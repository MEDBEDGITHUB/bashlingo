import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentUser, isAdmin } from '@/lib/user';
import { leaderboard } from '@/lib/classes';

// Рейтинг класса виден ученикам этого класса, его учителю и администраторам.
export async function GET(req, { params }) {
  const { id } = await params;
  const classId = Number(id);
  const user = await currentUser();
  let allowed = await isAdmin();
  if (!allowed && user && Number.isInteger(classId)) {
    allowed = user.class_id === classId || Boolean(await one('SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2', [classId, user.id]));
  }
  if (!allowed) return NextResponse.json({ error: 'Нет доступа к этому классу' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') ?? 'week';
  const rows = await leaderboard(classId, period);
  return NextResponse.json({ items: rows.map((r, i) => ({ place: i + 1, name: r.name, xp: r.xp, me: r.id === user?.id })) });
}
