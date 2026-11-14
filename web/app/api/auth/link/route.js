import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId, setUserCookie } from '@/lib/user';
import { sign, unsign } from '@/lib/session';

const TTL_MS = 15 * 60 * 1000;

// За прокси (Caddy, туннель) адрес из запроса внутренний, поэтому берём публичный из заголовков X-Forwarded-*
function base(req, url) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  // Туннели и прокси не всегда передают X-Forwarded-Proto: для не локального адреса считаем, что снаружи HTTPS
  const local = /^(localhost|127\.|10\.|192\.168\.|\[?::1)/.test(host ?? '');
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0] ?? (local ? url.protocol.replace(':', '') : 'https');
  return host && /^[a-z0-9.:-]+$/i.test(host) ? `${proto}://${host}` : url.origin;
}

// POST: выдать текущему пользователю ссылку для входа на другом устройстве (действует 15 минут).
export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const token = sign(`login:${userId}:${Date.now() + TTL_MS}`);
  return NextResponse.json({ url: `${base(req, new URL(req.url))}/api/auth/link?t=${encodeURIComponent(token)}`, minutes: 15 });
}

// GET ?t=...: войти по ссылке.
export async function GET(req) {
  const url = new URL(req.url);
  const value = unsign(url.searchParams.get('t'));
  const m = /^login:([0-9a-f-]{36}):(\d{13})$/.exec(value ?? '');
  const user = m && Number(m[2]) > Date.now() ? await one('SELECT id, role FROM users WHERE id = $1', [m[1]]) : null;
  if (!user) return NextResponse.redirect(new URL('/welcome', base(req, url)), 303);
  return setUserCookie(NextResponse.redirect(new URL(user.role === 'teacher' ? '/teacher' : '/', base(req, url)), 303), user.id);
}
