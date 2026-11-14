import { cookies } from 'next/headers';
import { one } from './db';
import { sign, unsign, cookieOpts, safeEqual } from './session';

export const UID_COOKIE = 'zb_uid';
export const ADMIN_COOKIE = 'zb_admin';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function currentUserId() {
  const jar = await cookies();
  const id = unsign(jar.get(UID_COOKIE)?.value);
  return id && UUID_RE.test(id) ? id : null;
}

export function setUserCookie(res, userId) {
  res.cookies.set(UID_COOKIE, sign(userId), cookieOpts());
  return res;
}

export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  return one(
    `SELECT u.id, u.name, u.level, u.role, u.lang_pair, u.class_id, u.school_id,
            (u.telegram_id IS NOT NULL) AS has_telegram,
            CASE WHEN u.last_active >= current_date - 1 THEN u.streak ELSE 0 END AS streak,
            COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id), 0)::int AS xp,
            c.name AS class_name,
            s.name AS school_name, s.city AS school_city, s.code AS school_code
       FROM users u
       LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN schools s ON s.id = COALESCE(u.school_id, c.school_id)
      WHERE u.id = $1`,
    [id]
  );
}

export async function currentTeacher() {
  const user = await currentUser();
  return user?.role === 'teacher' ? user : null;
}

export async function isAdmin() {
  const jar = await cookies();
  return unsign(jar.get(ADMIN_COOKIE)?.value) === 'admin';
}

export function checkAdminKey(key) {
  const expected = process.env.ADMIN_KEY;
  return Boolean(expected) && typeof key === 'string' && key.length > 0 && safeEqual(key, expected);
}

export const LEVELS = [
  { value: 1, title: 'Начинаю с нуля', hint: 'Ни одного слова пока не знаю' },
  { value: 2, title: 'Знаю отдельные слова', hint: 'Сәләм, рәхмәт и ещё немного' },
  { value: 3, title: 'Понимаю простые фразы', hint: 'Могу понять приветствие и вопрос' },
  { value: 4, title: 'Понимаю, но не могу говорить', hint: 'Слышу дома, но отвечаю по-русски' },
  { value: 5, title: 'Уровень родного языка', hint: 'Говорю свободно' },
];
