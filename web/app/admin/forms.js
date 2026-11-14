'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function send(url, body, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(data?.error ?? 'Не получилось, попробуйте ещё раз');
  return data;
}

export function AdminLogin() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await send('/api/admin/login', { key });
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  return (
    <form className="page-pad" onSubmit={submit} style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 className="h1">Вход для администраторов</h1>
      <p className="lead">Ключ задаётся в переменной ADMIN_KEY на сервере.</p>
      <input className="field" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Ключ администратора" autoComplete="current-password" aria-label="Ключ администратора" />
      {error && <p className="err">{error}</p>}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-g" disabled={!key || busy}>Войти</button>
      </div>
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button type="button" className="mini" onClick={async () => { await send('/api/admin/login', null, 'DELETE').catch(() => {}); router.refresh(); }}>
      Выйти
    </button>
  );
}

export function CreateSchool() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setCreated(await send('/api/admin/schools', { name, city }));
      setName('');
      setCity('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  return (
    <form className="inline-form three" onSubmit={submit}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название школы" maxLength={80} aria-label="Название школы" />
      <input className="field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город или село" maxLength={60} aria-label="Город" />
      <button className="btn btn-g" disabled={!name.trim() || busy}>Добавить школу</button>
      {error && <p className="err">{error}</p>}
      {created && <p className="okmsg">Школа «{created.name}» создана. Код для учителей: <b className="code">{created.code}</b></p>}
    </form>
  );
}
