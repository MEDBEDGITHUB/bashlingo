import { tx } from './db';

export const LESSON_XP = 10;
export const PERFECT_BONUS = 5;
export const DAILY_XP = 20;

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Сохраняет ответы и начисляет опыт один раз на ключ (урок или день).
export async function completeActivity({ userId, key, baseXp, results }) {
  return tx(async (run) => {
    for (const r of results) {
      await run(
        `INSERT INTO answers (user_id, fragment_id, exercise, correct)
         SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM fragments WHERE id = $2)`,
        [userId, r.fragmentId, r.type, r.correct]
      );
    }
    const mistakes = results.filter((r) => !r.correct).length;
    const xp = baseXp + (mistakes === 0 ? PERFECT_BONUS : 0);
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
    return { awarded, mistakes, repeat: !inserted.length, streak: u?.streak ?? 0 };
  });
}
