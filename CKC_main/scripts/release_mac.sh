#!/usr/bin/env bash
set -euo pipefail

VERSION=""
BUMP="patch"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --bump)
      BUMP="${2:-patch}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

dirty="$(git status --porcelain)"
if [[ -n "${dirty:-}" ]]; then
  echo "Working tree not clean. Commit/stash changes first." >&2
  echo "$dirty" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "Release builds must run from branch 'main' (current: '$branch')." >&2
  exit 1
fi

echo "Bumping version..."
if [[ -n "$VERSION" ]]; then
  npm version "$VERSION" --no-git-tag-version >/dev/null
else
  npm version "$BUMP" --no-git-tag-version >/dev/null
fi

ver="$(node -p "require('./package.json').version")"
if [[ -z "$ver" ]]; then
  echo "Failed to read version from package.json" >&2
  exit 1
fi
tag="v$ver"

git add -- package.json package-lock.json
git commit -m "release: $tag" >/dev/null
git tag "$tag"

echo "Packaging macOS artifacts..."
npm run package:mac:raw

echo "Pushing commit + tag..."
git push origin "$branch"
git push origin "$tag"

echo "Done. Tag pushed: $tag"

