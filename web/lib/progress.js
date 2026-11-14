import { tx } from './db.js';
import { awardBadges } from './badges.js';

export const LESSON_XP = 10;
export const PERFECT_BONUS = 5;
export const DAILY_XP = 20;

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Сохраняет ответы и начисляет опыт один раз на ключ (урок, набор или день).
// Для проверки перевода (type 'verify') верность считается здесь, а не берётся от клиента:
// «подменён ли перевод» определяется сравнением с исходным переводом фрагмента.
export async function completeActivity({ userId, key, baseXp, results }) {
  return tx(async (run) => {
    let mistakes = 0;
    let fixes = 0;
    for (const r of results) {
      let correct = r.correct;
      if (r.type === 'verify') {
        const [f] = await run('SELECT translation_auto FROM fragments WHERE id = $1', [r.fragmentId]);
        if (!f) continue;
        const shown = String(r.shown ?? '').slice(0, 300);
        const verdict = r.verdict === 'wrong' ? 'wrong' : 'ok';
        const correction = verdict === 'wrong' ? String(r.correction ?? '').trim().slice(0, 300) || null : null;
        const planted = shown !== f.translation_auto;
        correct = planted ? verdict === 'wrong' && correction === f.translation_auto : verdict === 'ok';
        if (planted && correct) fixes++;
        await run(
          'INSERT INTO checks (user_id, fragment_id, shown, planted, verdict, correction) VALUES ($1,$2,$3,$4,$5,$6)',
          [userId, r.fragmentId, shown, planted, verdict, correction]
        );
        // Ученик считает исходный перевод неверным и предлагает свой: это голос в согласовании переводов
        if (!planted && verdict === 'wrong' && correction && correction !== f.translation_auto) {
          await run(
            `INSERT INTO reports (user_id, fragment_id, reason, proposed) VALUES ($1, $2, 'Перевод неверный', $3)`,
            [userId, r.fragmentId, correction]
          );
        }
      }
      if (!correct) mistakes++;
      await run(
        `INSERT INTO answers (user_id, fragment_id, exercise, correct)
         SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM fragments WHERE id = $2)`,
        [userId, r.fragmentId, r.type, correct]
      );
    }
    const xp = baseXp + (mistakes === 0 ? PERFECT_BONUS : 0) + fixes * 2;
    const inserted = await run(
      `INSERT INTO completions (user_id, key, mistakes, xp) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, key) DO NOTHING RETURNING xp`,
      [userId, key, mistakes, xp]
    );
    const awarded = inserted.length ? xp : 0;
    if (awarded) await run(`INSERT INTO xp_events (user_id, amount, reason) VALUES ($1, $2, $3)`, [userId, awarded, key]);
    const [u] = await run(
      `UPDATE users SET
         streak = CASE WHEN last_active = current_date THEN streak
                       WHEN last_active = current_date - 1 THEN streak + 1
                       ELSE 1 END,
         last_active = current_date
       WHERE id = $1 RETURNING streak`,
      [userId]
    );
    const badges = await awardBadges(run, userId);
    return { awarded, mistakes, repeat: !inserted.length, streak: u?.streak ?? 0, badges };
  });
}
