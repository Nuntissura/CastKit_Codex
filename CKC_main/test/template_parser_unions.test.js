// WP-0103: union-aware field type inference.
// Pre-existing bugs surfaced by the post-WP-0100 sheet test campaign:
// - <string | unset> was misclassified as enum with values ['string', 'unset']
// - <integer | adult> was misclassified as enum with values ['integer', 'adult']
// - <score_10 | optional> was misclassified as enum (no range check fired)
// - <a | b | other:<descriptor> | unknown> matched the embedded <descriptor>
//   substring and was misclassified as descriptor — single-word valid enum
//   values like "curvy" were rejected with "Descriptor must be 2-12 words".

const test = require('node:test');
const assert = require('node:assert/strict');

// inferFieldType is not directly exported. The parseTemplate output
// surfaces it through field.type / field.enumValues / field.allowedSpecialValues
// / field.allowOtherType. Drive through the public surface.
const { parseTemplate } = require('../app/backend/templateParser');

function buildTemplate(field) {
  return [
    'CHARACTER SHEET — (v2.00-test)',
    '',
    'TEST SECTION',
    field,
    '',
  ].join('\n');
}

function fieldFromLine(line) {
  const ast = parseTemplate(buildTemplate(line));
  const all = ast.sections.flatMap((s) => s.fields);
  return all[0];
}

test('parser: <string> non-union is type "string"', () => {
  const f = fieldFromLine('TEST-A-001 — Field: <string>');
  assert.equal(f.type, 'string');
  assert.equal(f.enumValues, undefined);
});

test('parser: <string | unset> resolves to type "string", not enum', () => {
  const f = fieldFromLine('TEST-A-002 — Field: <string | unset>');
  assert.equal(f.type, 'string');
  assert.deepStrictEqual(f.allowedSpecialValues, ['unset']);
  assert.equal(f.enumValues, undefined);
});

test('parser: <integer | adult> resolves to type "integer" with sentinel "adult"', () => {
  const f = fieldFromLine('TEST-A-003 — Field: <integer | adult>');
  assert.equal(f.type, 'integer');
  assert.deepStrictEqual(f.allowedSpecialValues, ['adult']);
});

test('parser: <integer | optional> resolves to type "integer"', () => {
  const f = fieldFromLine('TEST-A-004 — Field: <integer | optional>');
  assert.equal(f.type, 'integer');
  assert.deepStrictEqual(f.allowedSpecialValues, ['optional']);
});

test('parser: <score_10 | optional> resolves to type "score_10"', () => {
  const f = fieldFromLine('TEST-A-005 — Field: <score_10 | optional>');
  assert.equal(f.type, 'score_10');
});

test('parser: <descriptor | optional> resolves to type "descriptor"', () => {
  const f = fieldFromLine('TEST-A-006 — Field: <descriptor | optional>');
  assert.equal(f.type, 'descriptor');
});

test('parser: <paragraph | optional> resolves to type "paragraph"', () => {
  const f = fieldFromLine('TEST-A-007 — Field: <paragraph | optional>');
  assert.equal(f.type, 'paragraph');
});

test('parser: <list | optional> resolves to type "list"', () => {
  const f = fieldFromLine('TEST-A-008 — Field: <list | optional>');
  assert.equal(f.type, 'list');
});

test('parser: <list of XYZ_Block | optional> resolves to type "block_list"', () => {
  const f = fieldFromLine('TEST-A-009 — Field: <list of Hustle_Block | optional>');
  assert.equal(f.type, 'block_list');
  assert.equal(f.blockSchemaName, 'Hustle_Block');
});

test('parser: <Sex_Profile_Block | optional> resolves to type "block"', () => {
  const f = fieldFromLine('TEST-A-010 — Field: <Sex_Profile_Block | optional>');
  assert.equal(f.type, 'block');
  assert.equal(f.blockSchemaName, 'Sex_Profile_Block');
});

test('parser: pure enum <a | b | c> resolves to type "enum" with all values', () => {
  const f = fieldFromLine('TEST-A-011 — Field: <fictional | original | composite>');
  assert.equal(f.type, 'enum');
  assert.deepStrictEqual(f.enumValues, ['fictional', 'original', 'composite']);
});

test('parser: <a | b | other:<descriptor> | unknown> resolves to enum + allowOtherType + special unknown', () => {
  const f = fieldFromLine('TEST-A-012 — Field: <slim | athletic | curvy | other:<descriptor> | unknown>');
  assert.equal(f.type, 'enum');
  assert.deepStrictEqual(f.enumValues, ['slim', 'athletic', 'curvy']);
  assert.equal(f.allowOtherType, 'descriptor');
  assert.deepStrictEqual(f.allowedSpecialValues, ['unknown']);
});

test('parser: <a | b | other:<string>> resolves to enum + allowOtherType=string', () => {
  const f = fieldFromLine('TEST-A-013 — Field: <body | face | voice | other:<string>>');
  assert.equal(f.type, 'enum');
  assert.deepStrictEqual(f.enumValues, ['body', 'face', 'voice']);
  assert.equal(f.allowOtherType, 'string');
});

test('parser: <rule> field is type "rule"', () => {
  const f = fieldFromLine('TEST-A-014 — Field: <rule> (some inline guidance.)');
  assert.equal(f.type, 'rule');
});

test('parser: real template parses without ANY field claiming enumValues like ["string","unset"]', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const tplPath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const ast = parseTemplate(fs.readFileSync(tplPath, 'utf8'));
  const offending = [];
  for (const s of ast.sections) {
    for (const f of s.fields) {
      if (f.type === 'enum' && Array.isArray(f.enumValues)) {
        for (const v of f.enumValues) {
          const lower = String(v).toLowerCase();
          if (['string', 'integer', 'number', 'paragraph', 'descriptor', 'score_10', 'list'].includes(lower)) {
            offending.push({ id: f.id, badEnumValue: v });
          }
        }
      }
    }
  }
  assert.deepStrictEqual(offending, [], `parser leaked type-keywords into enumValues: ${JSON.stringify(offending)}`);
});
