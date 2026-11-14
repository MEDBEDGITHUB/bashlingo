import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { teacherClass, classReport, teacherSets } from '@/lib/classes';
import { q } from '@/lib/db';
import { TopBar, TabBar } from '../../../components';
import { CopyCode, CreateAssignment, RemoveAssignment } from '../../forms';

export const dynamic = 'force-dynamic';

const fmt = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export default async function TeacherClassPage({ params }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/welcome');
  if (user.role !== 'teacher') redirect('/class');
  const cls = await teacherClass(user.id, Number(id));
  if (!cls) notFound();

  const [report, sets, lessonRows] = await Promise.all([
    classReport(cls.id),
    teacherSets(user.id),
    q(`SELECT l.slug, l.title, u.title AS unit FROM lessons l JOIN units u ON u.slug = l.unit_slug ORDER BY u.position, l.position`),
  ]);
  const lessons = [];
  for (const l of lessonRows) {
    let u = lessons.find((x) => x.title === l.unit);
    if (!u) lessons.push((u = { title: l.unit, lessons: [] }));
    u.lessons.push({ slug: l.slug, title: l.title });
  }
  const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const { students, assignments } = report;
  const activeWeek = students.filter((s) => s.last_active && Date.now() - new Date(s.last_active) < 7 * 864e5).length;

  return (
    <main className="app wide">
      <TopBar user={user} />
      <div className="page-pad">
        <Link href="/teacher" className="back">← Все классы</Link>
        <h1 className="h1">{cls.name}</h1>
        <p className="lead">{user.school_name}</p>

        <div className="school-card">
          <div>
            <b>Как пригласить учеников</b>
            <span>Покажите код на доске или отправьте ссылку в чат класса. Ученик вводит код при первом входе или во вкладке «Класс».</span>
          </div>
          <CopyCode code={cls.join_code} label="Код класса" link={`/join/${cls.join_code}`} />
        </div>

        <div className="tstats row4">
          <div><b>{students.length}</b><span>учеников</span></div>
          <div><b>{activeWeek}</b><span>занимались за 7 дней</span></div>
          <div><b>{students.reduce((a, s) => a + s.xp_week, 0)}</b><span>XP за неделю</span></div>
          <div><b>{assignments.length}</b><span>заданий</span></div>
        </div>

        <h2 className="h2">Задания</h2>
        {assignments.length === 0 && <p className="lead">Заданий пока нет.</p>}
        {assignments.map((a) => (
          <div key={a.id} className="arow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{a.set_id ? '🗂️' : '📘'} {a.title}</b>
              <span>{a.cards} карточек · до {fmt(a.due_date)} · выполнили {a.done} из {a.members}</span>
              <div className="bar"><i style={{ width: `${a.members ? (a.done / a.members) * 100 : 0}%`, background: 'var(--green)' }} /></div>
            </div>
            <RemoveAssignment id={a.id} title={a.title} />
          </div>
        ))}
        <CreateAssignment classId={cls.id} lessons={lessons} sets={sets} defaultDue={due} />

        <div className="h2-row">
          <h2 className="h2">Ученики</h2>
          {students.length > 0 && <a className="mini" href={`/api/teacher/classes/${cls.id}/report?format=csv`}>Скачать отчёт (CSV)</a>}
        </div>
        {students.length === 0 ? (
          <p className="lead">В классе пока никого нет. Поделитесь кодом <b className="code">{cls.join_code}</b>.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th className="num">XP за неделю</th>
                  <th className="num">XP всего</th>
                  <th className="num">Серия</th>
                  <th className="num">Уроков</th>
                  <th className="num">Точность</th>
                  <th>Был(а)</th>
                  {assignments.map((a) => <th key={a.id} className="mark" title={a.title}>{a.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    <td className="num">{s.xp_week}</td>
                    <td className="num">{s.xp}</td>
                    <td className="num">{s.streak ? `🔥 ${s.streak}` : '—'}</td>
                    <td className="num">{s.lessons}</td>
                    <td className="num">{s.accuracy == null ? '—' : `${s.accuracy}%`}</td>
                    <td>{s.last_active ? fmt(s.last_active) : 'ещё не занимался'}</td>
                    {assignments.map((a) => (
                      <td key={a.id} className="mark">
                        {a.id in s.marks ? <span className="yes" title="Выполнено">✓</span> : <span className="no" title="Не выполнено">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <TabBar active="/teacher" role={user.role} />
    </main>
  );
}
