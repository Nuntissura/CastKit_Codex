const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

function makeLib(t) {
  const libraryRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const makeInstance = () =>
    new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  return { makeInstance, libraryRoot };
}

function assertNoBlankPathSegments(absPath, rootPath) {
  const rel = path.relative(rootPath, absPath);
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    assert.equal(/[ \t]/.test(segment), false, `path segment contains blank space: ${segment}`);
  }
}

test('export hub: moodboard png + image set + share pack write to chosen outDir', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Export Test' });

  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  const note = await lib.upsertDoc({ docType: 'notes', title: 'N1', content: 'Hello', tags: [] });
  const story = await lib.upsertDoc({ docType: 'stories', title: 'S1', content: 'World', tags: [] });
  const mood = await lib.upsertDoc({
    docType: 'moodboard',
    title: 'M1',
    content: JSON.stringify({ version: 1, background: { kind: 'paper' }, strokes: [], images: [], texts: [] }),
    tags: [],
  });

  const outDir = path.join(libraryRoot, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAwMB/6X+oXQAAAAASUVORK5CYII=';
  const pngRes = await lib.exportMoodboardPng({ docId: mood.docId, title: 'Mood Test', pngBase64, outDir });
  assert.equal(pngRes.ok, true);
  assert.ok(pngRes.path.includes(path.join(outDir, 'moodboards')));
  assertNoBlankPathSegments(pngRes.path, outDir);
  const pngBytes = fs.readFileSync(pngRes.path);
  assert.equal(pngBytes.slice(0, 8).toString('hex'), '89504e470d0a1a0a');

  const imgRes = await lib.exportImageSet({ characterId, imageIds: [imageId], outDir });
  assert.equal(imgRes.ok, true);
  assert.ok(imgRes.outDir.includes(path.join(outDir, 'image_sets')));
  assertNoBlankPathSegments(imgRes.outDir, outDir);
  assert.equal(imgRes.written.length, 1);
  assert.ok(fs.existsSync(imgRes.written[0].path));
  assertNoBlankPathSegments(imgRes.written[0].path, outDir);

  const packRes = await lib.exportSharePack({
    characterId,
    outDir,
    includeSheet: true,
    imageIds: [imageId],
    docIdsByType: { notes: [note.docId], stories: [story.docId], moodboard: [mood.docId] },
  });
  assert.equal(packRes.ok, true);
  assert.ok(packRes.outDir.includes(path.join(outDir, 'share_packs')));
  assertNoBlankPathSegments(packRes.outDir, outDir);
  assert.ok(fs.existsSync(packRes.manifestPath));
  assert.ok(fs.existsSync(path.join(packRes.outDir, 'sheet', 'character.txt')));

  const manifest = JSON.parse(fs.readFileSync(packRes.manifestPath, 'utf8'));
  assert.equal(manifest.character.id, characterId);
  assert.equal(manifest.includeSheet, true);
  assert.equal(manifest.images.length, 1);
  assert.equal(manifest.docs.notes.length, 1);
  assert.equal(manifest.docs.stories.length, 1);
  assert.equal(manifest.docs.moodboard.length, 1);

  lib.close();
});

test('export hub: web portfolio export writes to chosen outDir', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Web Export Test' });

  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);

  const outDir = path.join(libraryRoot, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const res = await lib.exportWebPortfolio({
    outDir,
    characterIds: [characterId],
    format: 'portfolio',
    imageMode: 'all',
    fieldMode: 'none',
  });
  assert.equal(res.ok, true);
  assert.ok(res.outDir.startsWith(outDir));
  assertNoBlankPathSegments(res.outDir, outDir);
  assert.equal(res.characterCount, 1);
  assert.equal(res.imageCount, 1);

  assert.ok(fs.existsSync(path.join(res.outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(res.outDir, 'README.txt')));
  assert.ok(fs.existsSync(path.join(res.outDir, 'assets', 'style.css')));

  const pages = fs.readdirSync(path.join(res.outDir, 'characters')).filter((f) => f.endsWith('.html'));
  assert.equal(pages.length, 1);
  assert.equal(/[ \t]/.test(pages[0]), false);

  const pageHtml = fs.readFileSync(path.join(res.outDir, 'characters', pages[0]), 'utf8');
  assert.ok(pageHtml.includes('../images/'));

  const characterFolders = fs.readdirSync(path.join(res.outDir, 'images'));
  assert.equal(characterFolders.length, 1);
  assert.equal(/[ \t]/.test(characterFolders[0]), false);
  const imageFiles = fs.readdirSync(path.join(res.outDir, 'images', characterFolders[0]));
  assert.equal(imageFiles.length, 1);

  lib.close();
});
