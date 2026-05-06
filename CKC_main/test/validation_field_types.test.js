// WP-0103: validator behavior per field type.

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCharacterValues } = require('../app/backend/validation');

function makeAst(field) {
  return { sections: [{ title: 'TEST', fields: [field] }] };
}

function validateOne(field, value, mode = 'strict') {
  const ast = makeAst(field);
  const r = validateCharacterValues(ast, { [field.id]: value }, mode);
  return r;
}

// ---- string ----
test('string: any non-empty string is valid (no warnings)', () => {
  const r = validateOne({ id: 'F1', type: 'string' }, 'Aeri Real Name 한글');
  assert.deepStrictEqual(r.issues, []);
});

test('string: empty value returns no issues (handled by optionality elsewhere)', () => {
  const r = validateOne({ id: 'F2', type: 'string' }, '');
  assert.deepStrictEqual(r.issues, []);
});

test('string: allowedSpecialValues do not trigger warnings', () => {
  const r = validateOne({ id: 'F3', type: 'string', allowedSpecialValues: ['unset'] }, 'unset');
  assert.deepStrictEqual(r.issues, []);
});

// ---- enum ----
test('enum: literal value is valid', () => {
  const r = validateOne({ id: 'F4', type: 'enum', enumValues: ['fictional', 'original', 'composite'] }, 'original');
  assert.deepStrictEqual(r.issues, []);
});

test('enum: non-literal value emits warn (Non-canonical)', () => {
  const r = validateOne({ id: 'F5', type: 'enum', enumValues: ['fictional', 'original', 'composite'] }, 'totally-bogus');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'warn');
  assert.match(r.issues[0].message, /Non-canonical/);
});

test('enum + allowOtherType=descriptor: 2-12 word fallback accepted (no warning)', () => {
  const r = validateOne({
    id: 'F6',
    type: 'enum',
    enumValues: ['slim', 'athletic', 'curvy'],
    allowOtherType: 'descriptor',
    allowedSpecialValues: ['unknown'],
  }, 'long lithe dancer build');
  assert.deepStrictEqual(r.issues, []);
});

test('enum + allowOtherType=descriptor: literal enum value still accepted (regression for "curvy")', () => {
  const r = validateOne({
    id: 'F7',
    type: 'enum',
    enumValues: ['slim', 'athletic', 'curvy', 'muscular', 'stocky', 'mixed'],
    allowOtherType: 'descriptor',
    allowedSpecialValues: ['unknown'],
  }, 'curvy');
  assert.deepStrictEqual(r.issues, []);
});

test('enum + allowOtherType=string: any string is fine', () => {
  const r = validateOne({
    id: 'F8',
    type: 'enum',
    enumValues: ['body', 'face', 'voice'],
    allowOtherType: 'string',
  }, 'whatever the operator typed');
  assert.deepStrictEqual(r.issues, []);
});

// ---- score_10 ----
test('score_10: "7" normalizes to "7/10"', () => {
  const r = validateOne({ id: 'F9', type: 'score_10' }, '7');
  assert.deepStrictEqual(r.issues, []);
  assert.equal(r.normalizedValuesById.F9, '7/10');
});

test('score_10: "7/10" stays as "7/10"', () => {
  const r = validateOne({ id: 'F10', type: 'score_10' }, '7/10');
  assert.deepStrictEqual(r.issues, []);
  assert.equal(r.normalizedValuesById.F10, '7/10');
});

test('score_10: "11/10" emits error', () => {
  const r = validateOne({ id: 'F11', type: 'score_10' }, '11/10');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'error');
  assert.match(r.issues[0].message, /score_10/);
});

test('score_10: "abc" emits error', () => {
  const r = validateOne({ id: 'F12', type: 'score_10' }, 'abc');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'error');
});

// ---- integer ----
test('integer: "42" valid', () => {
  const r = validateOne({ id: 'F13', type: 'integer' }, '42');
  assert.deepStrictEqual(r.issues, []);
});

test('integer: "adult" sentinel via allowedSpecialValues passes', () => {
  const r = validateOne({ id: 'F14', type: 'integer', allowedSpecialValues: ['adult'] }, 'adult');
  assert.deepStrictEqual(r.issues, []);
});

test('integer: "abc" emits error', () => {
  const r = validateOne({ id: 'F15', type: 'integer' }, 'abc');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'error');
});

// ---- descriptor ----
test('descriptor: 4 words valid in strict mode', () => {
  const r = validateOne({ id: 'F16', type: 'descriptor' }, 'tall lean dancer build');
  assert.deepStrictEqual(r.issues, []);
});

test('descriptor: 1 word emits error in strict mode', () => {
  const r = validateOne({ id: 'F17', type: 'descriptor' }, 'curvy', 'strict');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'error');
  assert.match(r.issues[0].message, /2.{1,3}12 words/);
});

test('descriptor: sentinel "unknown" via allowedSpecialValues passes', () => {
  const r = validateOne({ id: 'F18', type: 'descriptor', allowedSpecialValues: ['unknown'] }, 'unknown', 'strict');
  assert.deepStrictEqual(r.issues, []);
});

// ---- list / block ----
test('list: invalid JSON emits error in strict mode', () => {
  const r = validateOne({ id: 'F19', type: 'list' }, 'not json', 'strict');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'error');
});

test('list: valid JSON array passes', () => {
  const r = validateOne({ id: 'F20', type: 'list' }, '["a","b","c"]', 'strict');
  assert.deepStrictEqual(r.issues, []);
});

// ---- regression: Aeri-style sheet save no longer emits noisy warnings ----
test('regression: real Build/Movement_Quality fields accept curvy/graceful without errors', () => {
  // Build value as the parser produces from the real template.
  const buildField = {
    id: 'CHAR-PHY-001',
    type: 'enum',
    enumValues: ['slim', 'athletic', 'curvy', 'muscular', 'stocky', 'mixed'],
    allowOtherType: 'descriptor',
    allowedSpecialValues: ['unknown'],
  };
  const movementField = {
    id: 'CHAR-PHY-003',
    type: 'enum',
    enumValues: ['graceful', 'sharp', 'heavy', 'bouncy', 'controlled', 'restless'],
    allowOtherType: 'descriptor',
    allowedSpecialValues: ['unknown'],
  };
  const ast = { sections: [{ title: 'PHY', fields: [buildField, movementField] }] };
  const r = validateCharacterValues(ast, {
    'CHAR-PHY-001': 'curvy',
    'CHAR-PHY-003': 'graceful',
  }, 'strict');
  assert.deepStrictEqual(r.issues, []);
});
