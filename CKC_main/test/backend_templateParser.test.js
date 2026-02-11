const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTemplate, normalizeDashVariants } = require('../app/backend/templateParser');

test('templateParser.normalizeDashVariants normalizes common dash variants', () => {
  assert.equal(normalizeDashVariants('a-b'), 'a—b');
  assert.equal(normalizeDashVariants('a–b'), 'a—b');
});

test('templateParser.parseTemplate parses sections + fields + inferred types', () => {
  const content = [
    'CHARACTER SHEET — (v2.00)',
    '',
    'IDENTITY',
    'CHAR-ID-001 — Character_ID: <string>',
    'CHAR-ID-002 — Name: <string>',
    '',
    'BODY',
    'CHAR-BDY-001 — Height: <integer>',
    '',
  ].join('\n');

  const ast = parseTemplate(content, 'v2.00', 'memory');

  assert.equal(ast.id, 'v2.00');
  assert.equal(ast.version, '2.00');
  assert.ok(ast.hash && typeof ast.hash === 'string');
  assert.ok(Array.isArray(ast.sections) && ast.sections.length >= 2);

  const allFields = ast.sections.flatMap((s) => s.fields);
  const byId = new Map(allFields.map((f) => [f.id, f]));

  assert.equal(byId.get('CHAR-ID-001')?.type, 'string');
  assert.equal(byId.get('CHAR-ID-002')?.label, 'Name');
  assert.equal(byId.get('CHAR-BDY-001')?.type, 'integer');
});

