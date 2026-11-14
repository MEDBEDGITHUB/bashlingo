import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, checkAdminKey } from '@/lib/user';
import { readJson, sign, cookieOpts } from '@/lib/session';

// Простая защита от перебора: не больше 10 попыток в минуту на процесс.
let attempts = [];

export async function POST(req) {
  const now = Date.now();
  attempts = attempts.filter((t) => now - t < 60_000);
  if (attempts.length >= 10) return NextResponse.json({ error: 'Слишком много попыток, подождите минуту' }, { status: 429 });
  const body = await readJson(req);
  if (!checkAdminKey(body.key)) {
    attempts.push(now);
    return NextResponse.json({ error: 'Неверный ключ' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sign('admin'), cookieOpts(60 * 60 * 12));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', cookieOpts(0));
  return res;
}
