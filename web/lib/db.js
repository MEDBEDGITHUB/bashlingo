import pg from 'pg';

// DATE отдаём строкой 'YYYY-MM-DD', иначе драйвер превращает её в полночь по местному времени и дата съезжает на день.
pg.types.setTypeParser(1082, (v) => v);

const globalForPg = globalThis;
const pool =
  globalForPg.__blPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production') globalForPg.__blPool = pool;

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] ?? null;
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn((t, p = []) => client.query(t, p).then((r) => r.rows));
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
