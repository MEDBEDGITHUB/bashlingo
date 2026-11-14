'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BADGES } from '@/lib/badges';

const norm = (s) => s.toLowerCase().replace(/[.,!?¿¡«»"“”:;]/g, '').replace(/\s+/g, ' ').trim();

function useBashkirVoice() {
  const [voice, setVoice] = useState(null);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const pick = () => setVoice(speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ba')) ?? null);
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', pick);
  }, []);
  return voice
    ? (text) => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    : null;
}

export default function Lesson({ slug, title, kicker, exercises, reasons, home = '/' }) {
  const router = useRouter();
  const speak = useBashkirVoice();
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [checked, setChecked] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);

  const ex = exercises[idx];
  const progress = (idx + (checked ? 1 : 0)) / Math.max(exercises.length, 1);

  function check(correct, extra = {}) {
    const fragmentIds = ex.type === 'match' ? ex.pairs.map((p) => p.id) : [ex.fragment.id];
    setResults((r) => [...r, ...fragmentIds.map((id) => ({ fragmentId: id, type: ex.type, correct }))]);
    setChecked({ correct, ...extra });
  }

  function checkVerify({ verdict, correction }) {
    const planted = ex.shown !== ex.fragment.text_ru;
    const correct = planted ? verdict === 'wrong' && correction === ex.fragment.text_ru : verdict === 'ok';
    setResults((r) => [...r, { fragmentId: ex.fragment.id, type: 'verify', correct, shown: ex.shown, verdict, correction }]);
    setChecked({ correct, planted });
  }

  function submit() {
    if (ex.type === 'choose') check(answer === ex.fragment.text_ru);
    if (ex.type === 'build') check(norm(answer.map((i) => ex.bank[i]).join(' ')) === norm(ex.fragment.text_ba));
  }

  async function next() {
    if (idx + 1 < exercises.length) {
      setIdx(idx + 1);
      setChecked(null);
      setAnswer(null);
      return;
    }
    setSaving(true);
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lesson: slug, results }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    const total = results.length || 1;
    setSummary({ ...data, accuracy: Math.round((results.filter((r) => r.correct).length / total) * 100) });
  }

  if (!exercises.length) {
    return (
      <div className="done-screen">
        <img src="/thinking.png" alt="" />
        <h2>Пока пусто</h2>
        <p>Для этого урока ещё нет фраз.</p>
        <Link className="btn btn-g" href={home}>На главную</Link>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="done-screen">
        <img src="/success.png" alt="Куница радуется" />
        <h2>{summary.repeat ? 'Повторение пройдено!' : 'Урок пройден!'}</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>{title}</p>
        <div className="stats">
          <div className="stat"><small>Опыт</small><b>⚡ {summary.awarded ?? 0}</b></div>
          <div className="stat g"><small>Точность</small><b>{summary.accuracy}%</b></div>
          <div className="stat"><small>Серия</small><b>🔥 {summary.streak ?? '—'}</b></div>
        </div>
        {summary.badges?.length > 0 && (
          <div className="badges-won">
            {summary.badges.map((b) => (
              <div key={b} className="badge-won"><span>{BADGES[b]?.icon}</span><b>Новое достижение</b>{BADGES[b]?.title}</div>
            ))}
          </div>
        )}
        {summary.repeat && <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: -10 }}>За повторное прохождение опыт не начисляется.</p>}
        <button className="btn btn-g" style={{ maxWidth: 320 }} onClick={() => { router.push(home); router.refresh(); }}>Продолжить</button>
      </div>
    );
  }

  return (
    <div className="lesson">
      <div className="l-bar">
        <Link className="x" href={home} aria-label="Выйти из урока">✕</Link>
        <div className="l-track"><i style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <div className="l-body">
        <div className="l-kicker">{kicker} · упражнение {idx + 1} из {exercises.length}</div>
        {ex.type === 'choose' && <Choose ex={ex} answer={answer} setAnswer={setAnswer} checked={checked} speak={speak} />}
        {ex.type === 'build' && <Build key={idx} ex={ex} answer={answer ?? []} setAnswer={setAnswer} checked={checked} />}
        {ex.type === 'match' && <Match key={idx} ex={ex} onDone={(mistakes) => check(mistakes === 0, { mistakes })} />}
        {ex.type === 'verify' && <Verify key={idx} ex={ex} onDone={checkVerify} speak={speak} done={!!checked} />}
      </div>

      <div className={`foot${checked ? (checked.correct ? ' ok' : ' bad') : ''}`}>
        {checked && (
          <>
            <h3>
              {ex.type === 'verify'
                ? checked.planted
                  ? checked.correct ? '✓ Вы нашли ошибку!' : 'Здесь была ошибка. Правильный перевод:'
                  : checked.correct ? '✓ Перевод верный' : 'Перевод был верным:'
                : checked.correct ? '✓ Отлично!' : ex.type === 'match' ? 'Почти! Были ошибки' : 'Правильный ответ:'}
            </h3>
            {ex.type !== 'match' && <p>{ex.fragment.text_ba} — {ex.fragment.text_ru}</p>}
            {ex.type !== 'match' && (
              <button className="flag" onClick={() => setReport(ex.fragment)}>В переводе ошибка?</button>
            )}
          </>
        )}
        {checked ? (
          <button className={`btn ${checked.correct ? 'btn-g' : 'btn-r'}`} onClick={next} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Дальше'}
          </button>
        ) : ex.type === 'verify' ? (
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Проверьте, правильно ли переведена фраза</p>
        ) : ex.type !== 'match' ? (
          <button className="btn btn-g" onClick={submit} disabled={!answer || (Array.isArray(answer) && !answer.length)}>
            Проверить
          </button>
        ) : (
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Соедините фразы с переводом</p>
        )}
      </div>

      {report && <ReportSheet fragment={report} reasons={reasons} onClose={() => setReport(null)} />}
    </div>
  );
}

