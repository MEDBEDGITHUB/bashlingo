import crypto from 'node:crypto';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET не задан (см. .env.example)');
  return s;
}

export function sign(value) {
  return `${value}.${crypto.createHmac('sha256', secret()).update(value).digest('base64url')}`;
}

export function unsign(signed) {
  if (typeof signed !== 'string') return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(signed);
  const b = Buffer.from(sign(value));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

// В проде cookie должна жить и внутри Telegram Web (там приложение открывается в iframe),
// поэтому SameSite=None; Secure. Локально по http остаётся Lax.
const prod = process.env.NODE_ENV === 'production';
export function cookieOpts(maxAge = 60 * 60 * 24 * 365) {
  return { httpOnly: true, path: '/', maxAge, sameSite: prod ? 'none' : 'lax', secure: prod };
}

// Тело читаем только как application/json: так межсайтовая форма не сможет отправить запрос от имени пользователя.
export async function readJson(req) {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return {};
  const body = await req.json().catch(() => null);
  return body && typeof body === 'object' ? body : {};
}

export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
