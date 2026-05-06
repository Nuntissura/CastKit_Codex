// Pins the background-mode stealth contract (WP-0099). When CKC runs
// with CKC_AUTOMATION_BACKGROUND=1 (or appConfig.automationBackground),
// the app must not show, focus, raise, flash, ring, bounce, prompt, or
// register OS-level shortcuts. Direct visibility-changing or
// attention-grabbing calls in main.js must be routed through the
// safeRaiseMainWindow / safeShowMessageBox / assertBackgroundSafe
// guards. This test fails CI if anyone bypasses them.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const MAIN_JS = path.resolve(__dirname, '..', 'app', 'main.js');
const APP_DIR = path.resolve(__dirname, '..', 'app');

const {
  isBackgroundMode,
  assertBackgroundSafe,
  STEALTH_DIALOG_STUB,
  STEALTH_ENV_FLAG,
} = require('../app/backend/automationStealth');

function readMainJs() {
  return fs.readFileSync(MAIN_JS, 'utf8');
}

// Extract the body of a top-level `function name(...) { ... }` block.
// Returns null if not found. Naive brace counter; sufficient for the
// well-shaped helpers we care about.
function extractFunctionBody(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return src.slice(m.index, i);
}

function stripGuardHelpers(src) {
  let out = src;
  for (const name of ['safeRaiseMainWindow', 'safeShowMessageBox', 'assertBackgroundSafe', 'isBackgroundMode']) {
    const body = extractFunctionBody(src, name);
    if (body) out = out.replace(body, '');
  }
  return out;
}

// ---- runtime tests for the pure stealth helpers ----

test('stealth: isBackgroundMode reads the env flag', () => {
  assert.equal(isBackgroundMode({ [STEALTH_ENV_FLAG]: '1' }, null), true);
  assert.equal(isBackgroundMode({ [STEALTH_ENV_FLAG]: '0' }, null), false);
  assert.equal(isBackgroundMode({}, null), false);
});

test('stealth: isBackgroundMode reads appConfig.automationBackground', () => {
  assert.equal(isBackgroundMode({}, { automationBackground: true }), true);
  assert.equal(isBackgroundMode({}, { automationBackground: false }), false);
  assert.equal(isBackgroundMode({}, {}), false);
});

test('stealth: assertBackgroundSafe returns true in operator mode', () => {
  const calls = [];
  const logger = { logEvent: (e) => calls.push(e) };
  assert.equal(assertBackgroundSafe({}, null, 'mainWindow.show', 'test', logger), true);
  assert.equal(calls.length, 0);
});

test('stealth: assertBackgroundSafe returns false in background mode and logs a stealth.skip event', () => {
  const calls = [];
  const logger = { logEvent: (e) => calls.push(e) };
  assert.equal(
    assertBackgroundSafe({ [STEALTH_ENV_FLAG]: '1' }, null, 'mainWindow.show', 'test-callsite', logger),
    false,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'stealth.skip');
  assert.deepStrictEqual(calls[0].details, { action: 'mainWindow.show', callsite: 'test-callsite' });
});

test('stealth: assertBackgroundSafe survives logger throws', () => {
  const broken = { logEvent: () => { throw new Error('logger blew up'); } };
  // Must not propagate; stealth guarantee outranks logging.
  assert.doesNotThrow(() => assertBackgroundSafe({ [STEALTH_ENV_FLAG]: '1' }, null, 'a', 'b', broken));
});

test('stealth: STEALTH_DIALOG_STUB shape is a frozen canceled MessageBox return value', () => {
  assert.deepStrictEqual({ ...STEALTH_DIALOG_STUB }, { response: -1, checkboxChecked: false, canceled: true });
  assert.ok(Object.isFrozen(STEALTH_DIALOG_STUB));
});

// ---- static call-pattern tests on main.js ----

test('stealth: main.js never calls mainWindow.show/focus/restore/moveTop outside safeRaiseMainWindow', () => {
  const stripped = stripGuardHelpers(readMainJs());
  for (const forbidden of [
    'mainWindow.show(',
    'mainWindow.focus(',
    'mainWindow.restore(',
    'mainWindow.moveTop(',
    'mainWindow.flashFrame(',
    'mainWindow.minimize(',
    'mainWindow.maximize(',
  ]) {
    assert.equal(
      stripped.includes(forbidden),
      false,
      `main.js contains direct ${forbidden} outside the safeRaiseMainWindow guard`,
    );
  }
});

