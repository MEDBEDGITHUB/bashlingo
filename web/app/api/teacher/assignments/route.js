import { NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentTeacher } from '@/lib/user';
import { readJson } from '@/lib/session';
import { teacherClass } from '@/lib/classes';

const err = (error, status = 400) => NextResponse.json({ error }, { status });

// Назначить классу урок курса или свой набор: {classId, lessonSlug | setId, dueDate, title?}
export async function POST(req) {
  const teacher = await currentTeacher();
  if (!teacher) return err('Только для учителей', 403);
  const body = await readJson(req);
  const cls = await teacherClass(teacher.id, Number(body.classId));
  if (!cls) return err('Класс не найден', 404);
  const due = String(body.dueDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due))) return err('Укажите срок сдачи');

  let lessonSlug = null;
  let setId = null;
  let title;
  if (body.setId != null) {
    const set = await one('SELECT id, title FROM card_sets WHERE id = $1 AND teacher_id = $2', [Number(body.setId) || 0, teacher.id]);
    if (!set) return err('Набор не найден', 404);
    setId = set.id;
    title = set.title;
  } else {
    const lesson = await one('SELECT slug, title FROM lessons WHERE slug = $1', [String(body.lessonSlug ?? '')]);
    if (!lesson) return err('Выберите урок или набор');
    lessonSlug = lesson.slug;
    title = lesson.title;
  }
  const custom = String(body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const dup = await one(
    'SELECT 1 FROM assignments WHERE class_id = $1 AND lesson_slug IS NOT DISTINCT FROM $2 AND set_id IS NOT DISTINCT FROM $3',
    [cls.id, lessonSlug, setId]
  );
  if (dup) return err('Это задание уже назначено классу');
  const a = await one(
    'INSERT INTO assignments (class_id, title, lesson_slug, set_id, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [cls.id, custom || title, lessonSlug, setId, due]
  );
  return NextResponse.json(a);
}

// Снять задание: {id}
export async function DELETE(req) {
  const teacher = await currentTeacher();
  if (!teacher) return err('Только для учителей', 403);
  const body = await readJson(req);
  const gone = await one(
    `DELETE FROM assignments a USING classes c
      WHERE a.id = $1 AND c.id = a.class_id AND c.teacher_id = $2 RETURNING a.id`,
    [Number(body.id) || 0, teacher.id]
  );
  if (!gone) return err('Задание не найдено', 404);
  return NextResponse.json({ ok: true });
}
