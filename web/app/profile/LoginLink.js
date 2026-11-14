'use client';
import { useState } from 'react';

export default function LoginLink({ hasTelegram }) {
  const [state, setState] = useState('idle');

  async function make() {
    setState('busy');
    const res = await fetch('/api/auth/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.url) return setState('error');
    try {
      await navigator.clipboard.writeText(data.url);
      setState('copied');
    } catch {
      window.prompt('Скопируйте ссылку:', data.url);
      setState('idle');
    }
  }

  async function logout() {
    const warn = hasTelegram
      ? 'Выйти из аккаунта? Вернуться можно, открыв приложение в Telegram.'
      : 'Выйти из аккаунта? Он привязан только к этому браузеру: без ссылки для входа вернуться в него не получится.';
    if (!window.confirm(warn)) return;
    try {
      sessionStorage.removeItem('zb_tg');
    } catch {}
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => null);
    location.href = '/welcome';
  }

  return (
    <div className="page-pad" style={{ paddingTop: 0 }}>
      <button type="button" className="btn btn-w" onClick={make} disabled={state === 'busy'}>Войти на другом устройстве</button>
      <p className="hint">
        {state === 'copied' ? 'Ссылка скопирована. Откройте её на другом устройстве в течение 15 минут и никому не передавайте.'
          : state === 'error' ? 'Не удалось создать ссылку, попробуйте ещё раз.'
          : 'Аккаунт на сайте привязан к этому браузеру. Ссылка перенесёт его на телефон или другой компьютер.'}
      </p>
      <button type="button" className="back" style={{ marginTop: 14, color: 'var(--red)' }} onClick={logout}>Выйти из аккаунта</button>
    </div>
  );
}
