// WP-0104: validateCharacterValues recurses into block_list / block fields and
// produces path-style issues like Side_Hustles[0].Hustle_Name.

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCharacterValues } = require('../app/backend/validation');

const HUSTLE_BLOCK = {
  name: 'Hustle_Block',
  fields: [
    { id: 'HUS-BLK-001', type: 'string' },
    { id: 'HUS-BLK-002', type: 'enum', enumValues: ['Live', 'On-Demand', 'Async'], allowOtherType: 'string' },
    { id: 'HUS-BLK-003', type: 'score_10' },
    { id: 'HUS-BLK-004', type: 'descriptor' },
  ],
};

const ANIMAL_BLOCK = {
  name: 'Animal_Comparison_Block',
  fields: [
    { id: 'ANC-BLK-001', type: 'string' },
    { id: 'ANC-BLK-002', type: 'descriptor' },
  ],
};

function buildAst(parentField, blockSchemas) {
  return {
    sections: [{ title: 'TEST', fields: [parentField] }],
    blockSchemas: blockSchemas || [HUSTLE_BLOCK, ANIMAL_BLOCK],
  };
}

const SIDE_HUSTLES_FIELD = {
  id: 'CHAR-WRK-007',
  type: 'block_list',
  blockSchemaName: 'Hustle_Block',
};

const SINGLE_BLOCK_FIELD = {
  id: 'CHAR-IDX-001',
  type: 'block',
  blockSchemaName: 'Hustle_Block',
};

test('empty block_list value yields no issues', () => {
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': '' });
  assert.deepStrictEqual(r.issues, []);
});

test('valid single-block entry yields no issues', () => {
  const value = JSON.stringify([
    { 'HUS-BLK-001': 'Tarot Streamer', 'HUS-BLK-002': 'Live', 'HUS-BLK-003': '7/10', 'HUS-BLK-004': 'late night ritual streamer' },
  ]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value });
  assert.deepStrictEqual(r.issues, []);
});

test('score_10 sub-field with "11/10" surfaces issue with path', () => {
  const value = JSON.stringify([{ 'HUS-BLK-001': 'X', 'HUS-BLK-003': '11/10' }]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value });
  const score = r.issues.find((i) => i.fieldId === 'CHAR-WRK-007[0].HUS-BLK-003');
  assert.ok(score, `expected scoped issue, got: ${JSON.stringify(r.issues)}`);
  assert.equal(score.severity, 'error');
});

test('descriptor sub-field with 1-word value emits descriptor error in strict mode', () => {
  const value = JSON.stringify([{ 'HUS-BLK-004': 'lone' }]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value }, 'strict');
  const issue = r.issues.find((i) => i.fieldId === 'CHAR-WRK-007[0].HUS-BLK-004');
  assert.ok(issue);
  assert.equal(issue.severity, 'error');
});

test('multi-block list reports issues with correct indices', () => {
  const value = JSON.stringify([
    { 'HUS-BLK-001': 'OK', 'HUS-BLK-003': '7/10' },
    { 'HUS-BLK-001': 'Bad', 'HUS-BLK-003': '99' },
    { 'HUS-BLK-001': 'OK2', 'HUS-BLK-003': '3/10' },
  ]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value });
  const paths = r.issues.map((i) => i.fieldId);
  assert.ok(paths.includes('CHAR-WRK-007[1].HUS-BLK-003'), `got: ${JSON.stringify(paths)}`);
  assert.equal(r.issues.length, 1);
});

test('unknown sub-field id is preserved without error', () => {
  const value = JSON.stringify([{ 'HUS-BLK-001': 'Name', 'UNKNOWN-FIELD': 'whatever' }]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value });
  assert.deepStrictEqual(r.issues, []);
});

test('non-array JSON for block_list yields error', () => {
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': '{"oops":true}' });
  assert.equal(r.issues.length, 1);
  assert.match(r.issues[0].message, /array/i);
});

test('malformed JSON yields error issue', () => {
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': '{not json' });
  assert.equal(r.issues.length, 1);
  assert.match(r.issues[0].message, /JSON/i);
});

test('single block field uses dotted path (no array index)', () => {
  const value = JSON.stringify({ 'HUS-BLK-003': '99' });
  const r = validateCharacterValues(buildAst(SINGLE_BLOCK_FIELD), { 'CHAR-IDX-001': value });
  const issue = r.issues.find((i) => i.fieldId === 'CHAR-IDX-001.HUS-BLK-003');
  assert.ok(issue, `expected dotted path, got: ${JSON.stringify(r.issues)}`);
});

test('single block field with array yields error', () => {
  const r = validateCharacterValues(buildAst(SINGLE_BLOCK_FIELD), { 'CHAR-IDX-001': '[]' });
  assert.equal(r.issues.length, 1);
  assert.match(r.issues[0].message, /object/i);
});

test('block_list without matching schema falls back to JSON-only check', () => {
  const field = { id: 'F1', type: 'block_list', blockSchemaName: 'NotInSchemas' };
  const ast = { sections: [{ title: 'T', fields: [field] }], blockSchemas: [HUSTLE_BLOCK] };
  const ok = validateCharacterValues(ast, { F1: '[{"x":1}]' });
  assert.deepStrictEqual(ok.issues, []);
  const bad = validateCharacterValues(ast, { F1: '{not json' });
  assert.equal(bad.issues.length, 1);
});

test('normalized output re-serializes score_10 inside block', () => {
  const value = JSON.stringify([{ 'HUS-BLK-003': '7' }]);
  const r = validateCharacterValues(buildAst(SIDE_HUSTLES_FIELD), { 'CHAR-WRK-007': value });
  assert.deepStrictEqual(r.issues, []);
  const parsed = JSON.parse(r.normalizedValuesById['CHAR-WRK-007']);
  assert.equal(parsed[0]['HUS-BLK-003'], '7/10');
});
