// Testes sem dependências: node --test tests/
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/local.mjs';

const dir = mkdtempSync(join(tmpdir(), 'convite-'));
// Com TEST_BASE, os testes correm contra um servidor já ligado (ex.: wrangler pages dev) com base vazia.
const PASSWORD = process.env.TEST_PASSWORD || 'senha-de-teste-muito-longa';
const BACKUP_TOKEN = process.env.TEST_BACKUP_TOKEN || 'token-de-backup-de-teste-0123456789';
const env = { ADMIN_PASSWORD: PASSWORD, SESSION_SECRET: 'segredo-de-teste-0123456789', BACKUP_TOKEN };
let base;
let srv;
let cookie = '';

before(async () => {
  if (process.env.TEST_BASE) base = process.env.TEST_BASE;
  else {
    srv = await startServer({ port: 0, dbPath: join(dir, 't.db'), env });
    base = `http://127.0.0.1:${srv.server.address().port}`;
  }
  // A data predefinida pode já ter passado: os testes usam um prazo futuro.
  const r = await call('/api/admin/login', { body: { password: PASSWORD } });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  // A porta do Save the Date fica desligada aqui; tem o seu próprio teste.
  const s = await admin('settings', 'PUT', { rsvp_deadline: '2099-01-01', wedding_date: '2099-01-02', std_gate: '0' });
  assert.equal(s.status, 200);
});

after(async () => {
  if (srv) {
    srv.server.closeAllConnections();
    await new Promise((ok) => srv.server.close(ok));
    srv.db.close();
  }
  rmSync(dir, { recursive: true, force: true });
});

function call(path, { method, body, headers = {}, raw } = {}) {
  const opts = { method: method || (body || raw ? 'POST' : 'GET'), headers: { ...headers }, redirect: 'manual' };
  if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  if (raw) opts.body = raw;
  return fetch(base + path, opts);
}
const admin = (path, method = 'GET', body) => call(`/api/admin/${path}`, { method, body, headers: { Cookie: cookie } });
const adminJson = async (...a) => (await admin(...a)).json();
const boot = (html) => JSON.parse(/<script id="boot" type="application\/json">(.*?)<\/script>/s.exec(html)[1]);

