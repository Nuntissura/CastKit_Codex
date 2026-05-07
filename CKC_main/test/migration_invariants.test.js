const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const productRoot = path.join(repoRoot, 'CKC_main');
const migrationRoots = [
  path.join(productRoot, 'app', 'backend', 'db.js'),
  path.join(productRoot, 'app', 'backend', 'dbMigrations'),
];

const SACRED_COLUMNS = new Set([
  'source_dataset_id',
  'source_task_id',
  'source_run_id',
  'source_contact_sheet_ref',
  'sheet_version_id',
  'file_hash',
  'image_id',
  'character_id',
  'relative_path',
  'template_id',
  'template_version',
  'template_hash',
]);

const HEAVY_TABLES = new Set(['ImageAsset', 'FieldValue', 'AuditLog']);

function listMigrationFiles() {
  const out = [];
  for (const root of migrationRoots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isFile()) {
      out.push(root);
      continue;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!/\.(js|sql|ts)$/i.test(entry.name)) continue;
      out.push(path.join(root, entry.name));
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function stripLineComment(line) {
  return String(line || '').replace(/\/\/.*$/, '');
}

function tableFromCreateIndex(line) {
  const m = line.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b[\s\S]*?\bON\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
  return m ? m[1] : null;
}

test('schema migrations stay additive and provenance-safe', () => {
  const files = listMigrationFiles();
  assert.ok(files.length > 0, 'expected at least db.js to be scanned');

  const deprecationsPath = path.join(repoRoot, 'CKC_GOV', 'DEPRECATIONS.md');
  const hasDeprecations = fs.existsSync(deprecationsPath);
  const failures = [];

  for (const filePath of files) {
    const rel = path.relative(repoRoot, filePath).replaceAll('\\', '/');
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const line = stripLineComment(raw);
      const loc = `${rel}:${i + 1}`;

      if (/\bALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b[\s\S]*\bNOT\s+NULL\b/i.test(line) && !/\bDEFAULT\b/i.test(line)) {
        failures.push(`${loc} ADD COLUMN NOT NULL must include DEFAULT`);
      }

      if (/\bDROP\s+COLUMN\b/i.test(line) && !(/\bckc-deprecation-ok\b/i.test(raw) && hasDeprecations)) {
        failures.push(`${loc} DROP COLUMN requires CKC_GOV/DEPRECATIONS.md and ckc-deprecation-ok marker`);
      }

      if (/\bDROP\s+TABLE\b/i.test(line) && !/\bckc-deprecation-ok\b/i.test(raw)) {
        failures.push(`${loc} DROP TABLE is forbidden without an explicit deprecation override`);
      }

      if (/\bRENAME\s+COLUMN\b/i.test(line)) {
        for (const column of SACRED_COLUMNS) {
          if (new RegExp(`\\b${column}\\b`, 'i').test(line)) {
            failures.push(`${loc} sacred provenance column must not be renamed: ${column}`);
          }
        }
      }

      const table = tableFromCreateIndex(line);
      if (table && HEAVY_TABLES.has(table) && !/\bCONCURRENTLY\b/i.test(line) && !/\bIF\s+NOT\s+EXISTS\b/i.test(line)) {
        failures.push(`${loc} heavy-table index must use CONCURRENTLY or be an idempotent bootstrap index`);
      }
    }
  }

  assert.deepEqual(failures, []);
});
