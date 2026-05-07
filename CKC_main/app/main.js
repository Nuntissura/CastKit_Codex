const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol, clipboard, globalShortcut } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { CKCLibrary } = require('./backend/library');
const { openAiChatCompletions } = require('./backend/llm');
const { createLibraryBackup, restoreLibraryBackup } = require('./backend/backup');
const { getAutomationManual } = require('./backend/automationManual');
const { AutomationControlPlane } = require('./backend/automationControl');
const { getAutomationCommandMap } = require('./backend/automationCommandMap');
const { startIntakeServer } = require('./backend/intakeServer');
const workflowSpecRegistry = require('./backend/workflowSpecRegistry');
const {
    getPendingFullResetMarkerPath,
    readPendingFullResetMarker,
    writePendingFullResetMarker,
    clearPreferenceFiles,
} = require('./backend/resetModes');
const {
    isBackgroundMode: isBackgroundModePure,
    assertBackgroundSafe: assertBackgroundSafePure,
    STEALTH_DIALOG_STUB,
} = require('./backend/automationStealth');

const CONFIG_FILE = 'ckc-config.json';

// Disable Chromium's native window-occlusion calculation. Without this,
// `webContents.capturePage()` returns 0x0 PNGs whenever the CKC window is
// fully occluded by another window — making operator-mode automation
// captures unusable when the agent is working from another window. Stealth
// mode is unaffected (the window is intentionally hidden but Chromium
// keeps painting).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'ckc',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
]);

function getPortableBaseDir() {
    const dir = process.env.PORTABLE_EXECUTABLE_DIR;
    if (!dir || typeof dir !== 'string') return null;
    const trimmed = dir.trim();
    return trimmed.length ? trimmed : null;
}

function getDefaultLibraryRoot() {
    const portableDir = getPortableBaseDir();
    if (portableDir) return path.join(portableDir, 'CastKit-Codex-Library');
    return path.join(app.getPath('userData'), 'CastKit-Codex-Library');
}

function getPrimaryConfigPath() {
    const portableDir = getPortableBaseDir();
    if (portableDir) return path.join(portableDir, CONFIG_FILE);
    return path.join(app.getPath('userData'), CONFIG_FILE);
}

function getFallbackUserDataConfigPath() {
    return path.join(app.getPath('userData'), CONFIG_FILE);
}

function loadConfig() {
    const primaryConfigPath = getPrimaryConfigPath();
    const fallbackConfigPath = getFallbackUserDataConfigPath();
    let configPath = primaryConfigPath;
    try {
        if (fs.existsSync(primaryConfigPath)) {
            const raw = fs.readFileSync(primaryConfigPath, 'utf8');
            return { configPath: primaryConfigPath, config: JSON.parse(raw) };
        }
        // Portable migration: if no portable config exists yet, but we have a userData config,
        // reuse it once and start saving into the portable location.
        if (primaryConfigPath !== fallbackConfigPath && fs.existsSync(fallbackConfigPath)) {
            const raw = fs.readFileSync(fallbackConfigPath, 'utf8');
            configPath = primaryConfigPath;
            const cfg = JSON.parse(raw);
            // Marker so we can make a good UX decision on first portable run.
            cfg._portableMigratedFromUserData = true;
            return { configPath, config: cfg };
        }
    } catch {
        // fall through to defaults
    }

    return {
        configPath,
        config: {
            libraryRoot: getDefaultLibraryRoot(),
            defaultTemplateId: 'v2.00',
            validationMode: 'strict',
            allowSaveWithErrors: false,
            automationBackground: false,
            database: {
                provider: 'postgres',
                host: '127.0.0.1',
                port: 5432,
                database: 'castkit_codex',
                user: 'castkit_codex',
                password: 'castkit_codex',
            },
            comfyui: {
                host: 'http://127.0.0.1:8188',
                intakePort: 52319,
                intakeToken: null,
            },
        },
    };
}

function normalizeConfig(config) {
    const cfg = config && typeof config === 'object' ? config : {};
    if (cfg.automationBackground === undefined) cfg.automationBackground = false;
    if (!cfg.database || typeof cfg.database !== 'object') {
        cfg.database = {};
    }
    const rawProvider = String(cfg.database.provider || '').trim().toLowerCase();
    if (!rawProvider) {
        cfg.database.provider = 'postgres';
    } else if (rawProvider === 'sqlite' || rawProvider === 'sqlite3') {
        cfg.database.provider = 'sqlite';
    }
    if (String(cfg.database.provider || '').trim().toLowerCase() === 'postgres') {
        cfg.database.host = cfg.database.host || '127.0.0.1';
        cfg.database.port = cfg.database.port || 5432;
        cfg.database.database = cfg.database.database || 'castkit_codex';
        cfg.database.user = cfg.database.user || 'castkit_codex';
        cfg.database.password = cfg.database.password || 'castkit_codex';
    }
    if (!cfg.comfyui || typeof cfg.comfyui !== 'object') cfg.comfyui = {};
    cfg.comfyui.host = String(cfg.comfyui.host || 'http://127.0.0.1:8188').trim() || 'http://127.0.0.1:8188';
    cfg.comfyui.intakePort = Math.max(1, Math.min(65535, Number(cfg.comfyui.intakePort) || 52319));
    cfg.comfyui.intakeToken = cfg.comfyui.intakeToken == null ? null : String(cfg.comfyui.intakeToken);
    return cfg;
}

function saveConfig(configPath, config) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function renderPdfFromHtml(html, printOpts = {}) {
    const win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    try {
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', ...printOpts });
        return pdf;
    } finally {
        win.close();
    }
}

async function writePdfFromText(text, outPath) {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 10.5px; }
      pre { white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(text)}</pre>
  </body>
</html>`;


    const pdf = await renderPdfFromHtml(html, { pageSize: 'A4' });
    fs.writeFileSync(outPath, pdf);
}

async function renderPdfFromPngBase64(pngBase64, { widthPx = 0, heightPx = 0 } = {}) {
    const base64 = String(pngBase64 ?? '').trim();
    if (!base64) throw new Error('pngBase64 is required');
    const prefix = 'data:image/png;base64,';
    const src = base64.startsWith(prefix) ? base64 : `${prefix}${base64}`;

    const w = Number(widthPx) || 0;
    const h = Number(heightPx) || 0;
    const landscape = w > 0 && h > 0 ? w > h : false;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { display: flex; align-items: center; justify-content: center; background: white; }
      img { width: 100vw; height: 100vh; object-fit: contain; }
    </style>
  </head>
  <body>
    <img src="${src}" alt="moodboard" />
  </body>
</html>`;

    return renderPdfFromHtml(html, { pageSize: 'A4', landscape });
}

let mainWindow = null;
let ckcLibrary = null;
let ckcLibraryInitPromise = null;
let appConfigPath = null;
let appConfig = null;
let referenceWindow = null;
let referenceSelection = { imageId: null };
let nearDupJobs = new Map();
let nearDupActiveJobId = null;
let libraryBackupJobs = new Map();
let libraryBackupActiveJobId = null;
let libraryRestoreJobs = new Map();
let libraryRestoreActiveJobId = null;
let aiTagJobs = new Map();
let aiTagActiveJobId = null;
const automationControl = new AutomationControlPlane();
let intakeServerHandle = null;
let intakeServerError = null;

// Bind the pure stealth helpers to process.env / appConfig /
// automationControl. Use these everywhere a code path is about to
// change visibility, focus, taskbar, or attention surfaces.
function isBackgroundMode() {
    return isBackgroundModePure(process.env, appConfig);
}
function assertBackgroundSafe(action, callsite) {
    return assertBackgroundSafePure(process.env, appConfig, action, callsite, automationControl);
}
async function safeShowMessageBox(opts, callsite) {
    if (!assertBackgroundSafe('dialog.showMessageBox', callsite)) {
        return STEALTH_DIALOG_STUB;
    }
    return dialog.showMessageBox(mainWindow, opts);
}
function safeRaiseMainWindow(callsite) {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (!assertBackgroundSafe('mainWindow.raise', callsite)) return false;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return true;
}
let automationRendererState = {
    route: 'library',
    selectedCharacterId: null,
    selectedImageId: null,
    drawerMode: 'none',
    overlays: {},
    updatedAt: null,
};
let automationCommandSeq = 1;
const automationPendingCommands = new Map();
let lastFullResetResult = null;

function looksLikeLibraryRoot(absPath) {
    try {
        if (!absPath || typeof absPath !== 'string') return false;
        if (!fs.existsSync(absPath)) return false;
        const dbPath = path.join(absPath, 'db', 'codex.db');
        const charactersDir = path.join(absPath, 'characters');
        return fs.existsSync(dbPath) || fs.existsSync(charactersDir);
    } catch {
        return false;
    }
}

function pathInsideDir(dirAbs, candidateAbs) {
    try {
        if (!dirAbs || !candidateAbs) return false;
        const dir = path.resolve(String(dirAbs));
        const candidate = path.resolve(String(candidateAbs));
        if (process.platform === 'win32') {
            const d = dir.toLowerCase();
            const c = candidate.toLowerCase();
            return c === d || c.startsWith(d + path.sep);
        }
        return candidate === dir || candidate.startsWith(dir + path.sep);
    } catch {
        return false;
    }
}

