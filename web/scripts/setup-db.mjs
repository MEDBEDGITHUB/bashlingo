import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dbUrl = process.env.DATABASE_URL;
const adminUrl = process.env.ADMIN_DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL не задан (см. .env.example)');

async function ensureDatabase() {
  if (!adminUrl) return;
  const target = new URL(dbUrl);
  const dbName = target.pathname.slice(1);
  const role = decodeURIComponent(target.username);
  const pass = decodeURIComponent(target.password);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const r = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
  if (!r.rowCount) await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${pass.replace(/'/g, "''")}'`);
  const d = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
  if (!d.rowCount) await admin.query(`CREATE DATABASE "${dbName}" OWNER "${role}"`);
  await admin.end();
}

async function main() {
  await ensureDatabase();
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  await db.query(fs.readFileSync(path.join(root, '../db/schema.sql'), 'utf8'));

  const course = JSON.parse(fs.readFileSync(path.join(root, '../db/course.json'), 'utf8'));
  await db.query('BEGIN');
  for (const f of Object.values(course.fragments)) {
    await db.query(
      `INSERT INTO fragments (id, text_ba, lang_pair, translation_auto, source) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET text_ba=EXCLUDED.text_ba, translation_auto=EXCLUDED.translation_auto, source=EXCLUDED.source`,
      [f.id, f.text_ba, course.lang_pair, f.text_ru, { ...f.source, dataset: course.source.dataset, url: course.source.url }]
    );
  }
  for (const [ui, u] of course.units.entries()) {
    await db.query(
      `INSERT INTO units (slug,title,icon,position) VALUES ($1,$2,$3,$4)
       ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, icon=EXCLUDED.icon, position=EXCLUDED.position`,
      [u.slug, u.title, u.icon, ui]
    );
    for (const [li, l] of u.lessons.entries()) {
      await db.query(
        `INSERT INTO lessons (slug,unit_slug,title,position) VALUES ($1,$2,$3,$4)
         ON CONFLICT (slug) DO UPDATE SET unit_slug=EXCLUDED.unit_slug, title=EXCLUDED.title, position=EXCLUDED.position`,
        [l.slug, u.slug, l.title, li]
      );
      for (const [pi, fid] of l.phrases.entries()) {
        await db.query(
          `INSERT INTO lesson_fragments (lesson_slug,fragment_id,position) VALUES ($1,$2,$3)
           ON CONFLICT (lesson_slug,fragment_id) DO UPDATE SET position=EXCLUDED.position`,
          [l.slug, fid, pi]
        );
      }
    }
  }

  const demo = await db.query(`SELECT id FROM classes WHERE join_code='7B2026'`);
  if (!demo.rowCount) {
    const s = await db.query(`INSERT INTO schools (name, city) VALUES ('Школа № 1', 'Сибай') RETURNING id`);
    const c = await db.query(
      `INSERT INTO classes (school_id, name, join_code) VALUES ($1, '7 «Б»', '7B2026') RETURNING id`,
      [s.rows[0].id]
    );
    const classId = c.rows[0].id;
    await db.query(
      `INSERT INTO assignments (class_id, title, lesson_slug, due_date)
       VALUES ($1, 'Приветствия', 'hello', current_date + ((5 - extract(isodow from current_date)::int + 7) % 7))`,
      [classId]
    );
    const mates = [['Айсылу', 640], ['Тимур', 515], ['Лилия', 410], ['Азат', 260], ['Гульназ', 180]];
    for (const [name, xp] of mates) {
      const u = await db.query(
        `INSERT INTO users (name, level, class_id, streak, last_active) VALUES ($1, 2, $2, 3, current_date) RETURNING id`,
        [name, classId]
      );
      await db.query(`INSERT INTO xp_events (user_id, amount, reason) VALUES ($1, $2, 'seed')`, [u.rows[0].id, xp]);
      if (xp > 300) await db.query(`INSERT INTO completions (user_id, key, xp) VALUES ($1, 'hello', 15)`, [u.rows[0].id]);
    }
    console.log('Демо-класс создан: код 7B2026');
  }
  await db.query('COMMIT');
  await db.end();
  console.log('База готова.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
