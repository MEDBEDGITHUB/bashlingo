import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { isAdmin } from '@/lib/user';
import { readJson } from '@/lib/session';
import { insertWithCode } from '@/lib/codes';

// Создать школу: {name, city}. Возвращает код школы для учителей.
export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Только для администраторов' }, { status: 403 });
  const body = await readJson(req);
  const name = String(body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const city = String(body.city ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
  if (!name) return NextResponse.json({ error: 'Введите название школы' }, { status: 400 });
  const [school] = await insertWithCode(q, 'INSERT INTO schools (name, city, code) VALUES ($1, $2, $3) RETURNING id, name, city, code', [name, city]);
  return NextResponse.json(school);
}
