// Telegram-бот Ҙурбаш (long polling). Состояние диалога хранится в таблице bot_state.
// Запуск: npm run bot   (нужны DATABASE_URL и TELEGRAM_BOT_TOKEN в .env)
import { q, one } from '../lib/db.js';
import { LEVELS_TEXT, normCode } from '../lib/botutil.js';
import { dailyFragments, lessonFragments, distractorPool, buildExercises } from '../lib/course.js';
import { completeActivity, todayKey, LESSON_XP, DAILY_XP } from '../lib/progress.js';
import { leaderboard, classAssignments, accessibleSet, setFragments } from '../lib/classes.js';
import { BADGES } from '../lib/badges.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не задан');
  process.exit(1);
}
const API = `${process.env.TELEGRAM_API_URL ?? "https://api.telegram.org"}/bot${TOKEN}`;
// Публичный адрес: из файла .run/public_url (его обновляет scripts/run-laptop.sh, когда туннель меняет адрес) или из PUBLIC_URL
import fs from 'node:fs';
const urlFile = new URL('../.run/public_url', import.meta.url);
function publicUrl() {
  // Если файл есть, он главный (даже пустой: туннель ещё не поднят), иначе берём PUBLIC_URL
  try {
    return fs.readFileSync(urlFile, 'utf8').trim();
  } catch {}
  return process.env.PUBLIC_URL ?? '';
}
let APP_URL = publicUrl();
const isHttps = () => APP_URL.startsWith('https://');

