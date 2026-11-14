import { q, one } from './db';

const PERIODS = { day: '1 day', week: '7 days', month: '1 month', year: '1 year' };

export async function leaderboard(classId, period = 'week') {
  if (!Number.isInteger(classId)) return [];
  const interval = PERIODS[period] ?? PERIODS.week;
  return q(
    `SELECT u.id, u.name, COALESCE(sum(e.amount), 0)::int AS xp
       FROM users u
       LEFT JOIN xp_events e ON e.user_id = u.id AND e.created_at >= now() - $2::interval
      WHERE u.class_id = $1
      GROUP BY u.id, u.name
      ORDER BY xp DESC, u.name
      LIMIT 30`,
    [classId, interval]
  );
}

export async function classAssignment(classId) {
  return one(
    `SELECT a.id, a.title, a.lesson_slug, a.due_date,
            (SELECT count(*) FROM lesson_fragments lf WHERE lf.lesson_slug = a.lesson_slug)::int AS cards,
            (SELECT count(*) FROM users u WHERE u.class_id = a.class_id)::int AS members,
            (SELECT count(*) FROM users u JOIN completions c ON c.user_id = u.id AND c.key = a.lesson_slug
              WHERE u.class_id = a.class_id)::int AS done
       FROM assignments a WHERE a.class_id = $1 ORDER BY a.due_date LIMIT 1`,
    [classId]
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
