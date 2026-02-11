const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseTemplate } = require('../app/backend/templateParser');

test('canonical template parses and contains expected field ids', () => {
  const templatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const content = fs.readFileSync(templatePath, 'utf8');

  const ast = parseTemplate(content, 'v2.00', templatePath);
  assert.equal(ast.version, '2.00');

  const allFields = ast.sections.flatMap((s) => s.fields);
  const ids = new Set(allFields.map((f) => f.id));
  assert.ok(ids.has('CHAR-ID-002'), 'expected CHAR-ID-002 (Name) to exist');
  assert.ok(ids.has('CHAR-ID-001'), 'expected CHAR-ID-001 (Character_ID) to exist');
  assert.ok(allFields.length > 200, 'expected canonical template to contain many fields');
});

