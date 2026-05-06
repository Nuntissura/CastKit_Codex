// Read-only registry over CKC_GOV/references/external_app_data/specs/.
// Discovers workflow spec files by filename pattern, sorts by version,
// and exposes list/get/getLatest helpers. Pure module: no Electron, no
// app deps. main.js wraps these via automation commands.
//
// Filename convention: <whatever>_v<MAJOR>.<MINOR>.json. The trailing
// _v00.19 suffix immediately before .json is parsed as the version
// token; the prefix becomes the spec id derived from the file's own
// `spec_id` field (the spec content is canonical, the filename is a
// hint).

const fs = require('fs');
const path = require('path');

function getDefaultSpecsDir() {
    // Resolve relative to the CKC_main repo: ../CKC_GOV/references/external_app_data/specs/.
    // CKC_GOV path is governance, owned by the operator; tests can
    // override via the explicit `dir` parameter.
    const root = path.resolve(__dirname, '..', '..', '..', 'CKC_GOV', 'references', 'external_app_data', 'specs');
    return root;
}

const VERSION_TOKEN_RE = /_v(\d+)\.(\d+)$/;

function parseVersionToken(version) {
    const raw = String(version || '').trim();
    const stripped = raw.replace(/^v/, '');
    const m = /^(\d+)\.(\d+)$/.exec(stripped);
    if (!m) return null;
    return [Number(m[1]), Number(m[2])];
}

function compareVersions(a, b) {
    const va = parseVersionToken(a);
    const vb = parseVersionToken(b);
    if (!va && !vb) return 0;
    if (!va) return -1;
    if (!vb) return 1;
    if (va[0] !== vb[0]) return va[0] - vb[0];
    return va[1] - vb[1];
}

function readSpecFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(text);
    return json;
}

function listSpecFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.json')) continue;
        out.push(path.join(dir, entry.name));
    }
    return out;
}

function summarizeSpec(filePath) {
    const json = readSpecFile(filePath);
    const specId = String(json.spec_id || path.basename(filePath, '.json'));
    const specVersion = String(json.spec_version || '');
    const specStatus = String(json.spec_status || '');
    const fileName = path.basename(filePath);
    return {
        specId,
        specVersion,
        specStatus,
        fileName,
        filePath,
        schemaVersion: typeof json.schema_version === 'number' ? json.schema_version : null,
    };
}

function listWorkflowSpecs({ dir } = {}) {
    const root = dir || getDefaultSpecsDir();
    const files = listSpecFiles(root);
    const summaries = [];
    const errors = [];
    for (const filePath of files) {
        try {
            summaries.push(summarizeSpec(filePath));
        } catch (err) {
            errors.push({ filePath: path.basename(filePath), error: err instanceof Error ? err.message : String(err) });
        }
    }
    summaries.sort((a, b) => {
        if (a.specId !== b.specId) return a.specId.localeCompare(b.specId);
        return compareVersions(a.specVersion, b.specVersion);
    });
    return { ok: true, dir: root, specs: summaries, errors };
}

function getWorkflowSpec({ specId, version, dir } = {}) {
    const root = dir || getDefaultSpecsDir();
    if (!specId || !version) {
        throw new Error('getWorkflowSpec requires specId and version');
    }
    const files = listSpecFiles(root);
    for (const filePath of files) {
        try {
            const json = readSpecFile(filePath);
            if (String(json.spec_id || '') === String(specId) && String(json.spec_version || '') === String(version)) {
                return { ok: true, filePath, fileName: path.basename(filePath), spec: json };
            }
        } catch {
            // skip unreadable files
        }
    }
    throw new Error(`No workflow spec found for specId=${specId} version=${version} under ${root}`);
}

function getLatestWorkflowSpec({ specId, dir } = {}) {
    const root = dir || getDefaultSpecsDir();
    if (!specId) throw new Error('getLatestWorkflowSpec requires specId');
    const files = listSpecFiles(root);
    let bestVersion = null;
    let best = null;
    for (const filePath of files) {
        try {
            const json = readSpecFile(filePath);
            if (String(json.spec_id || '') !== String(specId)) continue;
            const v = String(json.spec_version || '');
            if (!parseVersionToken(v)) continue;
            if (bestVersion === null || compareVersions(v, bestVersion) > 0) {
                bestVersion = v;
                best = { filePath, fileName: path.basename(filePath), spec: json };
            }
        } catch {
            // skip unreadable files
        }
    }
    if (!best) throw new Error(`No workflow spec found for specId=${specId} under ${root}`);
    return { ok: true, ...best };
}

module.exports = {
    getDefaultSpecsDir,
    parseVersionToken,
    compareVersions,
    listWorkflowSpecs,
    getWorkflowSpec,
    getLatestWorkflowSpec,
};
