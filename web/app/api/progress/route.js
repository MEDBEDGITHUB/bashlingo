import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUserId } from '@/lib/user';
import { completeActivity, todayKey, LESSON_XP, DAILY_XP } from '@/lib/progress';

const TYPES = new Set(['choose', 'build', 'match']);

export async function POST(req) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const lesson = String(body.lesson ?? '');
  const results = (Array.isArray(body.results) ? body.results : [])
    .slice(0, 40)
    .filter((r) => r && typeof r.fragmentId === 'string' && TYPES.has(r.type))
    .map((r) => ({ fragmentId: r.fragmentId.slice(0, 32), type: r.type, correct: Boolean(r.correct) }));

  let key;
  let baseXp;
  if (lesson === 'daily') {
    key = `daily:${todayKey()}`;
    baseXp = DAILY_XP;
  } else {
    const l = await one('SELECT slug FROM lessons WHERE slug = $1', [lesson]);
    if (!l) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 });
    key = l.slug;
    baseXp = LESSON_XP;
  }
  const out = await completeActivity({ userId, key, baseXp, results });
  return NextResponse.json(out);
}