async function ensureLibraryRootAvailable() {
    const configured = String(appConfig?.libraryRoot || '').trim();
    const portableDir = getPortableBaseDir();
    const defaultRoot = getDefaultLibraryRoot();
    const nearExeCandidate = portableDir ? path.join(portableDir, 'CastKit-Codex-Library') : null;

    if (configured && fs.existsSync(configured)) {
        // Portable UX: if a portable build is pointing at a libraryRoot outside the portable folder,
        // ask once whether to keep it or switch to a near-exe library.
        if (
            portableDir &&
            !pathInsideDir(portableDir, configured) &&
            !String(appConfig?.portableLibraryChoice || '').trim()
        ) {
            const res = mainWindow
                ? await safeShowMessageBox({
                    type: 'question',
                    message: 'Portable build: choose where your data lives',
                    detail:
                        `Current data folder (libraryRoot):\n${configured}\n\n` +
                        `Portable default (next to this .exe):\n${defaultRoot}\n\n` +
                        `If you keep the current folder, exports will also write there (exports live under: libraryRoot\\exports).`,
                    buttons: ['Switch to portable default', 'Keep current folder', 'Pick folder...', 'Quit'],
                    defaultId: 0,
                    cancelId: 3,
                    noLink: true,
                }, 'ensureLibraryRootAvailable.portableChoice')
                : null;

            const choice = res ? res.response : 1;

            if (choice === 3) {
                app.quit();
                throw new Error('Library root selection cancelled (user quit).');
            }

            if (choice === 2) {
                const picked = await dialog.showOpenDialog(mainWindow, {
                    title: 'Select Library Root',
                    properties: ['openDirectory', 'createDirectory'],
                });
                if (picked.canceled || !picked.filePaths[0]) {
                    app.quit();
                    throw new Error('Library root selection cancelled (no folder selected).');
                }
                appConfig.libraryRoot = picked.filePaths[0];
                appConfig.portableLibraryChoice = 'picked';
                saveConfig(appConfigPath, appConfig);
                return;
            }

            if (choice === 0) {
                appConfig.libraryRoot = defaultRoot;
                appConfig.portableLibraryChoice = 'portable_default';
                saveConfig(appConfigPath, appConfig);
                return;
            }

            // Keep current
            appConfig.portableLibraryChoice = 'keep_external';
            saveConfig(appConfigPath, appConfig);
        }

        return;
    }

    // If portable and a near-exe candidate exists, prefer it automatically.
    if (nearExeCandidate && looksLikeLibraryRoot(nearExeCandidate)) {
        appConfig.libraryRoot = nearExeCandidate;
        saveConfig(appConfigPath, appConfig);
        return;
    }

    // Non-interactive fallback when no window yet: just use default.
    if (!mainWindow) {
        appConfig.libraryRoot = defaultRoot;
        saveConfig(appConfigPath, appConfig);
        return;
    }

    const missing = configured || '(not set)';
    const createLabel = portableDir ? `Create new next to portable .exe` : 'Create new at default location';
    const createDetail = portableDir ? defaultRoot : defaultRoot;

    const res = await safeShowMessageBox({
        type: 'warning',
        message: 'CastKit Codex library folder not found.',
        detail: `Configured libraryRoot:\n${missing}\n\nChoose an existing library root folder, or create a new one.\n\nDefault:\n${createDetail}`,
        buttons: ['Select existing…', createLabel, 'Quit'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
    }, 'ensureLibraryRootAvailable.libraryNotFound');

    if (res.response === 2) {
        app.quit();
        throw new Error('Library root missing (user quit).');
    }

    if (res.response === 1) {
        appConfig.libraryRoot = defaultRoot;
        saveConfig(appConfigPath, appConfig);
        return;
    }

    const picked = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Library Root',
        properties: ['openDirectory', 'createDirectory'],
    });
    if (picked.canceled || !picked.filePaths[0]) {
        app.quit();
        throw new Error('Library root missing (no folder selected).');
    }
    appConfig.libraryRoot = picked.filePaths[0];
    saveConfig(appConfigPath, appConfig);
}

function resetLibrary() {
    if (ckcLibrary) {
        ckcLibrary.close();
        ckcLibrary = null;
    }
    ckcLibraryInitPromise = null;
}

async function ensureLibrary() {
    if (ckcLibraryInitPromise) return ckcLibraryInitPromise;

    ckcLibraryInitPromise = (async () => {
        await ensureLibraryRootAvailable();
        if (ckcLibrary) return ckcLibrary;

        const builtInTemplatePath = path.join(__dirname, 'templates', 'CHARACTER_SHEET__v2.00.txt');
        ckcLibrary = new CKCLibrary({
            libraryRoot: appConfig.libraryRoot,
            builtInTemplatePath,
            defaultTemplateId: appConfig.defaultTemplateId,
            electronNativeImage: nativeImage,
            database: appConfig.database,
        });
        await ckcLibrary.initialize();
        return ckcLibrary;
    })();

    try {
        return await ckcLibraryInitPromise;
    } catch (err) {
        // If initialization fails, allow retry on next call.
        resetLibrary();
        throw err;
    }
}

function getFullResetMarkerPath() {
    return getPendingFullResetMarkerPath(path.dirname(appConfigPath || getPrimaryConfigPath()));
}

function resetPreferenceStorage() {
    return clearPreferenceFiles({
        userDataDir: app.getPath('userData'),
        configPath: appConfigPath || getPrimaryConfigPath(),
    });
}

async function startCkcIntakeServer() {
    if (intakeServerHandle) return intakeServerHandle;
    const token = String(process.env.CKC_INTAKE_TOKEN || appConfig?.comfyui?.intakeToken || '').trim() || null;
    const preferredPort = Number(process.env.CKC_INTAKE_PORT || appConfig?.comfyui?.intakePort || 52319) || 52319;
    intakeServerHandle = await startIntakeServer({
        preferredPort,
        maxPort: 52399,
        token,
        registerBundle: async (body) => {
            const lib = await ensureLibrary();
            return lib.registerComfyUIOutput(body);
        },
    });
    intakeServerError = null;
    return intakeServerHandle;
}

function stopCkcIntakeServer() {
    if (!intakeServerHandle) return;
    try {
        intakeServerHandle.stop();
    } catch {
        // best-effort shutdown
    }
    intakeServerHandle = null;
}

