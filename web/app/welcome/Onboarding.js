'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Onboarding({ levels, initialCode, invite }) {
  const router = useRouter();
  const [role, setRole] = useState(invite ? 'student' : null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(null);
  const [code, setCode] = useState(initialCode);
  const [schoolMode, setSchoolMode] = useState('code');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolCity, setSchoolCity] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Внутри Telegram подставляем имя из профиля
  useEffect(() => {
    const fill = () => setName((n) => n || window.__zbTgName || '');
    fill();
    window.addEventListener('zb-tg', fill);
    return () => window.removeEventListener('zb-tg', fill);
  }, []);

  const teacherReady = schoolMode === 'code' ? schoolCode.trim() : schoolName.trim();
  const ready = name.trim() && (role === 'student' ? level : teacherReady);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = { role, name, initData: window.Telegram?.WebApp?.initData || undefined };
    if (role === 'student') Object.assign(body, { level, joinCode: code });
    else if (schoolMode === 'code') body.schoolCode = schoolCode;
    else body.newSchool = { name: schoolName, city: schoolCity };
    const res = await fetch('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setBusy(false);
      return setError(data?.error ?? 'Не получилось, попробуйте ещё раз');
    }
    router.replace(role === 'teacher' ? '/teacher' : '/');
    router.refresh();
  }

  if (!role) {
    return (
      <div className="page-pad">
        <h1 className="h1">Сәләм! Давайте учить башкирский.</h1>
        <p className="lead">Короткие уроки, серии дней и соревнования с классом. Кто вы?</p>
        <button type="button" className="role" onClick={() => setRole('student')}>
          <span className="ic">🎒</span>
          <span><b>Я ученик</b><span>Учусь сам или с классом</span></span>
        </button>
        <button type="button" className="role" onClick={() => setRole('teacher')}>
          <span className="ic">🍎</span>
          <span><b>Я учитель</b><span>Создаю классы, задаю задания, смотрю отчёты</span></span>
        </button>
      </div>
    );
  }

  return (
    <form className="page-pad" onSubmit={submit}>
      {!invite && <button type="button" className="back" onClick={() => { setRole(null); setError(''); }}>← Назад</button>}
      {invite ? (
        <>
          <h1 className="h1">Вас пригласили в класс {invite.class_name}</h1>
          <p className="lead">{invite.school_name}. Осталось представиться.</p>
        </>
      ) : (
        <h1 className="h1">{role === 'teacher' ? 'Регистрация учителя' : 'Пара вопросов, чтобы подобрать задания'}</h1>
      )}

      <label className="label" htmlFor="name">{role === 'teacher' ? 'Как к вам обращаться?' : 'Как вас зовут?'}</label>
      <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder={role === 'teacher' ? 'Имя и отчество' : 'Имя'} />

      {role === 'student' && (
        <>
          <span className="label">Насколько хорошо вы знаете башкирский?</span>
          {levels.map((l) => (
            <button type="button" key={l.value} className={`level${level === l.value ? ' sel' : ''}`} onClick={() => setLevel(l.value)} aria-pressed={level === l.value}>
              <span className="bars" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= l.value ? 'on' : ''} style={{ height: 6 + i * 3 }} />)}
              </span>
              <span><b>{l.title}</b><span>{l.hint}</span></span>
            </button>
          ))}
          {!invite && (
            <>
              <label className="label" htmlFor="code">Код класса <span className="opt-note">— если дал учитель</span></label>
              <input id="code" className="field code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={16} placeholder="Например, 7B2026" autoCapitalize="characters" autoComplete="off" />
            </>
          )}
        </>
      )}

      {role === 'teacher' && (
        <>
          <span className="label">Ваша школа</span>
          <div className="seg" style={{ margin: '0 0 12px' }}>
            <button type="button" className={schoolMode === 'code' ? 'on' : ''} onClick={() => setSchoolMode('code')}>У меня есть код школы</button>
            <button type="button" className={schoolMode === 'new' ? 'on' : ''} onClick={() => setSchoolMode('new')}>Школы ещё нет</button>
          </div>
          {schoolMode === 'code' ? (
            <>
              <input className="field code-input" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} maxLength={16} placeholder="Код школы" autoCapitalize="characters" autoComplete="off" aria-label="Код школы" />
              <p className="hint">Код школы есть у администратора или у коллеги, который уже зарегистрировался.</p>
            </>
          ) : (
            <>
              <input className="field" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={80} placeholder="Название школы" aria-label="Название школы" />
              <input className="field" style={{ marginTop: 10 }} value={schoolCity} onChange={(e) => setSchoolCity(e.target.value)} maxLength={60} placeholder="Город или село" aria-label="Город или село" />
              <p className="hint">Мы создадим школу и дадим код, по которому к ней присоединятся ваши коллеги.</p>
            </>
          )}
        </>
      )}

      {error && <p className="err">{error}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-g" disabled={!ready || busy}>{role === 'teacher' ? 'Открыть кабинет учителя' : 'Начать учиться'}</button>
      </div>
    </form>
  );
}
