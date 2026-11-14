import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId } from '@/lib/user';
import { readJson } from '@/lib/session';
import { normCode } from '@/lib/codes';

export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const body = await readJson(req);
  const code = normCode(body.code);
  const cls = await one('SELECT id, name FROM classes WHERE join_code = $1', [code]);
  if (!cls) return NextResponse.json({ error: 'Класс с таким кодом не найден' }, { status: 404 });
  const moved = await one(`UPDATE users SET class_id = $1 WHERE id = $2 AND role = 'student' RETURNING id`, [cls.id, userId]);
  if (!moved) return NextResponse.json({ error: 'Вступить в класс может только ученик' }, { status: 403 });
  return NextResponse.json({ ok: true, class: cls.name });
}
