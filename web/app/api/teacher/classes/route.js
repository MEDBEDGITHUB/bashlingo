import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { currentTeacher } from '@/lib/user';
import { readJson } from '@/lib/session';
import { insertWithCode } from '@/lib/codes';

export async function POST(req) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: 'Только для учителей' }, { status: 403 });
  const body = await readJson(req);
  const name = String(body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!name) return NextResponse.json({ error: 'Введите название класса' }, { status: 400 });
  const [cls] = await insertWithCode(
    q,
    'INSERT INTO classes (school_id, name, teacher_id, join_code) VALUES ($1, $2, $3, $4) RETURNING id, name, join_code',
    [teacher.school_id, name, teacher.id]
  );
  return NextResponse.json(cls);
}
