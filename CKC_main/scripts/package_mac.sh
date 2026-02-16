#!/usr/bin/env bash
set -euo pipefail

ARCH=""
GOV_ROOT="${CKC_GOV_ROOT:-}"
KIND=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      ARCH="${2:-}"
      shift 2
      ;;
    --gov-root)
      GOV_ROOT="${2:-}"
      shift 2
      ;;
    --kind)
      KIND="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "$GOV_ROOT" ]]; then
  GOV_ROOT="$(cd "$repo_root/../CKC_GOV" && pwd)"
fi

mkdir -p "$GOV_ROOT"

cache_root="$GOV_ROOT/targets/cache"
ckc_targets="$GOV_ROOT/targets/CKC"

export npm_config_cache="$cache_root/npm"
export ELECTRON_CACHE="$cache_root/electron"
export ELECTRON_BUILDER_CACHE="$cache_root/electron-builder"

pkg_version="$(node -p "require('$repo_root/package.json').version")"
base_version="$(echo "$pkg_version" | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+).*$/\1/')"
if [[ -z "$base_version" ]]; then
  base_version="$pkg_version"
fi

git_sha="nogit"
if command -v git >/dev/null 2>&1; then
  git_sha="$(git -C "$repo_root" rev-parse --short HEAD 2>/dev/null || echo "nogit")"
  dirty="$(git -C "$repo_root" status --porcelain 2>/dev/null || true)"
  if [[ -n "${dirty:-}" ]]; then
    echo "Working tree not clean. Commit/stash changes before packaging." >&2
    echo "$dirty" >&2
    exit 1
  fi
fi

exact_tag=""
if command -v git >/dev/null 2>&1; then
  exact_tag="$(git -C "$repo_root" describe --tags --exact-match 2>/dev/null || true)"
fi

if [[ -z "$exact_tag" && "${GITHUB_REF_TYPE:-}" == "tag" && -n "${GITHUB_REF_NAME:-}" ]]; then
  exact_tag="${GITHUB_REF_NAME}"
fi

release_version=""
if [[ "$exact_tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$ ]]; then
  release_version="${BASH_REMATCH[1]}"
fi

if [[ -z "$KIND" ]]; then
  if [[ -n "$release_version" ]]; then
    KIND="release"
  else
    KIND="dev"
  fi
fi

effective_version="$pkg_version"
if [[ "$KIND" == "release" ]]; then
  if [[ -z "$release_version" ]]; then
    echo "Release build requested but current commit is not tagged like vX.Y.Z (got: '$exact_tag')." >&2
    exit 1
  fi
  effective_version="$release_version"
else
  effective_version="$base_version"
fi

stamp_folder="$(date +"%Y-%m-%d_%H%M%S")"
if [[ "$KIND" == "dev" ]]; then
  build_id="dev__${stamp_folder}__${git_sha}"
  artifacts_rel_parts=("dev" "$build_id")
else
  build_id="v${effective_version}"
  artifacts_rel_parts=("releases" "v${effective_version}")
fi

stage_root="$ckc_targets/stage/$build_id"
artifacts_root="$ckc_targets/artifacts/${artifacts_rel_parts[0]}/${artifacts_rel_parts[1]}"

mkdir -p "$stage_root" "$artifacts_root"

echo "CKC packaging (macOS) - $KIND - $build_id"
echo "Version:   $effective_version"
echo "Stage:     $stage_root"
echo "Artifacts: $artifacts_root"

rm -rf "$stage_root/app" "$stage_root/dist"
cp -R "$repo_root/app" "$stage_root/app"

pushd "$repo_root" >/dev/null
  npx --no-install vite build --outDir "$stage_root/dist" --emptyOutDir
  index_path="$stage_root/dist/index.html"
  if [[ ! -f "$index_path" ]]; then
    echo "Missing renderer entry: $index_path" >&2
    exit 1
  fi
  if grep -qE 'src="/assets/|href="/assets/' "$index_path"; then
    echo "Renderer build emitted absolute /assets paths. Set Vite base to './' to avoid a white window in packaged Electron." >&2
    exit 1
  fi
popd >/dev/null

export CKC_STAGE_ROOT="$stage_root"
export CKC_REPO_ROOT="$repo_root"
export CKC_EFFECTIVE_VERSION="$effective_version"
export CKC_ARTIFACTS_REL_PARTS_JSON="$(
  printf '%s\n' "${artifacts_rel_parts[@]}" | node -e "const fs=require('fs'); const parts=fs.readFileSync(0,'utf8').split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean); process.stdout.write(JSON.stringify(parts));"
)"

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.env.CKC_REPO_ROOT;
const stageRoot = process.env.CKC_STAGE_ROOT;
const effectiveVersion = process.env.CKC_EFFECTIVE_VERSION;
const artifactsRelParts = JSON.parse(process.env.CKC_ARTIFACTS_REL_PARTS_JSON || '[]');

if (!repoRoot || !stageRoot || !effectiveVersion) throw new Error('Missing required env vars');

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
let electronVersion = String(pkg?.devDependencies?.electron || '').replace(/^[^0-9]*/, '');
if (!electronVersion) electronVersion = '34.2.0';

const stagePkg = {
  name: String(pkg.name || 'castkit-codex'),
  version: String(effectiveVersion),
  private: true,
  main: 'app/main.js',
  dependencies: {
    sqlite3: String(pkg?.dependencies?.sqlite3 || '^5.1.7'),
  },
  overrides: {
    tar: '7.5.7',
  },
  build: {
    appId: 'com.nuntissura.castkitcodex',
    productName: 'CastKit Codex',
    electronVersion,
    directories: {
      output: path.join('..', '..', 'artifacts', ...artifactsRelParts),
    },
    files: ['app/**/*', 'dist/**/*', 'node_modules/**/*', 'package.json'],
    asar: true,
    asarUnpack: ['**/*.node'],
    mac: {
      target: ['dmg', 'zip'],
      category: 'public.app-category.productivity',
      hardenedRuntime: false,
      gatekeeperAssess: false,
    },
    dmg: {
      contents: [
        { x: 130, y: 220 },
        { x: 410, y: 220, type: 'link', path: '/Applications' },
      ],
    },
  },
};

fs.writeFileSync(path.join(stageRoot, 'package.json'), JSON.stringify(stagePkg, null, 2), 'utf8');
NODE

pushd "$stage_root" >/dev/null
  npm install --omit=dev
popd >/dev/null

pushd "$repo_root" >/dev/null
  arch_args=()
  if [[ -n "$ARCH" ]]; then
    case "$ARCH" in
      x64|arm64)
        arch_args+=("--$ARCH")
        ;;
      *)
        echo "Unsupported --arch: $ARCH (expected x64 or arm64)" >&2
        exit 2
        ;;
    esac
  fi
  npx electron-builder --projectDir "$stage_root" --mac "${arch_args[@]}"
