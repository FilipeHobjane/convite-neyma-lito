// Aplicação do convite. Recebe um Request e devolve um Response, por isso corre
// sem alterações na Cloudflare (functions/) e em qualquer servidor Node (server/local.mjs).
import {
  BACKUP_TABLES, DEFAULT_THEME, FONT_OPTIONS, DEFAULT_SETTINGS, SECTIONS, bulkInsert, ensureSchema,
} from './schema.js';
import {
  HttpError, SESSION_COOKIE, SESSION_HOURS, createSession, csvCell, fail, getCookie, hmacHex, int,
  isColor, isDate, isMediaId, isTime, isTz, json, randomHex, randomToken, readJson, safeEqual, safeUrl,
  sessionCookie, str, toBytes, verifySession, withSecurity,
} from './http.js';

const CHUNK_SIZE = 900_000;
const MAX_MEDIA_TOTAL = 450_000_000; // abaixo dos 500 MB por base do D1 gratuito
const MAX_MEDIA_FILE = 30_000_000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4']);
const LIMITS = {
  rsvp: { max: 15, seconds: 3600 },
  mensagem: { max: 5, seconds: 3600 },
  presente: { max: 10, seconds: 3600 },
  login: { max: 5, seconds: 900 },
};

const EDGE_CACHE_SECONDS = 86400;
let requestOrigin = ''; // origem do site, igual em todos os pedidos servidos por esta instância

const nowIso = () => new Date().toISOString();
const rows = async (stmt) => (await stmt.all()).results;

// ---------- Limite de pedidos ----------

async function clientKey(request, env, bucket) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  // Guarda só o hash: o endereço IP não fica na base de dados.
  return `${bucket}:${(await hmacHex(env.SESSION_SECRET || 'convite', ip)).slice(0, 32)}`;
}

