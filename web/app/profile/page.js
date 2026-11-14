import { redirect } from 'next/navigation';
import { currentUser, LEVELS } from '@/lib/user';
import { one } from '@/lib/db';
import { TopBar, TabBar } from '../components';
import LoginLink from './LoginLink';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const user = await currentUser();
  if (!user) redirect('/welcome');
  const stats = await one(
    `SELECT (SELECT count(*) FROM completions WHERE user_id = $1 AND key NOT LIKE 'daily:%')::int AS lessons,
            (SELECT count(*) FROM completions WHERE user_id = $1 AND key LIKE 'daily:%')::int AS dailies,
            (SELECT count(DISTINCT fragment_id) FROM answers WHERE user_id = $1 AND correct)::int AS phrases,
            (SELECT count(*) FROM reports WHERE user_id = $1)::int AS reports`,
    [user.id]
  );
  const level = LEVELS.find((l) => l.value === user.level);
  return (
    <main className="app">
      <TopBar user={user} />
      <div className="hero"><img src="/idle.png" alt="" /></div>
      <div className="page-pad" style={{ paddingBottom: 0 }}>
        <h1 className="h1">{user.name}</h1>
        <p className="lead" style={{ margin: 0 }}>
          {user.role === 'teacher' ? 'Учитель' : level?.title} · башкирский → русский
          {user.school_name && <><br />{[user.school_name, user.class_name].filter(Boolean).join(', ')}</>}
          <br />Вход: {user.has_telegram ? 'Telegram и сайт' : 'сайт'}
        </p>
      </div>
      <div className="prof">
        <div><b>🔥 {user.streak}</b><span>дней подряд</span></div>
        <div><b>⚡ {user.xp}</b><span>опыта</span></div>
        <div><b>{stats.lessons}</b><span>уроков пройдено</span></div>
        <div><b>{stats.phrases}</b><span>фраз выучено</span></div>
        <div><b>{stats.dailies}</b><span>заданий дня</span></div>
        <div><b>{stats.reports}</b><span>замечаний к переводам</span></div>
      </div>
      <LoginLink hasTelegram={user.has_telegram} />
      <TabBar active="/profile" role={user.role} />
    </main>
  );
}