function makeNearDupJobId() {
    return `nd_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getNearDupJob(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return null;
    return nearDupJobs.get(id) || null;
}

function snapshotNearDupJob(job) {
    if (!job) return null;
    const status = String(job.status || 'running');
    return {
        ok: true,
        jobId: String(job.jobId),
        status,
        startedAt: String(job.startedAt),
        finishedAt: job.finishedAt ? String(job.finishedAt) : null,
        progress: job.progress && typeof job.progress === 'object' ? job.progress : null,
        error: job.error ? String(job.error) : null,
        result: status === 'done' ? job.result : null,
    };
}

function sanitizeAutomationState(state) {
    const raw = state && typeof state === 'object' ? state : {};
    return {
        route: String(raw.route || raw.page || 'library'),
        selectedCharacterId: raw.selectedCharacterId == null ? null : String(raw.selectedCharacterId),
        selectedImageId: raw.selectedImageId == null ? null : String(raw.selectedImageId),
        drawerMode: String(raw.drawerMode || 'none'),
        overlays: raw.overlays && typeof raw.overlays === 'object' ? raw.overlays : {},
        visibleControls: raw.visibleControls && typeof raw.visibleControls === 'object' ? raw.visibleControls : {},
        errors: Array.isArray(raw.errors) ? raw.errors.map((x) => String(x)) : [],
        updatedAt: new Date().toISOString(),
    };
}

function sanitizeCaptureLabel(label) {
    const raw = String(label || 'capture').trim() || 'capture';
    const safe = raw.replaceAll(/[^A-Za-z0-9_-]+/g, '_').replaceAll(/_+/g, '_').replaceAll(/^_+|_+$/g, '');
    return (safe || 'capture').slice(0, 80);
}

function getCkcRootCandidate() {
    const explicit = String(process.env.CKC_ROOT || '').trim();
    if (explicit) return explicit;
    return path.resolve(__dirname, '..', '..');
}

function getAutomationCaptureDir() {
    const root = getCkcRootCandidate();
    const govTargets = path.join(root, 'CKC_GOV', 'targets', 'CKC', 'automation_captures');
    if (fs.existsSync(path.join(root, 'CKC_GOV'))) return govTargets;
    const fallbackRoot = String(appConfig?.libraryRoot || app.getPath('userData'));
    return path.join(fallbackRoot, 'automation_captures');
}

async function captureViaDebugger() {
    // CDP fallback used when capturePage() returns a 0x0 image (typically
    // because Chromium's native-occlusion detection treated the window as
    // hidden despite the disable-features switch). Page.captureScreenshot
    // bypasses occlusion entirely.
    const wc = mainWindow.webContents;
    const wasAttached = wc.debugger.isAttached();
    if (!wasAttached) wc.debugger.attach('1.3');
    try {
        const result = await wc.debugger.sendCommand('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
        });
        const buf = Buffer.from(result.data, 'base64');
        return buf;
    } finally {
        if (!wasAttached) {
            try { wc.debugger.detach(); } catch { /* ignore */ }
        }
    }
}

async function captureAutomationPng({ label = 'capture', sessionId = null } = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available.');
    let image = await mainWindow.webContents.capturePage();
    let size = image.getSize();
    let pngBytes = null;
    if (!size.width || !size.height) {
        // Fallback to CDP Page.captureScreenshot if capturePage() returned an empty image.
        pngBytes = await captureViaDebugger();
        const fallbackImage = nativeImage.createFromBuffer(pngBytes);
        size = fallbackImage.getSize();
        image = fallbackImage;
    } else {
        pngBytes = image.toPNG();
    }
    const outDir = getAutomationCaptureDir();
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '').replace('T', '_').replace('Z', 'Z');
    const prefix = sessionId ? sanitizeCaptureLabel(sessionId) : 'no_session';
    const base = `${stamp}_${prefix}_${sanitizeCaptureLabel(label)}`;
    const pngPath = path.join(outDir, `${base}.png`);
    const jsonPath = path.join(outDir, `${base}.json`);
    fs.writeFileSync(pngPath, pngBytes);
    fs.writeFileSync(
        jsonPath,
        JSON.stringify(
            {
                ok: true,
                pngPath,
                width: size.width,
                height: size.height,
                sessionId,
                label,
                capturedAt: new Date().toISOString(),
                renderer: automationRendererState,
            },
            null,
            2
        ),
        'utf8'
    );
    return { ok: true, pngPath, jsonPath, width: size.width, height: size.height };
}

async function runBackendAutomationCommand(command, params) {
    const lib = await ensureLibrary();
    const name = String(command || '').trim();
    const p = params && typeof params === 'object' ? params : {};

    if (name === 'listCharacters') return lib.listCharacters(p);
    if (name === 'getCharacter') return lib.getCharacter(p.characterId);
    if (name === 'listGlobalCarouselImages') return lib.listGlobalCarouselImages(p);
    if (name === 'listPendingImages') return lib.listPendingImages(p);
    if (name === 'importImages') return lib.importImages(p);
    if (name === 'setImageMeta') return lib.setImageMeta(p);
    if (name === 'setImagesMetaBatch') return lib.setImagesMetaBatch(p);
    if (name === 'scanIntakeFolder') return lib.scanIntakeFolder(p);
    if (name === 'classifyIntakeImage') return lib.classifyIntakeImage(p);
    if (name === 'createCharacter') return lib.createCharacter(p);
    if (name === 'saveCharacter') {
        return lib.saveCharacter({
            characterId: p.characterId,
            valuesById: p.valuesById,
            validationMode: p.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: p.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    }
    if (name === 'softDeleteCharacters') return lib.softDeleteCharacters(p);
    if (name === 'restoreCharacters') return lib.restoreCharacters(p);
    if (name === 'listTemplates') return lib.listTemplates();
    if (name === 'listAllTags') return lib.listAllTags();
    if (name === 'globalSearch') return lib.globalSearch(p);
    if (name === 'resetPreferences') return { ...resetPreferenceStorage(), restartRequired: true };
    if (name === 'requestFullReset') {
        const marker = writePendingFullResetMarker({
            markerPath: getFullResetMarkerPath(),
            libraryRoot: lib.libraryRoot,
            database: appConfig?.database || null,
        });
        const prefs = resetPreferenceStorage();
        return {
            ok: true,
            markerPath: marker.markerPath,
            libraryRoot: marker.libraryRoot,
            deleted: prefs.deleted,
            failed: prefs.failed || [],
            restartRequired: true,
        };
    }
    if (name === 'listOrphanManifests') return lib.listOrphanManifests(p);
    if (name === 'adoptOrphanImages') return lib.adoptOrphanImages(p);

    // WP-0107: Pose/Rig/Workflow storage commands.
    if (name === 'listRigs') return lib.listRigs(p);
    if (name === 'getRig') return lib.getRig(p);
    if (name === 'createRig') return lib.createRig(p);
    if (name === 'updateRigCalibration') return lib.updateRigCalibration(p);
    if (name === 'setRigPortrait') return lib.setRigPortrait(p);
    if (name === 'updateRigPose') return lib.updateRigPose(p);
    if (name === 'exportOpenposePng') return lib.exportOpenposePng(p);
    if (name === 'registerComfyUIOutput') return lib.registerComfyUIOutput(p);
    if (name === 'getWorkflowHistory') return lib.getWorkflowHistory(p);
    if (name === 'extractPromptFromWorkflow') return lib.extractPromptFromWorkflow(p);
    if (name === 'replayWorkflow') return lib.replayWorkflow({ ...p, host: p.host || appConfig?.comfyui?.host });
    if (name === 'getComfyUIStats') return lib.getComfyUIStats({ host: p.host || appConfig?.comfyui?.host });
    if (name === 'listPrompts') return lib.listPrompts(p);
    if (name === 'upsertPrompt') return lib.upsertPrompt(p);
    if (name === 'deletePrompt') return lib.deletePrompt(p);
    if (name === 'listStoryBeats') return lib.listStoryBeats(p);
    if (name === 'upsertStoryBeat') return lib.upsertStoryBeat(p);
    if (name === 'deleteStoryBeat') return lib.deleteStoryBeat(p);

    // WP-0100: workflow spec registry (fs-backed, no DB)
    if (name === 'listWorkflowSpecs') return workflowSpecRegistry.listWorkflowSpecs(p);
    if (name === 'getWorkflowSpec') return workflowSpecRegistry.getWorkflowSpec(p);
    if (name === 'getLatestWorkflowSpec') return workflowSpecRegistry.getLatestWorkflowSpec(p);

    // WP-0100: per-character image-sourcing scripts
    if (name === 'listCharacterScripts') return lib.listCharacterScripts(p);
    if (name === 'getCharacterScript') return lib.getCharacterScript(p);
    if (name === 'addCharacterScript') return lib.addCharacterScript(p);
    if (name === 'removeCharacterScript') return lib.removeCharacterScript(p);

    // WP-0100: ingestion audit reads (writes happen inside the slice-2 adapter)
    if (name === 'listIngestionBatches') return lib.listIngestionBatches(p);
    if (name === 'getIngestionBatch') return lib.getIngestionBatch(p);
    if (name === 'listIngestionRejections') return lib.listIngestionRejections(p);

    // WP-0100 slice 2: v00.19 image-sourcing ingestion adapter
    if (name === 'ingestImageSourcingTask') return lib.ingestImageSourcingTask(p);

    throw new Error(`Unsupported backend automation command: ${name}`);
}

// Allowed mouse button labels for sendInputEvent.
const SYNTHETIC_MOUSE_BUTTONS = new Set(['left', 'right', 'middle']);
// Allowed event types for keyboard synthetic input.
const SYNTHETIC_KEY_TYPES = new Set(['keyDown', 'keyUp', 'char']);
// Allowed event types for mouse synthetic input.
const SYNTHETIC_MOUSE_TYPES = new Set([
    'mouseDown',
    'mouseUp',
    'mouseEnter',
    'mouseLeave',
    'mouseMove',
    'contextMenu',
]);

function sanitizeSyntheticModifiers(input) {
    if (!Array.isArray(input)) return [];
    const allowed = new Set(['shift', 'control', 'alt', 'meta', 'isKeypad', 'isAutoRepeat', 'leftButtonDown', 'middleButtonDown', 'rightButtonDown', 'capsLock', 'numLock', 'left', 'right']);
    return input.filter((m) => typeof m === 'string' && allowed.has(m));
}

// Window-scoped synthetic input. Routes only through
// mainWindow.webContents.sendInputEvent — no OS-level keyboard or mouse
// libraries, no focus stealing, no cursor movement. The test
// automation_input_injection_invariants.test.js pins this contract.
function runSyntheticKey(params) {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available.');
    const p = params && typeof params === 'object' ? params : {};
    const type = String(p.type || 'char');
    if (!SYNTHETIC_KEY_TYPES.has(type)) throw new Error(`injectKey: type must be one of keyDown/keyUp/char (got ${type})`);
    const keyCode = String(p.keyCode || p.key || '');
    if (!keyCode) throw new Error('injectKey: keyCode (or key) is required');
    const modifiers = sanitizeSyntheticModifiers(p.modifiers);
    mainWindow.webContents.sendInputEvent({ type, keyCode, modifiers });
    return { ok: true, type, keyCode, modifiers };
}

function runSyntheticMouse(params) {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available.');
    const p = params && typeof params === 'object' ? params : {};
    const type = String(p.type || 'mouseMove');
    if (!SYNTHETIC_MOUSE_TYPES.has(type)) throw new Error(`injectMouse: type must be a mouse event type (got ${type})`);
    const x = Number.isFinite(p.x) ? Math.max(0, Math.floor(p.x)) : 0;
    const y = Number.isFinite(p.y) ? Math.max(0, Math.floor(p.y)) : 0;
    const button = SYNTHETIC_MOUSE_BUTTONS.has(p.button) ? p.button : 'left';
    const clickCount = Number.isFinite(p.clickCount) ? Math.max(1, Math.min(3, Math.floor(p.clickCount))) : 1;
    const modifiers = sanitizeSyntheticModifiers(p.modifiers);
    mainWindow.webContents.sendInputEvent({ type, x, y, button, clickCount, modifiers });
    return { ok: true, type, x, y, button, clickCount, modifiers };
}

function runRendererAutomationCommand(command, params = {}, timeoutMs = 15000) {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available.');
    const name = String(command || '').trim();
    if (!name) throw new Error('command is required');

    // Low-level synthetic input is fulfilled in the main process via
    // sendInputEvent; no renderer round-trip needed. clickElement and
    // typeText still round-trip because they need DOM access.
    if (name === 'injectKey') return Promise.resolve(runSyntheticKey(params));
    if (name === 'injectMouse') return Promise.resolve(runSyntheticMouse(params));

    const id = `auto_${automationCommandSeq++}_${Date.now()}`;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            automationPendingCommands.delete(id);
            reject(new Error(`Automation command timed out: ${name}`));
        }, Math.max(1000, Math.min(120000, Number(timeoutMs) || 15000)));

        automationPendingCommands.set(id, {
            resolve: (payload) => {
                clearTimeout(timer);
                resolve(payload);
            },
            reject: (err) => {
                clearTimeout(timer);
                reject(err);
            },
        });

        mainWindow.webContents.send('ckc:automationCommand', { id, command: name, params });
    });
}

async function runNearDuplicateScanJob(job, params) {
    const p = params && typeof params === 'object' ? params : {};
    const threshold = typeof p.threshold === 'number' ? p.threshold : Number(p.threshold) || 10;
    const maxImages = typeof p.maxImages === 'number' ? p.maxImages : Number(p.maxImages) || 2500;
    const maxPerGroup = typeof p.maxPerGroup === 'number' ? p.maxPerGroup : Number(p.maxPerGroup) || 60;

    try {
        const lib = await ensureLibrary();
        const res = await lib.scanNearDuplicateGroups({
            threshold,
            maxImages,
            maxPerGroup,
            onProgress: (prog) => {
                if (!job || job.cancelRequested) return;
                const phase = String(prog?.phase || '').trim() || 'working';
                const done = Number(prog?.done) || 0;
                const total = Number(prog?.total) || 0;
                job.progress = { phase, done, total };
            },
            isCancelled: () => !!job.cancelRequested,
        });

        if (job.cancelRequested || res?.cancelled) {
            job.status = 'cancelled';
            job.result = null;
        } else {
            job.status = 'done';
            job.result = res;
        }
    } catch (err) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        job.result = null;
    } finally {
        job.finishedAt = new Date().toISOString();
        if (nearDupActiveJobId === job.jobId) nearDupActiveJobId = null;
    }
}

function makeLibraryBackupJobId() {
    return `bk_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getLibraryBackupJob(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return null;
    return libraryBackupJobs.get(id) || null;
}

function snapshotLibraryBackupJob(job) {
    if (!job) return null;
    const status = String(job.status || 'running');
    return {
        ok: true,
        jobId: String(job.jobId),
        status,
        startedAt: String(job.startedAt),
        finishedAt: job.finishedAt ? String(job.finishedAt) : null,
        progress: job.progress && typeof job.progress === 'object' ? job.progress : null,
        error: job.error ? String(job.error) : null,
        result: status === 'done' ? job.result : null,
    };
}

async function runLibraryBackupJob(job, params) {
    const p = params && typeof params === 'object' ? params : {};
    const outDirBase = p.outDirBase == null ? null : String(p.outDirBase);
    const backupName = p.backupName == null ? null : String(p.backupName);

    try {
        const lib = await ensureLibrary();
        const res = await createLibraryBackup({
            libraryRoot: lib.libraryRoot,
            db: lib.db,
            outDirBase,
            backupName,
            onProgress: (prog) => {
                if (!job || job.cancelRequested) return;
                const phase = String(prog?.phase || '').trim() || 'working';
                const done = Number(prog?.done) || 0;
                const total = Number(prog?.total) || 0;
                job.progress = { phase, done, total };
            },
            isCancelled: () => !!job.cancelRequested,
        });

        if (job.cancelRequested) {
            job.status = 'cancelled';
            job.result = null;
        } else {
            job.status = 'done';
            job.result = { ok: true, destLibraryRoot: res.destLibraryRoot, fileCount: res.fileCount };
        }
    } catch (err) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        job.result = null;
    } finally {
        job.finishedAt = new Date().toISOString();
        if (libraryBackupActiveJobId === job.jobId) libraryBackupActiveJobId = null;
    }
}

