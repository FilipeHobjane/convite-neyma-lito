// Servidor sem dependências para correr o convite no computador ou em qualquer servidor Node 22.5+.
// Uso: node server/local.mjs   (lê a configuração de .env, se existir)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../src/app.js';
import { SECURITY_HEADERS } from '../src/http.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function loadEnv() {
  const file = join(ROOT, process.env.ENV_FILE || '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// Mesma interface do D1, sobre o SQLite incluído no Node.
function d1Compatible(path) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode=WAL');
  const clean = (args) => args.map((a) => (a === undefined ? null : a instanceof ArrayBuffer ? new Uint8Array(a) : a));
  const wrap = (sql, args = []) => ({
    bind: (...values) => wrap(sql, values),
    first: async () => sqlite.prepare(sql).get(...clean(args)) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...clean(args)) }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...clean(args));
      return { meta: { changes: Number(r.changes) } };
    },
    exec_: () => {
      const st = sqlite.prepare(sql);
      return st.columns().length ? { results: st.all(...clean(args)) } : (st.run(...clean(args)), { results: [] });
    },
  });
  return {
    prepare: (sql) => wrap(sql),
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((s) => s.exec_());
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    close: () => sqlite.close(),
  };
}

async function staticFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(PUBLIC, rel));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) return null;
  const info = await stat(file).catch(() => null);
  if (!info) return null;
  if (info.isDirectory()) return staticFile(`${pathname}/`);
  return { body: await readFile(file), type: TYPES[extname(file).toLowerCase()] || 'application/octet-stream' };
}

const isDynamic = (p) => p === '/' || p.startsWith('/c/') || p.startsWith('/api/') || p.startsWith('/media/');

export function startServer({ port, dbPath, env }) {
  const db = d1Compatible(dbPath);
  const assets = {
    fetch: async (url) => {
      const f = await staticFile(new URL(url).pathname);
      return f ? new Response(f.body, { headers: { 'Content-Type': f.type } }) : new Response('Não encontrado', { status: 404 });
    },
  };
  const fullEnv = { ...env, DB: db, ASSETS: assets };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (!isDynamic(url.pathname)) {
        const f = await staticFile(url.pathname) || { ...(await staticFile('/404.html')), missing: true };
        const headers = { ...SECURITY_HEADERS, 'Content-Type': f.type, 'Cache-Control': 'no-cache' };
        delete headers['Strict-Transport-Security'];
        res.writeHead(f.missing ? 404 : 200, headers);
        res.end(f.body);
        return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      // Substitui o cabeçalho enviado pelo cliente para o limite de pedidos não poder ser contornado.
      headers.set('CF-Connecting-IP', env.TRUST_PROXY === '1' ? (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress : req.socket.remoteAddress);
      const response = await handle(new Request(url, {
        method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
      }), fullEnv, { waitUntil() {} });
      const out = {};
      response.headers.forEach((v, k) => { out[k] = v; });
      res.writeHead(response.status, out);
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro interno');
    }
  });
  return new Promise((ok) => server.listen(port, env.HOST || '127.0.0.1', () => ok({ server, db })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  const port = Number(process.env.PORT || 8788);
  const dbPath = resolve(ROOT, process.env.DB_PATH || 'data/convite.db');
  await startServer({ port, dbPath, env: process.env });
  console.log(`Convite:  http://127.0.0.1:${port}/`);
  console.log(`Painel:   http://127.0.0.1:${port}/admin/`);
  console.log(`Dados:    ${dbPath}`);
  if (!process.env.ADMIN_PASSWORD) console.log('AVISO: copie .env.example para .env e defina as senhas para usar o painel.');
}
