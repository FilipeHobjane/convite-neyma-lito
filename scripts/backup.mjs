// Cria uma cópia completa (dados e ficheiros) fora da plataforma.
// Uso: node scripts/backup.mjs https://o-seu-convite.pages.dev <pasta-destino>
// Requer a variável BACKUP_TOKEN (permite apenas ler cópias).
import { createWriteStream, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { once } from 'node:events';

const [site, dest = 'backups'] = process.argv.slice(2);
const token = process.env.BACKUP_TOKEN;
if (!site || !token) {
  console.error('Uso: BACKUP_TOKEN=... node scripts/backup.mjs <url-do-site> [pasta]');
  process.exit(2);
}
const KEEP = Number(process.env.BACKUP_KEEP || 30);
const headers = { Authorization: `Bearer ${token}` };

// Cada pedido tem um limite de tempo e até três tentativas: um pedido sem resposta não encrava a cópia.
async function get(path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(new URL(path, site), { headers, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt >= 3 || /HTTP 4\d\d/.test(err.message)) throw err;
      console.error(`${path}: ${err.message}. Nova tentativa (${attempt + 1} de 3)…`);
    }
  }
}
console.log(`A copiar de ${new URL(site).origin}…`);

const data = await (await get('/api/admin/backup/data')).json();
if (data.format !== 'convite-backup') throw new Error('Resposta inesperada do servidor.');

const dir = resolve(dest);
mkdirSync(dir, { recursive: true });
const stamp = data.created_at.replace(/[:.]/g, '-');
const file = join(dir, `convite-backup-${stamp}.json`);
const out = createWriteStream(file);
const write = async (text) => { if (!out.write(text)) await once(out, 'drain'); };

await write(JSON.stringify(data).slice(0, -1));
await write(',"files":[');
let bytes = 0;
for (let i = 0; i < data.tables.media.length; i++) {
  const m = data.tables.media[i];
  const parts = [];
  for (let c = 0; c < m.chunks; c++) parts.push(Buffer.from(await (await get(`/api/admin/backup/chunk/${m.id}/${c}`)).arrayBuffer()));
  const whole = Buffer.concat(parts);
  if (whole.length !== m.size) throw new Error(`Ficheiro ${m.id} incompleto.`);
  bytes += whole.length;
  await write(`${i ? ',' : ''}${JSON.stringify({ id: m.id, data: whole.toString('base64') })}`);
}
await write(']}');
out.end();
await once(out, 'finish');

const old = readdirSync(dir).filter((f) => /^convite-backup-.*\.json$/.test(f)).sort();
for (const f of old.slice(0, Math.max(0, old.length - KEEP))) rmSync(join(dir, f));

console.log(`Cópia criada: ${file}`);
console.log(`${data.tables.guests.length} convidados, ${data.tables.media.length} ficheiros (${(bytes / 1e6).toFixed(1)} MB).`);
