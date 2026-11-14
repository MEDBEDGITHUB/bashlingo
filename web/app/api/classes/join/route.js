import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId } from '@/lib/user';

export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '').trim().toUpperCase().slice(0, 16);
  const cls = await one('SELECT id, name FROM classes WHERE join_code = $1', [code]);
  if (!cls) return NextResponse.json({ error: 'Класс с таким кодом не найден' }, { status: 404 });
  await one('UPDATE users SET class_id = $1 WHERE id = $2 RETURNING id', [cls.id, userId]);
  return NextResponse.json({ ok: true, class: cls.name });
}
