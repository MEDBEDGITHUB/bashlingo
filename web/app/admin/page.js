import { isAdmin } from '@/lib/user';
import { adminStats, adminActivity, adminSchools, adminDisputed, adminRecentUsers } from '@/lib/admin';
import { AdminLogin, AdminLogout, CreateSchool } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ҙурбаш — админ-панель', robots: { index: false } };

const day = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="app wide bare">
        <AdminLogin />
      </main>
    );
  }
  const [s, activity, schools, disputed, users] = await Promise.all([adminStats(), adminActivity(), adminSchools(), adminDisputed(), adminRecentUsers()]);
  const peak = Math.max(1, ...activity.map((a) => a.answers));
  const community = disputed.filter((d) => d.status === 'community').length;

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <span className="brand">Ҙурбаш</span>
          <span className="kicker" style={{ marginLeft: 10 }}>админ-панель</span>
        </div>
        <AdminLogout />
      </header>

      <section className="tiles">
        <div className="tile"><b>{s.students}</b><span>учеников</span><small>+{s.new_week} аккаунтов за 7 дней</small></div>
        <div className="tile"><b>{s.teachers}</b><span>учителей</span><small>{s.schools} школ · {s.classes} классов</small></div>
        <div className="tile"><b>{s.active_today}</b><span>занимались сегодня</span><small>{s.active_week} за 7 дней</small></div>
        <div className="tile"><b>{s.answers}</b><span>ответов всего</span><small>{s.answers_today} сегодня · верных {pct(s.answers_correct, s.answers)}</small></div>
        <div className="tile"><b>{s.fragments_confirmed}<i> / {s.fragments}</i></b><span>фраз корпуса подтверждено</span><small>хотя бы одним верным ответом</small></div>
        <div className="tile"><b>{disputed.length}</b><span>спорных переводов</span><small>{community} выбрано сообществом · {s.reports} замечаний</small></div>
        <div className="tile"><b>{s.tg_users}</b><span>вошли через Telegram</span><small>{pct(s.tg_users, s.students + s.teachers)} аккаунтов</small></div>
        <div className="tile"><b>{s.teacher_cards}</b><span>карточек учителей</span><small>{s.completions} прохождений уроков</small></div>
      </section>

      <section className="apanel">
        <h2>Активность за 14 дней</h2>
        <p className="sub">Число ответов в упражнениях по дням. Под столбцом — сколько человек занималось.</p>
        <div className="chart" role="img" aria-label="Ответы по дням за 14 дней">
          {activity.map((a) => (
            <div className="col" key={a.day} title={`${day(a.day)}: ${a.answers} ответов, ${a.users} чел., ${a.signups} регистраций`}>
              <span className="val">{a.answers || ''}</span>
              <i style={{ height: `${Math.max(2, (a.answers / peak) * 100)}%` }} className={a.answers ? '' : 'zero'} />
              <span className="lbl">{new Date(a.day).getDate()}</span>
              <span className="lbl u">{a.users ? `${a.users} чел.` : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="apanel">
        <h2>Школы</h2>
        <p className="sub">Код школы передайте учителям: по нему они регистрируются и создают классы.</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Школа</th><th>Город</th><th>Код школы</th><th className="num">Учителей</th><th className="num">Классов</th><th className="num">Учеников</th><th className="num">XP за неделю</th></tr>
            </thead>
            <tbody>
              {schools.map((sc) => (
                <tr key={sc.id}>
                  <td><b>{sc.name}</b></td><td>{sc.city ?? '—'}</td><td><span className="code">{sc.code}</span></td>
                  <td className="num">{sc.teachers}</td><td className="num">{sc.classes}</td><td className="num">{sc.students}</td><td className="num">{sc.xp_week}</td>
                </tr>
              ))}
              {schools.length === 0 && <tr><td colSpan={7}>Школ пока нет.</td></tr>}
            </tbody>
          </table>
        </div>
        <CreateSchool />
      </section>

      <section className="apanel">
        <div className="h2-row">
          <h2>Спорные переводы</h2>
          <span className="links">
            <a className="mini" href="/api/translations?status=expert_review&format=csv">Экспертам (CSV)</a>
            <a className="mini" href="/api/translations?format=csv">Вся база (CSV)</a>
          </span>
        </div>
        <p className="sub">Фразы, по которым ученики нажали «В переводе ошибка?». Вариант становится «выбран сообществом» при ≥80% голосов и минимум 5 голосующих; остальное уходит экспертам УФИЦ РАН.</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Фраза</th><th>Перевод в источнике</th><th>Предложенные варианты</th><th>Причины</th><th className="num">Голосов</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {disputed.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.text_ba}</b><br /><small>{d.id}</small></td>
                  <td>{d.translation_auto}</td>
                  <td>{d.proposals.length ? d.proposals.map((p) => <div key={p.proposed}>{p.proposed} <small>× {p.n}</small></div>) : <small>без варианта</small>}</td>
                  <td>{d.reasons.map((r) => <div key={r.reason}><small>{r.reason} × {r.n}</small></div>)}</td>
                  <td className="num">{d.voters}</td>
                  <td><span className={`pill ${d.status}`}>{d.status === 'community' ? 'Выбран сообществом' : 'Экспертам'}</span></td>
                </tr>
              ))}
              {disputed.length === 0 && <tr><td colSpan={6}>Замечаний к переводам пока нет.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="apanel">
        <h2>Новые пользователи</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Имя</th><th>Роль</th><th>Школа и класс</th><th className="num">XP</th><th>Вход</th><th>Регистрация</th></tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i}>
                  <td><b>{u.name}</b></td>
                  <td>{u.role === 'teacher' ? 'Учитель' : `Ученик · ур. ${u.level}`}</td>
                  <td>{[u.school_name, u.class_name].filter(Boolean).join(', ') || <small>без класса</small>}</td>
                  <td className="num">{u.xp}</td>
                  <td>{u.tg ? 'Telegram' : 'Сайт'}</td>
                  <td>{day(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