function Choose({ ex, answer, setAnswer, checked, speak }) {
  return (
    <>
      <div className="l-title">Выберите перевод</div>
      <div className="say">
        <img src="/explaining.png" alt="" />
        <div className="bubble">
          {speak && (
            <button className="tts" onClick={() => speak(ex.fragment.text_ba)} aria-label="Прослушать">🔊</button>
          )}
          {ex.fragment.text_ba}
        </div>
      </div>
      <div className="opts">
        {ex.options.map((o, i) => {
          let cls = answer === o ? ' sel' : '';
          if (checked && o === ex.fragment.text_ru) cls = ' right';
          else if (checked && answer === o) cls = ' wrong';
          return (
            <button key={o} className={`opt${cls}`} onClick={() => setAnswer(o)} disabled={!!checked}>
              <i>{i + 1}</i>
              {o}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Build({ ex, answer, setAnswer, checked }) {
  return (
    <>
      <div className="l-title">Соберите фразу по-башкирски</div>
      <div className="say">
        <img src="/thinking.png" alt="" />
        <div className="bubble">{ex.fragment.text_ru}</div>
      </div>
      <div className="answer-line">
        {answer.map((i) => (
          <button key={i} className="chip" disabled={!!checked} onClick={() => setAnswer(answer.filter((x) => x !== i))}>
            {ex.bank[i]}
          </button>
        ))}
      </div>
      <div className="bank">
        {ex.bank.map((w, i) => (
          <button key={i} className={`chip${answer.includes(i) ? ' used' : ''}`} disabled={!!checked} onClick={() => setAnswer([...answer, i])}>
            {w}
          </button>
        ))}
      </div>
    </>
  );
}

function Verify({ ex, onDone, speak, done }) {
  const [step, setStep] = useState('ask');
  const [custom, setCustom] = useState('');
  const planted = ex.shown !== ex.fragment.text_ru;
  return (
    <>
      <div className="l-title">Правильно ли переведена фраза?</div>
      <div className="say">
        <img src="/thinking.png" alt="" />
        <div className="bubble" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {speak && <button className="tts" onClick={() => speak(ex.fragment.text_ba)} aria-label="Прослушать">🔊</button>}
            {ex.fragment.text_ba}
          </span>
          <span style={{ fontSize: 17, fontWeight: 600, color: planted && done ? 'var(--red)' : 'var(--ink)' }}>{ex.shown}</span>
        </div>
      </div>
      {step === 'ask' && !done && (
        <div className="opts" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
          <button className="btn btn-g" onClick={() => onDone({ verdict: 'ok' })}>Верно</button>
          <button className="btn btn-w" onClick={() => setStep('fix')}>Ошибка</button>
        </div>
      )}
      {step === 'fix' && !done && (
        <>
          <div className="l-kicker" style={{ marginBottom: 8 }}>Как правильно?</div>
          <div className="opts">
            {ex.options.filter((o) => o !== ex.shown).map((o, i) => (
              <button key={o} className="opt" onClick={() => onDone({ verdict: 'wrong', correction: o })}><i>{i + 1}</i>{o}</button>
            ))}
          </div>
          <details className="own">
            <summary>Мой вариант</summary>
            <textarea className="field" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} placeholder="Как вы бы перевели" />
            <button className="btn btn-w" style={{ marginTop: 8 }} disabled={!custom.trim()} onClick={() => onDone({ verdict: 'wrong', correction: custom.trim() })}>Отправить мой вариант</button>
          </details>
        </>
      )}
    </>
  );
}

function Match({ ex, onDone }) {
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [mistakes, setMistakes] = useState(0);
  const byId = useMemo(() => Object.fromEntries(ex.pairs.map((p) => [p.id, p])), [ex]);

  useEffect(() => {
    if (!left || !right) return;
    if (left === right) {
      const m = [...matched, left];
      setMatched(m);
      setLeft(null);
      setRight(null);
      if (m.length === ex.pairs.length) onDone(mistakes);
    } else {
      setMistakes((n) => n + 1);
      setWrong([left, right]);
      const t = setTimeout(() => { setWrong(null); setLeft(null); setRight(null); }, 600);
      return () => clearTimeout(t);
    }
  }, [left, right]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = (id, side) => {
    if (matched.includes(id)) return ' gone';
    if (wrong && wrong[side === 'l' ? 0 : 1] === id) return ' wrong';
    if ((side === 'l' ? left : right) === id) return ' sel';
    return '';
  };

  return (
    <>
      <div className="l-title">Соедините пары</div>
      <div className="pairs">
        <div className="opts">
          {ex.pairs.map((p) => (
            <button key={p.id} className={`opt${cls(p.id, 'l')}`} disabled={matched.includes(p.id)} onClick={() => setLeft(p.id)}>{p.ba}</button>
          ))}
        </div>
        <div className="opts">
          {ex.ruOrder.map((id) => (
            <button key={id} className={`opt${cls(id, 'r')}`} disabled={matched.includes(id)} onClick={() => setRight(id)}>{byId[id].ru}</button>
          ))}
        </div>
      </div>
    </>
  );
}

function ReportSheet({ fragment, reasons, onClose }) {
  const [reason, setReason] = useState(null);
  const [proposed, setProposed] = useState('');
  const [state, setState] = useState('idle');

  async function send() {
    setState('sending');
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fragmentId: fragment.id, reason, proposed }),
    });
    setState(res.ok ? 'sent' : 'error');
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ошибка в переводе">
        {state === 'sent' ? (
          <>
            <h3>Рәхмәт! Спасибо!</h3>
            <p className="lead">Ваше замечание сохранено. Если с ним согласятся другие, перевод исправят.</p>
            <button className="btn btn-g" onClick={onClose}>Готово</button>
          </>
        ) : (
          <>
            <h3>В переводе ошибка?</h3>
            <div className="src">{fragment.text_ba} — {fragment.text_ru} · {fragment.source?.doc}, строка {fragment.source?.row}</div>
            <div className="reason-list">
              {reasons.map((r) => (
                <button key={r} className={`opt${reason === r ? ' sel' : ''}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
            <textarea placeholder="Ваш вариант перевода (если знаете)" value={proposed} onChange={(e) => setProposed(e.target.value)} maxLength={300} />
            {state === 'error' && <p className="err">Не удалось отправить, попробуйте ещё раз.</p>}
            <button className="btn btn-g" disabled={!reason || state === 'sending'} onClick={send}>Отправить</button>
          </>
        )}
      </div>
    </div>
  );
}
