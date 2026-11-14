import crypto from 'node:crypto';

// Без похожих символов (0/O, 1/I/L), чтобы код было легко продиктовать и записать на доске.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function genCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export const normCode = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 16);

// Вставка строки с уникальным кодом: повторяем при редком совпадении.
export async function insertWithCode(run, sql, params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await run(sql, [...params, genCode()]);
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }
  throw new Error('Не удалось сгенерировать код');
}
