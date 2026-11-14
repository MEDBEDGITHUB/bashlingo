import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { teacherClasses, teacherSets } from '@/lib/classes';
import { TopBar, TabBar } from '../components';
import { CreateClass, CreateSet, CopyCode } from './forms';

export const dynamic = 'force-dynamic';

export default async function TeacherHome() {
  const user = await currentUser();
  if (!user) redirect('/welcome');
  if (user.role !== 'teacher') redirect('/class');
  const [classes, sets] = await Promise.all([teacherClasses(user.id), teacherSets(user.id)]);

  return (
    <main className="app wide">
      <TopBar user={user} />
      <div className="page-pad">
        <p className="kicker">Кабинет учителя</p>
        <h1 className="h1">{user.name}</h1>
        <div className="school-card">
          <div>
            <b>{user.school_name}</b>
            <span>{user.school_city ?? 'Город не указан'} · код школы для коллег-учителей</span>
          </div>
          <CopyCode code={user.school_code} label="Код школы" />
        </div>

        <h2 className="h2">Мои классы</h2>
        {classes.length === 0 && (
          <p className="lead">Пока нет классов. Создайте первый: ученики вступят по коду или по ссылке.</p>
        )}
        <div className="cards">
          {classes.map((c) => (
            <Link key={c.id} href={`/teacher/class/${c.id}`} className="tcard">
              <div className="tcard-top">
                <b>{c.name}</b>
                <span className="code">{c.join_code}</span>
              </div>
              <div className="tstats">
                <div><b>{c.students}</b><span>учеников</span></div>
                <div><b>{c.active_week}</b><span>занимались за 7 дней</span></div>
                <div><b>{c.xp_week}</b><span>XP за неделю</span></div>
                <div><b>{c.assignments}</b><span>заданий</span></div>
              </div>
            </Link>
          ))}
        </div>
        <CreateClass />

        <h2 className="h2">Мои наборы карточек</h2>
        <p className="lead">Свои фразы с переводом. Набор можно назначить любому вашему классу как задание.</p>
        {sets.map((s) => (
          <Link key={s.id} href={`/lesson/set-${s.id}`} className="card-row" style={{ margin: '0 0 10px' }}>
            <span className="ic">🗂️</span>
            <div style={{ flex: 1 }}>
              <b>{s.title}</b>
              <span>{s.cards} карточек · нажмите, чтобы пройти самому</span>
            </div>
          </Link>
        ))}
        <CreateSet />
      </div>
      <TabBar active="/teacher" role={user.role} />
    </main>
  );
}
