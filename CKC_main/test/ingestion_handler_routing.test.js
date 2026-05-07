const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { listWorkflowSpecs } = require('../app/backend/workflowSpecRegistry');
const { HANDLERS, resolveHandler } = require('../app/backend/imageSourcingAdapter');

const handlersDir = path.join(__dirname, '..', 'app', 'backend', 'imageSourcingHandlers');
const pinnedPath = path.join(handlersDir, '_pinned.json');

function handlerModuleForSpecVersion(specVersion) {
  const m = /^v(\d+)\.(\d+)$/.exec(String(specVersion || '').trim());
  if (!m) return null;
  return `v${m[1]}_${m[2]}.js`;
}

test('every registered workflow spec has a pinned ingestion handler', () => {
  const registry = listWorkflowSpecs();
  assert.equal(registry.ok, true);
  assert.equal(registry.errors.length, 0, JSON.stringify(registry.errors));

  const pinned = JSON.parse(fs.readFileSync(pinnedPath, 'utf8'));
  const pinnedBySpec = new Map((pinned.handlers || []).map((h) => [String(h.specVersion), h]));
  const failures = [];

  for (const spec of registry.specs) {
    const specVersion = String(spec.specVersion || '');
    const expectedModule = handlerModuleForSpecVersion(specVersion);
    const pinnedEntry = pinnedBySpec.get(specVersion);

    if (!expectedModule) failures.push(`${spec.fileName}: invalid spec_version ${specVersion}`);
    if (!pinnedEntry) failures.push(`${spec.fileName}: missing _pinned.json entry for ${specVersion}`);
    if (pinnedEntry && pinnedEntry.module !== expectedModule) {
      failures.push(`${spec.fileName}: pinned module ${pinnedEntry.module} should be ${expectedModule}`);
    }
    if (expectedModule && !fs.existsSync(path.join(handlersDir, expectedModule))) {
      failures.push(`${spec.fileName}: missing handler file ${expectedModule}`);
    }
    if (!Object.prototype.hasOwnProperty.call(HANDLERS, specVersion)) {
      failures.push(`${spec.fileName}: dispatcher HANDLERS missing ${specVersion}`);
    } else {
      assert.equal(resolveHandler(specVersion), HANDLERS[specVersion]);
    }
  }

  for (const entry of pinned.handlers || []) {
    const specVersion = String(entry.specVersion || '');
    const moduleName = String(entry.module || '');
    if (!specVersion || !moduleName) failures.push(`pinned entry is incomplete: ${JSON.stringify(entry)}`);
    if (moduleName && !fs.existsSync(path.join(handlersDir, moduleName))) {
      failures.push(`pinned handler file missing: ${moduleName}`);
    }
    if (specVersion && !Object.prototype.hasOwnProperty.call(HANDLERS, specVersion)) {
      failures.push(`pinned handler not registered in dispatcher: ${specVersion}`);
    }
  }

  assert.deepEqual(failures, []);
});