async function rateLimit(db, request, env, bucket) {
  const { max, seconds } = LIMITS[bucket];
  const key = await clientKey(request, env, bucket);
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    INSERT INTO rate_limits(key, window_start, count) VALUES(?1, ?2, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END
    RETURNING count`).bind(key, now, seconds).first();
  if (row.count > max) fail(429, 'Demasiadas tentativas. Aguarde um pouco e tente novamente.');
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 86400).run();
  }
}

// ---------- Conteúdo público ----------

async function getSettings(db) {
  const list = await rows(db.prepare(`SELECT key, value FROM settings WHERE key <> 'schema_version'`));
  // Os valores iniciais cobrem definições em falta (por exemplo, depois de restaurar uma cópia antiga).
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(list.map((r) => [r.key, r.value])) };
}

function deadlineInfo(s) {
  const tz = isTz(s.event_tz) ? s.event_tz : '+02:00';
  const end = isDate(s.rsvp_deadline) ? Date.parse(`${s.rsvp_deadline}T23:59:59${tz}`) : Infinity;
  return { open: Date.now() <= end, deadline: s.rsvp_deadline, tz };
}

const foldText = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// O modelo fica no servidor: cada convidado só recebe o texto já preenchido do seu nível.
function guestTemplate(g, s) {
  let list = [];
  try { list = JSON.parse(s.relation_templates || '[]'); } catch { /* sem modelos */ }
  const found = list.find((t) => foldText(t.label) === foldText(g.group_name)) || list[list.length - 1] || {};
  const fill = (text) => String(text || '').replace(/\{nome\}/g, () => g.name).replace(/\{primeiro_nome\}/g, () => g.name.trim().split(/\s+/)[0]);
  return { cover_line: fill(found.cover_line), salutation: fill(found.salutation), message: fill(found.message) };
}

function publicGuest(g, s) {
  if (!g) return g;
  const tpl = guestTemplate(g, s);
  return {
    // O telefone não sai completo: quem receber o link reencaminhado só vê os últimos dígitos.
    token: g.token, name: g.name, phone_hint: String(g.phone || '').replace(/\D/g, '').slice(-3), status: g.status, max_companions: g.max_companions,
    companions: g.companions, companion_names: parseNames(g.companion_names), notes: g.notes,
    cover_line: tpl.cover_line, salutation: g.salutation || tpl.salutation, personal_message: g.personal_message || tpl.message,
  };
}

function parseNames(text) {
  try { const v = JSON.parse(text || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

async function publicData(db, token) {
  const [settings, chapters, events, gallery, messages, stores, categories, gifts, guest] = await db.batch([
    db.prepare(`SELECT key, value FROM settings WHERE key <> 'schema_version'`),
    db.prepare('SELECT id,label,title,text,image FROM chapters ORDER BY order_index,id'),
    db.prepare('SELECT id,time,title,location,description,map_url FROM events ORDER BY order_index,id'),
    db.prepare('SELECT id,media_id,thumb_id,is_main FROM gallery ORDER BY is_main DESC, order_index, id'),
    db.prepare('SELECT id,nome,relacao,mensagem FROM messages WHERE aprovado=1 AND oculto=0 ORDER BY id DESC LIMIT 200'),
    db.prepare('SELECT id,name,description,address,image,phone,whatsapp,map_url FROM stores ORDER BY order_index,id'),
    db.prepare('SELECT id,name,image FROM gift_categories ORDER BY order_index,id'),
    // chosen_by nunca sai para o público
    db.prepare('SELECT id,category_id,name,description,image,available FROM gifts ORDER BY id'),
    db.prepare('SELECT * FROM guests WHERE token=?').bind(token || ''),
  ]);
  // Os valores iniciais cobrem definições novas ausentes de cópias antigas restauradas.
  const all = { ...DEFAULT_SETTINGS, ...Object.fromEntries(settings.results.map((r) => [r.key, r.value])) };
  // Os textos de cada nível e as mensagens de envio não saem para o público.
  const { relation_templates: _templates, std_share_message: _share, ...s } = all;
  return {
    s,
    chapters: chapters.results,
    events: events.results,
    gallery: gallery.results,
    messages: messages.results,
    stores: stores.results,
    categories: categories.results,
    gifts: gifts.results,
    guest: publicGuest(guest.results[0], all) || null,
    rsvp: deadlineInfo(s),
    invalidToken: Boolean(token) && !guest.results[0],
  };
}

const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Os robôs do WhatsApp não executam JavaScript: os metadados têm de vir no HTML.
async function renderInvite(request, env, db, token) {
  const asset = await env.ASSETS.fetch(new URL('/', request.url));
  const data = await publicData(db, token);
  const origin = new URL(request.url).origin;
  const { s } = data;
  const image = s.cover_image ? `${origin}/media/${s.cover_image}` : `${origin}/icons/og.jpg`;
  const title = data.guest ? `${data.guest.name}, ${s.couple_display} convidam-no(a)` : s.site_title;
  const meta = [
    `<title>${escHtml(s.site_title)}</title>`,
    `<meta name="description" content="${escHtml(s.site_description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(s.site_description)}">`,
    `<meta property="og:image" content="${escHtml(image)}">`,
    `<meta property="og:url" content="${escHtml(origin + new URL(request.url).pathname)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    token ? '<meta name="robots" content="noindex">' : '',
  ].join('\n');
  // < é escapado para o texto dos convidados nunca poder fechar o bloco.
  const boot = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = (await asset.text())
    .replace('<!--META-->', () => meta)
    .replace('<!--BOOT-->', () => `<script id="boot" type="application/json">${boot}</script>`);
  return new Response(html, {
    status: data.invalidToken ? 404 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Save the Date: recebe só o necessário, sem programa, presentes nem outros dados do convidado.
const SAVE_DATE_KEYS = ['couple_display', 'bride_name', 'groom_name', 'wedding_date', 'event_tz', 'envelope_seal_text', 'std_photo', 'std_video', 'cover_image', 'std_title', 'std_hint', 'std_message', 'std_next', 'color_primary', 'color_gold', 'font_titles', 'font_text'];

async function renderSaveDate(request, env, db, token) {
  const s = { ...DEFAULT_SETTINGS, ...(await getSettings(db)) };
  const guest = token ? await db.prepare('SELECT name, group_name FROM guests WHERE token=?').bind(token).first() : null;
  if (s.show_savedate === '0') {
    return new Response(null, { status: 302, headers: { Location: token && guest ? `/c/${token}` : '/' } });
  }
  const asset = await env.ASSETS.fetch(new URL('/guarde-a-data/', request.url));
  const origin = new URL(request.url).origin;
  const photo = s.std_photo || s.cover_image;
  const title = guest ? `${guest.name}, ${s.std_title}` : `${s.couple_display} | ${s.std_title}`;
  const meta = [
    `<title>${escHtml(`${s.couple_display} | ${s.std_title}`)}</title>`,
    `<meta name="description" content="${escHtml(s.std_message)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(s.std_message)}">`,
    `<meta property="og:image" content="${escHtml(photo ? `${origin}/media/${photo}` : `${origin}/icons/og.jpg`)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    token ? '<meta name="robots" content="noindex">' : '',
  ].join('\n');
  const data = { s: Object.fromEntries(SAVE_DATE_KEYS.map((k) => [k, s[k]])), guest: guest ? { name: guest.name, cover_line: guestTemplate(guest, s).cover_line } : null };
  const boot = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = (await asset.text())
    .replace('<!--META-->', () => meta)
    .replace('<!--BOOT-->', () => `<script id="boot" type="application/json">${boot}</script>`);
  return new Response(html, {
    status: token && !guest ? 404 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ---------- Rotas públicas de escrita ----------

const normalizeName = (v) => str(v, 120).replace(/\s+/g, ' ');

async function submitRsvp(request, env, db) {
  const body = await readJson(request, 20_000);
  await rateLimit(db, request, env, 'rsvp');
  if (body.website) return json({ ok: true }); // campo isca preenchido por robôs

  const settings = await getSettings(db);
  if (!deadlineInfo(settings).open) fail(403, 'O prazo de confirmação já terminou. Contacte os noivos.');

  const status = body.status;
  if (status !== 'sim' && status !== 'nao') fail(400, 'Escolha se poderá estar presente.');
  const phone = str(body.telefone, 30);
  const notes = str(body.observacao, 1000);
  const token = str(body.token, 40);
  const now = nowIso();

  let guest;
  if (token) {
    guest = await db.prepare('SELECT * FROM guests WHERE token=?').bind(token).first();
    if (!guest) fail(404, 'Convite não encontrado.');
  }
  const max = guest ? guest.max_companions : int(settings.public_max_companions, 0, 20, 0);
  const companions = status === 'sim' ? int(body.acompanhantes, 0, 50, 0) : 0;
  if (companions > max) fail(400, `Este convite permite no máximo ${max} acompanhante(s).`);
  const names = JSON.stringify((Array.isArray(body.nomes_acompanhantes) ? body.nomes_acompanhantes : [])
    .slice(0, companions).map((n) => normalizeName(n)).filter(Boolean));

  if (guest) {
    await db.prepare(`UPDATE guests SET status=?, companions=?, companion_names=?, notes=?, phone=COALESCE(NULLIF(?,''),phone), responded_at=? WHERE id=?`)
      .bind(status, companions, names, notes, phone, now, guest.id).run();
    return json({ ok: true, token: guest.token, status });
  }

  if (settings.rsvp_public !== '1') fail(403, 'Utilize o link pessoal que recebeu no convite.');
  const name = normalizeName(body.nome);
  if (name.length < 2) fail(400, 'Indique o seu nome completo.');
  const newToken = randomToken();
  await db.prepare(`INSERT INTO guests(token,name,phone,max_companions,status,companions,companion_names,notes,source,responded_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,'aberto',?,?)`)
    .bind(newToken, name, phone, max, status, companions, names, notes, now, now).run();
  return json({ ok: true, token: newToken, status });
}

async function submitMessage(request, env, db) {
  const body = await readJson(request, 10_000);
  await rateLimit(db, request, env, 'mensagem');
  if (body.website) return json({ ok: true });
  const nome = normalizeName(body.nome);
  const mensagem = str(body.mensagem, 800);
  if (nome.length < 2 || mensagem.length < 2) fail(400, 'Preencha o nome e a mensagem.');
  await db.prepare('INSERT INTO messages(nome,relacao,mensagem,aprovado,oculto,data_criacao) VALUES(?,?,?,0,0,?)')
    .bind(nome, str(body.relacao, 80), mensagem, nowIso()).run();
  return json({ ok: true });
}

async function chooseGift(request, env, db, id) {
  const body = await readJson(request, 2_000);
  await rateLimit(db, request, env, 'presente');
  if (body.website) return json({ ok: true });
  // Só quem tem link pessoal escolhe: impede que alguém esgote a lista com nomes inventados.
  const guest = await db.prepare('SELECT name FROM guests WHERE token=?').bind(str(body.token, 40)).first();
  if (!guest) fail(403, 'Para escolher um presente, abra o convite pelo seu link pessoal.');
  const nome = guest.name;
  const settings = await getSettings(db);
  const onePerGuest = settings.gift_one_per_guest === '1' ? 1 : 0;
  // Actualização atómica: se duas pessoas escolherem ao mesmo tempo, só uma fica com o presente.
  const result = await db.prepare(`UPDATE gifts SET available=0, chosen_by=?1 WHERE id=?2 AND available=1
    AND (?3=0 OR NOT EXISTS (SELECT 1 FROM gifts WHERE chosen_by=?1 COLLATE NOCASE))`).bind(nome, id, onePerGuest).run();
  if (result.meta.changes === 1) return json({ ok: true });
  const gift = await db.prepare('SELECT available FROM gifts WHERE id=?').bind(id).first();
  if (!gift || !gift.available) fail(409, 'Este presente já não está disponível.');
  return fail(409, 'Já escolheu um presente. Cada convidado só pode escolher um.');
}

// ---------- Ficheiros (fotos e música) ----------

// Cada resposta parcial junta no máximo dois blocos: mantém cada pedido longe do limite de CPU
// gratuito, por maior que seja o ficheiro. Os leitores de vídeo pedem simplesmente o resto a seguir.
const MAX_RANGE_CHUNKS = 2;

async function serveMedia(request, db, id, ctx) {
  if (!isMediaId(id)) fail(404, 'Não encontrado.');
  const range = request.headers.get('Range');
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    const hit = await cache.match(new Request(request.url));
    if (hit && !range) return hit;
    // Ficheiro inteiro já na cache deste centro de dados: corta-se a parte pedida, sem ler a base de dados.
    const m = hit && /^bytes=(\d+)-(\d*)$/.exec(range || '');
    if (m) {
      const all = new Uint8Array(await hit.arrayBuffer());
      const start = Number(m[1]);
      const end = Math.min(all.length - 1, m[2] === '' ? all.length - 1 : Number(m[2]));
      if (start <= end) {
        return new Response(all.subarray(start, end + 1), {
          status: 206,
          headers: { 'Content-Type': hit.headers.get('Content-Type'), 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${all.length}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${id}"` },
        });
      }
    }
  }
  const media = await db.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  if (!media) fail(404, 'Não encontrado.');

  let start = 0;
  let end = media.size - 1;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (range && (!m || (m[1] === '' && m[2] === ''))) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${media.size}` } });
  }
  if (m) {
    if (m[1] === '') {
      start = Math.max(0, media.size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== '') end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= media.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${media.size}` } });
    }
    end = Math.min(end, (Math.floor(start / media.chunk_size) + MAX_RANGE_CHUNKS) * media.chunk_size - 1);
  }

  const first = Math.floor(start / media.chunk_size);
  const last = Math.floor(end / media.chunk_size);
  const parts = await rows(db.prepare('SELECT idx, data FROM media_chunks WHERE media_id=? AND idx BETWEEN ? AND ? ORDER BY idx').bind(id, first, last));
  if (parts.length !== last - first + 1) fail(404, 'Ficheiro incompleto.');
  const out = new Uint8Array(end - start + 1);
  for (const part of parts) {
    const bytes = toBytes(part.data);
    const partStart = part.idx * media.chunk_size;
    const from = Math.max(start, partStart) - partStart;
    const to = Math.min(end + 1, partStart + bytes.length) - partStart;
    out.set(bytes.subarray(from, to), partStart + from - start);
  }
  const headers = {
    'Content-Type': media.mime,
    'Content-Length': String(out.length),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable', // o id muda sempre que o ficheiro muda
    ETag: `"${id}"`,
  };
  if (m) {
    headers['Content-Range'] = `bytes ${start}-${end}/${media.size}`;
    return new Response(out, { status: 206, headers });
  }
  const res = new Response(out, { status: 200, headers });
  if (cache && !range && ctx && ctx.waitUntil) {
    // A cópia na rede dura um dia: a cache é por centro de dados e só a local pode ser apagada.
    const edge = new Response(out, { status: 200, headers: { ...headers, 'Cache-Control': `public, max-age=${EDGE_CACHE_SECONDS}` } });
    ctx.waitUntil(cache.put(request, edge));
  }
  return res;
}

