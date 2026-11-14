import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId } from '@/lib/user';
import { readJson } from '@/lib/session';
import { REASONS } from '@/lib/reasons';

export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const body = await readJson(req);
  const fragmentId = String(body.fragmentId ?? '').slice(0, 40);
  const reason = String(body.reason ?? '');
  const proposed = String(body.proposed ?? '').trim().slice(0, 300) || null;
  if (!REASONS.includes(reason)) return NextResponse.json({ error: 'Укажите причину' }, { status: 400 });
  const f = await one('SELECT id FROM fragments WHERE id = $1', [fragmentId]);
  if (!f) return NextResponse.json({ error: 'Фрагмент не найден' }, { status: 404 });
  await one('INSERT INTO reports (user_id, fragment_id, reason, proposed) VALUES ($1,$2,$3,$4) RETURNING id', [
    userId,
    fragmentId,
    reason,
    proposed,
  ]);
  return NextResponse.json({ ok: true });
}
