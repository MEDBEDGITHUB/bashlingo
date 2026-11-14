import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUser } from '@/lib/user';
import { readJson } from '@/lib/session';
import { accessibleSet } from '@/lib/classes';
import { completeActivity, todayKey, LESSON_XP, DAILY_XP } from '@/lib/progress';

const TYPES = new Set(['choose', 'build', 'match', 'verify']);

export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const body = await readJson(req);
  const lesson = String(body.lesson ?? '');
  const results = (Array.isArray(body.results) ? body.results : [])
    .slice(0, 60)
    .filter((r) => r && typeof r.fragmentId === 'string' && TYPES.has(r.type))
    .map((r) => ({
      fragmentId: r.fragmentId.slice(0, 40),
      type: r.type,
      correct: Boolean(r.correct),
      shown: typeof r.shown === 'string' ? r.shown : undefined,
      verdict: r.verdict,
      correction: typeof r.correction === 'string' ? r.correction : undefined,
    }));

  let key;
  let baseXp = LESSON_XP;
  const setMatch = /^set-(\d{1,9})$/.exec(lesson);
  if (lesson === 'daily') {
    key = `daily:${todayKey()}`;
    baseXp = DAILY_XP;
  } else if (setMatch) {
    const set = await accessibleSet(Number(setMatch[1]), user);
    if (!set) return NextResponse.json({ error: 'Набор не найден' }, { status: 404 });
    key = `set:${set.id}`;
  } else {
    const l = await one('SELECT slug FROM lessons WHERE slug = $1', [lesson]);
    if (!l) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 });
    key = l.slug;
  }
  const out = await completeActivity({ userId: user.id, key, baseXp, results });
  return NextResponse.json(out);
}