async function deleteMedia(db, ...ids) {
  const valid = ids.filter((id) => id && isMediaId(id));
  if (!valid.length) return;
  if (typeof caches !== 'undefined' && requestOrigin) {
    await Promise.all(valid.map((id) => caches.default.delete(new Request(`${requestOrigin}/media/${id}`))));
  }
  await db.batch(valid.flatMap((id) => [
    db.prepare('DELETE FROM media_chunks WHERE media_id=?').bind(id),
    db.prepare('DELETE FROM media WHERE id=?').bind(id),
  ]));
}

async function createMedia(request, db) {
  const b = await readJson(request, 2_000);
  const size = int(b.size, 1, MAX_MEDIA_FILE, 0);
  if (!ALLOWED_MIME.has(b.mime)) fail(400, 'Tipo de ficheiro não permitido.');
  if (!size || Number(b.size) > MAX_MEDIA_FILE) fail(413, 'Ficheiro demasiado grande (máximo 30 MB).');
  const used = await db.prepare('SELECT COALESCE(SUM(size),0) n FROM media').first();
  if (used.n + size > MAX_MEDIA_TOTAL) fail(413, 'Espaço de armazenamento esgotado. Elimine fotos antigas.');
  const id = randomHex();
  const chunks = Math.ceil(size / CHUNK_SIZE);
  await db.prepare('INSERT INTO media(id,mime,name,size,chunks,chunk_size,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(id, b.mime, str(b.name, 120), size, chunks, CHUNK_SIZE, nowIso()).run();
  return json({ id, chunks, chunk_size: CHUNK_SIZE }, 201);
}

async function putChunk(request, db, id, idx) {
  const media = await db.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  if (!media) fail(404, 'Ficheiro não encontrado.');
  if (idx < 0 || idx >= media.chunks) fail(400, 'Bloco inválido.');
  const data = new Uint8Array(await request.arrayBuffer());
  const expected = idx === media.chunks - 1 ? media.size - idx * media.chunk_size : media.chunk_size;
  if (data.length !== expected) fail(400, 'Tamanho do bloco incorrecto.');
  await db.prepare('INSERT OR REPLACE INTO media_chunks(media_id,idx,data) VALUES(?,?,?)').bind(id, idx, data).run();
  return json({ ok: true });
}

// ---------- Administração: validação ----------

const URL_SETTINGS = new Set(['footer_instagram']);
const MEDIA_SETTINGS = new Set(['std_photo', 'std_video','groom_photo', 'bride_photo', 'cover_image', 'dresscode_women_image', 'dresscode_men_image', 'music_file']);

function cleanSetting(key, raw) {
  const value = str(raw, key === 'relation_templates' ? 40000 : 6000);
  if (key.startsWith('color_')) return isColor(value) ? value : fail(400, `Cor inválida em ${key}.`);
  if (key === 'font_titles') return FONT_OPTIONS.titles.includes(value) ? value : fail(400, 'Fonte inválida.');
  if (key === 'font_text') return FONT_OPTIONS.text.includes(value) ? value : fail(400, 'Fonte inválida.');
  if (key === 'font_title_size' || key === 'font_text_size') {
    const n = Number(value);
    return n >= 0.6 && n <= 5 ? String(n) : fail(400, 'Tamanho de letra inválido.');
  }
  if (key === 'wedding_date' || key === 'rsvp_deadline') return isDate(value) ? value : fail(400, 'Data inválida.');
  if (key === 'wedding_time') return isTime(value) ? value : fail(400, 'Hora inválida.');
  if (key === 'event_tz') return isTz(value) ? value : fail(400, 'Fuso horário inválido.');
  if (key === 'public_max_companions') return String(int(value, 0, 20, 0));
  if (key === 'rsvp_public' || key === 'gift_one_per_guest' || key === 'music_enabled' || key.startsWith('show_')) return value === '1' ? '1' : '0';
  if (URL_SETTINGS.has(key)) return safeUrl(value);
  if (key === 'footer_whatsapp') return value.replace(/\D/g, '').slice(0, 15);
  if (MEDIA_SETTINGS.has(key)) return value === '' || isMediaId(value) ? value : fail(400, 'Ficheiro inválido.');
  if (key === 'manual_guest_items') {
    let list;
    try { list = JSON.parse(value); } catch { fail(400, 'Lista inválida.'); }
    if (!Array.isArray(list)) fail(400, 'Lista inválida.');
    return JSON.stringify(list.slice(0, 30).map((i) => ({ title: str(i.title, 120), text: str(i.text, 400) })).filter((i) => i.title));
  }
  if (key === 'relation_templates') {
    let list;
    try { list = JSON.parse(value); } catch { fail(400, 'Modelos inválidos.'); }
    if (!Array.isArray(list)) fail(400, 'Modelos inválidos.');
    const clean = list.slice(0, 30).map((t) => ({
      label: str(t.label, 60), cover_line: str(t.cover_line, 80), salutation: str(t.salutation, 80), message: str(t.message, 600),
      wa_savedate: str(t.wa_savedate, 800), wa_invite: str(t.wa_invite, 800),
    })).filter((t) => t.label);
    return clean.length ? JSON.stringify(clean) : fail(400, 'Mantenha pelo menos um modelo.');
  }
  return value;
}

async function updateSettings(request, db) {
  const body = await readJson(request, 200_000);
  const entries = {};
  for (const [key, raw] of Object.entries(body)) {
    // Lista branca: chaves desconhecidas são ignoradas.
    if (Object.hasOwn(DEFAULT_SETTINGS, key)) entries[key] = cleanSetting(key, raw);
  }
  const current = await getSettings(db);
  const replaced = Object.keys(entries).filter((k) => MEDIA_SETTINGS.has(k) && current[k] && current[k] !== entries[k]).map((k) => current[k]);
  await db.prepare(`INSERT OR REPLACE INTO settings(key,value) SELECT key, value FROM json_each(?)`).bind(JSON.stringify(entries)).run();
  await deleteMedia(db, ...replaced);
  return json({ ok: true, settings: await getSettings(db) });
}

const mediaField = (v) => { const s = str(v, 40); return isMediaId(s) ? s : ''; };

const COLLECTIONS = {
  chapters: {
    table: 'chapters', ordered: true, media: ['image'],
    clean: (b) => ({ label: str(b.label, 60), title: str(b.title, 120) || fail(400, 'Indique o título.'), text: str(b.text, 800), image: mediaField(b.image) }),
  },
  events: {
    table: 'events', ordered: true,
    clean: (b) => ({ time: str(b.time, 30), title: str(b.title, 120) || fail(400, 'Indique o título.'), location: str(b.location, 160), description: str(b.description, 600), map_url: safeUrl(b.map_url) }),
  },
  stores: {
    table: 'stores', ordered: true, media: ['image'],
    clean: (b) => ({ name: str(b.name, 120) || fail(400, 'Indique o nome.'), description: str(b.description, 400), address: str(b.address, 200), image: mediaField(b.image), phone: str(b.phone, 30), whatsapp: str(b.whatsapp, 20).replace(/\D/g, ''), map_url: safeUrl(b.map_url) }),
  },
  'gift-categories': {
    table: 'gift_categories', ordered: true, media: ['image'],
    clean: (b) => ({ name: str(b.name, 80) || fail(400, 'Indique o nome.'), image: mediaField(b.image) }),
  },
  gifts: {
    table: 'gifts', media: ['image'],
    clean: (b) => ({ category_id: int(b.category_id, 0, 1e9, 0) || null, name: str(b.name, 120) || fail(400, 'Indique o nome.'), description: str(b.description, 400), image: mediaField(b.image) }),
  },
  guests: {
    table: 'guests',
    clean: (b) => {
      const status = ['pendente', 'sim', 'nao'].includes(b.status) ? b.status : 'pendente';
      const max = int(b.max_companions, 0, 50, 0);
      const companions = status === 'sim' ? Math.min(max, int(b.companions, 0, 50, 0)) : 0;
      return {
        name: normalizeName(b.name) || fail(400, 'Indique o nome do convidado.'),
        phone: str(b.phone, 30), group_name: str(b.group_name, 80), max_companions: max, status, companions,
        companion_names: JSON.stringify((Array.isArray(b.companion_names) ? b.companion_names : []).slice(0, companions).map(normalizeName).filter(Boolean)),
        notes: str(b.notes, 1000), admin_notes: str(b.admin_notes, 1000),
        salutation: str(b.salutation, 80), personal_message: str(b.personal_message, 600),
        responded_at: status === 'pendente' ? null : (str(b.responded_at, 40) || nowIso()),
      };
    },
    extraInsert: () => ({ token: randomToken(), source: 'lista', created_at: nowIso() }),
  },
  messages: {
    table: 'messages',
    clean: (b) => ({ nome: normalizeName(b.nome) || fail(400, 'Indique o nome.'), relacao: str(b.relacao, 80), mensagem: str(b.mensagem, 800) || fail(400, 'Indique a mensagem.'), aprovado: b.aprovado ? 1 : 0, oculto: b.oculto ? 1 : 0 }),
  },
};

async function collectionCreate(request, db, spec) {
  const data = { ...spec.clean(await readJson(request)), ...(spec.extraInsert ? spec.extraInsert() : {}) };
  if (spec.ordered) {
    const m = await db.prepare(`SELECT COALESCE(MAX(order_index),0)+1 n FROM ${spec.table}`).first();
    data.order_index = m.n;
  }
  const cols = Object.keys(data);
  const row = await db.prepare(`INSERT INTO ${spec.table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')}) RETURNING *`).bind(...cols.map((c) => data[c])).first();
  return json({ ok: true, item: row }, 201);
}

async function collectionUpdate(request, db, spec, id) {
  const data = spec.clean(await readJson(request));
  const before = await db.prepare(`SELECT * FROM ${spec.table} WHERE id=?`).bind(id).first();
  if (!before) fail(404, 'Registo não encontrado.');
  const cols = Object.keys(data);
  const row = await db.prepare(`UPDATE ${spec.table} SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=? RETURNING *`).bind(...cols.map((c) => data[c]), id).first();
  await deleteMedia(db, ...(spec.media || []).filter((f) => before[f] && before[f] !== data[f]).map((f) => before[f]));
  return json({ ok: true, item: row });
}

async function collectionDelete(db, name, spec, id) {
  const before = await db.prepare(`SELECT * FROM ${spec.table} WHERE id=?`).bind(id).first();
  if (!before) fail(404, 'Registo não encontrado.');
  if (name === 'gift-categories') {
    const gifts = await rows(db.prepare('SELECT image FROM gifts WHERE category_id=?').bind(id));
    await db.prepare('DELETE FROM gifts WHERE category_id=?').bind(id).run();
    await deleteMedia(db, ...gifts.map((g) => g.image));
  }
  await db.prepare(`DELETE FROM ${spec.table} WHERE id=?`).bind(id).run();
  await deleteMedia(db, ...(spec.media || []).map((f) => before[f]));
  return json({ ok: true });
}

async function move(request, db, table, id) {
  const { direction } = await readJson(request, 200);
  const list = await rows(db.prepare(`SELECT id, order_index FROM ${table} ORDER BY order_index, id`));
  const i = list.findIndex((r) => r.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return json({ ok: true });
  // Reescreve a ordem para corrigir índices iguais vindos de versões antigas.
  [list[i], list[j]] = [list[j], list[i]];
  await db.prepare(`UPDATE ${table} SET order_index = (SELECT json_extract(j.value,'$.o') FROM json_each(?1) j WHERE json_extract(j.value,'$.id') = ${table}.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?1))`)
    .bind(JSON.stringify(list.map((r, o) => ({ id: r.id, o })))).run();
  return json({ ok: true });
}

function stats(guests, messages, gifts) {
  const sim = guests.filter((g) => g.status === 'sim');
  const companions = sim.reduce((n, g) => n + (g.companions || 0), 0);
  const answered = guests.filter((g) => g.status !== 'pendente').length;
  return {
    total: guests.length,
    sim: sim.length,
    nao: guests.filter((g) => g.status === 'nao').length,
    pendente: guests.length - answered,
    acompanhantes: companions,
    pessoas: sim.length + companions,
    taxa: guests.length ? Math.round((answered / guests.length) * 100) : 0,
    mensagens_pendentes: messages.filter((m) => !m.aprovado).length,
    presentes_escolhidos: gifts.filter((g) => g.chosen_by).length,
  };
}

async function adminAll(db) {
  const [settings, chapters, events, guests, messages, gallery, categories, gifts, stores, usage] = await db.batch([
    db.prepare(`SELECT key, value FROM settings WHERE key <> 'schema_version'`),
    db.prepare('SELECT * FROM chapters ORDER BY order_index,id'),
    db.prepare('SELECT * FROM events ORDER BY order_index,id'),
    db.prepare('SELECT * FROM guests ORDER BY name COLLATE NOCASE'),
    db.prepare('SELECT * FROM messages ORDER BY id DESC'),
    db.prepare('SELECT * FROM gallery ORDER BY order_index,id'),
    db.prepare('SELECT * FROM gift_categories ORDER BY order_index,id'),
    db.prepare('SELECT * FROM gifts ORDER BY id'),
    db.prepare('SELECT * FROM stores ORDER BY order_index,id'),
    db.prepare('SELECT COALESCE(SUM(size),0) used, COUNT(*) files FROM media'),
  ]);
  return json({
    settings: { ...DEFAULT_SETTINGS, ...Object.fromEntries(settings.results.map((r) => [r.key, r.value])) },
    sections: SECTIONS,
    chapters: chapters.results,
    events: events.results, guests: guests.results, messages: messages.results, gallery: gallery.results,
    categories: categories.results, gifts: gifts.results, stores: stores.results,
    stats: stats(guests.results, messages.results, gifts.results),
    storage: { ...usage.results[0], limit: MAX_MEDIA_TOTAL },
    theme_defaults: DEFAULT_THEME,
    fonts: FONT_OPTIONS,
  });
}

async function importGuests(request, db) {
  const { rows: list } = await readJson(request, 1_000_000);
  if (!Array.isArray(list) || list.length > 2000) fail(400, 'Lista inválida (máximo 2000 linhas).');
  const now = nowIso();
  // Acompanhantes em branco: numa pessoa nova vale 0; numa actualização mantém o valor que já tinha.
  const blank = (v) => v === null || v === undefined || String(v).trim() === '';
  const clean = list.map((r) => ({
    name: normalizeName(r.name), phone: str(r.phone, 30), group_name: str(r.group_name, 80),
    max_companions: blank(r.max_companions) ? null : int(r.max_companions, 0, 50, 0), token: randomToken(), status: 'pendente',
    companions: 0, companion_names: '[]', notes: '', admin_notes: '', source: 'lista', created_at: now,
    salutation: str(r.salutation, 80), personal_message: str(r.personal_message, 600),
  })).filter((r) => r.name.length >= 2);
  // Importar de novo actualiza a mesma pessoa: mantém o link, a resposta e o registo de envio.
  // É a mesma pessoa quando tem o mesmo nome (e telefone compatível) ou o mesmo telefone e o mesmo
  // primeiro nome. Mesmo telefone com outro primeiro nome é outra pessoa: famílias partilham números.
  const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);
  const first = (n) => foldText(n).split(/\s+/)[0];
  const people = (await rows(db.prepare('SELECT id, name, phone FROM guests')))
    .map((g) => ({ id: g.id, name: foldText(g.name), first: first(g.name), phone: digits(g.phone) }));
  const fresh = [];
  const changes = new Map();
  for (const r of clean) {
    const phone = digits(r.phone);
    const name = foldText(r.name);
    const match = people.find((p) => p.name === name && (!phone || !p.phone || p.phone === phone))
      || (phone.length === 9 && people.find((p) => p.phone === phone && p.first === first(r.name)));
    if (match && match.id < 0) continue; // linha repetida no próprio ficheiro
    if (match) {
      changes.set(match.id, { id: match.id, name: r.name, phone: r.phone, group_name: r.group_name, max_companions: r.max_companions, salutation: r.salutation, personal_message: r.personal_message });
    } else {
      fresh.push({ ...r, max_companions: r.max_companions ?? 0 });
      people.push({ id: -1, name, first: first(r.name), phone });
    }
  }
  const updates = [...changes.values()];
  if (fresh.length) await bulkInsert(db, 'guests', Object.keys(fresh[0]), fresh);
  if (updates.length) {
    const col = (c) => `(SELECT json_extract(j.value,'$.${c}') FROM json_each(?1) j WHERE json_extract(j.value,'$.id') = guests.id)`;
    const keep = (c) => `${c} = COALESCE(NULLIF(${col(c)},''), ${c})`;
    await db.prepare(`UPDATE guests SET name=${col('name')}, ${keep('phone')}, ${keep('group_name')}, ${keep('max_companions')}, ${keep('salutation')}, ${keep('personal_message')} WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?1))`)
      .bind(JSON.stringify(updates)).run();
  }
  return json({ ok: true, imported: fresh.length, updated: updates.length });
}

async function markSent(request, db, id) {
  const { kind, undo } = await readJson(request, 200);
  const col = kind === 'savedate' ? 'savedate_sent_at' : kind === 'invite' ? 'invite_sent_at' : fail(400, 'Tipo de envio inválido.');
  const row = await db.prepare(`UPDATE guests SET ${col}=? WHERE id=? RETURNING id`).bind(undo ? null : nowIso(), id).first();
  if (!row) fail(404, 'Convidado não encontrado.');
  return json({ ok: true });
}

async function exportGuests(db) {
  const list = await rows(db.prepare('SELECT * FROM guests ORDER BY name COLLATE NOCASE'));
  const label = { sim: 'Confirmado', nao: 'Não vem', pendente: 'Sem resposta' };
  const header = ['Nome', 'Telefone', 'Grupo', 'Estado', 'Acompanhantes', 'Máx. acompanhantes', 'Nomes dos acompanhantes', 'Observação', 'Notas internas', 'Origem', 'Respondeu em', 'Link pessoal (caminho)', 'Saudação', 'Mensagem pessoal'];
  const lines = [header.map(csvCell).join(';')];
  for (const g of list) {
    lines.push([g.name, g.phone, g.group_name, label[g.status], g.companions, g.max_companions, parseNames(g.companion_names).join(', '), g.notes, g.admin_notes, g.source, g.responded_at, `/c/${g.token}`, g.salutation, g.personal_message].map(csvCell).join(';'));
  }
  // BOM e ";" para o Excel abrir acentos e colunas correctamente em português.
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="convidados.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

// ---------- Cópias de segurança ----------
// Os dados e os blocos são pedidos separadamente: um só pedido excederia o limite de CPU gratuito.

async function backupData(db) {
  const entries = Object.entries(BACKUP_TABLES);
  const results = await db.batch(entries.map(([t, cols]) => db.prepare(`SELECT ${cols.join(',')} FROM ${t}`)));
  const tables = Object.fromEntries(entries.map(([t], i) => [t, results[i].results]));
  tables.settings = tables.settings.filter((r) => r.key !== 'schema_version');
  return json({ format: 'convite-backup', version: 1, created_at: nowIso(), tables });
}

async function backupChunk(db, id, idx) {
  const row = await db.prepare('SELECT data FROM media_chunks WHERE media_id=? AND idx=?').bind(id, idx).first();
  if (!row) fail(404, 'Bloco não encontrado.');
  return new Response(toBytes(row.data), { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
}

async function restoreBegin(request, db) {
  const { confirm } = await readJson(request, 200);
  if (confirm !== 'RESTAURAR') fail(400, 'Confirmação em falta.');
  const tables = [...Object.keys(BACKUP_TABLES), 'media_chunks'];
  await db.batch(tables.map((t) => db.prepare(t === 'settings' ? `DELETE FROM settings WHERE key <> 'schema_version'` : `DELETE FROM ${t}`)));
  return json({ ok: true });
}

// Uma cópia pode vir de fora: valida-se como se fosse escrita no painel, para não trazer
// ficheiros de tipo perigoso nem definições inválidas.
function sanitizeRows(table, list) {
  if (!Array.isArray(list)) fail(400, `Dados inválidos em ${table}.`);
  if (table === 'settings') {
    return list.filter((r) => r && r.key !== 'schema_version' && Object.hasOwn(DEFAULT_SETTINGS, r.key)).flatMap((r) => {
      try { return [{ key: r.key, value: cleanSetting(r.key, r.value ?? '') }]; } catch { return []; }
    });
  }
  if (table === 'media') {
    return list.filter((r) => r && isMediaId(r.id) && ALLOWED_MIME.has(r.mime)).map((r) => ({
      ...r, size: int(r.size, 1, MAX_MEDIA_FILE, 0), chunks: int(r.chunks, 1, 1000, 0), chunk_size: int(r.chunk_size, 1, CHUNK_SIZE, 0),
    })).filter((r) => r.size && r.chunks && r.chunk_size);
  }
  if (table === 'guests') return list.filter((r) => r && /^[\w-]{8,40}$/.test(String(r.token || '')) && String(r.name || '').trim());
  return list;
}

async function restoreTable(request, db, table) {
  const cols = Object.hasOwn(BACKUP_TABLES, table) ? BACKUP_TABLES[table] : fail(404, 'Tabela desconhecida.');
  const { rows: list } = await readJson(request, 1_900_000);
  const clean = sanitizeRows(table, list);
  if (clean.length) await bulkInsert(db, table, cols, clean, 'INSERT OR REPLACE');
  return json({ ok: true, count: clean.length });
}

// Restauro de uma só vez: apagar e repor acontecem no mesmo lote do D1, que é uma transacção.
// Se algo falhar, nada muda. Os ficheiros são enviados antes (são novos ou iguais) e os que
// deixarem de ser usados são apagados no fim.
async function restoreApply(request, db) {
  const { confirm, tables } = await readJson(request, 1_900_000);
  if (confirm !== 'RESTAURAR') fail(400, 'Confirmação em falta.');
  if (!tables || typeof tables !== 'object') fail(400, 'Dados inválidos.');
  for (const t of Object.keys(tables)) if (!Object.hasOwn(BACKUP_TABLES, t)) fail(400, `Tabela desconhecida: ${t}.`);
  const statements = [];
  for (const [table, cols] of Object.entries(BACKUP_TABLES)) {
    statements.push(db.prepare(table === 'settings' ? `DELETE FROM settings WHERE key <> 'schema_version'` : `DELETE FROM ${table}`));
    const clean = sanitizeRows(table, tables[table] || []);
    if (clean.length) {
      const select = cols.map((c) => `json_extract(value,'$.${c}')`).join(',');
      statements.push(db.prepare(`INSERT INTO ${table}(${cols.join(',')}) SELECT ${select} FROM json_each(?)`).bind(JSON.stringify(clean)));
    }
  }
  statements.push(db.prepare('DELETE FROM media_chunks WHERE media_id NOT IN (SELECT id FROM media)'));
  await db.batch(statements);
  return json({ ok: true });
}

// ---------- Autenticação ----------

async function login(request, env, db) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.ADMIN_PASSWORD.length < 12) {
    fail(503, 'Painel por configurar: defina ADMIN_PASSWORD (mínimo 12 caracteres) e SESSION_SECRET.');
  }
  await rateLimit(db, request, env, 'login');
  const { password } = await readJson(request, 1_000);
  const stored = await storedPassword(db, env);
  if (!(await passwordMatches(env, stored, password))) fail(401, 'Senha incorrecta.');
  const value = await createSession(sessionKey(env, stored));
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, value, SESSION_HOURS * 3600) });
}

