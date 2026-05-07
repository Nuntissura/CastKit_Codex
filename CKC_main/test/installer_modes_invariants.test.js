const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NSH_PATH = path.join(__dirname, '..', 'scripts', 'installer_custom.nsh');
const PACKAGE_SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'package_win.ps1');

test('installer reset modes are wired through electron-builder staging', () => {
  const script = fs.readFileSync(PACKAGE_SCRIPT_PATH, 'utf8');
  assert.match(script, /installer_custom\.nsh/);
  assert.match(script, /include\s*=\s*'scripts\/installer_custom\.nsh'|include\s*=\s*'scripts\\installer_custom\.nsh'/);
});

test('installer custom NSIS defines four reset modes and marker handoff', () => {
  const text = fs.readFileSync(NSH_PATH, 'utf8');
  for (const expected of ['update', 'reinstall', 'light', 'full']) {
    assert.match(text, new RegExp(`"${expected}"`), `missing mode ${expected}`);
  }
  assert.match(text, /\.ckc-pending-full-reset/);
  assert.match(text, /ckc-config\.json/);
  assert.match(text, /Local Storage/);
  assert.match(text, /Session Storage/);
  assert.match(text, /IndexedDB/);
});

test('installer reset actions never delete preserved image byte directories', () => {
  const text = fs.readFileSync(NSH_PATH, 'utf8');
  const destructiveLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(Delete|RMDir)\b/i.test(line));

  assert.ok(destructiveLines.length > 0, 'expected destructive installer lines to audit');
  for (const line of destructiveLines) {
    assert.doesNotMatch(line, /images\\original/i, line);
    assert.doesNotMatch(line, /images\\thumb/i, line);
    assert.doesNotMatch(line, /images\/original/i, line);
    assert.doesNotMatch(line, /images\/thumb/i, line);
  }
});
