import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId, setUserCookie } from '@/lib/user';
import { sign, unsign } from '@/lib/session';

const TTL_MS = 15 * 60 * 1000;

// За прокси (Caddy) адрес из запроса внутренний, поэтому берём публичный из PUBLIC_URL
const base = (url) => (process.env.PUBLIC_URL?.startsWith('https://') ? process.env.PUBLIC_URL.replace(/\/$/, '') : url.origin);

// POST: выдать текущему пользователю ссылку для входа на другом устройстве (действует 15 минут).
export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const token = sign(`login:${userId}:${Date.now() + TTL_MS}`);
  return NextResponse.json({ url: `${base(new URL(req.url))}/api/auth/link?t=${encodeURIComponent(token)}`, minutes: 15 });
}

// GET ?t=...: войти по ссылке.
export async function GET(req) {
  const url = new URL(req.url);
  const value = unsign(url.searchParams.get('t'));
  const m = /^login:([0-9a-f-]{36}):(\d{13})$/.exec(value ?? '');
  const user = m && Number(m[2]) > Date.now() ? await one('SELECT id, role FROM users WHERE id = $1', [m[1]]) : null;
  if (!user) return NextResponse.redirect(new URL('/welcome', base(url)), 303);
  return setUserCookie(NextResponse.redirect(new URL(user.role === 'teacher' ? '/teacher' : '/', base(url)), 303), user.id);
}