popd >/dev/null

export CKC_ARTIFACTS_ROOT="$artifacts_root"
export CKC_BUILD_ID="$build_id"
export CKC_KIND="$KIND"
export CKC_PKG_VERSION="$pkg_version"
export CKC_GIT_SHA="$git_sha"
export CKC_GIT_TAG="$exact_tag"
export CKC_CREATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
export CKC_ARTIFACTS_REL_FROM_BASE="${artifacts_rel_parts[0]}/${artifacts_rel_parts[1]}"
export CKC_LATEST_INFO_PATH="$ckc_targets/artifacts/LATEST_BUILD.txt"

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const artifactsRoot = process.env.CKC_ARTIFACTS_ROOT;
const buildId = process.env.CKC_BUILD_ID;
const kind = process.env.CKC_KIND;
const version = process.env.CKC_EFFECTIVE_VERSION;
const sourceVersion = process.env.CKC_PKG_VERSION;
const gitSha = process.env.CKC_GIT_SHA;
const gitTag = process.env.CKC_GIT_TAG || '';
const createdAt = process.env.CKC_CREATED_AT;
const artifactsRel = process.env.CKC_ARTIFACTS_REL_FROM_BASE;
const latestInfoPath = process.env.CKC_LATEST_INFO_PATH;

if (!artifactsRoot || !buildId || !kind || !version || !sourceVersion || !createdAt || !artifactsRel || !latestInfoPath) {
  throw new Error('Missing required env vars for manifest generation');
}

const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const topFiles = fs
  .readdirSync(artifactsRoot, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const manifest = {
  buildId,
  kind,
  version,
  sourceVersion,
  gitSha,
  gitTag: gitTag || null,
  createdAt,
  artifacts: path.join('CKC_GOV', 'targets', 'CKC', 'artifacts', artifactsRel),
  files: topFiles.map((name) => {
    const abs = path.join(artifactsRoot, name);
    const st = fs.statSync(abs);
    const hash = sha256Hex(fs.readFileSync(abs));
    return { name, sizeBytes: st.size, sha256: hash };
  }),
};

const buildInfoText = [
  `buildId: ${buildId}`,
  `kind: ${kind}`,
  `version: ${version}`,
  `sourceVersion: ${sourceVersion}`,
  `gitSha: ${gitSha || ''}`,
  gitTag ? `gitTag: ${gitTag}` : null,
  `createdAt: ${createdAt}`,
  '',
]
  .filter(Boolean)
  .join('\n');
fs.writeFileSync(path.join(artifactsRoot, 'BUILD_INFO.txt'), buildInfoText, 'utf8');

fs.writeFileSync(path.join(artifactsRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const shaLines = manifest.files.map((f) => `${f.sha256}  ${f.name}`).join('\n') + '\n';
fs.writeFileSync(path.join(artifactsRoot, 'SHA256SUMS.txt'), shaLines, 'utf8');

const latestInfo = [
  `buildId: ${buildId}`,
  `kind: ${kind}`,
  `version: ${version}`,
  `sourceVersion: ${sourceVersion}`,
  `gitSha: ${gitSha || ''}`,
  gitTag ? `gitTag: ${gitTag}` : null,
  `createdAt: ${createdAt}`,
  `artifacts: ${artifactsRel}`,
  `manifest: ${artifactsRel}/manifest.json`,
  `sha256: ${artifactsRel}/SHA256SUMS.txt`,
  '',
]
  .filter(Boolean)
  .join('\n');

fs.mkdirSync(path.dirname(latestInfoPath), { recursive: true });
fs.writeFileSync(latestInfoPath, latestInfo, 'utf8');
NODE

echo "Done. Artifacts in: $artifacts_root"
echo "Updated:  $ckc_targets/artifacts/LATEST_BUILD.txt"
