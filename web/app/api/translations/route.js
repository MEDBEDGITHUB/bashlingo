import { q } from '@/lib/db';

// Выгрузка по схеме ТЗ п.5: fragment_id, text_ba, lang_pair, translation, source, confirmed, status.
// Правило сообщества (GRILL-ME): вариант с ≥80% голосов при ≥5 голосующих получает статус community.
const SQL = `
WITH votes AS (
  SELECT fragment_id, proposed, count(DISTINCT user_id)::int AS n
    FROM reports WHERE proposed IS NOT NULL GROUP BY fragment_id, proposed
), totals AS (
  SELECT fragment_id, count(DISTINCT user_id)::int AS voters FROM reports GROUP BY fragment_id
), best AS (
  SELECT DISTINCT ON (fragment_id) fragment_id, proposed, n FROM votes ORDER BY fragment_id, n DESC
), ok AS (
  SELECT fragment_id, count(DISTINCT user_id)::int AS confirmed FROM answers WHERE correct GROUP BY fragment_id
)
SELECT f.id AS fragment_id, f.text_ba, f.lang_pair,
       CASE WHEN b.n >= 5 AND b.n >= 0.8 * t.voters THEN b.proposed ELSE f.translation_auto END AS translation,
       f.translation_auto AS translation_source,
       f.source,
       COALESCE(ok.confirmed, 0) AS confirmed,
       COALESCE(t.voters, 0) AS reports,
       CASE WHEN b.n >= 5 AND b.n >= 0.8 * t.voters THEN 'community'
            WHEN COALESCE(t.voters, 0) > 0 THEN 'expert_review'
            ELSE 'confirmed' END AS status
  FROM fragments f
  LEFT JOIN totals t ON t.fragment_id = f.id
  LEFT JOIN best b ON b.fragment_id = f.id
  LEFT JOIN ok ON ok.fragment_id = f.id
 WHERE f.lang_pair = $1 AND f.origin = 'dataset' AND ($2::text IS NULL OR
       (CASE WHEN b.n >= 5 AND b.n >= 0.8 * t.voters THEN 'community'
             WHEN COALESCE(t.voters, 0) > 0 THEN 'expert_review' ELSE 'confirmed' END) = $2::text)
 ORDER BY f.id`;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const langPair = searchParams.get('lang_pair') ?? 'ba-ru';
  const status = searchParams.get('status');
  const rows = await q(SQL, [langPair, status]);
  if (searchParams.get('format') === 'csv') {
    const cols = ['fragment_id', 'text_ba', 'lang_pair', 'translation', 'translation_source', 'source', 'confirmed', 'reports', 'status'];
    const esc = (v) => `"${String(typeof v === 'object' ? JSON.stringify(v) : v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    return new Response('﻿' + csv, {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="translations-${langPair}.csv"` },
    });
  }
  return Response.json({ items: rows });
}
