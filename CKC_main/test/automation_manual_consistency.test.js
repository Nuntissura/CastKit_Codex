// Self-consistency test for the in-app LLM manual.
//
// Per CKC_GOV/PROJECT_CODEX.md "Code-truth and documentation consistency":
// every entry in featureGroups[].commands and commandReference[].id MUST
// resolve to a wired automation command via automationCommandMap.js, or
// be prefixed `script:` for a documented external script. Aspirational
// items go in featureGroups[].roadmap. This test fails CI if the manual
// drifts from the wired surface.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const {
  getAutomationCommandMap,
  TOP_LEVEL_AUTOMATION_IPC,
  classifyAutomationCommand,
  getAllWiredAutomationCommands,
} = require('../app/backend/automationCommandMap');

const {
  featureGroups,
  commandReference,
  getAutomationManual,
  MANUAL_VERSION,
} = require('../app/backend/automationManual');

const SCRIPT_PREFIX = 'script:';
const GOV_SCRIPTS_DIR = path.resolve(__dirname, '..', '..', 'CKC_GOV', 'scripts');

function isScriptRef(name) {
  return typeof name === 'string' && name.startsWith(SCRIPT_PREFIX);
}

function isWiredCommand(name) {
  return classifyAutomationCommand(name) !== null;
}

test('manual: featureGroups[].commands all resolve to a wired command or governance script', () => {
  for (const group of featureGroups) {
    assert.ok(Array.isArray(group.commands), `group ${group.id} missing commands array`);
    for (const name of group.commands) {
      if (isScriptRef(name)) {
        const scriptName = name.slice(SCRIPT_PREFIX.length);
        const scriptPath = path.join(GOV_SCRIPTS_DIR, scriptName);
        assert.ok(
          fs.existsSync(scriptPath),
          `group ${group.id}: script reference '${name}' does not exist at ${scriptPath}`,
        );
        continue;
      }
      assert.ok(
        isWiredCommand(name),
        `group ${group.id}: command '${name}' is not in getAutomationCommandMap() or TOP_LEVEL_AUTOMATION_IPC; move to roadmap or wire the code`,
      );
    }
  }
});

test('manual: featureGroups[].roadmap entries are not also in commands (no double-listing)', () => {
  for (const group of featureGroups) {
    const commands = new Set(group.commands || []);
    const roadmap = group.roadmap || [];
    for (const item of roadmap) {
      // roadmap entries can carry parenthetical context; extract the leading identifier
      const id = String(item).split(/\s|\(/)[0];
      assert.ok(
        !commands.has(id),
        `group ${group.id}: '${id}' is in both commands and roadmap; pick one`,
      );
    }
  }
});

test('manual: commandReference[].id all resolve to a wired command (no aspirational ids)', () => {
  for (const cmd of commandReference) {
    assert.ok(cmd && typeof cmd === 'object' && cmd.id, 'commandReference entry missing id');
    assert.ok(
      isWiredCommand(cmd.id),
      `commandReference: '${cmd.id}' is not wired; remove the entry, or wire the code, or move to a roadmap field`,
    );
    assert.ok(typeof cmd.target === 'string' && cmd.target.length > 0, `commandReference '${cmd.id}' missing target`);
    assert.ok(typeof cmd.description === 'string' && cmd.description.length > 0, `commandReference '${cmd.id}' missing description`);
    assert.ok(cmd.example && typeof cmd.example === 'object', `commandReference '${cmd.id}' missing example`);
  }
});

test('manual: every wired automation command appears in commandReference at least once', () => {
  const wired = getAllWiredAutomationCommands();
  const documented = new Set(commandReference.map((c) => c.id));
  const missing = wired.filter((name) => !documented.has(name));
  assert.deepStrictEqual(
    missing,
    [],
    `wired commands missing from manual.commandReference: ${missing.join(', ')}. Document each one or explicitly opt out.`,
  );
});

test('manual: commandReference target labels match classifyAutomationCommand output', () => {
  for (const cmd of commandReference) {
    const buckets = classifyAutomationCommand(cmd.id) || [];
    const expected = buckets.join('/');
    assert.equal(
      cmd.target,
      expected,
      `commandReference '${cmd.id}' has target '${cmd.target}' but classifier says '${expected}'`,
    );
  }
});

test('manual: getAutomationManual exposes index/json/markdown formats and pinned MANUAL_VERSION', () => {
  const j = getAutomationManual({ format: 'json' });
  assert.equal(j.ok, true);
  assert.equal(j.manualVersion, MANUAL_VERSION);
  assert.ok(Array.isArray(j.featureGroups) && j.featureGroups.length > 0);
  assert.ok(Array.isArray(j.commandReference) && j.commandReference.length > 0);
  assert.deepStrictEqual(j.commandMap, getAutomationCommandMap());

  const i = getAutomationManual({ format: 'index' });
  assert.equal(i.ok, true);
  assert.equal(i.manualVersion, MANUAL_VERSION);
  assert.ok(Array.isArray(i.index));

  const m = getAutomationManual({ format: 'markdown' });
  assert.equal(m.ok, true);
  assert.equal(m.manualVersion, MANUAL_VERSION);
  assert.ok(typeof m.markdown === 'string' && m.markdown.includes('Quick start'));
});

test('manual: TOP_LEVEL_AUTOMATION_IPC superset of commandMap.control', () => {
  const map = getAutomationCommandMap();
  for (const name of map.control) {
    assert.ok(
      TOP_LEVEL_AUTOMATION_IPC.includes(name),
      `commandMap.control entry '${name}' missing from TOP_LEVEL_AUTOMATION_IPC`,
    );
  }
});
