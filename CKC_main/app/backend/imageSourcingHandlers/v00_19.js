// v00.19 image-sourcing task handler. Pure module: no Electron, no DB
// access — produces a plan that the dispatcher hands to library helpers.
// The dispatcher (../imageSourcingAdapter.js) selects this handler when
// task_state.yaml.spec_version === 'v00.19'.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SPEC_VERSION = 'v00.19';
const VALID_LANES = new Set(['raw', 'accepted', 'pending', 'rejected']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

function deriveTaskId(taskRootPath) {
    return path.basename(String(taskRootPath || '').replace(/[\\/]+$/, ''));
}

function readYamlFileSafe(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    return yaml.load(text);
}

function readTaskState(taskRootPath, taskId) {
    const filePath = path.join(taskRootPath, `${taskId}.task_state.yaml`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing task_state at ${filePath}`);
    }
    const data = readYamlFileSafe(filePath) || {};
    return {
        filePath,
        datasetId: data.dataset_id == null ? null : String(data.dataset_id),
        taskId: data.task_id == null ? null : String(data.task_id),
        specVersion: data.spec_version == null ? null : String(data.spec_version),
        raw: data,
    };
}

function readTaskTopology(taskRootPath, taskId) {
    const filePath = path.join(taskRootPath, `${taskId}.task_topology.yaml`);
    if (!fs.existsSync(filePath)) return { filePath, raw: null };
    const data = readYamlFileSafe(filePath);
    return { filePath, raw: data };
}

function readTaskRequirements(taskRootPath, taskId) {
    const filePath = path.join(taskRootPath, `${taskId}.task_requirements.yaml`);
    if (!fs.existsSync(filePath)) return { filePath, text: '', raw: null };
    const text = fs.readFileSync(filePath, 'utf8');
    let raw = null;
    try { raw = yaml.load(text); } catch { raw = null; }
    return { filePath, text, raw };
}

// Resolve the lane folder. Tries task_topology.yaml first per
// RID-TOPOLOGY-005; falls back to the v00.19 convention intake/<lane>/.
function resolveLaneDir(taskRootPath, topology, lane) {
    const t = topology && topology.raw ? topology.raw : null;
    if (t && t.folders && typeof t.folders === 'object') {
        const key = `intake_${lane}`;
        const fromTopology = t.folders[key] || t.folders[lane];
        if (typeof fromTopology === 'string' && fromTopology.length) {
            return path.join(taskRootPath, fromTopology);
        }
    }
    return path.join(taskRootPath, 'intake', lane);
}

function isLockHeld(taskRootPath, taskId) {
    const lockPath = path.join(taskRootPath, 'state', `${taskId}.run_state_lock.json`);
    if (!fs.existsSync(lockPath)) return { held: false, lockPath, raw: null };
    try {
        const text = fs.readFileSync(lockPath, 'utf8');
        const data = JSON.parse(text);
        // The lock is "held" when active === true (per v00.19 spec).
        // Any structurally present lock with active: false is fine.
        if (data && data.active === true) {
            return { held: true, lockPath, raw: data };
        }
        return { held: false, lockPath, raw: data };
    } catch (err) {
        // Malformed lock — treat as held to be safe; operator can clean up.
        return { held: true, lockPath, raw: null, parseError: err instanceof Error ? err.message : String(err) };
    }
}

function listLaneFiles(laneDir) {
    if (!fs.existsSync(laneDir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(laneDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;
        out.push(path.join(laneDir, entry.name));
    }
    return out;
}

function readMediaItemsIndex(taskRootPath, taskId) {
    // media_items.jsonl is one of the v00.19 artifacts; each line should
    // describe one media item. We index by basename (best-effort) to
    // associate source URLs with files in intake/<lane>/. Missing or
    // partial files are tolerated.
    const candidates = [
        path.join(taskRootPath, 'logs', `${taskId}.media_items.jsonl`),
        path.join(taskRootPath, 'state', `${taskId}.media_items.jsonl`),
        path.join(taskRootPath, `${taskId}.media_items.jsonl`),
    ];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) return { filePath: null, byBasename: new Map(), byPath: new Map() };

    const text = fs.readFileSync(filePath, 'utf8');
    const byBasename = new Map();
    const byPath = new Map();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row;
        try { row = JSON.parse(trimmed); } catch { continue; }
        if (!row || typeof row !== 'object') continue;
        const sourceUrl = row.source_url == null ? null : String(row.source_url);
        const basename = row.media_basename || row.basename || (row.media_path ? path.basename(String(row.media_path)) : null);
        const mediaPath = row.media_path == null ? null : String(row.media_path);
        const contactSheetRef = row.contact_sheet_ref == null ? null : String(row.contact_sheet_ref);
        const runId = row.run_id == null ? null : String(row.run_id);
        const entry = { sourceUrl, basename, mediaPath, contactSheetRef, runId };
        if (basename) byBasename.set(basename, entry);
        if (mediaPath) byPath.set(mediaPath, entry);
    }
    return { filePath, byBasename, byPath };
}

function readRejectManifestIndex(taskRootPath, taskId) {
    // reject_manifest.jsonl carries rejection_reason per item.
    const candidates = [
        path.join(taskRootPath, 'logs', `${taskId}.reject_manifest.jsonl`),
        path.join(taskRootPath, 'state', `${taskId}.reject_manifest.jsonl`),
        path.join(taskRootPath, `${taskId}.reject_manifest.jsonl`),
    ];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) return { filePath: null, byBasename: new Map(), byUrl: new Map() };

    const text = fs.readFileSync(filePath, 'utf8');
    const byBasename = new Map();
    const byUrl = new Map();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row;
        try { row = JSON.parse(trimmed); } catch { continue; }
        if (!row || typeof row !== 'object') continue;
        const sourceUrl = row.source_url == null ? null : String(row.source_url);
        const basename = row.media_basename || row.basename || (row.media_path ? path.basename(String(row.media_path)) : null);
        const reason = row.rejection_reason == null ? '' : String(row.rejection_reason);
        const entry = { sourceUrl, basename, reason };
        if (basename) byBasename.set(basename, entry);
        if (sourceUrl) byUrl.set(sourceUrl, entry);
    }
    return { filePath, byBasename, byUrl };
}

// Build a plan: read the task root, walk the requested lane, return
// per-file work units and the helper artifacts the dispatcher will use.
// This is pure (no library calls); the dispatcher executes the plan.
function buildIngestionPlan({ taskRootPath, lane }) {
    const taskId = deriveTaskId(taskRootPath);
    const state = readTaskState(taskRootPath, taskId);
    if (state.specVersion !== SPEC_VERSION) {
        throw new Error(`v00_19 handler refuses task with spec_version=${state.specVersion} (expected ${SPEC_VERSION})`);
    }
    const laneText = String(lane || 'accepted').trim();
    if (!VALID_LANES.has(laneText)) {
        throw new Error(`Unsupported lane: ${laneText}. Valid lanes: ${[...VALID_LANES].join(', ')}`);
    }

    const lock = isLockHeld(taskRootPath, taskId);
    if (lock.held) {
        throw new Error(`Task ${taskId} run_state_lock is held at ${lock.lockPath}; refusing to ingest`);
    }

    const topology = readTaskTopology(taskRootPath, taskId);
    const requirements = readTaskRequirements(taskRootPath, taskId);
    const laneDir = resolveLaneDir(taskRootPath, topology, laneText);

    const mediaIndex = readMediaItemsIndex(taskRootPath, taskId);
    const rejectIndex = laneText === 'rejected' ? readRejectManifestIndex(taskRootPath, taskId) : null;

    const laneFiles = listLaneFiles(laneDir);
    const items = [];
    for (const filePath of laneFiles) {
        const basename = path.basename(filePath);
        const meta = mediaIndex.byBasename.get(basename) || null;
        const reject = rejectIndex ? (rejectIndex.byBasename.get(basename) || null) : null;
        items.push({
            filePath,
            basename,
            sourceUrl: meta ? meta.sourceUrl : (reject ? reject.sourceUrl : null),
            contactSheetRef: meta ? meta.contactSheetRef : null,
            runId: meta ? meta.runId : null,
            rejectionReason: reject ? reject.reason : null,
        });
    }

    // task_tools/scripts/ — copied for accepted lane (and only when
    // requested). We collect candidate scripts here; the dispatcher
    // decides whether to copy based on the copyScripts flag.
    const scriptsDir = path.join(taskRootPath, 'task_tools', 'scripts');
    const scriptFiles = [];
    if (fs.existsSync(scriptsDir)) {
        for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            scriptFiles.push(path.join(scriptsDir, entry.name));
        }
    }

    const appSyncEventsPath = path.join(taskRootPath, 'app', `${taskId}.app_sync_events.jsonl`);

    return {
        specVersion: SPEC_VERSION,
        taskId,
        datasetId: state.datasetId,
        lane: laneText,
        laneDir,
        items,
        scriptFiles,
        scriptsDir,
        appSyncEventsPath,
        requirementsText: requirements.text,
        requirementsRaw: requirements.raw,
        topologyPath: topology.filePath,
        statePath: state.filePath,
    };
}

// Append one v00.19 app_sync_event line per processed image. Caller
// passes events as plain objects; we coerce to the schema-required shape.
function appendAppSyncEvents(appSyncEventsPath, events) {
    if (!Array.isArray(events) || events.length === 0) return 0;
    const dir = path.dirname(appSyncEventsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = events.map((e) => JSON.stringify(e));
    const payload = lines.join('\n') + '\n';
    fs.appendFileSync(appSyncEventsPath, payload, 'utf8');
    return events.length;
}

module.exports = {
    SPEC_VERSION,
    VALID_LANES,
    IMAGE_EXTS,
    deriveTaskId,
    buildIngestionPlan,
    appendAppSyncEvents,
};
