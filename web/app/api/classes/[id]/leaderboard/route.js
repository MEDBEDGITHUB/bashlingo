import { NextResponse } from 'next/server';
import { leaderboard } from '@/lib/classes';

export async function GET(req, { params }) {
  const { id } = await params;
  const period = new URL(req.url).searchParams.get('period') ?? 'week';
  const rows = await leaderboard(Number(id), period);
  return NextResponse.json({ items: rows });
}