test('stealth: main.js never calls dialog.showMessageBox(mainWindow,...) outside safeShowMessageBox', () => {
  const stripped = stripGuardHelpers(readMainJs());
  assert.equal(
    stripped.includes('dialog.showMessageBox(mainWindow'),
    false,
    'main.js contains a direct dialog.showMessageBox(mainWindow,...) call; route through safeShowMessageBox',
  );
});

test('stealth: main.js does not use native attention-grabbing surfaces', () => {
  const src = readMainJs();
  for (const forbidden of [
    'new Notification(',
    'app.show(',
    'app.focus(',
    'dock.bounce(',
    'flashFrame(true)',
    'setSkipTaskbar(false)',
    'setAlwaysOnTop(true)',
  ]) {
    // setAlwaysOnTop may legitimately be called on referenceWindow; permit
    // the substring there but still want to know if it appears against
    // mainWindow. We also allow the constructor-prop declaration in
    // BrowserWindow options (alwaysOnTop:) which uses different syntax.
    if (forbidden === 'setAlwaysOnTop(true)') {
      assert.equal(
        src.includes('mainWindow.setAlwaysOnTop(true)'),
        false,
        'main.js calls mainWindow.setAlwaysOnTop(true); not allowed',
      );
      continue;
    }
    assert.equal(
      src.includes(forbidden),
      false,
      `main.js contains forbidden attention-grabbing call: ${forbidden}`,
    );
  }
});

test('stealth: main.js declares a single-instance lock and a second-instance handler', () => {
  const src = readMainJs();
  assert.ok(/app\.requestSingleInstanceLock\s*\(/.test(src), 'main.js missing app.requestSingleInstanceLock()');
  assert.ok(/app\.on\(\s*['"]second-instance['"]/.test(src), 'main.js missing app.on(\'second-instance\', ...)');
  // The second-instance handler must route through the guard, not call
  // mainWindow.show/focus directly.
  const onIdx = src.indexOf("app.on('second-instance'");
  assert.ok(onIdx >= 0, 'second-instance handler not found');
  // grab roughly 600 chars after the handler open
  const slice = src.slice(onIdx, onIdx + 800);
  assert.ok(slice.includes('safeRaiseMainWindow'), 'second-instance handler must call safeRaiseMainWindow');
});

test('stealth: main.js guards globalShortcut.register through assertBackgroundSafe', () => {
  const src = readMainJs();
  const idx = src.indexOf('globalShortcut.register(');
  assert.ok(idx > 0, 'globalShortcut.register not found in main.js');
  // Look at the ~400 chars before the call. There must be an
  // assertBackgroundSafe guard nearby that returns/early-exits.
  const before = src.slice(Math.max(0, idx - 600), idx);
  assert.ok(
    before.includes("assertBackgroundSafe('globalShortcut.register'"),
    'globalShortcut.register must be preceded by an assertBackgroundSafe guard',
  );
});

test('stealth: main.js guards createReferenceWindow through assertBackgroundSafe', () => {
  const src = readMainJs();
  const body = extractFunctionBody(src, 'createReferenceWindow');
  assert.ok(body, 'createReferenceWindow function body not found');
  assert.ok(
    body.includes("assertBackgroundSafe('createReferenceWindow'"),
    'createReferenceWindow must short-circuit via assertBackgroundSafe in background mode',
  );
});

test('stealth: every backend helper file is free of attention-grabbing calls (Notification, dock.bounce, flashFrame)', () => {
  function* walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) yield* walk(full);
      else if (e.isFile() && /\.(js|ts|tsx|jsx|cjs|mjs)$/.test(full)) yield full;
    }
  }
  for (const file of walk(APP_DIR)) {
    if (file === MAIN_JS) continue; // main.js covered above
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of ['new Notification(', 'dock.bounce(', 'flashFrame(true)']) {
      assert.equal(
        text.includes(forbidden),
        false,
        `${path.relative(APP_DIR, file)} contains forbidden attention-grabbing call: ${forbidden}`,
      );
    }
  }
});
