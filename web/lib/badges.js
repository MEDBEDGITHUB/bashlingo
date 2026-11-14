// Достижения. Каждое условие проверяется после прохождения урока или проверки перевода.
export const BADGES = {
  first_lesson: { icon: '🌱', title: 'Первый шаг', hint: 'Пройдите первый урок' },
  perfect: { icon: '🎯', title: 'Без ошибок', hint: 'Пройдите урок без единой ошибки' },
  streak3: { icon: '🔥', title: '3 дня подряд', hint: 'Занимайтесь 3 дня подряд' },
  streak7: { icon: '🏅', title: 'Неделя подряд', hint: 'Занимайтесь 7 дней подряд' },
  daily5: { icon: '☀️', title: 'Постоянство', hint: 'Выполните задание дня 5 раз' },
  xp100: { icon: '⚡', title: '100 XP', hint: 'Наберите 100 опыта' },
  xp500: { icon: '💎', title: '500 XP', hint: 'Наберите 500 опыта' },
  corrector: { icon: '🖊️', title: 'Корректор', hint: 'Найдите неверный перевод и исправьте его' },
  unit: { icon: '🏆', title: 'Раздел пройден', hint: 'Пройдите все уроки раздела' },
};

// Возвращает список новых бейджей (ещё не выданных) и записывает их.
export async function awardBadges(run, userId) {
  const [s] = await run(
    `SELECT (SELECT count(*) FROM completions WHERE user_id = $1 AND key NOT LIKE 'daily:%')::int AS lessons,
            (SELECT count(*) FROM completions WHERE user_id = $1 AND key LIKE 'daily:%')::int AS dailies,
            (SELECT count(*) FROM completions WHERE user_id = $1 AND mistakes = 0 AND key NOT LIKE 'daily:%')::int AS perfect,
            (SELECT streak FROM users WHERE id = $1)::int AS streak,
            COALESCE((SELECT sum(amount) FROM xp_events WHERE user_id = $1), 0)::int AS xp,
            (SELECT count(*) FROM checks WHERE user_id = $1 AND planted AND verdict = 'wrong')::int AS fixes,
            (SELECT count(*) FROM units u WHERE NOT EXISTS (
                SELECT 1 FROM lessons l WHERE l.unit_slug = u.slug
                   AND NOT EXISTS (SELECT 1 FROM completions c WHERE c.user_id = $1 AND c.key = l.slug)))::int AS units_done`,
    [userId]
  );
  const earned = {
    first_lesson: s.lessons >= 1,
    perfect: s.perfect >= 1,
    streak3: s.streak >= 3,
    streak7: s.streak >= 7,
    daily5: s.dailies >= 5,
    xp100: s.xp >= 100,
    xp500: s.xp >= 500,
    corrector: s.fixes >= 1,
    unit: s.units_done >= 1,
  };
  const have = new Set((await run('SELECT badge FROM user_badges WHERE user_id = $1', [userId])).map((r) => r.badge));
  const fresh = Object.keys(earned).filter((b) => earned[b] && !have.has(b));
  for (const b of fresh) await run('INSERT INTO user_badges (user_id, badge) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, b]);
  return fresh;
}
