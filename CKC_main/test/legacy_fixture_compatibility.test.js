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
const { all, get } = require('../app/backend/db');
const { validateCharacterValues } = require('../app/backend/validation');

const fixturesRoot = path.join(__dirname, 'fixtures', 'legacy');
const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempLibrary(t, fixtureDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-legacy-fixture-'));
  t.after(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  fs.cpSync(fixtureDir, root, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'manifest.json',
  });
  return root;
}

test('frozen legacy fixtures migrate and round-trip under current CKCLibrary', async (t) => {
  assert.ok(fs.existsSync(fixturesRoot), 'legacy fixture directory is missing');
  const fixtureNames = fs.readdirSync(fixturesRoot)
    .filter((name) => fs.statSync(path.join(fixturesRoot, name)).isDirectory())
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(fixtureNames, ['wp-0091', 'wp-0100', 'wp-0103', 'wp-0104']);

  for (const fixtureName of fixtureNames) {
    await t.test(fixtureName, async (tt) => {
      const fixtureDir = path.join(fixturesRoot, fixtureName);
      const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
      const libraryRoot = makeTempLibrary(tt, fixtureDir);
      const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
      await lib.initialize();
      tt.after(() => lib.close());

      const characterRows = await all(lib.db, `SELECT character_id FROM Character WHERE is_system = 0 ORDER BY character_id`);
      const imageCount = await get(lib.db, `SELECT COUNT(*) AS c FROM ImageAsset`);
      const tagCount = await get(lib.db, `SELECT COUNT(*) AS c FROM CharacterTag`);
      assert.equal(characterRows.length, manifest.character_count, `${fixtureName} character_count`);
      assert.equal(Number(imageCount.c), manifest.image_count, `${fixtureName} image_count`);
      assert.equal(Number(tagCount.c), manifest.tag_count, `${fixtureName} tag_count`);

      const templateAst = await lib.getTemplateAst('v2.00');
      for (const expected of manifest.characters) {
        const character = await lib.getCharacter(expected.character_id);
        assert.ok(character, `${fixtureName} should load ${expected.character_id}`);
        assert.equal(character.displayName, expected.display_name);
        assert.equal(character.valuesById[expected.sample_sheet_field.field_id], expected.sample_sheet_field.value);
        for (const tag of expected.tags || []) {
          assert.ok(character.tags.some((t) => t.text === tag), `${fixtureName} missing tag ${tag}`);
        }
        for (const image of expected.images || []) {
          const got = character.images.find((img) => img.id === image.image_id);
          assert.ok(got, `${fixtureName} missing image ${image.image_id}`);
          assert.equal(got.fileHash, image.file_hash);
          const abs = path.join(lib.getCharacterPaths(character.id).base, got.relativePath.replaceAll('/', path.sep));
          assert.ok(fs.existsSync(abs), `${fixtureName} missing image bytes for ${image.image_id}`);
        }
        if (expected.sample_block_list_value) {
          assert.equal(character.valuesById[expected.sample_block_list_value.field_id], expected.sample_block_list_value.value);
        }

        const allowedIssues = new Set(expected.known_issues || []);
        const unexpectedErrors = validateCharacterValues(templateAst, character.valuesById, 'strict')
          .issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => `${issue.fieldId}:${issue.message}`)
          .filter((issueKey) => !allowedIssues.has(issueKey));
        assert.deepEqual(unexpectedErrors, []);
      }
    });
  }
});
