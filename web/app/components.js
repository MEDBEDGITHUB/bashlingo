import Link from 'next/link';

export function TopBar({ user }) {
  return (
    <div className="top">
      <span className="pair">ba → ru</span>
      <span className={user.streak ? 'fire' : 'fire off'} title="Серия дней">🔥 {user.streak}</span>
      <span className="gem" title="Опыт">⚡ {user.xp} XP</span>
    </div>
  );
}

const TABS = [
  { href: '/', icon: '🏠', label: 'Учиться' },
  { href: '/class', icon: '🏫', label: 'Класс' },
  { href: '/profile', icon: '👤', label: 'Профиль' },
];

export function TabBar({ active }) {
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={active === t.href ? 'on' : ''}>
          <i aria-hidden>{t.icon}</i>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
