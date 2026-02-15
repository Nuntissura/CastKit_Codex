const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('startup guard: uninitialized DB throws friendly error (not TypeError)', async (t) => {
  const libraryRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });

  await assert.rejects(
    async () => {
      await lib.listGlobalCarouselImages({ preferFrontpage: true });
    },
    (err) => {
      assert.ok(err);
      assert.notEqual(err.name, 'TypeError');
      assert.equal(err.code, 'CKC_DB_NOT_READY');
      assert.match(String(err.message || ''), /db not initialized/i);
      return true;
    }
  );

  await lib.initialize();
  const rows = await lib.listGlobalCarouselImages({ preferFrontpage: true });
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 0);

  lib.close();
});