// A senha do painel tem prioridade sobre ADMIN_PASSWORD. Mudar SESSION_SECRET invalida-a
// e volta a valer ADMIN_PASSWORD: é assim que se recupera uma senha esquecida.
async function storedPassword(db, env) {
  if (!env.SESSION_SECRET) return null;
  const row = await db.prepare('SELECT password_hmac, secret_check FROM admin_auth WHERE id=1').first();
  if (!row || row.secret_check !== await hmacHex(env.SESSION_SECRET, 'auth-check')) return null;
  return row.password_hmac;
}

async function passwordMatches(env, stored, password) {
  if (typeof password !== 'string') return false;
  if (stored) return safeEqual(env.SESSION_SECRET, await hmacHex(env.SESSION_SECRET, `pw:${password}`), stored);
  return safeEqual(env.SESSION_SECRET, password, env.ADMIN_PASSWORD || randomHex());
}

// Inclui a senha na chave: ao mudá-la, as sessões abertas noutros aparelhos terminam.
const sessionKey = (env, stored) => (env.SESSION_SECRET ? `${env.SESSION_SECRET}|${stored || ''}` : '');

async function changePassword(request, env, db) {
  const { current, next } = await readJson(request, 2_000);
  const stored = await storedPassword(db, env);
  if (!(await passwordMatches(env, stored, current))) {
    await rateLimit(db, request, env, 'login');
    fail(401, 'A senha actual está incorrecta.');
  }
  if (typeof next !== 'string' || next.length < 12 || next.length > 200) fail(400, 'A nova senha precisa de pelo menos 12 caracteres.');
  const hash = await hmacHex(env.SESSION_SECRET, `pw:${next}`);
  await db.prepare('INSERT OR REPLACE INTO admin_auth(id,password_hmac,secret_check) VALUES(1,?,?)')
    .bind(hash, await hmacHex(env.SESSION_SECRET, 'auth-check')).run();
  const value = await createSession(sessionKey(env, hash));
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, value, SESSION_HOURS * 3600) });
}

