'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Работает только когда сайт открыт внутри Telegram как Mini App: подключает SDK Telegram,
// разворачивает окно и входит в аккаунт по подписанным данным Telegram.
export default function TelegramBridge() {
  const router = useRouter();
  useEffect(() => {
    let inTelegram = false;
    try {
      inTelegram = location.hash.includes('tgWebAppData') || Boolean(sessionStorage.getItem('__telegram__initParams'));
    } catch {}
    if (!inTelegram) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = async () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready();
      tg.expand();
      document.documentElement.classList.add('in-tg');
      if (!tg.initData) return;
      let done = false;
      try {
        done = Boolean(sessionStorage.getItem('zb_tg'));
      } catch {}
      if (done) return;
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      }).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json().catch(() => ({}));
      try {
        sessionStorage.setItem('zb_tg', '1');
      } catch {}
      if (data.registered) {
        if (location.pathname.startsWith('/welcome')) router.replace('/');
        if (data.changed) router.refresh();
      } else {
        window.__zbTgName = data.firstName ?? '';
        window.dispatchEvent(new CustomEvent('zb-tg', { detail: data }));
      }
    };
    document.head.appendChild(script);
  }, [router]);
  return null;
}
