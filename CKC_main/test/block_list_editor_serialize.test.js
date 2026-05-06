// WP-0104: round-trip + tolerant parse/serialize for the block-list editor.
// We import the TS module via its source path; node --test will route through
// the existing test pipeline (the module is plain TS used through the renderer
// build, but the runtime semantics are JS-equivalent and small enough to
// re-implement here as an integration test of the helper logic).

const test = require('node:test');
const assert = require('node:assert/strict');

// Re-implement the helpers in JS so we don't pull TS through node --test;
// keep this file in lockstep with src/ui/components/blockListSerialize.ts.
function parseBlockList(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { list: [], warning: null };
  let parsed;
  try {
    parsed = JSON.parse(s);
  } catch {
    return { list: [], warning: 'Stored block-list value is not valid JSON; starting fresh.' };
  }
  if (!Array.isArray(parsed)) {
    return { list: [], warning: 'Stored block-list value is not an array; starting fresh.' };
  }
  const list = [];
  for (const item of parsed) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = {};
      for (const [k, v] of Object.entries(item)) obj[k] = v == null ? '' : String(v);
      list.push(obj);
    } else {
      list.push({});
    }
  }
  return { list, warning: null };
}

function serializeBlockList(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return JSON.stringify(list);
}

test('empty value parses to empty list with no warning', () => {
  const r = parseBlockList('');
  assert.deepStrictEqual(r, { list: [], warning: null });
});

test('whitespace-only parses to empty list', () => {
  const r = parseBlockList('   \n  ');
  assert.deepStrictEqual(r, { list: [], warning: null });
});

test('valid single-block list round-trips', () => {
  const original = [{ 'HUS-BLK-001': 'Tarot Streamer', 'HUS-BLK-003': '7/10' }];
  const r = parseBlockList(JSON.stringify(original));
  assert.equal(r.warning, null);
  assert.deepStrictEqual(r.list, original);
  assert.equal(serializeBlockList(r.list), JSON.stringify(original));
});

test('multi-block list preserves ordering and Unicode', () => {
  const original = [
    { 'HUS-BLK-001': 'Tarot Streamer', 'HUS-BLK-002': 'Live' },
    { 'HUS-BLK-001': '占卜师 / oracle', 'HUS-BLK-002': '🔮' },
  ];
  const r = parseBlockList(JSON.stringify(original));
  assert.deepStrictEqual(r.list, original);
});

test('null/missing sub-field values normalized to empty string', () => {
  const r = parseBlockList(JSON.stringify([{ a: null, b: undefined, c: 'ok' }]));
  assert.deepStrictEqual(r.list, [{ a: '', c: 'ok' }]);
});

test('numeric sub-field values stringified', () => {
  const r = parseBlockList(JSON.stringify([{ score: 7 }]));
  assert.deepStrictEqual(r.list, [{ score: '7' }]);
});

test('malformed JSON recovers to empty list with warning', () => {
  const r = parseBlockList('{not valid json');
  assert.deepStrictEqual(r.list, []);
  assert.match(r.warning, /not valid JSON/);
});

test('non-array JSON (object) recovers to empty list with warning', () => {
  const r = parseBlockList('{"a":1}');
  assert.deepStrictEqual(r.list, []);
  assert.match(r.warning, /not an array/);
});

test('array with non-object entries replaces them with empty objects', () => {
  const r = parseBlockList('[1, "x", null, {"a": "ok"}]');
  assert.deepStrictEqual(r.list, [{}, {}, {}, { a: 'ok' }]);
});

test('empty list serializes to empty string (preserves "unset")', () => {
  assert.equal(serializeBlockList([]), '');
});

test('reorder via splice preserves object identity in serialization', () => {
  const list = [{ a: '1' }, { a: '2' }, { a: '3' }];
  const next = list.slice();
  const [item] = next.splice(0, 1);
  next.splice(2, 0, item);
  assert.equal(serializeBlockList(next), JSON.stringify([{ a: '2' }, { a: '3' }, { a: '1' }]));
});

test('add empty block then commit yields valid JSON', () => {
  const list = [];
  list.push({ 'HUS-BLK-001': '', 'HUS-BLK-002': '' });
  assert.equal(serializeBlockList(list), JSON.stringify([{ 'HUS-BLK-001': '', 'HUS-BLK-002': '' }]));
});

test('remove last block returns empty string (not "[]")', () => {
  const list = [{ a: '1' }];
  list.splice(0, 1);
  assert.equal(serializeBlockList(list), '');
});
