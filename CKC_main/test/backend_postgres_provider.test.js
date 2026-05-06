const test = require('node:test');
const assert = require('node:assert/strict');

const { all, initSchema, openDb, run, translatePostgresSql } = require('../app/backend/db');

test('postgres SQL translator preserves string literals while converting placeholders', () => {
  assert.equal(
    translatePostgresSql("SELECT * FROM ImageAsset WHERE image_id = ? AND notes = '?' AND rating >= ?"),
    "SELECT * FROM ImageAsset WHERE image_id = $1 AND notes = '?' AND rating >= $2"
  );
});

test('postgres SQL translator handles SQLite case-insensitive clauses', () => {
  assert.equal(
    translatePostgresSql("SELECT * FROM Character WHERE display_name = ? COLLATE NOCASE AND notes = 'LIKE ? COLLATE NOCASE'"),
    "SELECT * FROM Character WHERE LOWER(display_name) = LOWER($1) AND notes = 'LIKE ? COLLATE NOCASE'"
  );
  assert.equal(
    translatePostgresSql("SELECT * FROM Character WHERE search_blob LIKE ? COLLATE NOCASE ORDER BY display_name COLLATE NOCASE"),
    "SELECT * FROM Character WHERE search_blob ILIKE $1 ORDER BY display_name"
  );
});

test(
  'postgres provider initializes schema and supports concurrent core writes',
  { skip: !process.env.CKC_TEST_POSTGRES_URL },
  async () => {
    const db = await openDb(null, {
      database: {
        provider: 'postgres',
        connectionString: process.env.CKC_TEST_POSTGRES_URL,
      },
    });

    const characterId = `pg_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    try {
      await initSchema(db);
      await run(
        db,
        `INSERT INTO Character(
          character_id, public_id, display_name, template_id, template_version, template_hash
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [characterId, null, 'Postgres Test', 'v2.00', '2.00', 'test_hash']
      );

      await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          run(
            db,
            `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
             VALUES(?, ?, ?, ?)
             ON CONFLICT(character_id, field_id) DO UPDATE SET
               value_text = excluded.value_text,
               value_type = excluded.value_type,
               updated_at = CURRENT_TIMESTAMP`,
            [characterId, `PG-TEST-${i}`, `value-${i}`, 'text']
          )
        )
      );

      const rows = await all(db, `SELECT field_id FROM FieldValue WHERE character_id = ? ORDER BY field_id`, [characterId]);
      assert.equal(rows.length, 8);
    } finally {
      try {
        await run(db, `DELETE FROM Character WHERE character_id = ?`, [characterId]);
      } finally {
        if (db && typeof db.close === 'function') await db.close();
      }
    }
  }
);
