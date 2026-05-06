// Canonical source of truth for the LLM-callable automation surface.
// Pure data: no Electron, no fs, no app deps. Both main.js and tests
// require this module; the in-app manual reconciles itself against it.

function getAutomationCommandMap() {
    return {
        control: [
            'automationGetManual',
            'automationCreateSession',
            'automationHeartbeat',
            'automationEndSession',
            'automationListSessions',
            'automationAcquireLease',
            'automationReleaseLease',
            'automationListLog',
            'automationCaptureToFile',
        ],
        renderer: [
            'openLibrary',
            'openCharacter',
            'openExports',
            'openIntake',
            'selectImage',
            'openGlobalSearch',
            'toggleMenu',
            'closeOverlays',
            'getRendererState',
            'getRendererUIState',
            'injectKey',
            'injectMouse',
            'clickElement',
            'typeText',
        ],
        backend: [
            'listCharacters',
            'getCharacter',
            'listGlobalCarouselImages',
            'listPendingImages',
            'importImages',
            'setImageMeta',
            'scanIntakeFolder',
            'classifyIntakeImage',
            'saveCharacter',
            'createCharacter',
            'softDeleteCharacters',
            'restoreCharacters',
            'listTemplates',
            'setImagesMetaBatch',
            'listAllTags',
            'globalSearch',
        ],
    };
}

// Top-level Electron IPC methods that LLMs invoke directly through the
// preload bridge (window.ckc.automation*). Superset of the `control`
// group plus a few meta-helpers that are not dispatched via
// automationRunCommand: state inspection, the dispatcher itself, the
// in-memory capture variant, and the renderer-state setter.
const TOP_LEVEL_AUTOMATION_IPC = [
    // session + manual + lease + log (also in commandMap.control)
    'automationGetManual',
    'automationCreateSession',
    'automationHeartbeat',
    'automationEndSession',
    'automationListSessions',
    'automationAcquireLease',
    'automationReleaseLease',
    'automationListLog',
    'automationCaptureToFile',
    // meta-helpers (not in commandMap)
    'automationGetState',
    'automationRunCommand',
    'automationCapture',
    'automationSetRendererState',
];

function getAllWiredAutomationCommands() {
    const map = getAutomationCommandMap();
    const set = new Set();
    for (const list of Object.values(map)) for (const name of list) set.add(name);
    for (const name of TOP_LEVEL_AUTOMATION_IPC) set.add(name);
    return [...set].sort();
}

function classifyAutomationCommand(name) {
    const map = getAutomationCommandMap();
    if (TOP_LEVEL_AUTOMATION_IPC.includes(name)) {
        if (map.control.includes(name)) return ['top-level', 'control'];
        return ['top-level'];
    }
    if (map.renderer.includes(name)) return ['renderer'];
    if (map.backend.includes(name)) return ['backend'];
    if (map.control.includes(name)) return ['control'];
    return null;
}

module.exports = {
    getAutomationCommandMap,
    TOP_LEVEL_AUTOMATION_IPC,
    getAllWiredAutomationCommands,
    classifyAutomationCommand,
};
