// Utilitários HTTP, validação e criptografia. Só usam normas da Web (Request, Response, crypto).

export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'";

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

export function withSecurity(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };

export async function readJson(request, max = 2_500_000) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) fail(415, 'Formato inválido.');
  const text = await request.text();
  if (text.length > max) fail(413, 'Conteúdo demasiado grande.');
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== 'object') throw new Error();
    return data;
  } catch { return fail(400, 'Pedido inválido.'); }
}

// Remove caracteres de controlo (mantém quebras de linha) e limita o tamanho.
export function str(value, max = 200) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function int(value, min, max, fallback = min) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Só permite ligações http(s): bloqueia javascript: e semelhantes.
export function safeUrl(value) {
  const v = str(value, 1000);
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}

export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
export const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isColor = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
export const isTz = (v) => /^[+-](0\d|1[0-4]):[0-5]\d$/.test(v);
export const isMediaId = (v) => /^[a-f0-9]{32}$/.test(v);

export function randomToken(bytes = 12) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomHex(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function hmacBytes(secret, msg) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));
}

export async function hmacHex(secret, msg) {
  return [...await hmacBytes(secret, msg)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante: compara os HMAC, não os textos.
export async function safeEqual(secret, a, b) {
  const [x, y] = await Promise.all([hmacBytes(secret, `cmp:${a}`), hmacBytes(secret, `cmp:${b}`)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export const SESSION_COOKIE = 'convite_admin';
export const SESSION_HOURS = 12;

export async function createSession(secret, now = Date.now()) {
  const exp = now + SESSION_HOURS * 3600_000;
  return `${exp}.${await hmacHex(secret, `session:${exp}`)}`;
}

export async function verifySession(secret, value, now = Date.now()) {
  if (!secret || !value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < now) return false;
  return safeEqual(secret, sig, await hmacHex(secret, `session:${exp}`));
}

export function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

// Neutraliza fórmulas ao abrir o CSV no Excel (=, +, -, @).
export function csvCell(value) {
  let v = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return Uint8Array.from(data); // o D1 devolve BLOB como lista de números
}
