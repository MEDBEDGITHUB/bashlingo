'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinClass() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function join(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/classes/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? 'Не получилось');
    router.refresh();
  }

  return (
    <form onSubmit={join}>
      <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код класса" maxLength={16} autoCapitalize="characters" />
      {error && <p className="err">{error}</p>}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-g" disabled={!code.trim()}>Вступить</button>
      </div>
    </form>
  );
}
