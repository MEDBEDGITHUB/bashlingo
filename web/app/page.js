import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { getPath } from '@/lib/course';
import { one } from '@/lib/db';
import { classAssignments } from '@/lib/classes';
import { todayKey } from '@/lib/progress';
import { TopBar, TabBar } from './components';

export const dynamic = 'force-dynamic';

const OFFSETS = [0, -56, -28, 40, 56, 10];

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/welcome');
  const [units, daily, homework] = await Promise.all([
    getPath(user.id),
    one('SELECT 1 FROM completions WHERE user_id = $1 AND key = $2', [user.id, `daily:${todayKey()}`]),
    user.class_id ? classAssignments(user.class_id, user.id) : [],
  ]);
  const currentUnit = units.find((u) => u.lessons.some((l) => l.state === 'current')) ?? units[units.length - 1];

  let n = 0;
  return (
    <main className="app">
      <TopBar user={user} />

      <Link href="/lesson/daily" className={`card-row${daily ? ' done' : ''}`}>
        <span className="ic">☀️</span>
        <div style={{ flex: 1 }}>
          <b>Задание дня</b>
          <span>{daily ? 'Выполнено · возвращайтесь завтра' : '5 фраз по вашему уровню · +20 XP'}</span>
          <div className="bar"><i style={{ width: daily ? '100%' : '0%' }} /></div>
        </div>
      </Link>
      {homework.map((hw) => (
        <Link key={hw.id} href={`/lesson/${hw.href}`} className={`card-row${hw.mine ? ' done' : ''}`}>
          <span className="ic">🍎</span>
          <div style={{ flex: 1 }}>
            <b>От учителя: {hw.title}</b>
            <span>{hw.mine ? 'Выполнено ✓' : `${hw.cards} карточек · до ${new Date(hw.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`}</span>
          </div>
        </Link>
      ))}

      {units.map((u, ui) => {
        const locked = u.lessons.every((l) => l.state === 'locked');
        const doneCount = u.lessons.filter((l) => l.state === 'done').length;
        return (
          <section key={u.slug}>
            <div className={`unit${locked ? ' locked' : ''}`}>
              <div>
                <small>Раздел {ui + 1} · {doneCount} из {u.lessons.length}</small>
                <b>{u.title}</b>
              </div>
              <span className="ic">{locked ? '🔒' : u.icon}</span>
            </div>
            <div className="path">
              {u.lessons.map((l) => {
                const off = OFFSETS[n++ % OFFSETS.length];
                const node = (
                  <span className={`node ${l.state}`} style={{ transform: `translateX(${off}px)` }}>
                    {l.state === 'current' && <span className="tip">Начать</span>}
                    {l.state === 'done' ? '✓' : l.state === 'current' ? '★' : '🔒'}
                  </span>
                );
                return (
                  <div key={l.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                    {l.state === 'locked' ? node : <Link href={`/lesson/${l.slug}`} aria-label={l.title}>{node}</Link>}
                    <span className="node-label" style={{ transform: `translateX(${off}px)` }}>{l.title}</span>
                  </div>
                );
              })}
              {u === currentUnit && (
                <img className="mascot" src="/idle.png" alt="" style={{ right: 6, top: 18 }} />
              )}
            </div>
          </section>
        );
      })}

      <TabBar active="/" role={user.role} />
    </main>
  );
}
