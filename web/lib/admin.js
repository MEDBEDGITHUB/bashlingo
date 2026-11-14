import { q, one } from './db';

export async function adminStats() {
  return one(`
    SELECT (SELECT count(*) FROM users WHERE role = 'student')::int AS students,
           (SELECT count(*) FROM users WHERE role = 'teacher')::int AS teachers,
           (SELECT count(*) FROM users WHERE telegram_id IS NOT NULL)::int AS tg_users,
           (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days')::int AS new_week,
           (SELECT count(*) FROM schools)::int AS schools,
           (SELECT count(*) FROM classes)::int AS classes,
           (SELECT count(DISTINCT user_id) FROM answers WHERE created_at >= current_date)::int AS active_today,
           (SELECT count(DISTINCT user_id) FROM answers WHERE created_at >= now() - interval '7 days')::int AS active_week,
           (SELECT count(*) FROM answers)::int AS answers,
           (SELECT count(*) FROM answers WHERE created_at >= current_date)::int AS answers_today,
           (SELECT count(*) FROM answers WHERE correct)::int AS answers_correct,
           (SELECT count(*) FROM completions)::int AS completions,
           (SELECT count(*) FROM fragments WHERE origin = 'dataset')::int AS fragments,
           (SELECT count(DISTINCT fragment_id) FROM answers a JOIN fragments f ON f.id = a.fragment_id AND f.origin = 'dataset' WHERE a.correct)::int AS fragments_confirmed,
           (SELECT count(*) FROM fragments WHERE origin = 'teacher')::int AS teacher_cards,
           (SELECT count(*) FROM reports)::int AS reports`);
}

export async function adminActivity(days = 14) {
  return q(
    `SELECT d::date AS day,
            (SELECT count(*) FROM answers a WHERE a.created_at >= d AND a.created_at < d + interval '1 day')::int AS answers,
            (SELECT count(DISTINCT user_id) FROM answers a WHERE a.created_at >= d AND a.created_at < d + interval '1 day')::int AS users,
            (SELECT count(*) FROM users u WHERE u.created_at >= d AND u.created_at < d + interval '1 day')::int AS signups
       FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
      ORDER BY d`,
    [days]
  );
}

export async function adminSchools() {
  return q(`
    SELECT s.id, s.name, s.city, s.code, s.created_at,
           (SELECT count(*) FROM users u WHERE u.school_id = s.id AND u.role = 'teacher')::int AS teachers,
           (SELECT count(*) FROM classes c WHERE c.school_id = s.id)::int AS classes,
           (SELECT count(*) FROM users u JOIN classes c ON c.id = u.class_id WHERE c.school_id = s.id)::int AS students,
           COALESCE((SELECT sum(e.amount) FROM xp_events e JOIN users u ON u.id = e.user_id JOIN classes c ON c.id = u.class_id
                      WHERE c.school_id = s.id AND e.created_at >= now() - interval '7 days'), 0)::int AS xp_week
      FROM schools s ORDER BY students DESC, s.name`);
}

// Спорные переводы: фрагменты корпуса, по которым есть замечания.
export async function adminDisputed() {
  const rows = await q(`
    SELECT f.id, f.text_ba, f.translation_auto, f.source,
           count(DISTINCT r.user_id)::int AS voters,
           max(r.created_at) AS last_at,
           (SELECT json_agg(x) FROM (SELECT proposed, count(DISTINCT user_id)::int AS n FROM reports
                                      WHERE fragment_id = f.id AND proposed IS NOT NULL
                                      GROUP BY proposed ORDER BY n DESC, proposed LIMIT 5) x) AS proposals,
           (SELECT json_agg(x) FROM (SELECT reason, count(*)::int AS n FROM reports
                                      WHERE fragment_id = f.id GROUP BY reason ORDER BY n DESC) x) AS reasons
      FROM fragments f JOIN reports r ON r.fragment_id = f.id
     WHERE f.origin = 'dataset'
     GROUP BY f.id ORDER BY voters DESC, last_at DESC LIMIT 100`);
  return rows.map((r) => {
    const top = r.proposals?.[0];
    const community = Boolean(top) && top.n >= 5 && top.n >= 0.8 * r.voters;
    return { ...r, proposals: r.proposals ?? [], reasons: r.reasons ?? [], status: community ? 'community' : 'expert_review' };
  });
}

export async function adminRecentUsers() {
  return q(`
    SELECT u.name, u.role, u.level, u.created_at, (u.telegram_id IS NOT NULL) AS tg,
           c.name AS class_name, s.name AS school_name,
           COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id), 0)::int AS xp
      FROM users u
      LEFT JOIN classes c ON c.id = u.class_id
      LEFT JOIN schools s ON s.id = COALESCE(u.school_id, c.school_id)
     ORDER BY u.created_at DESC LIMIT 15`);
}