const log = (...a) => console.log(new Date().toISOString(), ...a);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function tg(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 45_000 : 15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`);
  return data.result;
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });
const kb = (rows) => ({ reply_markup: { inline_keyboard: rows } });
const openApp = () => (isHttps() ? [[{ text: '📱 Открыть Ҙурбаш', web_app: { url: APP_URL } }]] : []);

async function syncMenuButton() {
  const now = publicUrl();
  if (now === APP_URL && syncMenuButton.done) return;
  APP_URL = now;
  syncMenuButton.done = true;
  if (isHttps()) {
    await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Ҙурбаш', web_app: { url: APP_URL } } });
    log('Кнопка Mini App:', APP_URL);
  } else {
    await tg('setChatMenuButton', { menu_button: { type: 'default' } });
    log('PUBLIC_URL не https: кнопка Mini App сброшена');
  }
}

// ---- состояние ----
async function getState(chatId) {
  return (await one('SELECT * FROM bot_state WHERE chat_id = $1', [chatId])) ?? { chat_id: chatId, state: 'idle', data: {}, user_id: null };
}
async function setState(chatId, state, data = {}, userId = undefined) {
  await q(
    `INSERT INTO bot_state (chat_id, user_id, state, data, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (chat_id) DO UPDATE SET state = $3, data = $4, updated_at = now(),
       user_id = COALESCE($2, bot_state.user_id)`,
    [chatId, userId ?? null, state, data]
  );
}
async function userByTg(tgId) {
  return one(
    `SELECT u.id, u.name, u.role, u.level, u.class_id, c.name AS class_name,
            CASE WHEN u.last_active >= current_date - 1 THEN u.streak ELSE 0 END AS streak,
            COALESCE((SELECT sum(amount) FROM xp_events e WHERE e.user_id = u.id), 0)::int AS xp,
            s.name AS school_name
       FROM users u LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN schools s ON s.id = COALESCE(u.school_id, c.school_id)
      WHERE u.telegram_id = $1`,
    [tgId]
  );
}

// ---- команды ----
const HELP = `<b>Ҙурбаш</b>: башкирский короткими заданиями.

/daily — задание дня
/homework — задания от учителя
/profile — ваш уровень, опыт и серия
/rating — рейтинг класса
/join — вступить в класс по коду
/cancel — выйти из текущего задания
/help — эта справка`;

async function cmdStart(chatId, from, payload) {
  const user = await userByTg(from.id);
  if (user) {
    if (payload) await joinClass(chatId, user, payload);
    return send(chatId, `Сәләм, ${esc(user.name)}! Продолжим?\n\n/daily — задание дня\n/homework — от учителя`, kb([[{ text: '☀️ Задание дня', callback_data: 'go:daily' }], ...openApp()]));
  }
  await setState(chatId, 'ask_name', { code: normCode(payload), first: from.first_name ?? '' });
  const name = String(from.first_name ?? '').trim().slice(0, 40);
  return send(
    chatId,
    'Сәләм! Я куница, буду учить вас башкирскому. Как вас зовут?',
    name ? kb([[{ text: `Меня зовут ${name}`, callback_data: 'name:tg' }]]) : {}
  );
}

async function askLevel(chatId, name, code) {
  await setState(chatId, 'ask_level', { name, code });
  const rows = LEVELS_TEXT.map((l, i) => [{ text: l, callback_data: `lvl:${i + 1}` }]);
  return send(chatId, `Приятно познакомиться, ${esc(name)}! Насколько хорошо вы знаете башкирский?`, kb(rows));
}

async function register(chatId, from, level) {
  const st = await getState(chatId);
  const name = st.data.name;
  if (!name) return cmdStart(chatId, from);
  let classId = null;
  if (st.data.code) classId = (await one('SELECT id FROM classes WHERE join_code = $1', [st.data.code]))?.id ?? null;
  const user = await one(
    `INSERT INTO users (name, level, role, class_id, telegram_id) VALUES ($1, $2, 'student', $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE SET telegram_id = users.telegram_id RETURNING id`,
    [name, level, classId, from.id]
  );
  await setState(chatId, 'idle', {}, user.id);
  return send(
    chatId,
    `Готово! ${classId ? 'Вы в классе. ' : ''}Начнём с задания дня.`,
    kb([[{ text: '☀️ Задание дня', callback_data: 'go:daily' }], ...openApp()])
  );
}

async function cmdProfile(chatId, user) {
  const lvl = LEVELS_TEXT[user.level - 1] ?? '';
  const badges = await q('SELECT badge FROM user_badges WHERE user_id = $1', [user.id]);
  return send(
    chatId,
    `<b>${esc(user.name)}</b>\n${user.role === 'teacher' ? 'Учитель' : esc(lvl)}\n${user.school_name ? `${esc(user.school_name)}${user.class_name ? `, ${esc(user.class_name)}` : ''}\n` : ''}\n🔥 ${user.streak} дн. подряд · ⚡ ${user.xp} XP${badges.length ? `\n${badges.map((b) => BADGES[b.badge]?.icon ?? '').join(' ')}` : ''}`,
    kb(openApp())
  );
}

async function cmdRating(chatId, user) {
  if (!user.class_id) return send(chatId, 'Вы пока не в классе. Введите /join и код от учителя.');
  const rows = await leaderboard(user.class_id, 'week', 'xp');
  const medal = ['🥇', '🥈', '🥉'];
  const text = rows.slice(0, 10).map((r, i) => `${medal[i] ?? `${i + 1}.`} ${r.id === user.id ? '<b>' : ''}${esc(r.name)}${r.id === user.id ? ' (вы)</b>' : ''} — ${r.xp} XP`).join('\n');
  return send(chatId, `<b>Рейтинг класса ${esc(user.class_name)}</b> за неделю\n\n${text}`);
}

async function joinClass(chatId, user, rawCode) {
  const code = normCode(rawCode);
  const cls = code && (await one('SELECT id, name FROM classes WHERE join_code = $1', [code]));
  if (!cls) return send(chatId, 'Класс с таким кодом не найден. Проверьте код и отправьте его ещё раз или /cancel.');
  if (user.role !== 'student') return send(chatId, 'Вступать в класс могут только ученики.');
  await q('UPDATE users SET class_id = $1 WHERE id = $2', [cls.id, user.id]);
  await setState(chatId, 'idle', {});
  return send(chatId, `Вы в классе ${esc(cls.name)}! Загляните в /homework.`);
}

async function cmdHomework(chatId, user) {
  if (!user.class_id) return send(chatId, 'Вы пока не в классе. Введите /join и код от учителя.');
  const list = await classAssignments(user.class_id, user.id);
  if (!list.length) return send(chatId, 'Учитель пока ничего не задал.');
  const rows = list.map((a) => [{ text: `${a.mine ? '✅' : '🍎'} ${a.title} · до ${new Date(a.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`, callback_data: `hw:${a.id}` }]);
  return send(chatId, '<b>От учителя</b>\nВыберите задание:', kb(rows));
}

// ---- задание в переписке ----
async function startQuiz(chatId, user, { key, title, baseXp, frags, pool, verify }) {
  const exercises = buildExercises(frags, pool, { verify, simple: true });
  if (!exercises.length) return send(chatId, 'Для этого задания пока нет фраз.');
  await setState(chatId, 'quiz', { key, title, baseXp, exercises, idx: 0, step: 'ask', results: [] }, user.id);
  await send(chatId, `<b>${esc(title)}</b>\n${exercises.length} упражнений. Выйти: /cancel`);
  return showExercise(chatId);
}

async function showExercise(chatId) {
  const st = await getState(chatId);
  const { exercises, idx } = st.data;
  const ex = exercises[idx];
  const n = `${idx + 1}/${exercises.length}`;
  if (ex.type === 'choose') {
    const rows = ex.options.map((o, i) => [{ text: o, callback_data: `c:${idx}:${i}` }]);
    return send(chatId, `<b>${n}</b> · Выберите перевод\n\n<b>${esc(ex.fragment.text_ba)}</b>`, kb(rows));
  }
  return send(
    chatId,
    `<b>${n}</b> · Правильно ли переведена фраза?\n\n<b>${esc(ex.fragment.text_ba)}</b>\n${esc(ex.shown)}`,
    kb([[{ text: '✅ Верно', callback_data: `v:${idx}:ok` }, { text: '❌ Ошибка', callback_data: `v:${idx}:bad` }]])
  );
}

async function answer(chatId, user, idx, entry, feedback) {
  const st = await getState(chatId);
  const results = [...st.data.results, entry];
  const done = idx + 1 >= st.data.exercises.length;
  await setState(chatId, 'quiz', { ...st.data, idx: idx + 1, step: 'ask', results });
  await send(chatId, feedback);
  if (!done) return showExercise(chatId);
  const out = await completeActivity({ userId: user.id, key: st.data.key, baseXp: st.data.baseXp, results });
  await setState(chatId, 'idle', {});
  const total = results.length;
  const ok = results.filter((r) => (r.type === 'verify' ? verifyCorrect(r, st.data.exercises[results.indexOf(r)]) : r.correct)).length;
  const newBadges = out.badges.map((b) => `${BADGES[b]?.icon} ${BADGES[b]?.title}`).join(', ');
  return send(
    chatId,
    `🎉 <b>${esc(st.data.title)}</b> пройдено!\nВерно: ${ok} из ${total}\n${out.repeat ? 'За повторное прохождение опыт не начисляется.' : `⚡ +${out.awarded} XP`} · 🔥 ${out.streak}${newBadges ? `\n\nНовое достижение: ${esc(newBadges)}` : ''}`,
    kb([...openApp()])
  );
}

const verifyCorrect = (r, ex) => {
  const planted = ex.shown !== ex.fragment.text_ru;
  return planted ? r.verdict === 'wrong' && r.correction === ex.fragment.text_ru : r.verdict === 'ok';
};

async function onChoose(chatId, user, idx, opt) {
  const st = await getState(chatId);
  const ex = st.data.exercises?.[idx];
  if (st.state !== 'quiz' || idx !== st.data.idx || !ex || ex.type !== 'choose') return;
  const picked = ex.options[opt];
  const correct = picked === ex.fragment.text_ru;
  return answer(chatId, user, idx, { fragmentId: ex.fragment.id, type: 'choose', correct }, correct ? `✅ Верно: ${esc(ex.fragment.text_ru)}` : `❌ Правильно: <b>${esc(ex.fragment.text_ru)}</b>`);
}

async function onVerify(chatId, user, idx, choice) {
  const st = await getState(chatId);
  const ex = st.data.exercises?.[idx];
  if (st.state !== 'quiz' || idx !== st.data.idx || !ex || ex.type !== 'verify') return;
  const planted = ex.shown !== ex.fragment.text_ru;
  if (choice === 'bad') {
    if (st.data.step === 'fix') return;
    await setState(chatId, 'quiz', { ...st.data, step: 'fix' });
    const opts = ex.options.filter((o) => o !== ex.shown);
    return send(chatId, 'Как правильно?', kb(opts.map((o) => [{ text: o, callback_data: `f:${idx}:${ex.options.indexOf(o)}` }])));
  }
  if (choice === 'ok') {
    const entry = { fragmentId: ex.fragment.id, type: 'verify', shown: ex.shown, verdict: 'ok' };
    return answer(chatId, user, idx, entry, planted ? `❌ Здесь была ошибка. Правильно: <b>${esc(ex.fragment.text_ru)}</b>` : '✅ Да, перевод верный.');
  }
  const correction = ex.options[Number(choice)];
  const entry = { fragmentId: ex.fragment.id, type: 'verify', shown: ex.shown, verdict: 'wrong', correction };
  const good = verifyCorrect(entry, ex);
  return answer(chatId, user, idx, entry, good ? '✅ Вы нашли ошибку!' : planted ? `❌ Правильно: <b>${esc(ex.fragment.text_ru)}</b>` : '❌ Исходный перевод был верным.');
}

async function runDaily(chatId, user) {
  const done = await one('SELECT 1 FROM completions WHERE user_id = $1 AND key = $2', [user.id, `daily:${todayKey()}`]);
  if (done) return send(chatId, 'Сегодняшнее задание уже выполнено. Возвращайтесь завтра! Можно потренироваться в /homework.');
  const frags = await dailyFragments(user.level, todayKey());
  return startQuiz(chatId, user, { key: `daily:${todayKey()}`, title: 'Задание дня', baseXp: DAILY_XP, frags, pool: await distractorPool(null), verify: true });
}

async function runHomework(chatId, user, assignmentId) {
  const a = await one('SELECT id, title, lesson_slug, set_id FROM assignments WHERE id = $1 AND class_id = $2', [assignmentId, user.class_id]);
  if (!a) return send(chatId, 'Задание не найдено.');
  let frags;
  let key;
  if (a.set_id) {
    const set = await accessibleSet(a.set_id, { id: user.id, class_id: user.class_id });
    if (!set) return send(chatId, 'Задание не найдено.');
    frags = await setFragments(set.id);
    key = `set:${set.id}`;
  } else {
    frags = await lessonFragments(a.lesson_slug);
    key = a.lesson_slug;
  }
  return startQuiz(chatId, user, { key, title: a.title, baseXp: LESSON_XP, frags, pool: a.set_id ? frags : await distractorPool(a.lesson_slug), verify: false });
}

// ---- обработка обновлений ----
async function onMessage(msg) {
  if (msg.chat.type !== 'private' || !msg.from) return;
  const chatId = msg.chat.id;
  const text = String(msg.text ?? '').trim();
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.startsWith('/') ? cmdRaw.slice(1).split('@')[0].toLowerCase() : null;
  const arg = rest.join(' ');

  if (cmd === 'start') return cmdStart(chatId, msg.from, arg);
  if (cmd === 'help') return send(chatId, HELP, kb(openApp()));
  const st = await getState(chatId);
  if (cmd === 'cancel') {
    await setState(chatId, 'idle', {});
    return send(chatId, st.state === 'idle' ? 'Нечего отменять. Попробуйте /daily.' : 'Хорошо, вышли. Возвращайтесь, когда будете готовы: /daily');
  }

  if (st.state === 'ask_name' && !cmd) {
    const name = text.replace(/\s+/g, ' ').slice(0, 40);
    if (!name) return send(chatId, 'Напишите, как вас зовут.');
    return askLevel(chatId, name, st.data.code);
  }

  const user = await userByTg(msg.from.id);
  if (!user) return send(chatId, 'Давайте познакомимся: отправьте /start');
  if (st.state === 'ask_join' && !cmd) return joinClass(chatId, user, text);
  if (st.state === 'quiz' && !cmd) return send(chatId, 'Выберите ответ кнопкой под вопросом или /cancel, чтобы выйти.');

  switch (cmd) {
    case 'profile': return cmdProfile(chatId, user);
    case 'rating': return cmdRating(chatId, user);
    case 'homework': return cmdHomework(chatId, user);
    case 'daily': return runDaily(chatId, user);
    case 'join':
      if (arg) return joinClass(chatId, user, arg);
      await setState(chatId, 'ask_join', {});
      return send(chatId, 'Введите код класса, который дал учитель (например, 7B2026):');
    default:
      return send(chatId, 'Не понял. Вот что я умею:\n\n' + HELP);
  }
}

async function onCallback(cb) {
  const chatId = cb.message?.chat?.id;
  if (!chatId) return;
  await tg('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});
  const [kind, a, b] = String(cb.data ?? '').split(':');
  if (kind === 'name' && a === 'tg') return askLevel(chatId, String(cb.from.first_name ?? 'ученик').slice(0, 40), (await getState(chatId)).data.code);
  if (kind === 'lvl') {
    const lvl = Number(a);
    return lvl >= 1 && lvl <= 5 ? register(chatId, cb.from, lvl) : undefined;
  }
  const user = await userByTg(cb.from.id);
  if (!user) return send(chatId, 'Давайте познакомимся: отправьте /start');
  if (kind === 'go' && a === 'daily') return runDaily(chatId, user);
  if (kind === 'hw') return runHomework(chatId, user, Number(a));
  if (kind === 'c') return onChoose(chatId, user, Number(a), Number(b));
  if (kind === 'v') return onVerify(chatId, user, Number(a), b);
  if (kind === 'f') return onVerify(chatId, user, Number(a), b);
}

async function main() {
  const me = await tg('getMe');
  log(`Бот @${me.username} запущен`);
  await tg('deleteWebhook', { drop_pending_updates: false });
  await tg('setMyCommands', {
    commands: [
      { command: 'daily', description: 'Задание дня' },
      { command: 'homework', description: 'Задания от учителя' },
      { command: 'profile', description: 'Мой профиль' },
      { command: 'rating', description: 'Рейтинг класса' },
      { command: 'join', description: 'Вступить в класс по коду' },
      { command: 'cancel', description: 'Выйти из задания' },
      { command: 'help', description: 'Справка' },
    ],
  });
  await syncMenuButton();
  setInterval(() => syncMenuButton().catch((e) => log('menu button:', e.message)), 20_000);

  let offset = 0;
  for (;;) {
    let updates = [];
    try {
      updates = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
    } catch (e) {
      log('getUpdates:', e.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        if (u.message) await onMessage(u.message);
        else if (u.callback_query) await onCallback(u.callback_query);
      } catch (e) {
        console.error('update', u.update_id, e);
        const chatId = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
        if (chatId) await send(chatId, 'Что-то пошло не так. Попробуйте ещё раз или /cancel.').catch(() => {});
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