function makeLibraryRestoreJobId() {
    return `rs_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getLibraryRestoreJob(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return null;
    return libraryRestoreJobs.get(id) || null;
}

function snapshotLibraryRestoreJob(job) {
    if (!job) return null;
    const status = String(job.status || 'running');
    return {
        ok: true,
        jobId: String(job.jobId),
        status,
        startedAt: String(job.startedAt),
        finishedAt: job.finishedAt ? String(job.finishedAt) : null,
        progress: job.progress && typeof job.progress === 'object' ? job.progress : null,
        error: job.error ? String(job.error) : null,
        result: status === 'done' ? job.result : null,
    };
}

async function runLibraryRestoreJob(job, params) {
    const p = params && typeof params === 'object' ? params : {};
    const backupDir = String(p.backupDir || '').trim();
    const destLibraryRoot = String(p.destLibraryRoot || '').trim();
    const allowOverwrite = !!p.allowOverwrite;
    const confirmToken = p.confirmToken == null ? null : String(p.confirmToken);

    try {
        if (!backupDir) throw new Error('backupDir is required');
        if (!destLibraryRoot) throw new Error('destLibraryRoot is required');

        const lib = await ensureLibrary();
        const res = await restoreLibraryBackup({
            backupDir,
            destLibraryRoot,
            currentLibraryRoot: lib.libraryRoot,
            allowOverwrite,
            confirmToken,
            onProgress: (prog) => {
                if (!job || job.cancelRequested) return;
                const phase = String(prog?.phase || '').trim() || 'working';
                const done = Number(prog?.done) || 0;
                const total = Number(prog?.total) || 0;
                job.progress = { phase, done, total };
            },
            isCancelled: () => !!job.cancelRequested,
        });

        if (job.cancelRequested) {
            job.status = 'cancelled';
            job.result = null;
        } else {
            job.status = 'done';
            job.result = res;
        }
    } catch (err) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        job.result = null;
    } finally {
        job.finishedAt = new Date().toISOString();
        if (libraryRestoreActiveJobId === job.jobId) libraryRestoreActiveJobId = null;
    }
}

function makeAiTagJobId() {
    return `ai_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getAiTagJob(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return null;
    return aiTagJobs.get(id) || null;
}

function snapshotAiTagJob(job) {
    if (!job) return null;
    const status = String(job.status || 'running');
    return {
        ok: true,
        jobId: String(job.jobId),
        status,
        startedAt: String(job.startedAt),
        finishedAt: job.finishedAt ? String(job.finishedAt) : null,
        progress: job.progress && typeof job.progress === 'object' ? job.progress : null,
        error: job.error ? String(job.error) : null,
        result: status === 'done' ? job.result : null,
    };
}

function getAiTaggingConfig() {
    const ai = appConfig?.aiTagging && typeof appConfig.aiTagging === 'object' ? appConfig.aiTagging : {};
    const llm = appConfig?.llm && typeof appConfig.llm === 'object' ? appConfig.llm : {};

    const baseUrl = typeof ai.baseUrl === 'string' ? ai.baseUrl : typeof llm.baseUrl === 'string' ? llm.baseUrl : '';
    const model = typeof ai.model === 'string' ? ai.model : typeof llm.model === 'string' ? llm.model : '';
    const apiKey = typeof ai.apiKey === 'string' ? ai.apiKey : typeof llm.apiKey === 'string' ? llm.apiKey : '';

    const timeoutSecRaw =
        typeof ai.timeoutSec === 'number'
            ? ai.timeoutSec
            : typeof llm.timeoutSec === 'number'
              ? llm.timeoutSec
              : NaN;
    const timeoutSec = Number.isFinite(timeoutSecRaw) ? timeoutSecRaw : 900;
    const clampedTimeoutSec = Math.max(5, Math.min(7200, timeoutSec));

    const maxTagsRaw = typeof ai.maxTags === 'number' ? ai.maxTags : NaN;
    const maxTags = Number.isFinite(maxTagsRaw) ? Math.max(1, Math.min(200, Math.round(maxTagsRaw))) : 24;

    const maxImagePxRaw = typeof ai.maxImagePx === 'number' ? ai.maxImagePx : NaN;
    const maxImagePx = Number.isFinite(maxImagePxRaw) ? Math.max(128, Math.min(2048, Math.round(maxImagePxRaw))) : 512;

    return {
        baseUrl,
        model,
        apiKey,
        timeoutMs: Math.round(clampedTimeoutSec * 1000),
        autoOnImport: !!ai.autoOnImport,
        maxTags,
        maxImagePx,
    };
}

function imagePathToPngDataUrl(absPath, { maxImagePx = 512 } = {}) {
    const img = nativeImage.createFromPath(String(absPath || ''));
    if (!img || img.isEmpty()) throw new Error('Failed to load image for AI tagging.');

    const size = img.getSize();
    const w = Number(size?.width) || 0;
    const h = Number(size?.height) || 0;

    let resized = img;
    const maxDim = Math.max(w, h);
    if (maxDim > 0 && maxDim > maxImagePx) {
        resized = w >= h ? img.resize({ width: maxImagePx }) : img.resize({ height: maxImagePx });
    }

    const png = resized.toPNG();
    if (!png || png.length === 0) throw new Error('Failed to encode image for AI tagging.');
    return `data:image/png;base64,${png.toString('base64')}`;
}

function parseAiTagSuggestionsFromText(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return [];

    const tryParse = (s) => {
        try {
            return JSON.parse(s);
        } catch {
            return null;
        }
    };

    const direct = tryParse(raw);
    let parsed = direct;

    if (parsed == null) {
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            parsed = tryParse(raw.slice(firstBrace, lastBrace + 1));
        }
    }

    if (parsed == null) {
        const firstBr = raw.indexOf('[');
        const lastBr = raw.lastIndexOf(']');
        if (firstBr !== -1 && lastBr !== -1 && lastBr > firstBr) {
            parsed = tryParse(raw.slice(firstBr, lastBr + 1));
        }
    }

    if (parsed == null) return [];
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        const tags = parsed.tags;
        if (Array.isArray(tags)) return tags;
        const suggestions = parsed.suggestions;
        if (Array.isArray(suggestions)) return suggestions;
    }
    return [];
}

async function suggestImageTags({ imageId } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const cfg = getAiTaggingConfig();
    if (!String(cfg.baseUrl || '').trim()) throw new Error('AI tagging base URL is not configured (Tools → Local model).');
    if (!String(cfg.model || '').trim()) throw new Error('AI tagging model is not configured (Tools → Local model).');

    const lib = await ensureLibrary();
    const absPath = await lib.getImageAbsPath({ imageId: id, kind: 'original' });
    if (!absPath || !fs.existsSync(absPath)) throw new Error('Image file not found on disk.');

    const dataUrl = imagePathToPngDataUrl(absPath, { maxImagePx: cfg.maxImagePx });

    const userText = [
        `Suggest up to ${cfg.maxTags} tags for organizing this image in a reference library.`,
        `Rules: lowercase; 1-3 words per tag; no punctuation; no duplicates; no markdown.`,
        `Return ONLY JSON: {"tags":[{"tag":"...","confidence":0.0}]} where confidence is 0..1.`,
    ].join('\n');

    const messages = [
        {
            role: 'system',
            content: 'You generate concise tags for images. You must return only valid JSON. No prose.',
        },
        {
            role: 'user',
            content: [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: dataUrl } },
            ],
        },
    ];

    const res = await openAiChatCompletions({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages,
        temperature: 0.2,
        maxTokens: 600,
        timeoutMs: cfg.timeoutMs,
    });

    const rawSuggestions = parseAiTagSuggestionsFromText(res.text);
    if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
        throw new Error('AI tagging returned no suggestions. Try a different vision-capable model.');
    }

    return await lib.setImageTagSuggestions({ imageId: id, suggestions: rawSuggestions });
}

async function runAiTaggingJob(job, params) {
    const p = params && typeof params === 'object' ? params : {};
    const mode = String(p.mode ?? 'untagged').trim().toLowerCase();
    const limit = typeof p.limit === 'number' ? p.limit : Number(p.limit) || 250;
    const explicitIds = Array.isArray(p.imageIds) ? p.imageIds : null;

    try {
        const lib = await ensureLibrary();
        const ids = explicitIds
            ? explicitIds.map((x) => String(x ?? '').trim()).filter(Boolean)
            : await lib.listImageIdsForAiTagging({ mode, limit });

        job.progress = { phase: 'tagging', done: 0, total: ids.length, imageId: null };

        let processed = 0;
        let suggested = 0;
        let failed = 0;

        for (const imageId of ids) {
            if (job.cancelRequested) break;
            job.progress = { ...job.progress, done: processed, imageId };
            try {
                const res = await suggestImageTags({ imageId });
                const count = Array.isArray(res?.suggestions) ? res.suggestions.length : 0;
                if (count > 0) suggested += 1;
            } catch (err) {
                failed += 1;
                const msg = err instanceof Error ? err.message : String(err);
                job.error = msg;
            } finally {
                processed += 1;
                job.progress = { ...job.progress, done: processed, imageId };
            }
        }

        if (job.cancelRequested) {
            job.status = 'cancelled';
            job.result = null;
        } else {
            job.status = 'done';
            job.result = { ok: true, processed, suggested, failed, total: ids.length };
        }
    } catch (err) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        job.result = null;
    } finally {
        job.finishedAt = new Date().toISOString();
        if (aiTagActiveJobId === job.jobId) aiTagActiveJobId = null;
    }
}

function startAiTaggingJobInternal(params, { throwIfRunning = true } = {}) {
    if (aiTagActiveJobId) {
        const existing = getAiTagJob(aiTagActiveJobId);
        if (existing && String(existing.status) === 'running') {
            if (throwIfRunning) throw new Error('AI tagging job already running.');
            return null;
        }
        aiTagActiveJobId = null;
    }

    const jobId = makeAiTagJobId();
    const job = {
        jobId,
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        progress: { phase: 'starting', done: 0, total: 0, imageId: null },
        cancelRequested: false,
        error: null,
        result: null,
    };

    aiTagJobs.set(jobId, job);
    aiTagActiveJobId = jobId;
    void runAiTaggingJob(job, params || {});
    return jobId;
}

function maybeStartAutoAiTagging(imageIds) {
    const ids = Array.isArray(imageIds) ? imageIds.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
    if (ids.length === 0) return null;

    const cfg = getAiTaggingConfig();
    if (!cfg.autoOnImport) return null;
    if (!String(cfg.baseUrl || '').trim() || !String(cfg.model || '').trim()) return null;

    try {
        return startAiTaggingJobInternal({ imageIds: ids }, { throwIfRunning: false });
    } catch {
        return null;
    }
}

function contentTypeFromPath(filePath) {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.bmp') return 'image/bmp';
    return 'application/octet-stream';
}

