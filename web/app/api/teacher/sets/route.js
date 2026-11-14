import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { tx } from '@/lib/db';
import { currentTeacher } from '@/lib/user';
import { readJson } from '@/lib/session';

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Набор своих карточек учителя: {title, cards: [{ba, ru}]}
export async function POST(req) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: 'Только для учителей' }, { status: 403 });
  const body = await readJson(req);
  const title = clean(body.title, 60);
  const cards = (Array.isArray(body.cards) ? body.cards : [])
    .slice(0, 40)
    .map((c) => ({ ba: clean(c?.ba, 200), ru: clean(c?.ru, 200) }))
    .filter((c) => c.ba && c.ru);
  if (!title) return NextResponse.json({ error: 'Введите название набора' }, { status: 400 });
  if (cards.length < 3) return NextResponse.json({ error: 'Нужно минимум 3 заполненные карточки' }, { status: 400 });
  if (new Set(cards.map((c) => c.ru.toLowerCase())).size < cards.length)
    return NextResponse.json({ error: 'Переводы карточек не должны повторяться' }, { status: 400 });

  const set = await tx(async (run) => {
    const [s] = await run('INSERT INTO card_sets (teacher_id, title) VALUES ($1, $2) RETURNING id, title', [teacher.id, title]);
    for (const [i, c] of cards.entries()) {
      const id = `t-${crypto.randomUUID()}`;
      await run(
        `INSERT INTO fragments (id, text_ba, lang_pair, translation_auto, source, origin, owner_id)
         VALUES ($1, $2, 'ba-ru', $3, $4, 'teacher', $5)`,
        [id, c.ba, c.ru, { doc: `Карточка учителя: ${title}`, row: i + 1 }, teacher.id]
      );
      await run('INSERT INTO card_set_items (set_id, fragment_id, position) VALUES ($1, $2, $3)', [s.id, id, i]);
    }
    return s;
  });
  return NextResponse.json({ ...set, cards: cards.length });
}
