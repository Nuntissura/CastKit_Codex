const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSheetText, applyFieldUpdatesToParsedSheet } = require('../app/backend/sheet');

test('sheet.parseSheetText captures multi-line values and preserves trailing newline', () => {
  const text = [
    'CHAR-ID-002 — Name: Alice',
    'CHAR-BDY-010 — Description: First line',
    '  Second line',
    '',
  ].join('\n');

  const parsed = parseSheetText(text);
  assert.equal(parsed.hasFinalNewline, true);

  assert.equal(parsed.fieldValues.get('CHAR-ID-002'), 'Alice');
  assert.equal(parsed.fieldValues.get('CHAR-BDY-010'), 'First line\nSecond line');
});

test('sheet.applyFieldUpdatesToParsedSheet replaces values without losing indentation', () => {
  const text = [
    'CHAR-ID-002 — Name: Alice',
    'CHAR-BDY-010 — Description: First line',
    '  Second line',
    '',
  ].join('\n');

  const parsed = parseSheetText(text);
  const out = applyFieldUpdatesToParsedSheet(parsed, {
    'CHAR-BDY-010': 'Updated 1\nUpdated 2',
  });

  assert.ok(out.includes('CHAR-BDY-010 — Description: Updated 1'));
  assert.ok(out.includes('\n  Updated 2\n'));
  assert.ok(out.endsWith('\n'));
});