function registerProtocolHandlers() {
    protocol.handle('ckc', async (request) => {
        try {
            const url = new URL(request.url);
            const host = String(url.hostname || '').toLowerCase();
            const imageId = decodeURIComponent(String(url.pathname || '').replace(/^\//, ''));

            if ((host !== 'image' && host !== 'thumb') || !imageId) {
                return new Response('Not found', { status: 404 });
            }

            const lib = await ensureLibrary();
            const absPath = await lib.getImageAbsPath({ imageId, kind: host === 'thumb' ? 'thumb' : 'original' });
            if (!absPath || !fs.existsSync(absPath)) {
                return new Response('Not found', { status: 404 });
            }

            const bytes = fs.readFileSync(absPath);
            return new Response(bytes, {
                status: 200,
                headers: {
                    'content-type': contentTypeFromPath(absPath),
                    'cache-control': 'private, max-age=31536000',
                },
            });
        } catch (err) {
            return new Response(String(err?.message || err || 'Internal error'), { status: 500 });
        }
    });
}

function createWindow() {
    const automationBackground = process.env.CKC_AUTOMATION_BACKGROUND === '1' || !!appConfig?.automationBackground;
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        show: !automationBackground,
        paintWhenInitiallyHidden: true,
        focusable: !automationBackground,
        skipTaskbar: automationBackground,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    if (automationBackground) {
        mainWindow.setMenuBarVisibility(false);
    }

    const isDev = !app.isPackaged;
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

function getReferenceWindowPrefs() {
    const rw = appConfig?.referenceWindow && typeof appConfig.referenceWindow === 'object' ? appConfig.referenceWindow : {};
    const opacityRaw = typeof rw.opacity === 'number' ? rw.opacity : NaN;
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0.15, Math.min(1, opacityRaw)) : 1;
    return {
        alwaysOnTop: !!rw.alwaysOnTop,
        clickThrough: !!rw.clickThrough,
        opacity,
    };
}

function sendReferenceSelection() {
    if (!referenceWindow || referenceWindow.isDestroyed()) return;
    referenceWindow.webContents.send('ckc:referenceSelection', { ...referenceSelection });
}

function sendReferenceWindowState() {
    if (!referenceWindow || referenceWindow.isDestroyed()) return;
    const prefs = getReferenceWindowPrefs();
    referenceWindow.webContents.send('ckc:referenceWindowState', {
        isOpen: true,
        imageId: referenceSelection.imageId ?? null,
        alwaysOnTop: !!prefs.alwaysOnTop,
        clickThrough: !!prefs.clickThrough,
        opacity: prefs.opacity,
    });
}

function createReferenceWindow() {
    // Reference window is a visible secondary window that can also be
    // setAlwaysOnTop. Both behaviors break the background stealth
    // contract, so refuse to create it in background mode.
    if (!assertBackgroundSafe('createReferenceWindow', 'createReferenceWindow')) {
        return null;
    }
    const prefs = getReferenceWindowPrefs();

    referenceWindow = new BrowserWindow({
        width: 980,
        height: 720,
        title: 'CKC Reference',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    referenceWindow.setMenuBarVisibility(false);
    referenceWindow.setAlwaysOnTop(!!prefs.alwaysOnTop);
    try {
        referenceWindow.setOpacity(prefs.opacity);
    } catch {
        // ignore (platform support)
    }
    try {
        referenceWindow.setIgnoreMouseEvents(!!prefs.clickThrough);
    } catch {
        // ignore
    }

    referenceWindow.on('closed', () => {
        referenceWindow = null;
    });

    referenceWindow.webContents.on('did-finish-load', () => {
        sendReferenceSelection();
        sendReferenceWindowState();
    });

    const isDev = !app.isPackaged;
    if (isDev) referenceWindow.loadURL('http://localhost:5173?ref=1');
    else referenceWindow.loadFile(path.join(__dirname, '../dist/index.html'), { search: '?ref=1' });
}

function toggleReferenceWindowClickThrough() {
    const prev = appConfig?.referenceWindow && typeof appConfig.referenceWindow === 'object' ? appConfig.referenceWindow : {};
    const next = { ...prev, clickThrough: !prev.clickThrough };
    appConfig = { ...appConfig, referenceWindow: next };
    saveConfig(appConfigPath, appConfig);
    if (referenceWindow && !referenceWindow.isDestroyed()) {
        try {
            referenceWindow.setIgnoreMouseEvents(!!next.clickThrough);
        } catch {
            // ignore
        }
        sendReferenceWindowState();
    }
}

function registerReferenceWindowShortcuts() {
    try {
        globalShortcut.unregister('CommandOrControl+Alt+T');
    } catch {
        // ignore
    }
    // Background mode forbids OS-level keyboard hooks because they can
    // intercept the operator's real keystrokes globally.
    if (!assertBackgroundSafe('globalShortcut.register', 'registerReferenceWindowShortcuts')) {
        return;
    }
    try {
        globalShortcut.register('CommandOrControl+Alt+T', () => {
            try {
                toggleReferenceWindowClickThrough();
            } catch {
                // ignore
            }
        });
    } catch {
        // ignore
    }
}

function registerIpcHandlers() {
    ipcMain.handle('ckc:automationSetRendererState', async (_evt, state) => {
        automationRendererState = sanitizeAutomationState(state);
        return { ok: true, state: automationRendererState };
    });

    ipcMain.handle('ckc:automationGetManual', async (_evt, params) => {
        return getAutomationManual(params || {});
    });

    ipcMain.handle('ckc:automationCreateSession', async (_evt, params) => {
        return automationControl.createSession(params || {});
    });

    ipcMain.handle('ckc:automationHeartbeat', async (_evt, params) => {
        return automationControl.heartbeat(params || {});
    });

    ipcMain.handle('ckc:automationEndSession', async (_evt, params) => {
        return automationControl.endSession(params || {});
    });

    ipcMain.handle('ckc:automationListSessions', async () => {
        return automationControl.listSessions();
    });

    ipcMain.handle('ckc:automationAcquireLease', async (_evt, params) => {
        return automationControl.acquireLease(params || {});
    });

    ipcMain.handle('ckc:automationReleaseLease', async (_evt, params) => {
        return automationControl.releaseLease(params || {});
    });

    ipcMain.handle('ckc:automationListLog', async (_evt, params) => {
        return automationControl.listLog(params || {});
    });

    ipcMain.handle('ckc:automationCommandResult', async (_evt, payload) => {
        const p = payload && typeof payload === 'object' ? payload : {};
        const id = String(p.id || '').trim();
        const pending = automationPendingCommands.get(id);
        if (!pending) return { ok: false, reason: 'unknown_command' };
        automationPendingCommands.delete(id);
        if (p.ok === false) {
            pending.reject(new Error(String(p.error || 'Automation command failed')));
        } else {
            pending.resolve(p.result ?? null);
        }
        return { ok: true };
    });

    ipcMain.handle('ckc:automationGetState', async () => {
        let diagnostics = null;
        try {
            const lib = await ensureLibrary();
            diagnostics = await lib.getDiagnostics({ quick: true });
            if (!intakeServerHandle) {
                try {
                    await startCkcIntakeServer();
                } catch (err) {
                    intakeServerError = err;
                }
            }
        } catch (err) {
            diagnostics = { ok: false, error: String(err?.message || err || 'Unknown error') };
        }

        return {
            ok: true,
            app: {
                configPath: appConfigPath,
                libraryRoot: appConfig?.libraryRoot || null,
                databaseProvider: appConfig?.database?.provider || 'postgres',
                comfyuiHost: appConfig?.comfyui?.host || 'http://127.0.0.1:8188',
                intakePort: intakeServerHandle?.port || null,
                intakeTokenRequired: !!intakeServerHandle?.tokenRequired,
                intakeError: intakeServerError ? String(intakeServerError?.message || intakeServerError) : null,
                pendingFullReset: fs.existsSync(getFullResetMarkerPath()),
                lastFullResetResult,
            },
            renderer: automationRendererState,
            sessions: automationControl.listSessions(),
            diagnostics,
            commandMap: getAutomationCommandMap(),
        };
    });

    ipcMain.handle('ckc:automationRunCommand', async (_evt, request) => {
        const req = request && typeof request === 'object' ? request : {};
        const target = String(req.target || 'renderer').trim().toLowerCase();
        const command = String(req.command || '').trim();
        const params = req.params && typeof req.params === 'object' ? req.params : {};
        if (!command) throw new Error('command is required');

        if (target === 'backend') {
            const result = await runBackendAutomationCommand(command, params);
            automationControl.logEvent({
                sessionId: req.sessionId || null,
                type: 'command.backend',
                details: { command, params, ok: true },
            });
            return { ok: true, target, command, result };
        }

        const result = await runRendererAutomationCommand(command, params, req.timeoutMs);
        automationControl.logEvent({
            sessionId: req.sessionId || null,
            type: 'command.renderer',
            details: { command, params, ok: true },
        });
        return { ok: true, target: 'renderer', command, result };
    });

    ipcMain.handle('ckc:automationCapture', async (_evt, params) => {
        if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available.');
        const p = params && typeof params === 'object' ? params : {};
        let image = await mainWindow.webContents.capturePage();
        let size = image.getSize();
        if (!size.width || !size.height) {
            const buf = await captureViaDebugger();
            image = nativeImage.createFromBuffer(buf);
            size = image.getSize();
        }
        if (p.format === 'pngBytes') {
            return { ok: true, width: size.width, height: size.height, pngBytes: image.toPNG() };
        }
        return { ok: true, width: size.width, height: size.height, dataUrl: image.toDataURL() };
    });

    ipcMain.handle('ckc:automationCaptureToFile', async (_evt, params) => {
        const p = params && typeof params === 'object' ? params : {};
        const res = await captureAutomationPng({ label: p.label || 'capture', sessionId: p.sessionId || null });
        automationControl.logEvent({
            sessionId: p.sessionId || null,
            type: 'capture.file',
            details: { label: p.label || 'capture', pngPath: res.pngPath, jsonPath: res.jsonPath },
        });
        return res;
    });

    ipcMain.handle('ckc:getConfig', async () => appConfig);

    ipcMain.handle('ckc:getConfigInfo', async () => {
        return { configPath: appConfigPath, config: appConfig };
    });

    ipcMain.handle('ckc:setConfig', async (_evt, nextConfig) => {
        const patch = nextConfig && typeof nextConfig === 'object' ? nextConfig : {};
        const prevLibraryRoot = appConfig?.libraryRoot;
        const merged = normalizeConfig({ ...appConfig, ...patch });
        const nextLibraryRoot = merged?.libraryRoot;

        appConfig = merged;
        saveConfig(appConfigPath, appConfig);

        // Only reinitialize the library when libraryRoot changes.
        if (typeof nextLibraryRoot === 'string' && nextLibraryRoot !== prevLibraryRoot) {
            resetLibrary();
            await ensureLibrary();
        }

        return appConfig;
    });

    ipcMain.handle('ckc:openReferenceWindow', async () => {
        if (referenceWindow && !referenceWindow.isDestroyed()) {
            if (assertBackgroundSafe('referenceWindow.show+focus', 'openReferenceWindow.existing')) {
                referenceWindow.show();
                referenceWindow.focus();
            }
            sendReferenceSelection();
            sendReferenceWindowState();
            return { ok: true, raised: !isBackgroundMode() };
        }
        const created = createReferenceWindow();
        return { ok: true, created: !!created };
    });

    ipcMain.handle('ckc:closeReferenceWindow', async () => {
        if (referenceWindow && !referenceWindow.isDestroyed()) referenceWindow.close();
        return { ok: true };
    });

    ipcMain.handle('ckc:getReferenceWindowState', async () => {
        const prefs = getReferenceWindowPrefs();
        return {
            isOpen: !!(referenceWindow && !referenceWindow.isDestroyed()),
            imageId: referenceSelection.imageId ?? null,
            alwaysOnTop: !!prefs.alwaysOnTop,
            clickThrough: !!prefs.clickThrough,
            opacity: prefs.opacity,
        };
    });

    ipcMain.handle('ckc:setReferenceWindowOptions', async (_evt, params) => {
        const p = params && typeof params === 'object' ? params : {};
        const prev = appConfig?.referenceWindow && typeof appConfig.referenceWindow === 'object' ? appConfig.referenceWindow : {};
        const next = { ...prev };

        if (p.alwaysOnTop !== undefined) next.alwaysOnTop = !!p.alwaysOnTop;
        if (p.clickThrough !== undefined) next.clickThrough = !!p.clickThrough;
        if (p.opacity !== undefined) {
            const o = Number(p.opacity);
            if (Number.isFinite(o)) next.opacity = Math.max(0.15, Math.min(1, o));
        }

        appConfig = { ...appConfig, referenceWindow: next };
        saveConfig(appConfigPath, appConfig);

        if (referenceWindow && !referenceWindow.isDestroyed()) {
            referenceWindow.setAlwaysOnTop(!!next.alwaysOnTop);
            try {
                const prefs = getReferenceWindowPrefs();
                referenceWindow.setOpacity(prefs.opacity);
            } catch {
                // ignore
            }
            try {
                referenceWindow.setIgnoreMouseEvents(!!next.clickThrough);
            } catch {
                // ignore
            }
            sendReferenceWindowState();
        }

        const prefs = getReferenceWindowPrefs();
        return { ok: true, state: { alwaysOnTop: !!prefs.alwaysOnTop, clickThrough: !!prefs.clickThrough, opacity: prefs.opacity } };
    });

    ipcMain.handle('ckc:setReferenceSelection', async (_evt, params) => {
        const p = params && typeof params === 'object' ? params : {};
        const nextId = p.imageId == null ? null : String(p.imageId ?? '').trim();
        referenceSelection = { imageId: nextId || null };
        sendReferenceSelection();
        return { ok: true };
    });

    ipcMain.handle('ckc:llmChat', async (_evt, params) => {
        const p = params && typeof params === 'object' ? params : {};
        const llm = appConfig?.llm && typeof appConfig.llm === 'object' ? appConfig.llm : {};
        const baseUrl = typeof llm.baseUrl === 'string' ? llm.baseUrl : '';
        const model = typeof llm.model === 'string' ? llm.model : '';
        const apiKey = typeof llm.apiKey === 'string' ? llm.apiKey : '';
        const systemPrompt = typeof llm.systemPrompt === 'string' ? llm.systemPrompt : '';
        const timeoutSecRaw = typeof llm.timeoutSec === 'number' ? llm.timeoutSec : NaN;
        const timeoutSec = Number.isFinite(timeoutSecRaw) ? timeoutSecRaw : 900;
        const clampedTimeoutSec = Math.max(5, Math.min(7200, timeoutSec));

        if (!String(baseUrl).trim()) throw new Error('Local model base URL is not configured (Tools → Local model).');
        if (!String(model).trim()) throw new Error('Local model name is not configured (Tools → Local model).');

        const messages = Array.isArray(p.messages) ? p.messages : [];
        const mergedMessages = [];
        const sys = String(systemPrompt || '').trim();
        if (sys) mergedMessages.push({ role: 'system', content: sys });
        mergedMessages.push(...messages);

        const temperature = typeof p.temperature === 'number' ? p.temperature : undefined;
        const maxTokens = typeof p.maxTokens === 'number' ? p.maxTokens : undefined;

        const res = await openAiChatCompletions({
            baseUrl,
            apiKey,
            model,
            messages: mergedMessages,
            temperature,
            maxTokens,
            timeoutMs: Math.round(clampedTimeoutSec * 1000),
        });
        return { ok: true, text: res.text };
    });

    ipcMain.handle('ckc:getImageTagSuggestions', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getImageTagSuggestions(params || {});
    });

    ipcMain.handle('ckc:clearImageTagSuggestions', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.clearImageTagSuggestions(params || {});
    });

    ipcMain.handle('ckc:suggestImageTags', async (_evt, params) => {
        const p = params && typeof params === 'object' ? params : {};
        return suggestImageTags({ imageId: p.imageId });
    });

    ipcMain.handle('ckc:startAiTaggingJob', async (_evt, params) => {
        const jobId = startAiTaggingJobInternal(params || {}, { throwIfRunning: true });
        if (!jobId) throw new Error('Failed to start AI tagging job.');
        return { ok: true, jobId };
    });

    ipcMain.handle('ckc:getAiTaggingJobStatus', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getAiTagJob(id);
        if (!job) throw new Error(`AI tagging job not found: ${id || '(blank)'}`);
        return snapshotAiTagJob(job);
    });

    ipcMain.handle('ckc:cancelAiTaggingJob', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getAiTagJob(id);
        if (!job) throw new Error(`AI tagging job not found: ${id || '(blank)'}`);
        job.cancelRequested = true;
        return { ok: true };
    });

    ipcMain.handle('ckc:getLibraryDiagnostics', async (_evt, params) => {
        const lib = await ensureLibrary();
        const diag = await lib.getMediaDiagnostics(params || {});
        return { ...diag, configPath: appConfigPath, generatedAt: new Date().toISOString() };
    });

    ipcMain.handle('ckc:listDuplicateGroups', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listDuplicateGroups(params || {});
    });

    ipcMain.handle('ckc:startNearDuplicateScan', async (_evt, params) => {
        if (nearDupActiveJobId) {
            const existing = getNearDupJob(nearDupActiveJobId);
            if (existing && String(existing.status) === 'running') throw new Error('Near-duplicate scan already running.');
            nearDupActiveJobId = null;
        }

        const jobId = makeNearDupJobId();
        const job = {
            jobId,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            progress: { phase: 'starting', done: 0, total: 0 },
            cancelRequested: false,
            error: null,
            result: null,
        };

        nearDupJobs.set(jobId, job);
        nearDupActiveJobId = jobId;
        void runNearDuplicateScanJob(job, params || {});
        return { ok: true, jobId };
    });

    ipcMain.handle('ckc:getNearDuplicateScanStatus', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getNearDupJob(id);
        if (!job) throw new Error(`Near-duplicate scan job not found: ${id || '(blank)'}`);
        return snapshotNearDupJob(job);
    });

    ipcMain.handle('ckc:cancelNearDuplicateScan', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getNearDupJob(id);
        if (!job) throw new Error(`Near-duplicate scan job not found: ${id || '(blank)'}`);
        job.cancelRequested = true;
        return { ok: true };
    });

    ipcMain.handle('ckc:findSimilarImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.findSimilarImages(params || {});
    });

    ipcMain.handle('ckc:startLibraryBackup', async (_evt, params) => {
        if (libraryBackupActiveJobId) {
            const existing = getLibraryBackupJob(libraryBackupActiveJobId);
            if (existing && String(existing.status) === 'running') throw new Error('Library backup already running.');
            libraryBackupActiveJobId = null;
        }

        const jobId = makeLibraryBackupJobId();
        const job = {
            jobId,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            progress: { phase: 'starting', done: 0, total: 0 },
            cancelRequested: false,
            error: null,
            result: null,
        };

        libraryBackupJobs.set(jobId, job);
        libraryBackupActiveJobId = jobId;
        void runLibraryBackupJob(job, params || {});
        return { ok: true, jobId };
    });

    ipcMain.handle('ckc:getLibraryBackupStatus', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getLibraryBackupJob(id);
        if (!job) throw new Error(`Library backup job not found: ${id || '(blank)'}`);
        return snapshotLibraryBackupJob(job);
    });

    ipcMain.handle('ckc:cancelLibraryBackup', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getLibraryBackupJob(id);
        if (!job) throw new Error(`Library backup job not found: ${id || '(blank)'}`);
        job.cancelRequested = true;
        return { ok: true };
    });

    ipcMain.handle('ckc:startLibraryRestore', async (_evt, params) => {
        if (libraryRestoreActiveJobId) {
            const existing = getLibraryRestoreJob(libraryRestoreActiveJobId);
            if (existing && String(existing.status) === 'running') throw new Error('Library restore already running.');
            libraryRestoreActiveJobId = null;
        }

        const jobId = makeLibraryRestoreJobId();
        const job = {
            jobId,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            progress: { phase: 'starting', done: 0, total: 0 },
            cancelRequested: false,
            error: null,
            result: null,
        };

        libraryRestoreJobs.set(jobId, job);
        libraryRestoreActiveJobId = jobId;
        void runLibraryRestoreJob(job, params || {});
        return { ok: true, jobId };
    });

    ipcMain.handle('ckc:getLibraryRestoreStatus', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getLibraryRestoreJob(id);
        if (!job) throw new Error(`Library restore job not found: ${id || '(blank)'}`);
        return snapshotLibraryRestoreJob(job);
    });

    ipcMain.handle('ckc:cancelLibraryRestore', async (_evt, jobId) => {
        const id = String(jobId || '').trim();
        const job = getLibraryRestoreJob(id);
        if (!job) throw new Error(`Library restore job not found: ${id || '(blank)'}`);
        job.cancelRequested = true;
        return { ok: true };
    });

    ipcMain.handle('ckc:listCollections', async () => {
        const lib = await ensureLibrary();
        return lib.listCollections();
    });

    ipcMain.handle('ckc:createCollection', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createCollection(params || {});
    });

    ipcMain.handle('ckc:renameCollection', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.renameCollection(params || {});
    });

    ipcMain.handle('ckc:deleteCollection', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteCollection(params || {});
    });

    ipcMain.handle('ckc:listCollectionImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listCollectionImages(params || {});
    });

    ipcMain.handle('ckc:addImagesToCollection', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.addImagesToCollection(params || {});
    });

    ipcMain.handle('ckc:removeImagesFromCollection', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.removeImagesFromCollection(params || {});
    });

    ipcMain.handle('ckc:listCharacterRelations', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listCharacterRelations(params || {});
    });

    ipcMain.handle('ckc:createCharacterRelation', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createCharacterRelation(params || {});
    });

    ipcMain.handle('ckc:updateCharacterRelation', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateCharacterRelation(params || {});
    });

    ipcMain.handle('ckc:deleteCharacterRelation', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteCharacterRelation(params || {});
    });

    ipcMain.handle('ckc:listTagStats', async () => {
        const lib = await ensureLibrary();
        return lib.listTagStats();
    });

    ipcMain.handle('ckc:mergeTags', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.mergeTags(params || {});
    });

    ipcMain.handle('ckc:renameTag', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.renameTag(params || {});
    });

    ipcMain.handle('ckc:resetPreferences', async () => {
        return { ...resetPreferenceStorage(), restartRequired: true };
    });

    ipcMain.handle('ckc:requestFullReset', async () => {
        const lib = await ensureLibrary();
        const marker = writePendingFullResetMarker({
            markerPath: getFullResetMarkerPath(),
            libraryRoot: lib.libraryRoot,
            database: appConfig?.database || null,
        });
        const prefs = resetPreferenceStorage();
        return {
            ok: true,
            markerPath: marker.markerPath,
            libraryRoot: marker.libraryRoot,
            deleted: prefs.deleted,
            failed: prefs.failed || [],
            restartRequired: true,
        };
    });

    ipcMain.handle('ckc:listOrphanManifests', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listOrphanManifests(params || {});
    });

    ipcMain.handle('ckc:adoptOrphanImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.adoptOrphanImages(params || {});
    });

    ipcMain.handle('ckc:selectLibraryRoot', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Library Root',
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        appConfig.libraryRoot = result.filePaths[0];
        saveConfig(appConfigPath, appConfig);
        resetLibrary();
        await ensureLibrary();
        return appConfig.libraryRoot;
    });

    ipcMain.handle('ckc:getDefaultLibraryRootInfo', async () => {
        return {
            isPortable: !!getPortableBaseDir(),
            portableDir: getPortableBaseDir(),
            defaultLibraryRoot: getDefaultLibraryRoot(),
        };
    });

    ipcMain.handle('ckc:resetLibraryRootToDefault', async () => {
        appConfig.libraryRoot = getDefaultLibraryRoot();
        if (getPortableBaseDir()) {
            appConfig.portableLibraryChoice = 'portable_default';
        }
        saveConfig(appConfigPath, appConfig);
        resetLibrary();
        await ensureLibrary();
        return appConfig.libraryRoot;
    });

    ipcMain.handle('ckc:initialize', async () => {
        await ensureLibrary();
        return { ok: true };
    });

    ipcMain.handle('ckc:getTemplate', async () => {
        const lib = await ensureLibrary();
        return lib.template;
    });

    ipcMain.handle('ckc:listTemplates', async () => {
        const lib = await ensureLibrary();
        return lib.listTemplates();
    });

    ipcMain.handle('ckc:getTemplateDetail', async (_evt, templateId) => {
        const lib = await ensureLibrary();
        return lib.getTemplateDetail(templateId || null);
    });

    ipcMain.handle('ckc:setDefaultTemplateId', async (_evt, templateId) => {
        appConfig.defaultTemplateId = templateId;
        saveConfig(appConfigPath, appConfig);
        if (ckcLibrary) {
            await ckcLibrary.setDefaultTemplateId(templateId);
            return ckcLibrary.template;
        }
        const lib = await ensureLibrary();
        await lib.setDefaultTemplateId(templateId);
        return lib.template;
    });

    ipcMain.handle('ckc:importTemplateFromDialog', async () => {
        const lib = await ensureLibrary();
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Template File',
            properties: ['openFile'],
            filters: [{ name: 'Template', extensions: ['txt'] }],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return lib.importTemplateFromFile({ filePath: result.filePaths[0] });
    });

    ipcMain.handle('ckc:listCharacterTemplates', async () => {
        const lib = await ensureLibrary();
        return lib.listCharacterTemplates();
    });

    ipcMain.handle('ckc:getCharacterTemplate', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getCharacterTemplate(params || {});
    });

    ipcMain.handle('ckc:saveCharacterTemplateFromCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.saveCharacterTemplateFromCharacter(params || {});
    });

    ipcMain.handle('ckc:createCharactersFromTemplate', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createCharactersFromTemplate(params || {});
    });

    ipcMain.handle('ckc:cloneCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.cloneCharacter(params || {});
    });

    ipcMain.handle('ckc:listCharacters', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listCharacters(params || {});
    });

    ipcMain.handle('ckc:listAllTags', async () => {
        const lib = await ensureLibrary();
        return lib.listAllTags();
    });

    ipcMain.handle('ckc:listRigs', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listRigs(params || {});
    });

    ipcMain.handle('ckc:getRig', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getRig(params || {});
    });

    ipcMain.handle('ckc:createRig', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createRig(params || {});
    });

    ipcMain.handle('ckc:updateRigCalibration', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateRigCalibration(params || {});
    });

    ipcMain.handle('ckc:setRigPortrait', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setRigPortrait(params || {});
    });

    ipcMain.handle('ckc:updateRigPose', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateRigPose(params || {});
    });

    ipcMain.handle('ckc:exportOpenposePng', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportOpenposePng(params || {});
    });

    ipcMain.handle('ckc:registerComfyUIOutput', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.registerComfyUIOutput(params || {});
    });

    ipcMain.handle('ckc:getWorkflowHistory', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getWorkflowHistory(params || {});
    });

    ipcMain.handle('ckc:extractPromptFromWorkflow', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.extractPromptFromWorkflow(params || {});
    });

    ipcMain.handle('ckc:replayWorkflow', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params || {};
        return lib.replayWorkflow({ ...p, host: p.host || appConfig?.comfyui?.host });
    });

    ipcMain.handle('ckc:getComfyUIStats', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params || {};
        return lib.getComfyUIStats({ host: p.host || appConfig?.comfyui?.host });
    });

    ipcMain.handle('ckc:listPrompts', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listPrompts(params || {});
    });

    ipcMain.handle('ckc:upsertPrompt', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.upsertPrompt(params || {});
    });

    ipcMain.handle('ckc:deletePrompt', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deletePrompt(params || {});
    });

    ipcMain.handle('ckc:listStoryBeats', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listStoryBeats(params || {});
    });

    ipcMain.handle('ckc:upsertStoryBeat', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.upsertStoryBeat(params || {});
    });

    ipcMain.handle('ckc:deleteStoryBeat', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteStoryBeat(params || {});
    });

    ipcMain.handle('ckc:listFieldValueSuggestions', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listFieldValueSuggestions(params || {});
    });

    ipcMain.handle('ckc:listGlobalCarouselImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listGlobalCarouselImages(params || {});
    });

    ipcMain.handle('ckc:listInboxImages', async () => {
        const lib = await ensureLibrary();
        return lib.listInboxImages();
    });

    ipcMain.handle('ckc:globalSearch', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.globalSearch(params || {});
    });

    ipcMain.handle('ckc:listDocs', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listDocs(params || {});
    });

    ipcMain.handle('ckc:getDoc', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getDoc(params || {});
    });

    ipcMain.handle('ckc:upsertDoc', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.upsertDoc(params || {});
    });

    ipcMain.handle('ckc:deleteDoc', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteDoc(params || {});
    });

    ipcMain.handle('ckc:getStoryBoard', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getStoryBoard(params || {});
    });

    ipcMain.handle('ckc:setStoryBoard', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setStoryBoard(params || {});
    });

    ipcMain.handle('ckc:resolveLinkToken', async (_evt, token) => {
        const lib = await ensureLibrary();
        return lib.resolveLinkToken(String(token ?? ''));
    });

    ipcMain.handle('ckc:listBacklinks', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listBacklinks(params || {});
    });

    ipcMain.handle('ckc:listSavedSearches', async () => {
        const lib = await ensureLibrary();
        return lib.listSavedSearches();
    });

    ipcMain.handle('ckc:createSavedSearch', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createSavedSearch(params || {});
    });

    ipcMain.handle('ckc:updateSavedSearch', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateSavedSearch(params || {});
    });

    ipcMain.handle('ckc:deleteSavedSearch', async (_evt, searchId) => {
        const lib = await ensureLibrary();
        return lib.deleteSavedSearch(searchId);
    });

    ipcMain.handle('ckc:listTagTemplates', async () => {
        const lib = await ensureLibrary();
        return lib.listTagTemplates();
    });

    ipcMain.handle('ckc:listTagTemplateVersions', async (_evt, templateName) => {
        const lib = await ensureLibrary();
        return lib.listTagTemplateVersions(templateName);
    });

    ipcMain.handle('ckc:upsertTagTemplate', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.upsertTagTemplate(params || {});
    });

    ipcMain.handle('ckc:deleteTagTemplateVersion', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteTagTemplateVersion(params || {});
    });

    ipcMain.handle('ckc:applyTagTemplateToCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.applyTagTemplateToCharacter(params || {});
    });

    ipcMain.handle('ckc:listTagRules', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listTagRules(params || {});
    });

    ipcMain.handle('ckc:createTagRule', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createTagRule(params || {});
    });

    ipcMain.handle('ckc:updateTagRule', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateTagRule(params || {});
    });

    ipcMain.handle('ckc:deleteTagRule', async (_evt, ruleId) => {
        const lib = await ensureLibrary();
        return lib.deleteTagRule(ruleId);
    });

    ipcMain.handle('ckc:recomputeDerivedTags', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.recomputeDerivedTags(characterId);
    });

    ipcMain.handle('ckc:recomputeDerivedTagsAll', async () => {
        const lib = await ensureLibrary();
        return lib.recomputeDerivedTagsAll();
    });

    ipcMain.handle('ckc:listAuditLog', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listAuditLog(params || {});
    });

    ipcMain.handle('ckc:listSpinOffs', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listSpinOffs(params || {});
    });

    ipcMain.handle('ckc:getSpinOff', async (_evt, spinoffId) => {
        const lib = await ensureLibrary();
        return lib.getSpinOff(spinoffId);
    });

    ipcMain.handle('ckc:createSpinOff', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createSpinOff(params || {});
    });

    ipcMain.handle('ckc:updateSpinOff', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.updateSpinOff(params || {});
    });

    ipcMain.handle('ckc:deleteSpinOff', async (_evt, spinoffId) => {
        const lib = await ensureLibrary();
        return lib.deleteSpinOff(spinoffId);
    });

    ipcMain.handle('ckc:getCharacter', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.getCharacter(characterId);
    });

    ipcMain.handle('ckc:setCharacterIcon', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setCharacterIcon(params || {});
    });

    ipcMain.handle('ckc:createCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.createCharacter(params || {});
    });

    ipcMain.handle('ckc:assignPublicCharacterIds', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.assignPublicCharacterIds(params || {});
    });

    ipcMain.handle('ckc:importCharacterFromSheetDialog', async () => {
        const lib = await ensureLibrary();
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Character Sheet (canonical)',
            properties: ['openFile'],
            filters: [{ name: 'Sheets', extensions: ['txt', 'md'] }, { name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return lib.importCharacterFromSheetFile({ filePath: result.filePaths[0] });
    });

    ipcMain.handle('ckc:saveCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.saveCharacter({
            characterId: params.characterId,
            valuesById: params.valuesById,
            validationMode: params.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: params.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:batchUpdateCharacterField', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params && typeof params === 'object' ? params : {};
        return lib.batchUpdateCharacterField({
            ...p,
            validationMode: p.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: p.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:batchUpdateCharacterTags', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.batchUpdateCharacterTags(params || {});
    });

    ipcMain.handle('ckc:softDeleteCharacters', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.softDeleteCharacters(params || {});
    });

    ipcMain.handle('ckc:restoreCharacters', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.restoreCharacters(params || {});
    });

    ipcMain.handle('ckc:purgeCharacters', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.purgeCharacters(params || {});
    });

    ipcMain.handle('ckc:addManualTag', async (_evt, params) => {
        const lib = await ensureLibrary();
        await lib.addManualTag(params.characterId, params.tagText);
        return { ok: true };
    });

    ipcMain.handle('ckc:removeManualTag', async (_evt, params) => {
        const lib = await ensureLibrary();
        await lib.removeManualTag(params.characterId, params.tagText);
        return { ok: true };
    });

    ipcMain.handle('ckc:listProtectedFieldIds', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.listProtectedFieldIds(characterId || null);
    });

    ipcMain.handle('ckc:setProtectedFieldIdsGlobal', async (_evt, fieldIds) => {
        const lib = await ensureLibrary();
        await lib.setProtectedFieldIdsGlobal(fieldIds || []);
        return { ok: true };
    });

    ipcMain.handle('ckc:listProtectedFieldIdsGlobal', async () => {
        const lib = await ensureLibrary();
        return lib.listProtectedFieldIdsGlobal();
    });

    ipcMain.handle('ckc:listProtectedFieldIdsForCharacter', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.listProtectedFieldIdsForCharacter(characterId);
    });

    ipcMain.handle('ckc:setProtectedFieldIdsForCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setProtectedFieldIdsForCharacter(params.characterId, params.fieldIds || []);
    });

    ipcMain.handle('ckc:ingestPreview', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.ingestPreview(params);
    });

    ipcMain.handle('ckc:ingestApply', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.ingestApply({
            ...params,
            validationMode: params.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: params.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:ingestCreateCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.ingestCreateCharacter({
            ...params,
            validationMode: params.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: params.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:openTextFileDialog', async (_evt, opts) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: opts?.title || 'Open Text File',
            properties: ['openFile'],
            filters: [{ name: 'Text', extensions: ['txt', 'md'] }, { name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        const p = result.filePaths[0];
        const text = fs.readFileSync(p, 'utf8');
        return { path: p, text };
    });

    ipcMain.handle('ckc:selectFolderDialog', async (_evt, opts) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: opts?.title || 'Select Folder',
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('ckc:exportEmptyTemplate', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportEmptyTemplate(params || {});
    });

    ipcMain.handle('ckc:exportTemplateFieldPack', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportTemplateFieldPack(params || {});
    });

    ipcMain.handle('ckc:patchPreview', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.patchPreview(params);
    });

    ipcMain.handle('ckc:patchApply', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.patchApply({
            ...params,
            validationMode: params.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: params.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:exportBundle', async (_evt, params) => {
        const lib = await ensureLibrary();
        const { txtPath, mdPath, pdfPath } = await lib.exportBundle(params);
        // Generate a real PDF now.
        const sheetText = fs.readFileSync(txtPath, 'utf8');
        await writePdfFromText(sheetText, pdfPath);
        return { txtPath, mdPath, pdfPath };
    });

    ipcMain.handle('ckc:exportImageSet', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportImageSet(params || {});
    });

    ipcMain.handle('ckc:exportSharePack', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportSharePack(params || {});
    });

    ipcMain.handle('ckc:exportWebPortfolio', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportWebPortfolio(params || {});
    });

    ipcMain.handle('ckc:exportMoodboardPng', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportMoodboardPng(params || {});
    });

    ipcMain.handle('ckc:exportMoodboardPdf', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params && typeof params === 'object' ? params : {};
        const pdf = await renderPdfFromPngBase64(p.pngBase64, { widthPx: p.widthPx, heightPx: p.heightPx });
        return lib.exportMoodboardPdf({
            docId: p.docId ?? null,
            title: p.title ?? 'Moodboard',
            pdfBytes: pdf,
            outDir: p.outDir ?? null,
        });
    });

    ipcMain.handle('ckc:listVersions', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.listVersions(characterId);
    });

    ipcMain.handle('ckc:diffVersions', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.diffVersions(params);
    });

    ipcMain.handle('ckc:revertPreviewFromVersion', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.revertPreviewFromVersion(params);
    });

    ipcMain.handle('ckc:revertApplyFromVersion', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.revertApplyFromVersion({
            ...params,
            validationMode: params.validationMode ?? appConfig.validationMode,
            allowSaveWithErrors: params.allowSaveWithErrors ?? appConfig.allowSaveWithErrors,
        });
    });

    ipcMain.handle('ckc:repairCharacterFolders', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.repairCharacterFolders(characterId);
    });

    ipcMain.handle('ckc:openPath', async (_evt, filePath) => {
        await shell.openPath(filePath);
        return { ok: true };
    });

    ipcMain.handle('ckc:scanInbox', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params && typeof params === 'object' ? params : {};
        const configured = appConfig && typeof appConfig.inboxDir === 'string' ? appConfig.inboxDir : '';
        const inboxDir = String(p.inboxDir ?? configured ?? '').trim();
        if (!inboxDir) throw new Error('Inbox folder is not configured (Library → Inbox).');
        const includeSubdirs = !!p.includeSubdirs;
        return lib.importInboxFromDir({ inboxDir, includeSubdirs });
    });

    ipcMain.handle('ckc:moveImagesToCharacter', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.moveImagesToCharacter(params || {});
    });

    ipcMain.handle('ckc:deleteImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.deleteImages(params || {});
    });

    ipcMain.handle('ckc:importClipboardImage', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params && typeof params === 'object' ? params : {};
        const target = String(p.target ?? '').trim().toLowerCase();
        let characterId = String(p.characterId ?? '').trim();
        if (!characterId && target === 'inbox') {
            characterId = await lib.ensureInboxCharacter();
        }
        if (!characterId) throw new Error('Missing characterId');

        const img = clipboard.readImage();
        if (!img || img.isEmpty()) return { ok: false, reason: 'no_image' };

        const png = img.toPNG();
        if (!png || png.length === 0) return { ok: false, reason: 'no_image' };

        const tmpName = `ckc_clipboard_${Date.now()}_${Math.random().toString(16).slice(2)}.png`;
        const tmpPath = path.join(os.tmpdir(), tmpName);
        await fs.promises.writeFile(tmpPath, png);
        try {
            const res = await lib.importImages({ characterId, filePaths: [tmpPath], duplicatePolicy: 'skip' });
            const imported = res.imported || [];
            maybeStartAutoAiTagging(imported.map((x) => x?.id));
            return { ok: true, imported, duplicates: res.duplicates || [] };
        } finally {
            try {
                await fs.promises.unlink(tmpPath);
            } catch {
                // ignore
            }
        }
    });

    ipcMain.handle('ckc:importFromUrl', async (_evt, params) => {
        const lib = await ensureLibrary();
        const p = params && typeof params === 'object' ? params : {};
        const target = String(p.target ?? '').trim().toLowerCase();
        let characterId = String(p.characterId ?? '').trim();
        if (!characterId && target === 'inbox') {
            characterId = await lib.ensureInboxCharacter();
        }
        if (!characterId) throw new Error('Missing characterId');

        const url = String(p.url ?? '').trim();
        if (!url) throw new Error('Missing url');

        const res = await lib.importFromUrl({
            characterId,
            url,
            sourceNote: p.sourceNote !== undefined ? String(p.sourceNote ?? '') : undefined,
        });

        const imported = res.imported || [];
        maybeStartAutoAiTagging(imported.map((x) => x?.id));
        return { ok: true, imported, duplicates: res.duplicates || [] };
    });

    ipcMain.handle('ckc:importImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        const characterId = params && typeof params === 'object' ? params.characterId : null;
        if (!characterId) throw new Error('Missing characterId');

        let filePaths = Array.isArray(params?.filePaths) ? params.filePaths.map(p => String(p || '')).filter(Boolean) : null;
        if (!filePaths || filePaths.length === 0) {
            const picked = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Images',
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
            });
            if (picked.canceled) return { imported: [], duplicates: [] };
            filePaths = picked.filePaths || [];
        }

        const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
        filePaths = filePaths.filter((p) => allowedExt.has(path.extname(String(p || '')).toLowerCase()));
        if (filePaths.length === 0) return { imported: [], duplicates: [] };

        const first = await lib.importImages({ characterId, filePaths, duplicatePolicy: 'skip' });
        let imported = first.imported || [];

        const duplicates = first.duplicates || [];
        if (duplicates.length > 0) {
            const res = await safeShowMessageBox({
                type: 'warning',
                message: `Detected ${duplicates.length} duplicate image(s).`,
                detail: 'Skip duplicates is safest. Keep both will import additional copies with deterministic renaming.',
                buttons: ['Keep both', 'Skip duplicates'],
                defaultId: 1,
                cancelId: 1,
            }, 'importImageFiles.duplicateConfirm');
            if (res.response === 0) {
                const dupPaths = duplicates.map(d => d.srcPath).filter(Boolean);
                const second = await lib.importImages({ characterId, filePaths: dupPaths, duplicatePolicy: 'keepBoth' });
                imported = imported.concat(second.imported || []);
            }
        }

        maybeStartAutoAiTagging(imported.map((x) => x?.id));
        return { imported, duplicates };
    });

    ipcMain.handle('ckc:repairMissingImagesByHash', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.repairMissingImagesByHash(params || {});
    });

    ipcMain.handle('ckc:repairThumbnails', async (_evt, characterId) => {
        const lib = await ensureLibrary();
        return lib.repairThumbnails({ characterId });
    });

    ipcMain.handle('ckc:setImageMeta', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setImageMeta(params);
    });

    ipcMain.handle('ckc:getImagePalette', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getImagePalette(params || {});
    });

    ipcMain.handle('ckc:ensureImagePalettes', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.ensureImagePalettes(params || {});
    });

    ipcMain.handle('ckc:getImageAnnotations', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.getImageAnnotations(params || {});
    });

    ipcMain.handle('ckc:setImageAnnotations', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setImageAnnotations(params || {});
    });

    ipcMain.handle('ckc:setImagesMetaBatch', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.setImagesMetaBatch(params || {});
    });

    ipcMain.handle('ckc:scanIntakeFolder', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.scanIntakeFolder(params || {});
    });

    ipcMain.handle('ckc:classifyIntakeImage', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.classifyIntakeImage(params || {});
    });

    ipcMain.handle('ckc:listPendingImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listPendingImages(params || {});
    });

    ipcMain.handle('ckc:exportFieldPack', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportFieldPack(params);
    });
}

