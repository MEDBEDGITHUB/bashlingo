import { NextResponse } from 'next/server';
import { q } from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const langPair = searchParams.get('lang_pair') ?? 'ba-ru';
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
  const rows = await q(
    `SELECT id AS fragment_id, text_ba, lang_pair, translation_auto, source
       FROM fragments WHERE lang_pair = $1 ORDER BY id LIMIT $2 OFFSET $3`,
    [langPair, limit, offset]
  );
  return NextResponse.json({ items: rows, limit, offset });
}
