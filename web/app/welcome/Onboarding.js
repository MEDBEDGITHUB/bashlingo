'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Onboarding({ levels }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, level, joinCode: code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Не получилось, попробуйте ещё раз');
    router.replace('/');
    router.refresh();
  }

  return (
    <form className="page-pad" onSubmit={submit}>
      <h1 className="h1">Сәләм! Я куница, буду учить вас башкирскому.</h1>
      <p className="lead">Пара вопросов, чтобы подобрать задания.</p>

      <label className="label" htmlFor="name">Как вас зовут?</label>
      <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" placeholder="Имя" />

      <span className="label">Насколько хорошо вы знаете башкирский?</span>
      {levels.map((l) => (
        <button type="button" key={l.value} className={`level${level === l.value ? ' sel' : ''}`} onClick={() => setLevel(l.value)} aria-pressed={level === l.value}>
          <span className="bars" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i <= l.value ? 'on' : ''} style={{ height: 6 + i * 3 }} />
            ))}
          </span>
          <span>
            <b>{l.title}</b>
            <span>{l.hint}</span>
          </span>
        </button>
      ))}

      <label className="label" htmlFor="code">Код класса <span style={{ fontWeight: 400, color: 'var(--muted)' }}>— если дал учитель</span></label>
      <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} placeholder="Например, 7B2026" autoCapitalize="characters" />

      {error && <p className="err">{error}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-g" disabled={!name.trim() || !level || busy}>Начать учиться</button>
      </div>
    </form>
  );
}
