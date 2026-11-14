import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId, setUserCookie } from '@/lib/user';
import { readJson } from '@/lib/session';
import { verifyInitData } from '@/lib/telegram';

// Вход из Telegram Mini App: {initData} → cookie сессии, если аккаунт уже привязан.
// Если пользователь вошёл на сайте раньше и ещё не привязан к Telegram, привязываем его текущий аккаунт.
export async function POST(req) {
  const body = await readJson(req);
  const tg = verifyInitData(String(body.initData ?? ''));
  if (!tg) return NextResponse.json({ error: 'Не удалось подтвердить данные Telegram' }, { status: 401 });

  const currentId = await currentUserId();
  let user = await one('SELECT id FROM users WHERE telegram_id = $1', [tg.id]);
  if (!user && currentId) {
    user = await one('UPDATE users SET telegram_id = $1 WHERE id = $2 AND telegram_id IS NULL RETURNING id', [tg.id, currentId]);
  }
  if (!user) return NextResponse.json({ registered: false, firstName: String(tg.first_name ?? '').slice(0, 40) });
  const res = NextResponse.json({ registered: true, changed: user.id !== currentId });
  return setUserCookie(res, user.id);
}
