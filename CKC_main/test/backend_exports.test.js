const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('exportEmptyTemplate copies canonical bytes (no rewrites)', async (t) => {
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
  await lib.initialize();
  t.after(() => lib.close());

  const res = await lib.exportEmptyTemplate({});
  assert.equal(res.ok, true);

  const exportedBytes = fs.readFileSync(res.path);
  const templateBytes = fs.readFileSync(builtInTemplatePath);
  assert.equal(Buffer.compare(exportedBytes, templateBytes), 0);
});

test('exportTemplateFieldPack is deterministic and writes outside repo', async (t) => {
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
  await lib.initialize();
  t.after(() => lib.close());

  const presets = await lib.listSpinOffs({ templateId: 'v2.00' });
  const safe = presets.find((p) => p.isBuiltin && String(p.name || '').toLowerCase().includes('safe subset'));
  assert.ok(safe, 'expected built-in Safe Subset spin-off');

  const a = await lib.exportTemplateFieldPack({ templateId: 'v2.00', spinoffId: safe.id });
  const b = await lib.exportTemplateFieldPack({ templateId: 'v2.00', spinoffId: safe.id });

  const aText = fs.readFileSync(a.path, 'utf8');
  const bText = fs.readFileSync(b.path, 'utf8');
  assert.equal(aText, bText);

  const lines = aText.split('\n');
  assert.ok(lines.length > 2);
  assert.equal(lines.at(-1), '');
  for (const line of lines.slice(0, -1)) {
    assert.match(line, /: $/);
  }

  const exportsDir = lib.getPaths().exportsDir;
  assert.ok(path.resolve(a.path).startsWith(path.resolve(exportsDir)));
});

