import { q, one } from './db.js';

export async function getPath(userId) {
  const lessons = await q(
    `SELECT l.slug, l.title, l.position, u.slug AS unit_slug, u.title AS unit_title, u.icon, u.position AS unit_pos,
            (c.key IS NOT NULL) AS done
       FROM lessons l
       JOIN units u ON u.slug = l.unit_slug
       LEFT JOIN completions c ON c.key = l.slug AND c.user_id = $1
      ORDER BY u.position, l.position`,
    [userId]
  );
  const units = [];
  let currentFound = false;
  for (const l of lessons) {
    let unit = units.find((u) => u.slug === l.unit_slug);
    if (!unit) {
      unit = { slug: l.unit_slug, title: l.unit_title, icon: l.icon, lessons: [] };
      units.push(unit);
    }
    let state = l.done ? 'done' : 'locked';
    if (!l.done && !currentFound) {
      state = 'current';
      currentFound = true;
    }
    unit.lessons.push({ slug: l.slug, title: l.title, state });
  }
  return units;
}

export async function getLesson(slug) {
  return one(
    `SELECT l.slug, l.title, u.slug AS unit_slug, u.title AS unit_title,
            (SELECT count(*) FROM lessons l2 WHERE l2.unit_slug = l.unit_slug)::int AS unit_lessons,
            l.position
       FROM lessons l JOIN units u ON u.slug = l.unit_slug WHERE l.slug = $1`,
    [slug]
  );
}

export async function lessonFragments(slug) {
  return q(
    `SELECT f.id, f.text_ba, f.translation_auto AS text_ru, f.source
       FROM lesson_fragments lf JOIN fragments f ON f.id = lf.fragment_id
      WHERE lf.lesson_slug = $1 ORDER BY lf.position`,
    [slug]
  );
}

const DAILY_UNITS = { 1: ['greetings'], 2: ['greetings'], 3: ['greetings', 'family'] };

export async function dailyFragments(level, dateKey) {
  const units = DAILY_UNITS[level] ?? null;
  const rows = await q(
    `SELECT f.id, f.text_ba, f.translation_auto AS text_ru, f.source
       FROM fragments f
       JOIN lesson_fragments lf ON lf.fragment_id = f.id
       JOIN lessons l ON l.slug = lf.lesson_slug
      WHERE $1::text[] IS NULL OR l.unit_slug = ANY($1::text[])`,
    [units]
  );
  const seed = [...dateKey].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return seededShuffle(rows, seed).slice(0, 5);
}

export async function distractorPool(slug) {
  return q(
    `SELECT f.id, f.text_ba, f.translation_auto AS text_ru
       FROM fragments f
       JOIN lesson_fragments lf ON lf.fragment_id = f.id
       JOIN lessons l ON l.slug = lf.lesson_slug
      WHERE l.unit_slug = (SELECT unit_slug FROM lessons WHERE slug = $1::text) OR $1::text IS NULL`,
    [slug]
  );
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffle(arr) {
  return seededShuffle(arr, (Math.random() * 2 ** 31) >>> 0);
}

const tokens = (s) => s.trim().split(/\s+/);
const buildable = (f) => !/[()…\-–]|\.\.\./.test(f.text_ba) && tokens(f.text_ba).length >= 2 && tokens(f.text_ba).length <= 6;

export function buildExercises(frags, pool, { verify = false, simple = false } = {}) {
  const others = (f) => pool.filter((p) => p.id !== f.id && p.text_ru !== f.text_ru);
  const out = [];
  frags.forEach((f, i) => {
    if (i === 3 && frags.length >= 4 && !simple) {
      const pairs = frags.slice(0, 4).map((p) => ({ id: p.id, ba: p.text_ba, ru: p.text_ru }));
      out.push({ type: 'match', pairs, ruOrder: shuffle(pairs.map((p) => p.id)) });
    }
    if (verify && (i === 1 || i === 3) && others(f).length >= 2) {
      // Проверка перевода (ТЗ 4.3): примерно в половине случаев подставляем перевод другой фразы
      const wrong = shuffle(others(f)).slice(0, 2).map((o) => o.text_ru);
      const planted = Math.random() < 0.5;
      out.push({ type: 'verify', fragment: f, shown: planted ? wrong[0] : f.text_ru, options: shuffle([f.text_ru, ...wrong]) });
    } else if (!simple && i % 3 === 2 && buildable(f)) {
      const extra = shuffle(others(f).flatMap((o) => tokens(o.text_ba)))
        .filter((t) => !tokens(f.text_ba).includes(t))
        .slice(0, 3);
      out.push({ type: 'build', fragment: f, bank: shuffle([...tokens(f.text_ba), ...extra]) });
    } else {
      const wrong = shuffle(others(f)).slice(0, 2).map((o) => o.text_ru);
      out.push({ type: 'choose', fragment: f, options: shuffle([f.text_ru, ...wrong]) });
    }
  });
  return out;
}
