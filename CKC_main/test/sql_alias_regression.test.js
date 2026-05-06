// WP-0103: regression guard for the camelCase SQL alias bug class.
//
// Postgres lowercases unquoted identifiers (including aliases) on
// return. SQLite preserves alias case. So `SELECT col AS valueText`
// works on SQLite but breaks JS reads of `r.valueText` on Postgres.
// This test scans backend SQL for any such alias and fails CI when
// reintroduced. Audit during WP-0103 confirmed only the two known
// instances existed (fixed in commit 89c0aa7); this test pins the
// invariant.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..', 'app', 'backend');

function* walkJsFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJsFiles(full);
    else if (e.isFile() && /\.(js|cjs|mjs)$/.test(full)) yield full;
  }
}

const FILES = [...walkJsFiles(BACKEND_DIR)];

// Match `AS aliasName` where aliasName has any uppercase letter and is
// NOT double-quoted. (Double-quoted aliases preserve case on Postgres.)
//
// We accept `AS snake_case` (all lowercase), `AS lowercase`, and
// `AS "DoubleQuoted"`. Anything else is the bug pattern.
function findOffendingAliases(text, file) {
  const re = /\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  const offending = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const alias = m[1];
    // Allow all-lowercase or snake_case
    if (alias === alias.toLowerCase()) continue;
    // Allow double-quoted aliases (the AS regex doesn't match those — they are AS "X")
    offending.push({ file: path.relative(path.resolve(__dirname, '..'), file), alias, contextLine: text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ').trim() });
  }
  return offending;
}

test('sql alias regression: no camelCase or PascalCase SQL aliases in app/backend/*.js', () => {
  const offending = [];
  for (const file of FILES) {
    const text = fs.readFileSync(file, 'utf8');
    offending.push(...findOffendingAliases(text, file));
  }
  assert.deepStrictEqual(
    offending,
    [],
    `camelCase/PascalCase SQL aliases break on Postgres (lowercased on return). Fix by using snake_case aliases or removing the alias. Found:\n${JSON.stringify(offending, null, 2)}`,
  );
});
