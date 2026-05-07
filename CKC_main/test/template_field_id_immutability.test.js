const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseTemplate } = require('../app/backend/templateParser');

const repoRoot = path.resolve(__dirname, '..', '..');
const governanceTemplatePath = path.join(
  repoRoot,
  'CKC_GOV',
  'templates',
  'character_sheet_templates',
  'CHARACTER_SHEET__v2.00.txt'
);
const appTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
const baselinePath = path.join(__dirname, 'fixtures', 'template_v2_00_field_ids.json');
const changelogPath = path.join(__dirname, 'fixtures', 'template_v2_00_field_ids.CHANGELOG.md');

function flattenFields(ast) {
  const rows = [];
  for (const section of ast.sections || []) {
    for (const field of section.fields || []) {
      rows.push({
        id: field.id,
        label: field.label,
        type: field.type,
        blockSchemaName: field.blockSchemaName || null,
        section: field.section || section.title,
      });
    }
  }
  for (const block of ast.blockSchemas || []) {
    for (const field of block.fields || []) {
      rows.push({
        id: field.id,
        label: field.label,
        type: field.type,
        blockSchemaName: field.blockSchemaName || null,
        section: `BLOCK:${block.name}`,
      });
    }
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

test('canonical template field ids are append-only and not reused', () => {
  assert.ok(fs.existsSync(governanceTemplatePath), 'governance canonical template is missing');
  assert.ok(fs.existsSync(appTemplatePath), 'app canonical template is missing');
  assert.ok(fs.existsSync(baselinePath), 'template field-id baseline is missing');
  assert.ok(fs.existsSync(changelogPath), 'template field-id baseline changelog is missing');

  const governanceText = fs.readFileSync(governanceTemplatePath, 'utf8');
  const appText = fs.readFileSync(appTemplatePath, 'utf8');
  assert.equal(appText, governanceText, 'app template must match governance canonical template');

  const ast = parseTemplate(governanceText, 'v2.00', governanceTemplatePath);
  const current = new Map(flattenFields(ast).map((field) => [field.id, field]));
  const baselineDoc = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const baseline = new Map((baselineDoc.fields || []).map((field) => [field.id, field]));

  const failures = [];
  for (const [fieldId, expected] of baseline) {
    const actual = current.get(fieldId);
    if (!actual) {
      failures.push(`${fieldId}: baseline field is missing`);
      continue;
    }
    for (const key of ['label', 'type', 'blockSchemaName']) {
      const a = actual[key] == null ? null : actual[key];
      const e = expected[key] == null ? null : expected[key];
      if (a !== e) failures.push(`${fieldId}: ${key} changed from ${e} to ${a}`);
    }
  }

  assert.deepEqual(failures, []);
});
