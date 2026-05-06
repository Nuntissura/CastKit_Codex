// Pins the strict invariants for window-scoped synthetic input
// (WP-0099). Synthetic input must route only through Electron
// `mainWindow.webContents.sendInputEvent` (main process) and
// renderer-side DOM `dispatchEvent` (App.tsx). OS-level input
// libraries are forbidden so operator focus/cursor/keyboard cannot
// be hijacked.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.resolve(__dirname, '..', 'app');
const SRC_DIR = path.resolve(__dirname, '..', 'src');

// Forbidden: OS-level keyboard/mouse libraries and native input APIs
// that can affect windows other than CKC or steal operator focus.
const FORBIDDEN_TOKENS = [
  'robotjs',
  'robot-js',
  'nut.js',
  'nut-js',
  '@nut-tree',
  '@nut-tree-fork',
  'node-key-sender',
  'autohotkey',
  'AutoHotkey',
  'SendInput',
  'PostMessage',
  'keybd_event',
  'mouse_event',
  'CGEventCreate',
  'XTestFakeKeyEvent',
];

// package.json dependency keys we forbid (any value).
const FORBIDDEN_PACKAGE_NAMES = new Set([
  'robotjs',
  'robot-js',
  'nut-js',
  '@nut-tree/nut-js',
  '@nut-tree-fork/nut-js',
  'node-key-sender',
]);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function readSourceFiles() {
  const files = [];
  for (const root of [APP_DIR, SRC_DIR]) {
    for (const file of walk(root)) {
      if (/\.(js|ts|tsx|jsx|cjs|mjs)$/.test(file)) {
        files.push(file);
      }
    }
  }
  return files;
}

// Files that are allowed to mention forbidden tokens because they are
// pure documentation prose teaching agents what NOT to use, not code
// that imports anything. Add files here only when the entire file is
// documentation; never use this to silence a real import.
const DOC_ALLOWLIST = new Set([
  path.resolve(APP_DIR, 'backend', 'automationManual.js'),
]);

test('input injection: source tree contains no OS-level keyboard/mouse library tokens', () => {
  const offending = [];
  for (const file of readSourceFiles()) {
    if (file === __filename) continue;
    if (DOC_ALLOWLIST.has(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const token of FORBIDDEN_TOKENS) {
      if (text.includes(token)) {
        offending.push({ file: path.relative(path.resolve(__dirname, '..'), file), token });
      }
    }
  }
  assert.deepStrictEqual(
    offending,
    [],
    `forbidden OS-level input library tokens found in source: ${JSON.stringify(offending, null, 2)}`,
  );
});

test('input injection: package.json declares no OS-level input library deps', () => {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
  const offending = Object.keys(allDeps).filter((name) => FORBIDDEN_PACKAGE_NAMES.has(name));
  assert.deepStrictEqual(
    offending,
    [],
    `forbidden OS-level input library deps in package.json: ${offending.join(', ')}`,
  );
});

test('input injection: synthetic input goes through webContents.sendInputEvent only (main.js)', () => {
  const mainSrc = fs.readFileSync(path.join(APP_DIR, 'main.js'), 'utf8');
  // injectKey/injectMouse implementations must reference sendInputEvent
  // and must not reference focus()/show()/raise()/setAlwaysOnTop on
  // the main window inside their bodies.
  const runSyntheticKeyMatch = /function\s+runSyntheticKey\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(mainSrc);
  const runSyntheticMouseMatch = /function\s+runSyntheticMouse\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(mainSrc);
  assert.ok(runSyntheticKeyMatch, 'runSyntheticKey not found in main.js');
  assert.ok(runSyntheticMouseMatch, 'runSyntheticMouse not found in main.js');
  const keyBody = runSyntheticKeyMatch[1];
  const mouseBody = runSyntheticMouseMatch[1];
  assert.ok(keyBody.includes('webContents.sendInputEvent'), 'runSyntheticKey must call webContents.sendInputEvent');
  assert.ok(mouseBody.includes('webContents.sendInputEvent'), 'runSyntheticMouse must call webContents.sendInputEvent');
  for (const forbidden of ['mainWindow.show', 'mainWindow.focus', 'mainWindow.moveTop', 'setAlwaysOnTop', 'flashFrame']) {
    assert.equal(
      keyBody.includes(forbidden),
      false,
      `runSyntheticKey must not call ${forbidden}`,
    );
    assert.equal(
      mouseBody.includes(forbidden),
      false,
      `runSyntheticMouse must not call ${forbidden}`,
    );
  }
});

test('input injection: clickElement/typeText use renderer DOM dispatch (App.tsx)', () => {
  const appPath = path.join(SRC_DIR, 'ui', 'App.tsx');
  const text = fs.readFileSync(appPath, 'utf8');
  // Both arms must exist and use dispatchEvent, not synthetic IPC bypass.
  assert.ok(/command === 'clickElement'/.test(text), 'App.tsx missing clickElement automation arm');
  assert.ok(/command === 'typeText'/.test(text), 'App.tsx missing typeText automation arm');
  // typeText must use the native value setter so React state updates.
  assert.ok(
    /Object\.getOwnPropertyDescriptor\(\s*proto\s*,\s*['"]value['"]\s*\)/.test(text),
    'typeText must use the native value setter (HTMLInputElement.prototype.value setter) so React onChange fires',
  );
});

test('input injection: getAutomationCommandMap exposes all four input commands under renderer', () => {
  const { getAutomationCommandMap } = require('../app/backend/automationCommandMap');
  const renderer = getAutomationCommandMap().renderer;
  for (const name of ['injectKey', 'injectMouse', 'clickElement', 'typeText']) {
    assert.ok(renderer.includes(name), `renderer command map missing ${name}`);
  }
});
