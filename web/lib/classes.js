import { q, one } from './db.js';

const PERIODS = { day: '1 day', week: '7 days', month: '1 month', year: '1 year' };
// Ключ учтённого прохождения для задания: slug урока или 'set:<id>' для набора учителя
const A_KEY = `COALESCE(a.lesson_slug, 'set:' || a.set_id)`;

export const METRICS = {
  xp: { label: 'Опыт', unit: 'XP' },
  words: { label: 'Словарный запас', unit: 'фраз' },
  accuracy: { label: 'Меньше ошибок', unit: '%' },
  fixes: { label: 'Исправления', unit: '' },
};

// Рейтинг класса за период по выбранному показателю (ТЗ 4.5).
// words: сколько разных фраз ученик ответил верно; accuracy: доля верных ответов (от 5 ответов);
// fixes: найденные подмены перевода и предложенные исправления.
export async function leaderboard(classId, period = 'week', metric = 'xp') {
  if (!Number.isInteger(classId)) return [];
  const interval = PERIODS[period] ?? PERIODS.week;
  const m = METRICS[metric] ? metric : 'xp';
  const value = {
    xp: `COALESCE((SELECT sum(e.amount) FROM xp_events e WHERE e.user_id = u.id AND e.created_at >= now() - $2::interval), 0)`,
    words: `(SELECT count(DISTINCT a.fragment_id) FROM answers a WHERE a.user_id = u.id AND a.correct AND a.created_at >= now() - $2::interval)`,
    accuracy: `(SELECT CASE WHEN count(*) >= 5 THEN round(100.0 * count(*) FILTER (WHERE a.correct) / count(*)) END
                   FROM answers a WHERE a.user_id = u.id AND a.created_at >= now() - $2::interval)`,
    fixes: `((SELECT count(*) FROM checks c WHERE c.user_id = u.id AND c.verdict = 'wrong' AND c.created_at >= now() - $2::interval)
             + (SELECT count(*) FROM reports r WHERE r.user_id = u.id AND r.proposed IS NOT NULL AND r.created_at >= now() - $2::interval))`,
  }[m];
  const rows = await q(
    `SELECT u.id, u.name, ${value}::int AS xp
       FROM users u WHERE u.class_id = $1
      ORDER BY xp DESC NULLS LAST, u.name LIMIT 50`,
    [classId, interval]
  );
  return rows.map((r) => ({ ...r, xp: r.xp ?? null }));
}

export async function classAssignments(classId, userId = null) {
  return q(
    `SELECT a.id, a.title, a.due_date, a.set_id,
            COALESCE(a.lesson_slug, 'set-' || a.set_id) AS href,
            (CASE WHEN a.set_id IS NULL
                  THEN (SELECT count(*) FROM lesson_fragments lf WHERE lf.lesson_slug = a.lesson_slug)
                  ELSE (SELECT count(*) FROM card_set_items i WHERE i.set_id = a.set_id) END)::int AS cards,
            (SELECT count(*) FROM users u WHERE u.class_id = a.class_id)::int AS members,
            (SELECT count(*) FROM users u JOIN completions c ON c.user_id = u.id AND c.key = ${A_KEY}
              WHERE u.class_id = a.class_id)::int AS done,
            EXISTS (SELECT 1 FROM completions c WHERE c.user_id = $2::uuid AND c.key = ${A_KEY}) AS mine
       FROM assignments a
      WHERE a.class_id = $1
      ORDER BY a.due_date, a.id`,
    [classId, userId]
  );
}

export async function schoolBoard() {
  return q(
    `SELECT s.name, COALESCE(sum(e.amount), 0)::int AS xp
       FROM schools s
       JOIN classes c ON c.school_id = s.id
       JOIN users u ON u.class_id = c.id
       LEFT JOIN xp_events e ON e.user_id = u.id AND e.created_at >= now() - interval '7 days'
      GROUP BY s.id, s.name ORDER BY xp DESC LIMIT 10`
  );
}

