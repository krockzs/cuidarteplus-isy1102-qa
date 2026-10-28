const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.QA_DATABASE_URL, max: 3, connectionTimeoutMillis: 4500});
const DB_NAME = 'cuidarteplus_qa';
async function query(sql, values = []) { return pool.query(sql, values); }
async function ensureLab() {
  if (process.env.QA_ALLOW_MUTATIONS !== 'YES') throw new Error('QA_ALLOW_MUTATIONS=YES es obligatorio.');
  if (!process.env.QA_DATABASE_URL) throw new Error('Falta QA_DATABASE_URL. Usa scripts/02-ejecutar-jest.sh');
  const db = await query('SELECT current_database() AS db');
  if (db.rows[0].db !== DB_NAME) throw new Error('Base rechazada: se exige ' + DB_NAME);
  const m = await query("SELECT etiqueta FROM qa_lab_marker WHERE id = 1");
  if (m.rows[0]?.etiqueta !== 'CUIDARTE_QA_PUBLIC_20261028') throw new Error('Marcador QA ausente o inválido');
}
module.exports = { query, pool, ensureLab };
