const test = require('node:test');
const assert = require('node:assert/strict');

const { validateValueForField, classifyChangeType, normalizeScore10 } = require('../app/backend/validation');

test('validation.normalizeScore10 normalizes 0..10 values', () => {
  assert.deepEqual(normalizeScore10('8'), { ok: true, normalized: '8/10' });
  assert.deepEqual(normalizeScore10('8/10'), { ok: true, normalized: '8/10' });
  assert.deepEqual(normalizeScore10('  0  '), { ok: true, normalized: '0/10' });
  assert.deepEqual(normalizeScore10('11'), { ok: false, normalized: '11' });
});

test('validation.validateValueForField validates basic field types', () => {
  const intField = { id: 'F-INT-001', type: 'integer' };
  assert.equal(validateValueForField(intField, '3.2', 'strict').issues[0]?.severity, 'error');

  const scoreField = { id: 'F-SCR-001', type: 'score_10' };
  const r = validateValueForField(scoreField, '8', 'strict');
  assert.equal(r.issues.length, 0);
  assert.equal(r.normalized, '8/10');

  const descriptorField = { id: 'F-DES-001', type: 'descriptor' };
  assert.equal(validateValueForField(descriptorField, 'One', 'strict').issues[0]?.severity, 'error');
});

test('validation.classifyChangeType classifies invalid changes', () => {
  const issues = [{ fieldId: 'X', severity: 'error', message: 'boom' }];
  assert.equal(classifyChangeType('A', 'B', issues), 'invalid');
  assert.equal(classifyChangeType('A', '   ', []), 'blank');
  assert.equal(classifyChangeType('', 'B', []), 'add');
  assert.equal(classifyChangeType('A', 'A', []), 'same');
  assert.equal(classifyChangeType('A', 'B', []), 'modify');
});