// ---- Кабинет учителя ----

export async function teacherClasses(teacherId) {
  return q(
    `SELECT c.id, c.name, c.join_code,
            (SELECT count(*) FROM users u WHERE u.class_id = c.id)::int AS students,
            (SELECT count(*) FROM assignments a WHERE a.class_id = c.id)::int AS assignments,
            COALESCE((SELECT sum(e.amount) FROM xp_events e JOIN users u ON u.id = e.user_id
                       WHERE u.class_id = c.id AND e.created_at >= now() - interval '7 days'), 0)::int AS xp_week,
            (SELECT count(*) FROM users u WHERE u.class_id = c.id AND u.last_active >= current_date - 6)::int AS active_week
       FROM classes c WHERE c.teacher_id = $1 ORDER BY c.name`,
    [teacherId]
  );
}

export async function teacherClass(teacherId, classId) {
  if (!Number.isInteger(classId)) return null;
  return one('SELECT id, name, join_code, school_id FROM classes WHERE id = $1 AND teacher_id = $2', [classId, teacherId]);
}

export async function teacherSets(teacherId) {
  return q(
    `SELECT s.id, s.title, (SELECT count(*) FROM card_set_items i WHERE i.set_id = s.id)::int AS cards
       FROM card_sets s WHERE s.teacher_id = $1 ORDER BY s.created_at DESC`,
    [teacherId]
  );
}

// Отчёт по классу: строка на ученика + отметки по каждому заданию.
export async function classReport(classId) {
  const [students, assignments, marks] = await Promise.all([
    q(
      `SELECT u.id, u.name, u.level,
              CASE WHEN u.last_active >= current_date - 1 THEN u.streak ELSE 0 END AS streak,
              u.last_active,
              COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id), 0)::int AS xp,
              COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id AND e.created_at >= now() - interval '7 days'), 0)::int AS xp_week,
              (SELECT count(*) FROM completions c WHERE c.user_id = u.id AND c.key NOT LIKE 'daily:%' AND c.key NOT LIKE 'set:%')::int AS lessons,
              (SELECT count(*) FROM answers a WHERE a.user_id = u.id)::int AS answers,
              (SELECT count(*) FROM answers a WHERE a.user_id = u.id AND a.correct)::int AS correct
         FROM users u WHERE u.class_id = $1 ORDER BY xp_week DESC, u.name`,
      [classId]
    ),
    classAssignments(classId),
    q(
      `SELECT a.id AS assignment_id, c.user_id, c.mistakes
         FROM assignments a
         JOIN completions c ON c.key = ${A_KEY}
         JOIN users u ON u.id = c.user_id AND u.class_id = a.class_id
        WHERE a.class_id = $1`,
      [classId]
    ),
  ]);
  const byUser = {};
  for (const m of marks) (byUser[m.user_id] ??= {})[m.assignment_id] = m.mistakes;
  return {
    assignments,
    students: students.map((s) => ({
      ...s,
      accuracy: s.answers ? Math.round((s.correct / s.answers) * 100) : null,
      marks: byUser[s.id] ?? {},
    })),
  };
}

// Доступ к набору учителя: автор или ученик класса, которому набор назначен.
export async function accessibleSet(setId, user) {
  if (!Number.isInteger(setId)) return null;
  return one(
    `SELECT s.id, s.title FROM card_sets s
      WHERE s.id = $1 AND (s.teacher_id = $2
         OR EXISTS (SELECT 1 FROM assignments a WHERE a.set_id = s.id AND a.class_id = $3))`,
    [setId, user.id, user.class_id]
  );
}

export async function setFragments(setId) {
  return q(
    `SELECT f.id, f.text_ba, f.translation_auto AS text_ru, f.source
       FROM card_set_items i JOIN fragments f ON f.id = i.fragment_id
      WHERE i.set_id = $1 ORDER BY i.position`,
    [setId]
  );
}
