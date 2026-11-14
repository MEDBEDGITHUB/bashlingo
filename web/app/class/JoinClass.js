'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinClass({ initial = '', locked = false }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await fetch('/api/classes/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setBusy(false);
      return setError(data?.error ?? 'Не получилось, попробуйте ещё раз');
    }
    router.replace('/class');
    router.refresh();
  }

  return (
    <form onSubmit={join}>
      {!locked && (
        <input className="field code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Код класса" maxLength={16} autoCapitalize="characters" autoComplete="off" aria-label="Код класса" />
      )}
      {error && <p className="err">{error}</p>}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-g" disabled={!code.trim() || busy}>Вступить</button>
      </div>
    </form>
  );
}
