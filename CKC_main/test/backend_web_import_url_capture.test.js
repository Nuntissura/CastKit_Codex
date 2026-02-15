const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
}

test('web import: importFromUrl stores provenance and allows editing source_note', async (t) => {
  const libraryRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  // 1x1 transparent PNG.
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X8l3cAAAAASUVORK5CYII=',
    'base64'
  );

  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': String(pngBytes.length),
    });
    res.end(pngBytes);
  });

  await listen(server);
  t.after(() => {
    try {
      server.close();
    } catch {
      // ignore
    }
  });

  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/img.png`;

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Test' });

  const first = await lib.importFromUrl({ characterId, url, sourceNote: 'site ref' });
  assert.equal(Array.isArray(first.imported), true);
  assert.equal(first.imported.length, 1);
  assert.equal(Array.isArray(first.duplicates), true);

  const c1 = await lib.getCharacter(characterId);
  assert.ok(c1);
  assert.ok(Array.isArray(c1.images));
  assert.ok(c1.images.length >= 1);
  const img = c1.images[0];
  assert.ok(img);
  assert.ok(String(img.sourceUrl || '').includes('/img.png'));
  assert.equal(String(img.sourceNote || ''), 'site ref');
  assert.equal(img.sourcePath, null);

  await lib.setImageMeta({ imageId: img.id, sourceNote: 'updated note' });
  const c2 = await lib.getCharacter(characterId);
  const img2 = c2.images.find((x) => x.id === img.id);
  assert.ok(img2);
  assert.equal(String(img2.sourceNote || ''), 'updated note');

  const second = await lib.importFromUrl({ characterId, url });
  assert.equal(Array.isArray(second.imported), true);
  assert.equal(second.imported.length, 0);
  assert.equal(Array.isArray(second.duplicates), true);
  assert.equal(second.duplicates.length, 1);

  lib.close();
});

