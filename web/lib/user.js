import { cookies } from 'next/headers';
import { one } from './db';

export const UID_COOKIE = 'bl_uid';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function currentUserId() {
  const jar = await cookies();
  const id = jar.get(UID_COOKIE)?.value;
  return id && UUID_RE.test(id) ? id : null;
}

export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  return one(
    `SELECT u.id, u.name, u.level, u.lang_pair, u.class_id,
            CASE WHEN u.last_active >= current_date - 1 THEN u.streak ELSE 0 END AS streak,
            COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id), 0)::int AS xp,
            c.name AS class_name, s.name AS school_name, s.city AS school_city
       FROM users u
       LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN schools s ON s.id = c.school_id
      WHERE u.id = $1`,
    [id]
  );
}

export const LEVELS = [
  { value: 1, title: 'Начинаю с нуля', hint: 'Ни одного слова пока не знаю' },
  { value: 2, title: 'Знаю отдельные слова', hint: 'Сәләм, рәхмәт и ещё немного' },
  { value: 3, title: 'Понимаю простые фразы', hint: 'Могу понять приветствие и вопрос' },
  { value: 4, title: 'Понимаю, но не могу говорить', hint: 'Слышу дома, но отвечаю по-русски' },
  { value: 5, title: 'Уровень родного языка', hint: 'Говорю свободно' },
];
