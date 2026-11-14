export const LEVELS_TEXT = [
  'Начинаю с нуля',
  'Знаю отдельные слова',
  'Понимаю простые фразы',
  'Понимаю, но не могу говорить',
  'Уровень родного языка',
];

export const normCode = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 16);