async function isAdmin(request, env, db) {
  const key = sessionKey(env, await storedPassword(db, env));
  return verifySession(key, getCookie(request, SESSION_COOKIE));
}

// O token de backup só permite leitura de cópias: princípio do menor privilégio.
async function hasBackupToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.BACKUP_TOKEN || env.BACKUP_TOKEN.length < 24 || !auth.startsWith('Bearer ')) return false;
  return safeEqual(env.SESSION_SECRET || 'convite', auth.slice(7), env.BACKUP_TOKEN);
}

function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) fail(403, 'Origem não autorizada.');
}

// ---------- Encaminhamento ----------

async function adminRoutes(request, env, db, path, method) {
  if (path === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }
  if (path === 'password' && method === 'POST') return changePassword(request, env, db);
  if (path === 'all' && method === 'GET') return adminAll(db);
  if (path === 'settings' && method === 'PUT') return updateSettings(request, db);
  if (path === 'guests/import' && method === 'POST') return importGuests(request, db);
  if (path === 'export/guests.csv' && method === 'GET') return exportGuests(db);
  if (path === 'media' && method === 'POST') return createMedia(request, db);
  if (path === 'restore/begin' && method === 'POST') return restoreBegin(request, db);
  if (path === 'restore/apply' && method === 'POST') return restoreApply(request, db);

  let m;
  if ((m = /^restore\/table\/(\w+)$/.exec(path)) && method === 'POST') return restoreTable(request, db, m[1]);
  if ((m = /^media\/([a-f0-9]{32})\/(\d+)$/.exec(path)) && method === 'PUT') return putChunk(request, db, m[1], Number(m[2]));
  if ((m = /^media\/([a-f0-9]{32})$/.exec(path)) && method === 'DELETE') { await deleteMedia(db, m[1]); return json({ ok: true }); }

  if (path === 'gallery' && method === 'POST') {
    const b = await readJson(request, 500);
    if (!isMediaId(b.media_id)) fail(400, 'Foto inválida.');
    const order = await db.prepare('SELECT COALESCE(MAX(order_index),0)+1 n FROM gallery').first();
    const item = await db.prepare('INSERT INTO gallery(media_id,thumb_id,is_main,order_index) VALUES(?,?,0,?) RETURNING *')
      .bind(b.media_id, isMediaId(b.thumb_id) ? b.thumb_id : b.media_id, order.n).first();
    return json({ ok: true, item }, 201);
  }
  if ((m = /^gallery\/(\d+)$/.exec(path)) && method === 'DELETE') {
    const id = Number(m[1]);
    const row = await db.prepare('SELECT * FROM gallery WHERE id=?').bind(id).first();
    if (!row) fail(404, 'Foto não encontrada.');
    await db.prepare('DELETE FROM gallery WHERE id=?').bind(id).run();
    await deleteMedia(db, row.media_id, row.thumb_id);
    return json({ ok: true });
  }
  if ((m = /^gallery\/(\d+)\/main$/.exec(path)) && method === 'POST') {
    await db.batch([db.prepare('UPDATE gallery SET is_main=0'), db.prepare('UPDATE gallery SET is_main=1 WHERE id=?').bind(Number(m[1]))]);
    return json({ ok: true });
  }
  if ((m = /^gallery\/(\d+)\/move$/.exec(path)) && method === 'POST') return move(request, db, 'gallery', Number(m[1]));
  if ((m = /^guests\/(\d+)\/sent$/.exec(path)) && method === 'POST') return markSent(request, db, Number(m[1]));
  if ((m = /^gifts\/(\d+)\/reset$/.exec(path)) && method === 'POST') {
    await db.prepare('UPDATE gifts SET available=1, chosen_by=NULL WHERE id=?').bind(Number(m[1])).run();
    return json({ ok: true });
  }
  if ((m = /^(chapters|events|stores|gift-categories)\/(\d+)\/move$/.exec(path)) && method === 'POST') {
    return move(request, db, COLLECTIONS[m[1]].table, Number(m[2]));
  }
  if ((m = /^([a-z-]+)(?:\/(\d+))?$/.exec(path)) && Object.hasOwn(COLLECTIONS, m[1])) {
    const spec = COLLECTIONS[m[1]];
    if (!m[2] && method === 'POST') return collectionCreate(request, db, spec);
    if (m[2] && method === 'PUT') return collectionUpdate(request, db, spec, Number(m[2]));
    if (m[2] && method === 'DELETE') return collectionDelete(db, m[1], spec, Number(m[2]));
  }
  return fail(404, 'Não encontrado.');
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname: p } = url;
  const method = request.method;
  requestOrigin = url.origin;
  const db = env.DB || fail(500, 'Base de dados não configurada (ligação DB em falta).');
  await ensureSchema(db);

  if (method !== 'GET' && method !== 'HEAD') assertSameOrigin(request);

  if (p === '/' && method === 'GET') return renderInvite(request, env, db, '');
  let m;
  if ((m = /^\/c\/([\w-]{8,40})\/?$/.exec(p)) && method === 'GET') return renderInvite(request, env, db, m[1]);
  if ((m = /^\/guarde-a-data(?:\/([\w-]{8,40}))?\/?$/.exec(p)) && method === 'GET') return renderSaveDate(request, env, db, m[1] || '');
  if ((m = /^\/media\/([a-f0-9]{32})$/.exec(p)) && (method === 'GET' || method === 'HEAD')) return serveMedia(request, db, m[1], ctx);

  if (p === '/api/rsvp' && method === 'POST') return submitRsvp(request, env, db);
  if (p === '/api/mensagem' && method === 'POST') return submitMessage(request, env, db);
  if ((m = /^\/api\/presente\/(\d+)$/.exec(p)) && method === 'POST') return chooseGift(request, env, db, Number(m[1]));
  if (p === '/api/health' && method === 'GET') return json({ ok: true });

  if (p === '/api/admin/login' && method === 'POST') return login(request, env, db);
  if (p.startsWith('/api/admin/')) {
    const path = p.slice('/api/admin/'.length);
    const admin = await isAdmin(request, env, db);
    if (method === 'GET' && !admin && await hasBackupToken(request, env)) {
      if (path === 'backup/data') return backupData(db);
      if ((m = /^backup\/chunk\/([a-f0-9]{32})\/(\d+)$/.exec(path))) return backupChunk(db, m[1], Number(m[2]));
      fail(403, 'Sem permissão.');
    }
    if (!admin) fail(401, 'Sessão terminada. Entre novamente.');
    if (path === 'me' && method === 'GET') return json({ ok: true });
    if (path === 'backup/data' && method === 'GET') return backupData(db);
    if ((m = /^backup\/chunk\/([a-f0-9]{32})\/(\d+)$/.exec(path)) && method === 'GET') return backupChunk(db, m[1], Number(m[2]));
    return adminRoutes(request, env, db, path, method);
  }
  return fail(404, 'Não encontrado.');
}

export async function handle(request, env, ctx) {
  try {
    return withSecurity(await route(request, env, ctx));
  } catch (err) {
    if (err instanceof HttpError) return withSecurity(json({ error: err.message }, err.status));
    // Os detalhes ficam só no registo do servidor, nunca na resposta.
    console.error(err);
    return withSecurity(json({ error: 'Ocorreu um erro. Tente novamente.' }, 500));
  }
}
