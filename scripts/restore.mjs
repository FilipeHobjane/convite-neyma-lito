// Restaura um ficheiro de cópia directamente numa base local (sem passar pelo painel).
// Uso: node scripts/restore.mjs <cópia.json> [data/convite.db]
// ATENÇÃO: substitui os dados da base indicada. Para a nuvem, use o painel.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BACKUP_TABLES, COLUMN_MIGRATIONS, SCHEMA, SCHEMA_VERSION } from '../src/schema.js';

const [file, target = 'data/convite.db'] = process.argv.slice(2);
if (!file || !existsSync(file)) {
  console.error('Uso: node scripts/restore.mjs <cópia.json> [base.db]');
  process.exit(2);
}
const data = JSON.parse(readFileSync(file, 'utf8'));
if (data.format !== 'convite-backup') throw new Error('Este ficheiro não é uma cópia do convite.');

const path = resolve(target);
mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec('BEGIN');
try {
  SCHEMA.forEach((sql) => db.exec(sql));
  for (const sql of COLUMN_MIGRATIONS) {
    try { db.exec(sql); } catch (err) { if (!String(err.message).includes('duplicate column')) throw err; }
  }
  for (const t of [...Object.keys(BACKUP_TABLES), 'media_chunks']) db.exec(`DELETE FROM ${t}`);
  for (const [table, cols] of Object.entries(BACKUP_TABLES)) {
    const stmt = db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`);
    for (const row of data.tables[table] || []) stmt.run(...cols.map((c) => row[c] ?? null));
  }
  db.prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version',?)`).run(SCHEMA_VERSION);
  const metas = Object.fromEntries((data.tables.media || []).map((m) => [m.id, m]));
  const put = db.prepare('INSERT INTO media_chunks(media_id,idx,data) VALUES(?,?,?)');
  for (const f of data.files || []) {
    const bytes = Buffer.from(f.data, 'base64');
    const { chunks, chunk_size: size } = metas[f.id];
    for (let i = 0; i < chunks; i++) put.run(f.id, i, bytes.subarray(i * size, (i + 1) * size));
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
db.close();
console.log(`Restaurado em ${path}: ${(data.tables.guests || []).length} convidados, ${(data.files || []).length} ficheiros.`);