test('página inicial: metadados, dados e cabeçalhos de segurança', async () => {
  const r = await call('/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<meta property="og:title" content="Convite de Casamento \| Nelde &amp; Nilton">/);
  assert.match(html, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/icons\/og\.jpg"/);
  assert.equal(boot(html).s.couple_display, 'Nelde & Nilton');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

test('estáticos, 404 e travessia de pastas', async () => {
  for (const p of ['/css/convite.css', '/js/convite.js', '/js/admin.js', '/admin/', '/sw.js', '/manifest.webmanifest', '/icons/og.jpg', '/fonts/jost.woff2']) {
    assert.equal((await call(p)).status, 200, p);
  }
  assert.equal((await call('/nao-existe')).status, 404);
  const trav = await call('/..%2f..%2fsrc%2fapp.js');
  assert.equal(trav.status, 404);
  assert.doesNotMatch(await trav.text(), /renderInvite/);
});

test('RSVP pelo link geral cria registo e valida dados', async () => {
  assert.equal((await call('/api/rsvp', { body: { nome: '', status: 'sim' } })).status, 400);
  assert.equal((await call('/api/rsvp', { body: { nome: 'Ana Silva', status: 'talvez' } })).status, 400);
  assert.equal((await call('/api/rsvp', { body: { nome: 'Ana Silva', status: 'sim', acompanhantes: 3 } })).status, 400);
  const ok = await (await call('/api/rsvp', { body: { nome: 'Ana Silva', status: 'sim' } })).json();
  assert.ok(ok.token);
  const { guests } = await adminJson('all');
  assert.equal(guests.find((g) => g.name === 'Ana Silva').status, 'sim');
});

test('campo isca não grava nada', async () => {
  const r = await call('/api/rsvp', { body: { nome: 'Robot', status: 'sim', website: 'spam.example' } });
  assert.equal(r.status, 200);
  const { guests } = await adminJson('all');
  assert.ok(!guests.some((g) => g.name === 'Robot'));
});

test('link pessoal: resposta, limite de acompanhantes e actualização', async () => {
  const { item } = await adminJson('guests', 'POST', { name: 'João Macuácua', max_companions: 2 });
  assert.equal(item.status, 'pendente');
  const page = boot(await (await call(`/c/${item.token}`)).text());
  assert.equal(page.guest.name, 'João Macuácua');
  assert.equal(page.guest.max_companions, 2);
  assert.equal(page.guest.admin_notes, undefined);

  const over = await call('/api/rsvp', { body: { token: item.token, status: 'sim', acompanhantes: 3 } });
  assert.equal(over.status, 400);
  const yes = await call('/api/rsvp', { body: { token: item.token, status: 'sim', acompanhantes: 2, nomes_acompanhantes: ['A', 'B', 'C'] } });
  assert.equal(yes.status, 200);
  let g = (await adminJson('all')).guests.find((x) => x.id === item.id);
  assert.equal(g.companions, 2);
  assert.deepEqual(JSON.parse(g.companion_names), ['A', 'B']);

  await call('/api/rsvp', { body: { token: item.token, status: 'nao', acompanhantes: 2 } });
  const all = await adminJson('all');
  g = all.guests.find((x) => x.id === item.id);
  assert.equal(g.status, 'nao');
  assert.equal(g.companions, 0);
  assert.equal(all.guests.filter((x) => x.name === 'João Macuácua').length, 1, 'não duplica');
});

test('token inválido devolve 404 sem dados de convidado', async () => {
  const r = await call('/c/inexistente123');
  assert.equal(r.status, 404);
  const data = boot(await r.text());
  assert.equal(data.guest, null);
  assert.equal(data.invalidToken, true);
  assert.equal((await call('/api/rsvp', { body: { token: 'inexistente123', status: 'sim' } })).status, 404);
});

test('prazo terminado bloqueia RSVP público', async () => {
  await admin('settings', 'PUT', { rsvp_deadline: '2020-01-01' });
  const r = await call('/api/rsvp', { body: { nome: 'Tardio Nome', status: 'sim' } });
  assert.equal(r.status, 403);
  await admin('settings', 'PUT', { rsvp_deadline: '2099-01-01' });
});

test('XSS: texto de convidado não fecha o bloco de dados', async () => {
  const evil = '</script><script>alert(1)</script>';
  await admin('messages', 'POST', { nome: 'Teste', mensagem: evil, aprovado: true });
  const html = await (await call('/')).text();
  assert.ok(!html.includes(evil));
  assert.ok(boot(html).messages.some((m) => m.mensagem === evil));
});

test('SQL injection é tratada como texto', async () => {
  const name = "Robert'); DROP TABLE guests;--";
  assert.equal((await call('/api/rsvp', { body: { nome: name, status: 'nao' } })).status, 200);
  const { guests } = await adminJson('all');
  assert.ok(guests.some((g) => g.name === name));
});

test('mensagens só aparecem depois de aprovadas', async () => {
  await call('/api/mensagem', { body: { nome: 'Rita', mensagem: 'Parabéns aos dois' } });
  let page = boot(await (await call('/')).text());
  assert.ok(!page.messages.some((m) => m.mensagem === 'Parabéns aos dois'));
  const msg = (await adminJson('all')).messages.find((m) => m.mensagem === 'Parabéns aos dois');
  await admin(`messages/${msg.id}`, 'PUT', { ...msg, aprovado: 1 });
  page = boot(await (await call('/')).text());
  assert.ok(page.messages.some((m) => m.mensagem === 'Parabéns aos dois'));
});

test('presentes: escolha única, regra por convidado e privacidade', async () => {
  const { categories } = await adminJson('all');
  const a = (await adminJson('gifts', 'POST', { name: 'Tacho', category_id: categories[0].id })).item;
  const b = (await adminJson('gifts', 'POST', { name: 'Copos', category_id: categories[0].id })).item;
  const one = (await adminJson('guests', 'POST', { name: 'Pessoa Um' })).item;
  const two = (await adminJson('guests', 'POST', { name: 'Pessoa Dois' })).item;
  // Sem link pessoal não se escolhe: ninguém esgota a lista com nomes inventados.
  assert.equal((await call(`/api/presente/${a.id}`, { body: { nome: 'Alguém' } })).status, 403);
  assert.equal((await call(`/api/presente/${a.id}`, { body: { token: 'inexistente123' } })).status, 403);
  const [r1, r2] = await Promise.all([
    call(`/api/presente/${a.id}`, { body: { token: one.token } }),
    call(`/api/presente/${a.id}`, { body: { token: two.token } }),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const winner = r1.status === 200 ? one : two;
  assert.equal((await call(`/api/presente/${b.id}`, { body: { token: winner.token } })).status, 409);
  const html = await (await call('/')).text();
  assert.ok(!html.includes(winner.name), 'quem escolheu não é público');
  const chosen = (await adminJson('all')).gifts.find((g) => g.id === a.id);
  assert.equal(chosen.chosen_by, winner.name);
  for (const g of [one, two]) await admin(`guests/${g.id}`, 'DELETE');
});

test('autenticação: rotas protegidas, sessão falsa e origem externa', async () => {
  assert.equal((await call('/api/admin/all')).status, 401);
  assert.equal((await call('/api/admin/export/guests.csv')).status, 401);
  assert.equal((await call('/api/admin/all', { headers: { Cookie: 'convite_admin=9999999999999.abc' } })).status, 401);
  const expired = await call('/api/admin/all', { headers: { Cookie: 'convite_admin=1000.abc' } });
  assert.equal(expired.status, 401);
  const cross = await call('/api/admin/settings', { method: 'PUT', body: { site_title: 'x' }, headers: { Cookie: cookie, Origin: 'https://atacante.example' } });
  assert.equal(cross.status, 403);
  const page = await call('/');
  assert.equal(page.headers.get('set-cookie'), null);
});

test('cookie de sessão tem HttpOnly e SameSite', async () => {
  const r = await admin('logout', 'POST', {});
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
});

test('definições: lista branca e validação', async () => {
  await admin('settings', 'PUT', { chave_inventada: 'x' });
  assert.equal((await adminJson('all')).settings.chave_inventada, undefined);
  assert.equal((await admin('settings', 'PUT', { color_primary: 'red;}body{display:none' })).status, 400);
  assert.equal((await admin('settings', 'PUT', { font_titles: "x';}" })).status, 400);
  const saved = await adminJson('settings', 'PUT', { footer_instagram: 'javascript:alert(1)' });
  assert.equal(saved.settings.footer_instagram, '');
});

test('secções: esconder e renomear a partir das definições', async () => {
  await admin('settings', 'PUT', { show_gallery: '0', program_title: 'O Grande Dia', show_rsvp: 'lixo' });
  const page = boot(await (await call('/')).text());
  assert.equal(page.s.show_gallery, '0');
  assert.equal(page.s.program_title, 'O Grande Dia');
  assert.equal(page.s.show_rsvp, '0');
  await admin('settings', 'PUT', { show_gallery: '1', show_rsvp: '1', program_title: 'Programa' });
});

test('senha: mudar no painel, senha antiga e sessões antigas deixam de valer', async () => {
  const novo = 'nova-senha-do-administrador';
  assert.equal((await admin('password', 'POST', { current: 'errada', next: novo })).status, 401);
  assert.equal((await admin('password', 'POST', { current: PASSWORD, next: 'curta' })).status, 400);
  const oldCookie = cookie;
  const ok = await admin('password', 'POST', { current: PASSWORD, next: novo });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/admin/me', { headers: { Cookie: oldCookie } })).status, 401);
  assert.equal((await admin('me')).status, 200);
  assert.equal((await call('/api/admin/login', { body: { password: PASSWORD } })).status, 401);
  assert.equal((await call('/api/admin/login', { body: { password: novo } })).status, 200);
  const data = await (await admin('backup/data')).json();
  assert.ok(!JSON.stringify(data).includes('password_hmac'), 'a senha não entra nas cópias');
  assert.ok(!(await (await call('/')).text()).includes('password_hmac'));
});

test('senha esquecida: mudar SESSION_SECRET repõe ADMIN_PASSWORD', async () => {
  const path = join(dir, 'rec.db');
  const start = (secret) => startServer({ port: 0, dbPath: path, env: { ...env, SESSION_SECRET: secret } });
  const stop = async (s) => { s.server.closeAllConnections(); await new Promise((ok) => s.server.close(ok)); s.db.close(); };
  const login = (s, password) => fetch(`http://127.0.0.1:${s.server.address().port}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  let s = await start('segredo-um-0123456789');
  const c = (await login(s, env.ADMIN_PASSWORD)).headers.get('set-cookie').split(';')[0];
  await fetch(`http://127.0.0.1:${s.server.address().port}/api/admin/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ current: env.ADMIN_PASSWORD, next: 'senha-que-vou-esquecer' }) });
  assert.equal((await login(s, env.ADMIN_PASSWORD)).status, 401);
  await stop(s);
  s = await start('segredo-dois-0123456789');
  assert.equal((await login(s, env.ADMIN_PASSWORD)).status, 200);
  await stop(s);
});

test('endereço de mapa javascript: é rejeitado', async () => {
  const { item } = await adminJson('events', 'POST', { title: 'Teste', map_url: 'javascript:alert(1)' });
  assert.equal(item.map_url, '');
  await admin(`events/${item.id}`, 'DELETE');
});

test('ordenar programa', async () => {
  const before = (await adminJson('all')).events.map((e) => e.id);
  await admin(`events/${before[1]}/move`, 'POST', { direction: 'up' });
  const after = (await adminJson('all')).events.map((e) => e.id);
  assert.deepEqual(after.slice(0, 2), [before[1], before[0]]);
  await admin(`events/${before[1]}/move`, 'POST', { direction: 'down' });
});

async function upload(bytes, mime = 'image/jpeg') {
  const meta = await adminJson('media', 'POST', { mime, name: 'f', size: bytes.length });
  for (let i = 0; i < meta.chunks; i++) {
    const r = await call(`/api/admin/media/${meta.id}/${i}`, { method: 'PUT', raw: bytes.subarray(i * meta.chunk_size, (i + 1) * meta.chunk_size), headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
  }
  return meta.id;
}

test('ficheiros: tipo, divisão em blocos, Range (iPhone) e eliminação', async () => {
  assert.equal((await admin('media', 'POST', { mime: 'text/html', name: 'x', size: 10 })).status, 400);
  assert.equal((await admin('media', 'POST', { mime: 'image/jpeg', name: 'x', size: 99_000_000 })).status, 413);
  const bytes = new Uint8Array(2_000_000).map((_, i) => i % 251);
  const id = await upload(bytes, 'audio/mpeg');
  const full = await call(`/media/${id}`);
  assert.equal(full.status, 200);
  assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);
  assert.match(full.headers.get('cache-control'), /immutable/);
  const part = await call(`/media/${id}`, { headers: { Range: 'bytes=899990-900009' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 899990-900009/2000000');
  assert.deepEqual(new Uint8Array(await part.arrayBuffer()), bytes.slice(899990, 900010));
  assert.equal((await call(`/media/${id}`, { headers: { Range: 'bytes=9999999-' } })).status, 416);
  assert.equal((await admin(`media/${id}`, 'DELETE')).status, 200);
  assert.equal((await call(`/media/${id}`)).status, 404);
});

test('galeria e substituição de imagem apagam o ficheiro antigo', async () => {
  const one = await upload(new Uint8Array(1000).fill(1));
  await admin('settings', 'PUT', { cover_image: one });
  const html = await (await call('/')).text();
  assert.ok(html.includes(`/media/${one}`));
  const two = await upload(new Uint8Array(1000).fill(2));
  await admin('settings', 'PUT', { cover_image: two });
  assert.equal((await call(`/media/${one}`)).status, 404);

  const photo = await upload(new Uint8Array(500).fill(3));
  const { item } = await adminJson('gallery', 'POST', { media_id: photo });
  assert.ok(boot(await (await call('/')).text()).gallery.some((g) => g.id === item.id));
  await admin(`gallery/${item.id}`, 'DELETE');
  assert.equal((await call(`/media/${photo}`)).status, 404);
});

test('carta: mensagem pessoal só no link do próprio convidado', async () => {
  const text = 'Mensagem-privada-da-tia <b>Ana</b>';
  const { item } = await adminJson('guests', 'POST', { name: 'Tia Ana', salutation: 'Querida tia Ana,', personal_message: text });
  const own = boot(await (await call(`/c/${item.token}`)).text());
  assert.equal(own.guest.salutation, 'Querida tia Ana,');
  assert.equal(own.guest.personal_message, text);
  assert.ok(!(await (await call('/')).text()).includes('Mensagem-privada-da-tia'));
  const { item: other } = await adminJson('guests', 'POST', { name: 'Outro Convidado' });
  assert.ok(!(await (await call(`/c/${other.token}`)).text()).includes('Mensagem-privada-da-tia'));
  assert.equal(boot(await (await call('/')).text()).s.show_letter, '1');
  await admin(`guests/${other.id}`, 'DELETE');
  await admin(`guests/${item.id}`, 'DELETE');
});

test('capítulos: público, ordem, protecção e ficheiro antigo', async () => {
  assert.equal((await call('/api/admin/chapters', { body: { title: 'x' } })).status, 401);
  assert.equal((await admin('chapters', 'POST', { title: '' })).status, 400);
  const one = await upload(new Uint8Array(800).fill(4));
  const a = (await adminJson('chapters', 'POST', { label: 'Um', title: 'Primeiro', text: 'Texto', image: one })).item;
  const b = (await adminJson('chapters', 'POST', { title: 'Segundo' })).item;
  assert.deepEqual(boot(await (await call('/')).text()).chapters.map((c) => c.id), [a.id, b.id]);
  await admin(`chapters/${b.id}/move`, 'POST', { direction: 'up' });
  assert.deepEqual((await adminJson('all')).chapters.map((c) => c.id), [b.id, a.id]);
  const two = await upload(new Uint8Array(800).fill(5));
  await admin(`chapters/${a.id}`, 'PUT', { ...a, image: two });
  assert.equal((await call(`/media/${one}`)).status, 404);
  const backup = await (await admin('backup/data')).json();
  assert.equal(backup.tables.chapters.length, 2);
  await admin(`chapters/${a.id}`, 'DELETE');
  await admin(`chapters/${b.id}`, 'DELETE');
  assert.equal((await call(`/media/${two}`)).status, 404);
});

test('Save the Date: link geral e pessoal sem dados a mais', async () => {
  const { item } = await adminJson('guests', 'POST', { name: 'Tia Ana', phone: '+258840000001', notes: 'Nota-privada', admin_notes: 'Interna-privada', personal_message: 'Carta-privada' });
  const general = await call('/guarde-a-data');
  assert.equal(general.status, 200);
  assert.match(general.headers.get('content-security-policy'), /script-src 'self'/);
  const generalHtml = await general.text();
  assert.match(generalHtml, /guarde-a-data\.js/);
  assert.equal(boot(generalHtml).guest, null);
  const page = await call(`/guarde-a-data/${item.token}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  const data = boot(html);
  assert.deepEqual(data.guest, { name: 'Tia Ana', cover_line: '', salutation: '' });
  assert.equal(data.s.wedding_date, '2099-01-02');
  assert.equal(data.events, undefined);
  assert.equal(data.s.mpesa_number, undefined);
  assert.equal(data.s.wedding_time, '11:00', 'conta até à mesma hora do convite');
  assert.equal(data.s.std_button, 'Aceito reservar este dia');
  assert.equal(data.s.color_std_bg, '#123f31');
  for (const secret of ['+258840000001', 'Nota-privada', 'Interna-privada', 'Carta-privada']) assert.ok(!html.includes(secret), secret);
  assert.match(html, /name="robots" content="noindex"/);

  const invalid = await call('/guarde-a-data/inexistente123');
  assert.equal(invalid.status, 404);
  assert.equal(boot(await invalid.text()).guest, null);

  const one = await upload(new Uint8Array(600).fill(6));
  await admin('settings', 'PUT', { std_photo: one });
  assert.equal(boot(await (await call('/guarde-a-data')).text()).s.std_photo, one);
  await admin('settings', 'PUT', { std_photo: '' });
  assert.equal((await call(`/media/${one}`)).status, 404);

  const clip = await upload(new Uint8Array(2_000_000).map((_, i) => i % 251), 'video/mp4');
  await admin('settings', 'PUT', { std_video: clip });
  assert.equal(boot(await (await call('/guarde-a-data')).text()).s.std_video, clip);
  const part = await call(`/media/${clip}`, { headers: { Range: 'bytes=899990-900009' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-type'), 'video/mp4');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], Array.from({ length: 20 }, (_, i) => (899990 + i) % 251));
  // Pedido aberto: no máximo dois blocos de cada vez, e o resto chega em pedidos seguintes.
  const open = await call(`/media/${clip}`, { headers: { Range: 'bytes=0-' } });
  assert.equal(open.status, 206);
  const firstPart = new Uint8Array(await open.arrayBuffer());
  assert.equal(open.headers.get('content-range'), `bytes 0-1799999/2000000`);
  const rest = await call(`/media/${clip}`, { headers: { Range: `bytes=${firstPart.length}-` } });
  assert.equal(rest.status, 206);
  const joined = new Uint8Array([...firstPart, ...new Uint8Array(await rest.arrayBuffer())]);
  assert.equal(joined.length, 2_000_000);
  assert.ok(joined.every((b, i) => b === i % 251));
  await admin('settings', 'PUT', { std_video: '' });
  assert.equal((await call(`/media/${clip}`)).status, 404);
  assert.equal((await admin('media', 'POST', { mime: 'video/quicktime', name: 'a.mov', size: 10 })).status, 400);

  await admin('settings', 'PUT', { show_savedate: '0' });
  const off = await call(`/guarde-a-data/${item.token}`);
  assert.equal(off.status, 302);
  assert.equal(off.headers.get('location'), `/c/${item.token}`);
  await admin('settings', 'PUT', { show_savedate: '1' });
  await admin(`guests/${item.id}`, 'DELETE');
});

test('porta do Save the Date: o convite só abre depois de aceitar reservar o dia', async () => {
  const { item } = await adminJson('guests', 'POST', { name: 'Prima Rosa' });
  await admin('settings', 'PUT', { std_gate: '1' });
  try {
    const closed = await call(`/c/${item.token}`);
    assert.equal(closed.status, 302);
    assert.equal(closed.headers.get('location'), `/guarde-a-data/${item.token}`);
    const general = await call('/');
    assert.equal(general.status, 302);
    assert.equal(general.headers.get('location'), '/guarde-a-data');
    assert.equal((await call('/c/inexistente123')).status, 404, 'link inválido continua a dar 404');

    assert.equal((await call('/api/aceitar', { body: { token: 'inexistente123' } })).status, 404);
    const ok = await call('/api/aceitar', { body: { token: item.token } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).next, `/c/${item.token}`);
    assert.match(ok.headers.get('set-cookie'), /^data_reservada=1; Path=\/; SameSite=Lax/);

    // Aceite no servidor: o link pessoal abre noutro telemóvel, sem o cookie.
    assert.equal((await call(`/c/${item.token}`)).status, 200);
    // O link geral abre com o cookie de quem aceitou.
    assert.equal((await call('/', { headers: { Cookie: 'data_reservada=1' } })).status, 200);

    const first = (await adminJson('all')).guests.find((g) => g.id === item.id).std_accepted_at;
    assert.ok(first);
    await call('/api/aceitar', { body: { token: item.token } });
    assert.equal((await adminJson('all')).guests.find((g) => g.id === item.id).std_accepted_at, first, 'guarda a primeira hora');

    await admin('settings', 'PUT', { show_savedate: '0' });
    assert.equal((await call('/')).status, 200, 'sem Save the Date, não há porta');
  } finally {
    await admin('settings', 'PUT', { std_gate: '0', show_savedate: '1' });
  }
});

test('modelos: texto por relação, sem expor os outros níveis', async () => {
  const { item: a } = await adminJson('guests', 'POST', { name: 'Ana Sitoe', group_name: 'família próxima' });
  const { item: b } = await adminJson('guests', 'POST', { name: 'Bruno Cossa', group_name: 'Colegas', personal_message: 'Mensagem-do-Bruno' });
  const { item: c } = await adminJson('guests', 'POST', { name: 'Carla Mondlane', group_name: 'Desconhecida' });
  const pa = boot(await (await call(`/c/${a.token}`)).text());
  assert.equal(pa.guest.cover_line, 'Para a nossa família');
  assert.equal(pa.guest.salutation, 'Querido(a) Ana,');
  assert.match(pa.guest.personal_message, /^Crescemos/);
  const htmlB = await (await call(`/c/${b.token}`)).text();
  const pb = boot(htmlB);
  assert.equal(pb.guest.cover_line, 'Com estima');
  assert.equal(pb.guest.personal_message, 'Mensagem-do-Bruno');
  assert.equal(pb.s.relation_templates, undefined);
  assert.ok(!htmlB.includes('Crescemos'), 'outros níveis não saem para o público');
  assert.equal(boot(await (await call(`/c/${c.token}`)).text()).guest.cover_line, '');
  assert.equal(boot(await (await call(`/guarde-a-data/${a.token}`)).text()).guest.cover_line, 'Para a nossa família');
  assert.equal(boot(await (await call('/')).text()).s.relation_templates, undefined);
  assert.equal((await admin('settings', 'PUT', { relation_templates: 'nao-json' })).status, 400);
  assert.equal((await admin('settings', 'PUT', { relation_templates: '[]' })).status, 400);
  for (const g of [a, b, c]) await admin(`guests/${g.id}`, 'DELETE');
});

test('importar de novo actualiza a mesma pessoa e mantém o link', async () => {
  const first = await adminJson('guests/import', 'POST', { rows: [
    { name: 'Dina Excel', phone: '+258841110001', group_name: 'Amigos', max_companions: 1 },
    { name: 'Eva Excel', phone: '', group_name: 'Colegas' },
    { name: 'Fred Excel', phone: '+258841110003' },
    { name: 'Fred Excel', phone: '+258841110004' },
  ] });
  assert.deepEqual([first.imported, first.updated], [4, 0]);
  const list = () => adminJson('all').then((d) => d.guests.filter((g) => g.name.endsWith('Excel') || g.name === 'Dina Nova'));
  const dina = (await list()).find((g) => g.name === 'Dina Excel');
  await call('/api/rsvp', { body: { token: dina.token, status: 'sim', acompanhantes: 1 } });
  const second = await adminJson('guests/import', 'POST', { rows: [
    { name: 'Dina Nova', phone: '841110001', group_name: 'Amigos próximos', max_companions: 2, personal_message: 'Nova carta' },
    { name: 'Eva Excel', phone: '+258841110002', group_name: 'Colegas' },
    { name: 'Fred Excel', phone: '+258841110005' },
  ] });
  assert.deepEqual([second.imported, second.updated], [1, 2]);
  const after = await list();
  const dina2 = after.find((g) => g.token === dina.token);
  assert.equal(dina2.name, 'Dina Nova');
  assert.equal(dina2.group_name, 'Amigos próximos');
  assert.equal(dina2.status, 'sim');
  assert.equal(dina2.personal_message, 'Nova carta');
  assert.equal(after.find((g) => g.name === 'Eva Excel').phone, '+258841110002');
  assert.equal(after.filter((g) => g.name === 'Fred Excel').length, 3);
  for (const g of after) await admin(`guests/${g.id}`, 'DELETE');
});

test('importar: família com o mesmo telefone, acompanhantes em branco', async () => {
  const first = await adminJson('guests/import', 'POST', { rows: [
    { name: 'João Família', phone: '+258842220001', max_companions: 2 },
    { name: 'Maria Família', phone: '+258842220001', max_companions: 1 },
    { name: 'João Família', phone: '+258842220001', max_companions: 2 },
  ] });
  assert.deepEqual([first.imported, first.updated], [2, 0], 'casal com o mesmo número fica como duas pessoas; linha repetida ignorada');
  const before = (await adminJson('all')).guests.filter((g) => g.name.endsWith('Família'));
  const second = await adminJson('guests/import', 'POST', { rows: [
    { name: 'Maria Família', phone: '842220001', max_companions: null, group_name: 'Família' },
    { name: 'João Família', phone: '842220001', max_companions: '' },
  ] });
  assert.deepEqual([second.imported, second.updated], [0, 2]);
  const after = (await adminJson('all')).guests.filter((g) => g.name.endsWith('Família'));
  for (const g of before) {
    const now = after.find((x) => x.id === g.id);
    assert.equal(now.name, g.name, 'cada um continua com o seu link');
    assert.equal(now.max_companions, g.max_companions, 'acompanhantes em branco não apagam o valor');
  }
  const page = boot(await (await call(`/c/${before[0].token}`)).text());
  assert.equal(page.guest.phone, undefined, 'o telefone não sai no link pessoal');
  assert.equal(page.guest.phone_hint, '001');
  for (const g of after) await admin(`guests/${g.id}`, 'DELETE');
});

test('restauro de uma só vez: falha não apaga nada e ficheiros perigosos são recusados', async () => {
  const before = await adminJson('all');
  const data = await (await admin('backup/data')).json();
  // Dois convidados com o mesmo código: a base recusa, o lote inteiro falha e os dados actuais ficam.
  const twin = { token: 'tokenrepetido1', status: 'pendente', created_at: '2026-01-01' };
  const broken = { ...data.tables, guests: [...data.tables.guests, { ...twin, id: 999998, name: 'Gémeo A' }, { ...twin, id: 999999, name: 'Gémeo B' }] };
  assert.equal((await admin('restore/apply', 'POST', { confirm: 'RESTAURAR', tables: broken })).status, 500);
  assert.equal((await adminJson('all')).guests.length, before.guests.length);
  assert.equal((await admin('restore/apply', 'POST', { confirm: 'nao', tables: data.tables })).status, 400);
  assert.equal((await admin('restore/apply', 'POST', { confirm: 'RESTAURAR', tables: { users: [] } })).status, 400);
  // Cópia com um "ficheiro" HTML: é ignorado, o resto restaura.
  const evil = { ...data.tables, media: [...data.tables.media, { id: 'f'.repeat(32), mime: 'text/html', name: 'x', size: 10, chunks: 1, chunk_size: 10, created_at: '' }] };
  assert.equal((await admin('restore/apply', 'POST', { confirm: 'RESTAURAR', tables: evil })).status, 200);
  assert.equal((await call(`/media/${'f'.repeat(32)}`)).status, 404);
  const after = await adminJson('all');
  assert.equal(after.guests.length, before.guests.length);
  assert.deepEqual(after.settings, before.settings);
});

test('envio: registar e desmarcar, só com sessão', async () => {
  const { item } = await adminJson('guests', 'POST', { name: 'Gil Envio' });
  assert.equal((await call(`/api/admin/guests/${item.id}/sent`, { body: { kind: 'invite' } })).status, 401);
  assert.equal((await admin(`guests/${item.id}/sent`, 'POST', { kind: 'outro' })).status, 400);
  assert.equal((await admin('guests/999999/sent', 'POST', { kind: 'invite' })).status, 404);
  assert.equal((await admin(`guests/${item.id}/sent`, 'POST', { kind: 'savedate' })).status, 200);
  const sent = (await adminJson('all')).guests.find((g) => g.id === item.id);
  assert.ok(sent.savedate_sent_at);
  assert.equal(sent.invite_sent_at, null);
  await admin(`guests/${item.id}/sent`, 'POST', { kind: 'savedate', undo: true });
  assert.equal((await adminJson('all')).guests.find((g) => g.id === item.id).savedate_sent_at, null);
  assert.ok(!(await (await call(`/c/${item.token}`)).text()).includes('sent_at'));
  await admin(`guests/${item.id}`, 'DELETE');
});

test('migração: base da versão anterior ganha as colunas e mantém os dados', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'v2-'));
  const path = join(folder, 'v2.db');
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE guests (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT DEFAULT '', group_name TEXT DEFAULT '', max_companions INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pendente', companions INTEGER DEFAULT 0, companion_names TEXT DEFAULT '[]', notes TEXT DEFAULT '', admin_notes TEXT DEFAULT '', source TEXT DEFAULT 'lista', responded_at TEXT, created_at TEXT NOT NULL);
    INSERT INTO settings VALUES('schema_version','2'),('couple_display','Casal Antigo');
    INSERT INTO guests(token,name,created_at) VALUES('token-antigo-123','Convidado Antigo','2026-01-01');`);
  old.close();
  const other = await startServer({ port: 0, dbPath: path, env });
  try {
    const page = boot(await (await fetch(`http://127.0.0.1:${other.server.address().port}/c/token-antigo-123`, { headers: { Cookie: 'data_reservada=1' } })).text());
    assert.equal(page.guest.name, 'Convidado Antigo');
    assert.equal(page.guest.personal_message, '');
    assert.equal(page.s.couple_display, 'Casal Antigo');
    assert.deepEqual(page.chapters, []);
    assert.equal(page.s.show_letter, '1');
  } finally {
    other.server.closeAllConnections();
    await new Promise((ok) => other.server.close(ok));
    other.db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('importação e exportação CSV (Excel e fórmulas)', async () => {
  const r = await adminJson('guests/import', 'POST', { rows: [{ name: 'Maria Sitoe', phone: '+258840000000', group_name: 'Amigos', max_companions: 1 }, { name: '=HYPERLINK("http://x")', max_companions: 0 }, { name: '' }] });
  assert.equal(r.imported, 2);
  const csv = await admin('export/guests.csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await csv.arrayBuffer());
  assert.equal(text.charCodeAt(0), 0xFEFF);
  assert.ok(text.includes('Maria Sitoe'));
  assert.ok(text.includes(`"'=HYPERLINK`));
});

test('estatísticas: confirmados, acompanhantes e pendentes', async () => {
  const { stats, guests } = await adminJson('all');
  assert.equal(stats.total, guests.length);
  assert.equal(stats.sim + stats.nao + stats.pendente, stats.total);
  assert.equal(stats.pessoas, stats.sim + stats.acompanhantes);
});

test('token de backup só lê cópias', async () => {
  const auth = { Authorization: `Bearer ${BACKUP_TOKEN}` };
  assert.equal((await call('/api/admin/backup/data', { headers: auth })).status, 200);
  assert.equal((await call('/api/admin/all', { headers: auth })).status, 403);
  assert.equal((await call('/api/admin/settings', { method: 'PUT', body: {}, headers: auth })).status, 401);
  assert.equal((await call('/api/admin/backup/data', { headers: { Authorization: 'Bearer errado' } })).status, 401);
});

test('backup por script e recuperação numa base nova, com ficheiros idênticos', async () => {
  const bytes = new Uint8Array(1_500_000).map((_, i) => (i * 7) % 256);
  const id = await upload(bytes, 'audio/mpeg');
  await admin('settings', 'PUT', { music_file: id, music_enabled: '1' });
  const before = await adminJson('all');

  const script = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
  const out = join(dir, 'bk');
  // Assíncrono: o servidor corre neste processo e tem de continuar a responder ao script.
  const { stdout: log } = await promisify(execFile)(process.execPath, ['--no-warnings', script('backup.mjs'), base, out], { env: { ...process.env, BACKUP_TOKEN }, encoding: 'utf8' });
  const file = /Cópia criada: (.+)/.exec(log)[1].trim();

  const newDb = join(dir, 'novo.db');
  execFileSync(process.execPath, ['--no-warnings', script('restore.mjs'), file, newDb], { encoding: 'utf8' });
  const other = await startServer({ port: 0, dbPath: newDb, env });
  try {
    const url = `http://127.0.0.1:${other.server.address().port}`;
    const login = await fetch(`${url}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
    const c = login.headers.get('set-cookie').split(';')[0];
    const after = await (await fetch(`${url}/api/admin/all`, { headers: { Cookie: c } })).json();
    assert.deepEqual(after.guests, before.guests);
    assert.deepEqual(after.settings, before.settings);
    assert.deepEqual(after.gifts, before.gifts);
    const media = new Uint8Array(await (await fetch(`${url}/media/${id}`)).arrayBuffer());
    assert.deepEqual(media, bytes);
  } finally {
    other.server.closeAllConnections();
    await new Promise((ok) => other.server.close(ok));
    other.db.close();
  }
});

test('restauro pela API (o mesmo caminho do painel)', async () => {
  const data = await (await admin('backup/data')).json();
  const before = (await adminJson('all')).guests.length;
  assert.equal((await admin('restore/begin', 'POST', { confirm: 'nao' })).status, 400);
  assert.equal((await admin('restore/begin', 'POST', { confirm: 'RESTAURAR' })).status, 200);
  assert.equal((await adminJson('all')).guests.length, 0);
  for (const [t, rows] of Object.entries(data.tables)) {
    if (rows.length) assert.equal((await admin(`restore/table/${t}`, 'POST', { rows })).status, 200, t);
  }
  assert.equal((await adminJson('all')).guests.length, before);
  assert.equal((await admin('restore/table/users', 'POST', { rows: [] })).status, 404);
});

test('migração da base Flask antiga', async () => {
  const old = mkdtempSync(join(tmpdir(), 'flask-'));
  const db = new DatabaseSync(join(old, 'database.db'));
  db.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE events(id INTEGER PRIMARY KEY,time TEXT,title TEXT,location TEXT,description TEXT,map_url TEXT,order_index INT);
    CREATE TABLE rsvps(id INTEGER PRIMARY KEY,nome TEXT,telefone TEXT,status TEXT,data_confirmacao TEXT,observacao TEXT);
    CREATE TABLE messages(id INTEGER PRIMARY KEY,nome TEXT,relacao TEXT,mensagem TEXT,aprovado INT,oculto INT,data_criacao TEXT);
    CREATE TABLE gallery(id INTEGER PRIMARY KEY,filename TEXT,is_main INT,order_index INT);
    CREATE TABLE gift_categories(id INTEGER PRIMARY KEY,name TEXT,image TEXT,order_index INT);
    CREATE TABLE gifts(id INTEGER PRIMARY KEY,category_id INT,name TEXT,description TEXT,image TEXT,available INT,chosen_by TEXT);
    CREATE TABLE stores(id INTEGER PRIMARY KEY,name TEXT,description TEXT,address TEXT,image TEXT,phone TEXT,whatsapp TEXT,map_url TEXT,order_index INT);
    INSERT INTO settings VALUES('couple_display','Casal Antigo'),('color_primary','#000000'),('cover_image','apagada.jpg');
    INSERT INTO rsvps VALUES(1,'Carla','840','sim','2026-05-01 10:00:00','olá');
    INSERT INTO messages VALUES(1,'Rui','Amigo','Parabéns',1,0,'2026-05-02');
    INSERT INTO gallery VALUES(1,'f.jpg',1,1);`);
  db.close();
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(old, 'static/images/gallery'), { recursive: true });
  writeFileSync(join(old, 'static/images/gallery/f.jpg'), Buffer.alloc(2000, 9));
  const script = fileURLToPath(new URL('../scripts/import-flask.mjs', import.meta.url));
  const out = join(dir, 'migrado.json');
  const log = execFileSync(process.execPath, ['--no-warnings', script, old, out], { encoding: 'utf8' });
  assert.match(log, /apagada\.jpg/);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  const get = (k) => data.tables.settings.find((r) => r.key === k).value;
  assert.equal(get('couple_display'), 'Casal Antigo');
  assert.notEqual(get('color_primary'), '#000000');
  assert.equal(data.tables.guests[0].name, 'Carla');
  assert.equal(data.tables.gallery[0].media_id, data.tables.media[0].id);
  assert.equal(Buffer.from(data.files[0].data, 'base64').length, 2000);
  rmSync(old, { recursive: true, force: true });
});

test('limite de pedidos: login bloqueia força bruta (último teste de login)', async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await call('/api/admin/login', { body: { password: 'errada' } });
  assert.equal(last.status, 429);
});

test('limite de pedidos: mensagens', async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await call('/api/mensagem', { body: { nome: 'Spam Bot', mensagem: `m${i}` } });
  assert.equal(last.status, 429);
});
