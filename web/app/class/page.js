import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { leaderboard, classAssignments, schoolBoard, METRICS } from '@/lib/classes';
import { TopBar, TabBar } from '../components';
import JoinClass from './JoinClass';

export const dynamic = 'force-dynamic';

const PERIODS = [
  ['day', 'День'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['year', 'Год'],
];
const COLORS = ['#2f6fb5', '#a8481f', '#dc941c', '#6b5bb5', '#2a8c8c', '#c8442f'];

export default async function ClassPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/welcome');
  if (user.role === 'teacher') redirect('/teacher');
  const sp = await searchParams;
  const period = PERIODS.some(([p]) => p === sp?.period) ? sp.period : 'week';
  const metric = METRICS[sp?.metric] ? sp.metric : 'xp';
  const unit = METRICS[metric].unit;

  if (!user.class_id) {
    return (
      <main className="app">
        <TopBar user={user} />
        <div className="hero"><img src="/wave-out.png" alt="" /></div>
        <div className="page-pad">
          <h1 className="h1">Учитесь вместе с классом</h1>
          <p className="lead">Введите код, который дал учитель: появятся задания от учителя и рейтинг класса.</p>
          <JoinClass />
        </div>
        <TabBar active="/class" role={user.role} />
      </main>
    );
  }

  const [rows, homework, schools] = await Promise.all([leaderboard(user.class_id, period, metric), classAssignments(user.class_id, user.id), schoolBoard()]);
  const hw = homework.find((h) => !h.mine) ?? null;
  const rest = homework.filter((h) => h !== hw);
  const top = schools[0]?.xp || 1;
  return (
    <main className="app">
      <TopBar user={user} />
      {hw && (
        <div className="hw">
          <small>🍎 От учителя · {user.class_name}</small>
          <b>{hw.title}</b>
          <p>{hw.cards} карточек · до {new Date(hw.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · выполнили {hw.done} из {hw.members}</p>
          <Link className="btn" href={`/lesson/${hw.href}`}>Начать</Link>
          <img src="/success.png" alt="" />
        </div>
      )}
      {rest.map((h) => (
        <Link key={h.id} href={`/lesson/${h.href}`} className={`card-row${h.mine ? ' done' : ''}`}>
          <span className="ic">🍎</span>
          <div style={{ flex: 1 }}>
            <b>{h.title}</b>
            <span>{h.mine ? 'Выполнено ✓' : `до ${new Date(h.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`} · выполнили {h.done} из {h.members}</span>
          </div>
        </Link>
      ))}
      <div className="league">
        <div className="shield">{user.class_name?.replace(/[«»\s]/g, '').slice(0, 3)}</div>
        <div>
          <b>Рейтинг класса</b>
          <span>{user.school_name}{user.school_city ? `, ${user.school_city}` : ''} · рейтинг обновляется каждый день</span>
        </div>
      </div>
      <nav className="seg">
        {PERIODS.map(([p, label]) => (
          <Link key={p} href={`/class?period=${p}&metric=${metric}`} className={p === period ? 'on' : ''}>{label}</Link>
        ))}
      </nav>
      <nav className="seg metrics">
        {Object.entries(METRICS).map(([k, mm]) => (
          <Link key={k} href={`/class?period=${period}&metric=${k}`} className={k === metric ? 'on' : ''}>{mm.label}</Link>
        ))}
      </nav>
      {rows.map((r, i) => (
        <div key={r.id}>
          <div className={`row${r.id === user.id ? ' me' : ''}`}>
            <span className="n">{i + 1}</span>
            <span className="av" style={{ background: r.id === user.id ? 'var(--green)' : COLORS[i % COLORS.length] }}>{r.name[0]?.toUpperCase()}</span>
            <span className="nm">{r.id === user.id ? `${r.name} (вы)` : r.name}</span>
            <span className="xp">{r.xp == null ? '—' : `${r.xp}${unit ? ` ${unit}` : ''}`}</span>
          </div>
          {i === 2 && rows.length > 3 && <div className="zone">▲ топ-3</div>}
        </div>
      ))}
      {schools.length > 0 && (
        <div className="schools">
          <b>Школы · неделя</b>
          {schools.map((s) => (
            <div className="sb" key={s.name}>
              <span>{s.name}</span>
              <i style={{ width: `${Math.max(4, (s.xp / top) * 100) * 0.6}%` }} />
              <small>{s.xp}</small>
            </div>
          ))}
        </div>
      )}
      <TabBar active="/class" role={user.role} />
    </main>
  );
}
