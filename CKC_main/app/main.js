const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol } = require('electron');
const fs = require('fs');
const path = require('path');

const { CKCLibrary } = require('./backend/library');

const CONFIG_FILE = 'ckc-config.json';

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
    if (portableDir) return path.join(portableDir, 'CastKit Codex Library');
    return path.join(app.getPath('documents'), 'CastKit Codex Library');
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
            return { configPath, config: JSON.parse(raw) };
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
        },
    };
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
        const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
        fs.writeFileSync(outPath, pdf);
    } finally {
        win.close();
    }
}

let mainWindow = null;
let ckcLibrary = null;
let ckcLibraryInitPromise = null;
let appConfigPath = null;
let appConfig = null;

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

async function ensureLibraryRootAvailable() {
    const configured = String(appConfig?.libraryRoot || '').trim();
    if (configured && fs.existsSync(configured)) return;

    const portableDir = getPortableBaseDir();
    const defaultRoot = getDefaultLibraryRoot();
    const nearExeCandidate = portableDir ? path.join(portableDir, 'CastKit Codex Library') : null;

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

    const res = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        message: 'CastKit Codex library folder not found.',
        detail: `Configured libraryRoot:\n${missing}\n\nChoose an existing library root folder, or create a new one.\n\nDefault:\n${createDetail}`,
        buttons: ['Select existing…', createLabel, 'Quit'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
    });

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
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    const isDev = !app.isPackaged;
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

function registerIpcHandlers() {
    ipcMain.handle('ckc:getConfig', async () => appConfig);

    ipcMain.handle('ckc:getConfigInfo', async () => {
        return { configPath: appConfigPath, config: appConfig };
    });

    ipcMain.handle('ckc:setConfig', async (_evt, nextConfig) => {
        appConfig = { ...appConfig, ...nextConfig };
        saveConfig(appConfigPath, appConfig);
        // Reinitialize library if libraryRoot changed.
        resetLibrary();
        await ensureLibrary();
        return appConfig;
    });

    ipcMain.handle('ckc:getLibraryDiagnostics', async (_evt, params) => {
        const lib = await ensureLibrary();
        const diag = await lib.getMediaDiagnostics(params || {});
        return { ...diag, configPath: appConfigPath, generatedAt: new Date().toISOString() };
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

    ipcMain.handle('ckc:listCharacters', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listCharacters(params || {});
    });

    ipcMain.handle('ckc:listAllTags', async () => {
        const lib = await ensureLibrary();
        return lib.listAllTags();
    });

    ipcMain.handle('ckc:listGlobalCarouselImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.listGlobalCarouselImages(params || {});
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

    ipcMain.handle('ckc:importImages', async (_evt, params) => {
        const lib = await ensureLibrary();
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Images',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
        });
        if (canceled) return { imported: [], duplicates: [] };

        const first = await lib.importImages({ characterId: params.characterId, filePaths, duplicatePolicy: 'skip' });
        let imported = first.imported || [];

        const duplicates = first.duplicates || [];
        if (duplicates.length > 0) {
            const res = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                message: `Detected ${duplicates.length} duplicate image(s).`,
                detail: 'Skip duplicates is safest. Keep both will import additional copies with deterministic renaming.',
                buttons: ['Keep both', 'Skip duplicates'],
                defaultId: 1,
                cancelId: 1,
            });
            if (res.response === 0) {
                const dupPaths = duplicates.map(d => d.srcPath).filter(Boolean);
                const second = await lib.importImages({ characterId: params.characterId, filePaths: dupPaths, duplicatePolicy: 'keepBoth' });
                imported = imported.concat(second.imported || []);
            }
        }

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

    ipcMain.handle('ckc:exportFieldPack', async (_evt, params) => {
        const lib = await ensureLibrary();
        return lib.exportFieldPack(params);
    });
}

app.whenReady().then(async () => {
    const loaded = loadConfig();
    appConfigPath = loaded.configPath;
    appConfig = loaded.config;
    saveConfig(appConfigPath, appConfig);

    registerIpcHandlers();
    registerProtocolHandlers();
    createWindow();

    // Initialize the library eagerly so the renderer cannot observe a partially-initialized instance.
    try {
        await ensureLibrary();
    } catch (err) {
        try {
            await dialog.showMessageBox(mainWindow, {
                type: 'error',
                message: 'Failed to initialize CastKit Codex library.',
                detail: String(err?.message || err || 'Unknown error'),
                buttons: ['Quit'],
                defaultId: 0,
                noLink: true,
            });
        } finally {
            app.quit();
        }
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
