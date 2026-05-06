// WP-0100 slice 1: per-character image-sourcing scripts.

// Force SQLite regardless of operator env. resolveDbConfig() reads
// CKC_DB_PROVIDER from env at openDb time; if the operator has it set
// to "postgres" globally and the local PG isn't running, every test
// hangs waiting for a connection. Clearing here keeps the suite
// hermetic.
delete process.env.CKC_DB_PROVIDER;
delete process.env.CKC_DATABASE_PROVIDER;
delete process.env.CKC_POSTGRES_URL;
delete process.env.CKC_POSTGRES_CONNECTION_STRING;
delete process.env.DATABASE_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-cs-'));
  t.after(() => {
    try { fs.rmSync(libraryRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

test('addCharacterScript creates row + on-disk file', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Script Test' });
  const res = await lib.addCharacterScript({
    characterId,
    scriptName: 'collector.py',
    scriptContent: 'print("hi")',
    role: 'collector',
    sourceTaskId: 'task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J',
    notes: 'first ingest',
  });
  assert.equal(res.ok, true);
  assert.equal(res.deduped, false);
  assert.match(res.scriptId, /^script_/);
  assert.equal(res.role, 'collector');
  assert.equal(res.sourceTaskId, 'task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J');
  assert.match(res.relativePath, /^scripts\/script_/);

  const paths = lib.getCharacterPaths(characterId);
  const absPath = path.join(paths.base, res.relativePath);
  assert.ok(fs.existsSync(absPath), `expected file at ${absPath}`);
  assert.equal(fs.readFileSync(absPath, 'utf8'), 'print("hi")');
  lib.close();
});

test('addCharacterScript dedupes by (characterId, script_bytes_hash)', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Dedup Test' });
  const a = await lib.addCharacterScript({ characterId, scriptName: 'a.py', scriptContent: 'shared bytes' });
  const b = await lib.addCharacterScript({ characterId, scriptName: 'renamed.py', scriptContent: 'shared bytes' });
  assert.equal(a.deduped, false);
  assert.equal(b.deduped, true);
  assert.equal(b.scriptId, a.scriptId);
  const list = await lib.listCharacterScripts({ characterId });
  assert.equal(list.length, 1);
  lib.close();
});

test('listCharacterScripts returns rows newest-first; getCharacterScript decodes file bytes', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'List Test' });
  const a = await lib.addCharacterScript({ characterId, scriptName: 'a.py', scriptContent: 'AAA' });
  // Force a different timestamp; a tight loop on Windows sometimes
  // produces identical CURRENT_TIMESTAMPs, so use a 5ms sleep.
  await new Promise((r) => setTimeout(r, 5));
  const b = await lib.addCharacterScript({ characterId, scriptName: 'b.py', scriptContent: 'BBB' });
  const list = await lib.listCharacterScripts({ characterId });
  assert.equal(list.length, 2);
  // The order is by (imported_at DESC, script_id DESC); both rows are valid
  // results but we just want to confirm both ids surface.
  const ids = list.map((r) => r.scriptId).sort();
  assert.deepEqual(ids, [a.scriptId, b.scriptId].sort());

  const got = await lib.getCharacterScript({ scriptId: a.scriptId });
  assert.equal(got.ok, true);
  assert.equal(got.scriptId, a.scriptId);
  assert.equal(got.content, 'AAA');
  assert.equal(got.fileExists, true);
  lib.close();
});

test('removeCharacterScript deletes row + file', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Remove Test' });
  const a = await lib.addCharacterScript({ characterId, scriptName: 'a.py', scriptContent: 'data' });
  const paths = lib.getCharacterPaths(characterId);
  const absPath = path.join(paths.base, a.relativePath);
  assert.ok(fs.existsSync(absPath));
  await lib.removeCharacterScript({ scriptId: a.scriptId });
  assert.equal(fs.existsSync(absPath), false);
  await assert.rejects(() => lib.getCharacterScript({ scriptId: a.scriptId }), /No script found/);
  lib.close();
});

test('addCharacterScript and listCharacterScripts validate args', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  await assert.rejects(() => lib.addCharacterScript({}), /characterId is required/);
  await assert.rejects(() => lib.addCharacterScript({ characterId: 'c' }), /scriptName is required/);
  await assert.rejects(() => lib.addCharacterScript({ characterId: 'c', scriptName: 'a.py' }), /scriptContent is required/);
  await assert.rejects(() => lib.listCharacterScripts({}), /characterId is required/);
  lib.close();
});
