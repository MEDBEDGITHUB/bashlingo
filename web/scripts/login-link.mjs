// Печатает ссылку для входа под пользователем (действует 15 минут). Для демо и поддержки.
// Использование: npm run login-link -- "Гульшат Ринатовна" [http://localhost:3000]
import pg from 'pg';
import { sign } from '../lib/session.js';

const [name, origin = 'http://localhost:3000'] = process.argv.slice(2);
if (!name) {
  console.error('Укажите имя пользователя: npm run login-link -- "Имя"');
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query('SELECT id, name, role FROM users WHERE name = $1 ORDER BY created_at LIMIT 2', [name]);
await db.end();
if (!rows.length) {
  console.error(`Пользователь «${name}» не найден`);
  process.exit(1);
}
if (rows.length > 1) console.error('Найдено несколько пользователей с таким именем, беру самого раннего.');
const token = sign(`login:${rows[0].id}:${Date.now() + 15 * 60 * 1000}`);
console.log(`${origin}/api/auth/link?t=${encodeURIComponent(token)}`);
