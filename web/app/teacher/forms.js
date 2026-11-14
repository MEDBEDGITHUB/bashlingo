'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(url, body, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(data?.error ?? 'Не получилось, попробуйте ещё раз');
  return data;
}

export function CopyCode({ code, label, link }) {
  const [copied, setCopied] = useState('');
  async function copy(what) {
    const text = what === 'link' ? `${location.origin}${link}` : code;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      window.prompt('Скопируйте:', text);
    }
  }
  return (
    <div className="codebox">
      <small>{label}</small>
      <b className="code big">{code}</b>
      <div className="codebtns">
        <button type="button" className="mini" onClick={() => copy('code')}>{copied === 'code' ? 'Скопировано ✓' : 'Копировать код'}</button>
        {link && <button type="button" className="mini" onClick={() => copy('link')}>{copied === 'link' ? 'Скопировано ✓' : 'Копировать ссылку'}</button>}
      </div>
    </div>
  );
}

export function CreateClass() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cls = await post('/api/teacher/classes', { name });
      router.push(`/teacher/class/${cls.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <form className="inline-form" onSubmit={submit}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Новый класс, например 7 «Б»" maxLength={30} aria-label="Название класса" />
      <button className="btn btn-g" disabled={!name.trim() || busy}>Создать класс</button>
      {error && <p className="err">{error}</p>}
    </form>
  );
}

const LETTERS = ['ә', 'ө', 'ү', 'ғ', 'ҡ', 'ң', 'ҙ', 'ҫ', 'һ'];
const emptyCards = () => [{ ba: '', ru: '' }, { ba: '', ru: '' }, { ba: '', ru: '' }];

export function CreateSet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cards, setCards] = useState(emptyCards);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const focus = useRef({ i: 0, el: null });

  const setCard = (i, key, value) => setCards((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: value } : c)));
  const filled = cards.filter((c) => c.ba.trim() && c.ru.trim()).length;

  function insertLetter(ch) {
    const { i, el } = focus.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setCard(i, 'ba', el.value.slice(0, start) + ch + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/api/teacher/sets', { title, cards });
      setOpen(false);
      setTitle('');
      setCards(emptyCards());
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (!open) return <button type="button" className="btn btn-w" onClick={() => setOpen(true)}>+ Новый набор карточек</button>;
  return (
    <form className="panel" onSubmit={submit}>
      <label className="label" htmlFor="set-title" style={{ marginTop: 0 }}>Название набора</label>
      <input id="set-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Например, Времена года" />
      <div className="letters" aria-label="Башкирские буквы">
        <span>Буквы:</span>
        {LETTERS.map((l) => (
          <button type="button" key={l} className="mini" onMouseDown={(e) => e.preventDefault()} onClick={() => insertLetter(l)}>{l}</button>
        ))}
      </div>
      {cards.map((c, i) => (
        <div className="pair-row" key={i}>
          <span className="n">{i + 1}</span>
          <input className="field" value={c.ba} placeholder="По-башкирски" maxLength={200} lang="ba" aria-label={`Карточка ${i + 1}, по-башкирски`}
            onFocus={(e) => (focus.current = { i, el: e.target })} onChange={(e) => setCard(i, 'ba', e.target.value)} />
          <input className="field" value={c.ru} placeholder="Перевод" maxLength={200} aria-label={`Карточка ${i + 1}, перевод`} onChange={(e) => setCard(i, 'ru', e.target.value)} />
          <button type="button" className="mini x" aria-label="Удалить карточку" disabled={cards.length <= 3} onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {cards.length < 40 && <button type="button" className="mini" onClick={() => setCards((cs) => [...cs, { ba: '', ru: '' }])}>+ Добавить карточку</button>}
      {error && <p className="err">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-w" onClick={() => setOpen(false)}>Отмена</button>
        <button className="btn btn-g" disabled={!title.trim() || filled < 3 || busy}>Сохранить набор ({filled})</button>
      </div>
    </form>
  );
}

export function CreateAssignment({ classId, lessons, sets, defaultDue }) {
  const router = useRouter();
  const [what, setWhat] = useState('');
  const [due, setDue] = useState(defaultDue);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const [kind, id] = what.split(':');
      await post('/api/teacher/assignments', { classId, dueDate: due, ...(kind === 'set' ? { setId: Number(id) } : { lessonSlug: id }) });
      setWhat('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  return (
    <form className="panel" onSubmit={submit}>
      <label className="label" htmlFor="a-what" style={{ marginTop: 0 }}>Что задать</label>
      <select id="a-what" className="field" value={what} onChange={(e) => setWhat(e.target.value)}>
        <option value="">Выберите урок или набор…</option>
        {sets.length > 0 && (
          <optgroup label="Мои наборы">
            {sets.map((s) => <option key={s.id} value={`set:${s.id}`}>{s.title} ({s.cards} карточек)</option>)}
          </optgroup>
        )}
        {lessons.map((u) => (
          <optgroup key={u.title} label={`Курс · ${u.title}`}>
            {u.lessons.map((l) => <option key={l.slug} value={`lesson:${l.slug}`}>{l.title}</option>)}
          </optgroup>
        ))}
      </select>
      <label className="label" htmlFor="a-due">Срок сдачи</label>
      <input id="a-due" type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
      {error && <p className="err">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-g" disabled={!what || !due || busy}>Задать классу</button>
      </div>
    </form>
  );
}

export function RemoveAssignment({ id, title }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Снять задание «${title}»? Опыт у выполнивших сохранится.`)) return;
    setBusy(true);
    try {
      await post('/api/teacher/assignments', { id }, 'DELETE');
      router.refresh();
    } catch (err) {
      window.alert(err.message);
    }
    setBusy(false);
  }
  return <button type="button" className="mini x" onClick={remove} disabled={busy} aria-label={`Снять задание ${title}`}>Снять</button>;
}
