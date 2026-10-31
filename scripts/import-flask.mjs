// Converte a instância Flask antiga num ficheiro de cópia, a restaurar no painel.
// Uso: node scripts/import-flask.mjs <pasta-do-projecto-antigo> <ficheiro-saída.json>
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { DEFAULT_SETTINGS, DEFAULT_THEME } from '../src/schema.js';

const [folder, output] = process.argv.slice(2);
if (!folder || !output) {
  console.error('Uso: node scripts/import-flask.mjs <pasta-antiga> <saída.json>');
  process.exit(2);
}
const CHUNK = 900_000;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const OLD_RSVP_INTRO = /^Por favor, confirme sua presença até/;

const db = new DatabaseSync(join(folder, 'database.db'), { readOnly: true });
const all = (t) => db.prepare(`SELECT * FROM ${t}`).all();
const now = new Date().toISOString();
const media = [];
const files = [];
const missing = [];

// Lê o ficheiro antigo (só leitura) e devolve o id novo.
function addFile(path, name) {
  if (!name) return '';
  const full = join(folder, path, name);
  const mime = MIME[extname(name).toLowerCase()];
  if (!existsSync(full) || !mime) { missing.push(join(path, name)); return ''; }
  const bytes = readFileSync(full);
  const id = randomBytes(16).toString('hex');
  media.push({ id, mime, name, size: bytes.length, chunks: Math.ceil(bytes.length / CHUNK), chunk_size: CHUNK, created_at: now });
  files.push({ id, data: bytes.toString('base64') });
  return id;
}

const settings = { ...DEFAULT_SETTINGS };
for (const { key, value } of all('settings')) {
  // O tema antigo é ignorado para o convite adoptar o novo aspecto; pode ser reposto no painel.
  if (Object.hasOwn(settings, key) && !Object.hasOwn(DEFAULT_THEME, key)) settings[key] = value ?? '';
}
if (OLD_RSVP_INTRO.test(settings.rsvp_intro)) settings.rsvp_intro = DEFAULT_SETTINGS.rsvp_intro;
for (const key of ['groom_photo', 'bride_photo', 'cover_image', 'dresscode_women_image', 'dresscode_men_image']) {
  settings[key] = addFile('static/images', settings[key]);
}
settings.music_file = addFile('static/audio', settings.music_file);

const token = () => randomBytes(12).toString('base64url');
const guests = all('rsvps').map((r) => ({
  id: r.id, token: token(), name: r.nome, phone: r.telefone || '', group_name: '', max_companions: 0,
  status: r.status === 'sim' ? 'sim' : 'nao', companions: 0, companion_names: '[]', notes: r.observacao || '',
  admin_notes: '', source: 'aberto', responded_at: r.data_confirmacao, created_at: r.data_confirmacao || now,
}));
const gallery = all('gallery').map((p) => {
  const id = addFile('static/images/gallery', p.filename);
  return { id: p.id, media_id: id, thumb_id: id, is_main: p.is_main, order_index: p.order_index };
}).filter((p) => p.media_id);

const backup = {
  format: 'convite-backup', version: 1, created_at: now,
  tables: {
    settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
    events: all('events'),
    guests,
    messages: all('messages'),
    gallery,
    gift_categories: all('gift_categories').map((c) => ({ ...c, image: addFile('static/images/gifts', c.image) })),
    gifts: all('gifts').map((g) => ({ ...g, image: addFile('static/images/gifts', g.image) })),
    stores: all('stores').map((s) => ({ ...s, image: addFile('static/images/stores', s.image) })),
    media,
  },
  files,
};
writeFileSync(output, JSON.stringify(backup));
db.close();

console.log(`Ficheiro criado: ${output}`);
console.log(`${guests.length} RSVPs, ${backup.tables.messages.length} mensagens, ${media.length} ficheiros.`);
if (missing.length) console.log(`Ficheiros em falta (ignorados): ${missing.join(', ')}`);
console.log('A senha antiga não é importada: use ADMIN_PASSWORD.');
