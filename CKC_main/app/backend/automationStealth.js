// Background-mode stealth contract (WP-0099).
//
// When CKC runs with CKC_AUTOMATION_BACKGROUND=1 (or
// appConfig.automationBackground), the app must be entirely stealthy:
// no visible window, no focus steal, no taskbar entry, no native
// attention surfaces (notifications, sound, dock bounce), no flashing,
// no globalShortcut hooks on the operator's keyboard.
//
// Pure module: no Electron, no fs, no app deps. main.js wraps every
// visibility-changing or attention-grabbing call through
// assertBackgroundSafe(); the test
// automation_background_stealth_invariants.test.js pins both the
// runtime behavior here and the static call patterns in main.js.

const STEALTH_ENV_FLAG = 'CKC_AUTOMATION_BACKGROUND';

function isBackgroundMode(env, appConfig) {
    const e = env || (typeof process !== 'undefined' && process.env) || {};
    if (String(e[STEALTH_ENV_FLAG] || '').trim() === '1') return true;
    if (appConfig && appConfig.automationBackground) return true;
    return false;
}

function assertBackgroundSafe(env, appConfig, action, callsite, logger) {
    if (!isBackgroundMode(env, appConfig)) return true;
    const detail = { action, callsite };
    try {
        if (logger && typeof logger.logEvent === 'function') {
            logger.logEvent({ sessionId: null, type: 'stealth.skip', details: detail });
        }
    } catch {
        // never let logging breakage propagate; the stealth guarantee is more important
    }
    try {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(`[stealth] skipped ${action} at ${callsite} (background mode)`);
        }
    } catch {
        // ignore
    }
    return false;
}

// Stub returned by safeShowMessageBox when background mode skips the
// dialog. Mirrors Electron's MessageBoxReturnValue shape so call sites
// can treat the result uniformly.
const STEALTH_DIALOG_STUB = Object.freeze({
    response: -1,
    checkboxChecked: false,
    canceled: true,
});

module.exports = {
    STEALTH_ENV_FLAG,
    STEALTH_DIALOG_STUB,
    isBackgroundMode,
    assertBackgroundSafe,
};
