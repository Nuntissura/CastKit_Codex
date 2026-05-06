// WP-0100 slice 1: workflow spec registry (fs-backed).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  listWorkflowSpecs,
  getWorkflowSpec,
  getLatestWorkflowSpec,
  parseVersionToken,
  compareVersions,
} = require('../app/backend/workflowSpecRegistry');

function makeSpecsDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-specs-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  return dir;
}

function writeSpec(dir, fileName, body) {
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(body, null, 2), 'utf8');
}

test('parseVersionToken parses v00.19, 00.19, and rejects junk', () => {
  assert.deepEqual(parseVersionToken('v00.19'), [0, 19]);
  assert.deepEqual(parseVersionToken('00.19'), [0, 19]);
  assert.deepEqual(parseVersionToken('1.20'), [1, 20]);
  assert.equal(parseVersionToken('not_a_version'), null);
  assert.equal(parseVersionToken(''), null);
});

test('compareVersions sorts numerically', () => {
  assert.equal(compareVersions('v00.19', 'v00.20') < 0, true);
  assert.equal(compareVersions('v01.00', 'v00.99') > 0, true);
  assert.equal(compareVersions('v00.19', 'v00.19'), 0);
});

test('listWorkflowSpecs returns sorted spec summaries from a folder', (t) => {
  const dir = makeSpecsDir(t);
  writeSpec(dir, 'idol_v00.19.json', { schema_version: 1, spec_id: 'idol_image_sourcing_init_spec', spec_version: 'v00.19', spec_status: 'draft' });
  writeSpec(dir, 'idol_v00.20.json', { schema_version: 1, spec_id: 'idol_image_sourcing_init_spec', spec_version: 'v00.20', spec_status: 'draft' });
  writeSpec(dir, 'other_v00.01.json', { schema_version: 1, spec_id: 'other_spec', spec_version: 'v00.01', spec_status: 'draft' });
  const res = listWorkflowSpecs({ dir });
  assert.equal(res.ok, true);
  assert.equal(res.dir, dir);
  assert.equal(res.errors.length, 0);
  assert.equal(res.specs.length, 3);
  // sort key is (specId, specVersion)
  assert.equal(res.specs[0].specId, 'idol_image_sourcing_init_spec');
  assert.equal(res.specs[0].specVersion, 'v00.19');
  assert.equal(res.specs[1].specVersion, 'v00.20');
  assert.equal(res.specs[2].specId, 'other_spec');
});

test('listWorkflowSpecs reports per-file parse errors without aborting', (t) => {
  const dir = makeSpecsDir(t);
  writeSpec(dir, 'good_v00.19.json', { schema_version: 1, spec_id: 'good', spec_version: 'v00.19', spec_status: 'draft' });
  fs.writeFileSync(path.join(dir, 'broken_v00.19.json'), '{ not json', 'utf8');
  const res = listWorkflowSpecs({ dir });
  assert.equal(res.specs.length, 1);
  assert.equal(res.specs[0].specId, 'good');
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].filePath, 'broken_v00.19.json');
});

test('getWorkflowSpec returns the parsed spec by id+version', (t) => {
  const dir = makeSpecsDir(t);
  const body = { schema_version: 1, spec_id: 'sp', spec_version: 'v00.19', spec_status: 'draft', extra: 'value' };
  writeSpec(dir, 'sp_v00.19.json', body);
  const res = getWorkflowSpec({ specId: 'sp', version: 'v00.19', dir });
  assert.equal(res.ok, true);
  assert.equal(res.spec.extra, 'value');
});

test('getWorkflowSpec throws if specId or version is missing', (t) => {
  const dir = makeSpecsDir(t);
  assert.throws(() => getWorkflowSpec({ specId: 'sp', dir }), /requires specId and version/);
  assert.throws(() => getWorkflowSpec({ version: 'v00.19', dir }), /requires specId and version/);
});

test('getWorkflowSpec throws when no match', (t) => {
  const dir = makeSpecsDir(t);
  writeSpec(dir, 'sp_v00.19.json', { schema_version: 1, spec_id: 'sp', spec_version: 'v00.19', spec_status: 'draft' });
  assert.throws(() => getWorkflowSpec({ specId: 'sp', version: 'v00.20', dir }), /No workflow spec found/);
});

test('getLatestWorkflowSpec picks the highest version for a specId', (t) => {
  const dir = makeSpecsDir(t);
  writeSpec(dir, 'sp_v00.19.json', { schema_version: 1, spec_id: 'sp', spec_version: 'v00.19', spec_status: 'draft' });
  writeSpec(dir, 'sp_v00.20.json', { schema_version: 1, spec_id: 'sp', spec_version: 'v00.20', spec_status: 'draft' });
  writeSpec(dir, 'sp_v01.00.json', { schema_version: 1, spec_id: 'sp', spec_version: 'v01.00', spec_status: 'draft' });
  // a different spec id at higher version should not influence the result
  writeSpec(dir, 'other_v99.99.json', { schema_version: 1, spec_id: 'other', spec_version: 'v99.99', spec_status: 'draft' });
  const res = getLatestWorkflowSpec({ specId: 'sp', dir });
  assert.equal(res.ok, true);
  assert.equal(res.spec.spec_version, 'v01.00');
});

test('getLatestWorkflowSpec throws when no match for the given specId', (t) => {
  const dir = makeSpecsDir(t);
  writeSpec(dir, 'sp_v00.19.json', { schema_version: 1, spec_id: 'sp', spec_version: 'v00.19', spec_status: 'draft' });
  assert.throws(() => getLatestWorkflowSpec({ specId: 'missing', dir }), /No workflow spec found/);
});

test('listWorkflowSpecs against the real registry sees the v00.19 spec', () => {
  // The repo ships with image_sourcing_init_spec-idol_v00.19.json; this
  // is the one regression-tied check that the WP-0100 relocation into
  // CKC_GOV/references/external_app_data/specs/ stays valid.
  const res = listWorkflowSpecs();
  assert.equal(res.ok, true);
  const idol = res.specs.find((s) => s.specId === 'idol_image_sourcing_init_spec' && s.specVersion === 'v00.19');
  assert.ok(idol, `repo registry should expose idol_image_sourcing_init_spec v00.19; got: ${JSON.stringify(res.specs)}`);
});