// Single-instance lock. A second launch:
//  - In operator mode: raises and focuses the running mainWindow
//    (typical desktop behavior). Routed through safeRaiseMainWindow
//    which short-circuits in background mode.
//  - In background mode: logs the second-instance event and exits
//    silently without raising the running instance.
const __ckcSingleInstance = app.requestSingleInstanceLock();
if (!__ckcSingleInstance) {
    try {
        console.warn('[stealth] another CKC instance is running; this process exits without raising the first.');
    } catch {
        // ignore
    }
    app.quit();
    process.exit(0);
}
app.on('second-instance', () => {
    try {
        automationControl.logEvent({
            sessionId: null,
            type: 'lifecycle.secondInstance',
            details: { backgroundMode: isBackgroundMode() },
        });
    } catch {
        // ignore
    }
    safeRaiseMainWindow('app.second-instance');
});

app.whenReady().then(async () => {
    const loaded = loadConfig();
    appConfigPath = loaded.configPath;
    appConfig = normalizeConfig(loaded.config);
    const pendingReset = readPendingFullResetMarker(getFullResetMarkerPath());
    const pendingResetRoot = String(pendingReset?.library_root || pendingReset?.libraryRoot || '').trim();
    if (pendingResetRoot) appConfig.libraryRoot = pendingResetRoot;
    if (pendingReset?.database && typeof pendingReset.database === 'object') {
        appConfig.database = pendingReset.database;
    }
    if (pendingReset) {
        resetPreferenceStorage();
    }
    saveConfig(appConfigPath, appConfig);

    registerIpcHandlers();
    registerProtocolHandlers();
    createWindow();
    registerReferenceWindowShortcuts();

    // Initialize the library eagerly so the renderer cannot observe a partially-initialized instance.
    try {
        const lib = await ensureLibrary();
        lastFullResetResult = await lib.runPendingFullReset({ markerPath: getFullResetMarkerPath() });
        if (lastFullResetResult?.ran) {
            resetLibrary();
            await ensureLibrary();
        }
    } catch (err) {
        try {
            await safeShowMessageBox({
                type: 'error',
                message: 'Failed to initialize CastKit Codex library.',
                detail: String(err?.message || err || 'Unknown error'),
                buttons: ['Quit'],
                defaultId: 0,
                noLink: true,
            }, 'whenReady.libraryInitFailure');
        } finally {
            app.quit();
        }
    }

    try {
        await startCkcIntakeServer();
    } catch (err) {
        intakeServerError = err;
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('will-quit', () => {
    stopCkcIntakeServer();
    try {
        globalShortcut.unregisterAll();
    } catch {
        // ignore
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
