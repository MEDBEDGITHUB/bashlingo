import { NextResponse } from 'next/server';
import { one, tx } from '@/lib/db';
import { currentUser, setUserCookie } from '@/lib/user';
import { readJson } from '@/lib/session';
import { verifyInitData } from '@/lib/telegram';
import { insertWithCode, normCode } from '@/lib/codes';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'not_registered' }, { status: 401 });
  const { id, ...pub } = user;
  return NextResponse.json(pub);
}

const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Регистрация ученика или учителя.
// Ученик: {name, level, joinCode?}. Учитель: {role:'teacher', name, schoolCode} или {role:'teacher', name, newSchool:{name, city}}.
// initData (Telegram Mini App) привязывает аккаунт к Telegram.
export async function POST(req) {
  const body = await readJson(req);
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  const name = clean(body.name, 40);
  if (!name) return bad('Введите имя');

  let tgId = null;
  if (body.initData) {
    const tg = verifyInitData(String(body.initData));
    if (!tg) return bad('Не удалось подтвердить вход через Telegram. Откройте приложение заново.');
    tgId = tg.id;
    const existing = await one('SELECT id FROM users WHERE telegram_id = $1', [tgId]);
    if (existing) return setUserCookie(NextResponse.json({ ok: true, existing: true }), existing.id);
  }

  if (role === 'student') {
    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) return bad('Выберите уровень');
    let classId = null;
    const code = normCode(body.joinCode);
    if (code) {
      const cls = await one('SELECT id FROM classes WHERE join_code = $1', [code]);
      if (!cls) return bad('Класс с таким кодом не найден', 404);
      classId = cls.id;
    }
    const user = await one(
      `INSERT INTO users (name, level, role, class_id, telegram_id) VALUES ($1, $2, 'student', $3, $4) RETURNING id`,
      [name, level, classId, tgId]
    );
    return setUserCookie(NextResponse.json({ ok: true, role }), user.id);
  }

  const schoolCode = normCode(body.schoolCode);
  const newName = clean(body.newSchool?.name, 80);
  const newCity = clean(body.newSchool?.city, 60) || null;
  if (!schoolCode && !newName) return bad('Введите код школы или создайте школу');

  let result;
  try {
    result = await tx(async (run) => {
      let schoolId;
      if (schoolCode) {
        const [school] = await run('SELECT id FROM schools WHERE code = $1', [schoolCode]);
        if (!school) return null;
        schoolId = school.id;
      } else {
        const [school] = await insertWithCodeTx(run, newName, newCity);
        schoolId = school.id;
      }
      const [user] = await run(
        `INSERT INTO users (name, level, role, school_id, telegram_id) VALUES ($1, 5, 'teacher', $2, $3) RETURNING id`,
        [name, schoolId, tgId]
      );
      return user;
    });
  } catch (e) {
    console.error('teacher signup failed', e);
    return bad('Не получилось создать аккаунт, попробуйте ещё раз', 500);
  }
  if (!result) return bad('Школа с таким кодом не найдена', 404);
  return setUserCookie(NextResponse.json({ ok: true, role }), result.id);
}

// Внутри транзакции ошибка уникальности ломает транзакцию, поэтому используем SAVEPOINT.
async function insertWithCodeTx(run, name, city) {
  return insertWithCode(
    async (sql, params) => {
      await run('SAVEPOINT code_try');
      try {
        const rows = await run(sql, params);
        await run('RELEASE SAVEPOINT code_try');
        return rows;
      } catch (e) {
        await run('ROLLBACK TO SAVEPOINT code_try');
        throw e;
      }
    },
    'INSERT INTO schools (name, city, code) VALUES ($1, $2, $3) RETURNING id',
    [name, city]
  );
}
