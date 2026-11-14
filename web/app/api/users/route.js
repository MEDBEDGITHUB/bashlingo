import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { UID_COOKIE, currentUser } from '@/lib/user';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  return NextResponse.json(user);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 40);
  const level = Number(body.level);
  const code = String(body.joinCode ?? '').trim().toUpperCase().slice(0, 16);
  if (!name) return NextResponse.json({ error: 'Введите имя' }, { status: 400 });
  if (!Number.isInteger(level) || level < 1 || level > 5)
    return NextResponse.json({ error: 'Выберите уровень' }, { status: 400 });

  let classId = null;
  if (code) {
    const cls = await one('SELECT id FROM classes WHERE join_code = $1', [code]);
    if (!cls) return NextResponse.json({ error: 'Класс с таким кодом не найден' }, { status: 404 });
    classId = cls.id;
  }
  const user = await one(
    'INSERT INTO users (name, level, class_id) VALUES ($1, $2, $3) RETURNING id',
    [name, level, classId]
  );
  const res = NextResponse.json({ id: user.id });
  res.cookies.set(UID_COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
