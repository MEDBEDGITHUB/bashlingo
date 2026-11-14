import { NextResponse } from 'next/server';
import { currentTeacher } from '@/lib/user';
import { teacherClass, classReport } from '@/lib/classes';

// Отчёт по классу для учителя и LMS: JSON или CSV (?format=csv)
export async function GET(req, { params }) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: 'Только для учителей' }, { status: 403 });
  const { id } = await params;
  const cls = await teacherClass(teacher.id, Number(id));
  if (!cls) return NextResponse.json({ error: 'Класс не найден' }, { status: 404 });
  const report = await classReport(cls.id);

  const rows = report.students.map((s) => ({
    name: s.name,
    xp_total: s.xp,
    xp_week: s.xp_week,
    streak: s.streak,
    lessons_done: s.lessons,
    accuracy_percent: s.accuracy,
    last_active: s.last_active ? new Date(s.last_active).toISOString().slice(0, 10) : null,
    assignments: report.assignments.map((a) => ({ title: a.title, done: a.id in s.marks, mistakes: s.marks[a.id] ?? null })),
  }));

  if (new URL(req.url).searchParams.get('format') !== 'csv') {
    return NextResponse.json({ class: cls.name, assignments: report.assignments.map((a) => ({ title: a.title, due_date: a.due_date })), students: rows });
  }
  // Защита от формул в Excel: значения, начинающиеся с = + - @, экранируем апострофом.
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Ученик', 'Опыт всего', 'Опыт за неделю', 'Серия дней', 'Уроков пройдено', 'Точность, %', 'Последняя активность', ...report.assignments.map((a) => `Задание: ${a.title}`)];
  const lines = rows.map((r) =>
    [r.name, r.xp_total, r.xp_week, r.streak, r.lessons_done, r.accuracy_percent ?? '', r.last_active ?? '', ...r.assignments.map((a) => (a.done ? 'выполнено' : 'нет'))].map(esc).join(';')
  );
  return new Response('﻿' + [head.map(esc).join(';'), ...lines].join('\r\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="class-${cls.id}-report.csv"` },
  });
}
