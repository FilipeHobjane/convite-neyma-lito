// Estrutura da base de dados (SQLite puro: funciona em D1 e em ficheiro local)
// e valores iniciais do convite. Editáveis depois no painel; nunca sobrepõem dados gravados.

export const SCHEMA_VERSION = '9';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, title TEXT, location TEXT, description TEXT, map_url TEXT, order_index INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS guests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     token TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     phone TEXT DEFAULT '',
     group_name TEXT DEFAULT '',
     max_companions INTEGER DEFAULT 0,
     status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','sim','nao')),
     companions INTEGER DEFAULT 0,
     companion_names TEXT DEFAULT '[]',
     notes TEXT DEFAULT '',
     admin_notes TEXT DEFAULT '',
     source TEXT DEFAULT 'lista',
     responded_at TEXT,
     created_at TEXT NOT NULL,
     salutation TEXT DEFAULT '',
     personal_message TEXT DEFAULT '',
     savedate_sent_at TEXT,
     invite_sent_at TEXT,
     std_accepted_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)`,
  `CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, title TEXT NOT NULL, text TEXT, image TEXT DEFAULT '', order_index INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, relacao TEXT, mensagem TEXT NOT NULL, aprovado INTEGER DEFAULT 0, oculto INTEGER DEFAULT 0, data_criacao TEXT)`,
  `CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id TEXT NOT NULL, thumb_id TEXT, is_main INTEGER DEFAULT 0, order_index INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS gift_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT DEFAULT '', order_index INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT NOT NULL, description TEXT, image TEXT DEFAULT '', available INTEGER DEFAULT 1, chosen_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, address TEXT, image TEXT DEFAULT '', phone TEXT, whatsapp TEXT, map_url TEXT, order_index INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, name TEXT, size INTEGER NOT NULL, chunks INTEGER NOT NULL, chunk_size INTEGER NOT NULL, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS media_chunks (media_id TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (media_id, idx))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`,
  // Senha alterada no painel. Fora de settings e das cópias: nunca chega ao público nem a ficheiros.
  `CREATE TABLE IF NOT EXISTS admin_auth (id INTEGER PRIMARY KEY CHECK (id = 1), password_hmac TEXT NOT NULL, secret_check TEXT NOT NULL)`,
];

// Colunas acrescentadas a bases já existentes. SQLite não tem ADD COLUMN IF NOT EXISTS.
export const COLUMN_MIGRATIONS = [
  `ALTER TABLE guests ADD COLUMN salutation TEXT DEFAULT ''`,
  `ALTER TABLE guests ADD COLUMN personal_message TEXT DEFAULT ''`,
  `ALTER TABLE guests ADD COLUMN savedate_sent_at TEXT`,
  `ALTER TABLE guests ADD COLUMN invite_sent_at TEXT`,
  `ALTER TABLE guests ADD COLUMN std_accepted_at TEXT`,
];

// Secções do convite: a chave dá os nomes eyebrow, title e show nas definições.
export const SECTIONS = {
  chapters: ['A nossa história', 'A nossa história', 'Um capítulo de cada vez'],
  couple: ['Os noivos', 'Com a bênção dos nossos pais', 'Os Noivos'],
  date: ['Calendário', 'Reserve este dia', 'Guarde a Data'],
  program: ['Programa', 'O nosso dia', 'Programa'],
  places: ['Localização', 'Como chegar', 'Localização'],
  dress: ['Dress code', 'O que vestir', 'Dress Code'],
  gallery: ['Galeria', 'Os nossos momentos', 'Galeria'],
  rsvp: ['Confirmação de presença', 'Contamos consigo?', 'Confirmação de Presença'],
  messages: ['Mensagens', 'Palavras de carinho', 'Mensagens aos Noivos'],
  gifts: ['Presentes', 'Se desejar oferecer', 'Presentes'],
  manual: ['Manual do convidado', 'Informações úteis', 'Manual do Bom Convidado'],
};

const SECTION_SETTINGS = Object.fromEntries(Object.entries(SECTIONS).flatMap(([k, [, eyebrow, title]]) => [
  [`show_${k}`, '1'], [`${k}_eyebrow`, eyebrow], [`${k}_title`, title],
]));

// Tabelas e colunas incluídas nas cópias de segurança (a ordem é a do restauro).
export const BACKUP_TABLES = {
  settings: ['key', 'value'],
  events: ['id', 'time', 'title', 'location', 'description', 'map_url', 'order_index'],
  guests: ['id', 'token', 'name', 'phone', 'group_name', 'max_companions', 'status', 'companions', 'companion_names', 'notes', 'admin_notes', 'source', 'responded_at', 'created_at', 'salutation', 'personal_message', 'savedate_sent_at', 'invite_sent_at', 'std_accepted_at'],
  chapters: ['id', 'label', 'title', 'text', 'image', 'order_index'],
  messages: ['id', 'nome', 'relacao', 'mensagem', 'aprovado', 'oculto', 'data_criacao'],
  gallery: ['id', 'media_id', 'thumb_id', 'is_main', 'order_index'],
  gift_categories: ['id', 'name', 'image', 'order_index'],
  gifts: ['id', 'category_id', 'name', 'description', 'image', 'available', 'chosen_by'],
  stores: ['id', 'name', 'description', 'address', 'image', 'phone', 'whatsapp', 'map_url', 'order_index'],
  media: ['id', 'mime', 'name', 'size', 'chunks', 'chunk_size', 'created_at'],
};

export const DEFAULT_THEME = {
  color_primary: '#123f31',
  color_secondary: '#6e5446',
  color_background: '#f6efe6',
  color_text: '#3e2418',
  color_titles: '#123f31',
  color_buttons: '#123f31',
  color_gold: '#b07a55',
  font_titles: "'Cormorant Garamond', serif",
  font_text: "'Jost', sans-serif",
  font_title_size: '2.4',
  font_text_size: '1',
};

export const FONT_OPTIONS = {
  titles: ["'Cormorant Garamond', serif", "'Playfair Display', serif", "'Marcellus', serif"],
  text: ["'Jost', sans-serif", "'Lato', sans-serif", "'Cormorant Garamond', serif"],
};

// Modelos por nível de proximidade. O último serve quem não tem relação reconhecida.
// {nome}, {primeiro_nome}, {casal}, {data} e {link} são substituídos ao usar o modelo.
const TEMPLATE = (label, cover_line, salutation, message, wa_savedate, wa_invite) => ({ label, cover_line, salutation, message, wa_savedate, wa_invite });
export const DEFAULT_TEMPLATES = [
  TEMPLATE('Família próxima', 'Para a nossa família', 'Querido(a) {primeiro_nome},', 'Crescemos convosco e é convosco que queremos viver este dia. Sem vocês não seria a mesma coisa.',
    '{primeiro_nome}, temos uma notícia muito especial para partilhar consigo primeiro. Abra e reserve a data connosco:\n\n{link}', '{primeiro_nome}, chegou o convite do nosso casamento, feito a pensar em si. Com todo o nosso carinho,\n{casal}\n\n{link}'),
  TEMPLATE('Família', 'Para a nossa família', 'Querido(a) {nome},', 'A família é o nosso começo. Ficaremos muito felizes por celebrar este dia consigo.',
    '{nome}, temos uma novidade para a família. Abra e reserve a data connosco:\n\n{link}', '{nome}, é com muita alegria que lhe enviamos o convite do nosso casamento.\n{casal}\n\n{link}'),
  TEMPLATE('Padrinhos', 'Para os nossos padrinhos', 'Querido(a) {primeiro_nome},', 'Escolhemos-vos para caminhar ao nosso lado. Este dia também é vosso.',
    '{primeiro_nome}, antes de todos, queremos que guarde esta data. Abra e reserve a data connosco:\n\n{link}', '{primeiro_nome}, aqui está o convite do nosso casamento. Obrigado por estar ao nosso lado.\n{casal}\n\n{link}'),
  TEMPLATE('Amigos próximos', 'Para quem é família por escolha', '{primeiro_nome},', 'Estiveste nas noites longas e nas gargalhadas mais altas. Agora queremos dançar contigo.',
    '{primeiro_nome}! Tenho uma coisa para ti: abre e reserva já esta data 😄\n\n{link}', '{primeiro_nome}, chegou o convite! Não aceitamos um não como resposta 😄\n{casal}\n\n{link}'),
  TEMPLATE('Amigos', 'Para os nossos amigos', 'Querido(a) {primeiro_nome},', 'Ficaremos muito felizes por celebrar este dia contigo.',
    '{primeiro_nome}, temos uma novidade! Abre e reserva a data connosco:\n\n{link}', '{primeiro_nome}, é com alegria que te enviamos o convite do nosso casamento.\n{casal}\n\n{link}'),
  TEMPLATE('Colegas', 'Com estima', 'Estimado(a) {nome},', 'Seria uma grande alegria contar com a sua presença neste dia tão importante para nós.',
    '{nome}, gostaríamos de partilhar uma novidade consigo. Abra e reserve a data connosco:\n\n{link}', '{nome}, temos o prazer de lhe enviar o convite do nosso casamento.\n{casal}\n\n{link}'),
  TEMPLATE('Outros', '', '', '', '', ''),
];

export const DEFAULT_SETTINGS = {
  bride_name: 'Noiva',
  groom_name: 'Noivo',
  couple_display: 'Noiva & Noivo',
  wedding_date: '2027-06-12',
  wedding_time: '11:00',
  event_tz: '+02:00',
  site_title: 'Convite de Casamento | Noiva & Noivo',
  site_description: 'Venha celebrar connosco o nosso grande dia.',
  groom_father: 'Pai do noivo',
  groom_mother: 'Mãe do noivo',
  bride_father: 'Pai da noiva',
  bride_mother: 'Mãe da noiva',
  groom_photo: '',
  bride_photo: '',
  welcome_title: 'Seja bem-vindo(a)',
  bible_quote: 'Encontrei o amor da minha vida. Segurei-o e não o deixarei ir.',
  bible_reference: 'Cânticos 3:4',
  story_title: 'Dois Corações, Um Caminho',
  story_text: 'E entre tantos caminhos, escolhemos caminhar lado a lado',
  story_author: 'Noiva & Noivo',
  formal_text: 'Com a bênção de Deus e de seus pais,\nTemos a honra de convidá-lo(a)\npara comemorar esta data especial connosco.',
  guest_label: 'Caro(a) Convidado(a)',
  invite_validity: 'Convite válido para 1 pessoa',
  children_notice: 'Não extensivo a crianças',
  dresscode_text: 'Escolha para ver as sugestões de cores',
  dresscode_women_colors: 'Terracota, Verde-escuro, Rosa-cedro, Bordô, Moca, Bege quente, Castanho, Verde-oliva, Azul-petróleo',
  dresscode_men_colors: 'Preto, Castanho escuro, Castanho, Camel, Bege',
  dresscode_warning: 'Proibido usar a cor branca',
  dresscode_women_image: '',
  dresscode_men_image: '',
  rsvp_deadline: '2027-05-29',
  rsvp_intro: 'Por favor, confirme a sua presença.',
  rsvp_public: '1',
  public_max_companions: '0',
  thanks_yes: 'Obrigado! Ficamos muito felizes por celebrar este dia consigo.',
  thanks_no: 'Obrigado por nos avisar. Vamos sentir a sua falta.',
  thanks_after_event: 'Obrigado a todos os que celebraram connosco este dia inesquecível.',
  share_message: 'Temos o prazer de convidar-te para celebrar connosco o nosso casamento.',
  gift_intro: 'A vossa presença é o nosso maior presente.\nCaso deseje oferecer-nos algo encontrará a lista nas seguintes lojas.\nAgradecemos pelo carinho!',
  gift_one_per_guest: '1',
  gift_rule_text: 'Cada convidado pode escolher apenas 1 presente.\nDepois de escolhido, não é possível trocar ou escolher outro.',
  mpesa_number: '',
  mpesa_holder: '',
  emola_number: '',
  emola_holder: '',
  bank_account: '',
  bank_nib: '',
  bank_holder: '',
  footer_brand: 'Noiva & Noivo',
  footer_text: 'Um convite digital para o casamento de Noiva & Noivo',
  footer_instagram: '',
  footer_whatsapp: '',
  footer_email: '',
  footer_copyright: 'Com amor.',
  music_file: '',
  music_enabled: '0',
  cover_image: '',
  envelope_seal_text: 'N&N',
  manual_guest_items: JSON.stringify([
    { title: 'Convidado não convida', text: 'O convite é pessoal e intransferível' },
    { title: 'Seja pontual', text: 'Chegue antes da hora marcada para a cerimónia' },
    { title: 'Tire muitas fotos', text: 'Capture os melhores momentos' },
    { title: 'Aproveite a festa', text: 'Dance, celebre e seja feliz' },
  ]),
  show_envelope: '1',
  show_countdown: '1',
  show_welcome: '1',
  show_letter: '1',
  show_celebration: '1',
  letter_greeting_general: 'Querido(a) convidado(a),',
  letter_greeting_personal: 'Querido(a) {nome},',
  letter_message: 'Este dia não seria o mesmo sem si. Ficaremos muito felizes por celebrá-lo consigo.',
  show_savedate: '1',
  show_std_invite: '0',
  std_photo: '',
  std_photo_2: '',
  std_photo_3: '',
  std_video: '',
  std_bell: '',
  // O convite só abre depois de o convidado tocar em "Aceito reservar este dia".
  std_gate: '1',
  std_kind: 'Bênção matrimonial',
  std_place: 'Cidade',
  std_question: 'Pode reservar este dia para nós?',
  std_lock_text: 'O convite completo só se abre quando aceitar guardar a data.',
  std_button: 'Aceito reservar este dia',
  std_tap_hint: 'Toque para abrir o convite',
  std_door_caption: 'A bênção de {casal} espera por si',
  // Cores do Save the Date (opção "Floresta e caramelo").
  color_std_bg: '#123f31',
  color_std_text: '#f6efe6',
  color_std_soft: '#d9c7b6',
  color_std_button: '#b07a55',
  color_std_detail: '#d29a6f',
  color_std_frame: '#d9c7b6',
  std_title: 'Save the Date',
  // 'floresta': o convite usa as cores e a letra do Save the Date. 'classico': fundo claro e letra clássica.
  invite_style: 'floresta',
  relation_templates: JSON.stringify(DEFAULT_TEMPLATES),
  std_hint: 'Raspe o dourado com o dedo para descobrir',
  std_message: 'Vamos casar, e este dia só fica completo consigo.',
  std_next: 'O convite, com o programa e o local, segue em breve.',
  std_share_message: 'Temos uma novidade para si. Abra e reserve a data connosco:',
  cover_hint: 'Toque no selo para abrir',
  hero_eyebrow: 'Vamos casar',
  hero_eyebrow_after: 'Casámos',
  ...SECTION_SETTINGS,
  ...DEFAULT_THEME,
};

const EV = (time, title, location, order_index) => ({ time, title, location, description: '', map_url: '', order_index });
export const DEFAULT_EVENTS = [
  EV('11h00', 'Cerimónia religiosa', 'Local da cerimónia religiosa', 1),
  EV('13h00', 'Sessão de fotografias', 'Local da sessão de fotografias', 2),
  EV('14h00', 'Cocktail', 'Local da recepção', 3),
  EV('15h30', "Copo d'Água", 'Local da recepção', 4),
];

export const DEFAULT_STORES = [
  { name: 'Nome da loja', description: 'Breve descrição do que a loja vende.', address: 'Endereço da loja', image: '', phone: '', whatsapp: '', map_url: '', order_index: 0 },
];

// Exemplos das versões anteriores (casal fictício). Uma base que ainda os tenha, sem alteração,
// passa a mostrar os valores genéricos acima; o que já foi editado no painel fica intacto.
const OLD_SETTINGS = {
  bride_name: 'Nelde Alberto Fumo', groom_name: 'Nilton Manhiça', couple_display: 'Nelde & Nilton',
  wedding_date: '2026-10-17', rsvp_deadline: '2026-09-20', site_title: 'Convite de Casamento | Nelde & Nilton',
  groom_father: 'Roberto Alfredo Manhiça', groom_mother: 'Jessica Alberto Manhiça', bride_father: 'Alberto Jose Fumo', bride_mother: 'Adelaide Narenque',
  story_author: 'Nelde & Nilton', mpesa_number: '+258 84 4747730', mpesa_holder: 'Nilton Manhiça', emola_number: '+258 86 65 0750', emola_holder: 'Nelde Checo',
  bank_account: '402630414', bank_nib: '000100000040263041457', bank_holder: 'O casal',
  footer_brand: 'Nelde & Nilton', footer_text: 'Um convite digital para o casamento de Nelde & Nilton', std_place: 'Maputo',
  manual_guest_items: JSON.stringify([
    { title: 'Convidado não convida', text: 'O convite é pessoal e intransferível' },
    { title: 'Seja pontual', text: 'A cerimónia começa às 10h00' },
    { title: 'Tire muitas fotos', text: 'Capture os melhores momentos' },
    { title: 'Aproveite a festa', text: 'Dance, celebre e seja feliz' },
  ]),
};
const OLD_EVENTS = [
  ['11h00', 'Cerimónia Religiosa', 'Igreja Santo António da Poliana'], ['12h30', 'Cerimónia Civil', 'Igreja Santo António da Poliana'],
  ['14h00', 'Cocktail', 'Salão de Eventos Tulipa'], ['14h50', 'Corte do Bolo', 'Salão de Eventos Tulipa'], ['15h30', "Copo d'Água", 'Salão de Eventos Tulipa'],
];
const OLD_STORES = [['Casa das Loiças', 'Avenida Karl Marx'], ['Louça Amiga', 'Avenida Karl Marx']];

export const DEFAULT_GIFT_CATEGORIES = ['Electrodomésticos', 'Cozinha', 'Mobília'].map((name, i) => ({ name, image: '', order_index: i }));

let readyFor = null;

// Cria as tabelas no primeiro pedido. Não é preciso nenhum comando nem consola de base de dados.
export async function ensureSchema(db) {
  if (readyFor === db) return;
  let current = null;
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key='schema_version'`).first();
    current = row && row.value;
  } catch { /* tabela ainda não existe */ }
  if (current !== SCHEMA_VERSION) {
    await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    for (const sql of COLUMN_MIGRATIONS) {
      try { await db.prepare(sql).run(); } catch (err) {
        if (!String(err && err.message).includes('duplicate column')) throw err;
      }
    }
    await db.prepare(`INSERT OR IGNORE INTO settings(key,value) SELECT key, value FROM json_each(?)`).bind(JSON.stringify(DEFAULT_SETTINGS)).run();
    if (current === null) await seedLists(db);
    else if (Number(current) < 8) await replaceOldExamples(db);
    await db.prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version',?)`).bind(SCHEMA_VERSION).run();
  }
  readyFor = db;
}

// Só troca o que continua exactamente igual ao exemplo antigo: nada do que o casal escreveu se perde.
async function replaceOldExamples(db) {
  const pairs = Object.fromEntries(Object.entries(OLD_SETTINGS).map(([k, old]) => [k, { old, new: DEFAULT_SETTINGS[k] }]));
  await db.prepare(`UPDATE settings SET value = (SELECT json_extract(j.value,'$.new') FROM json_each(?1) j WHERE j.key = settings.key)
    WHERE value = (SELECT json_extract(j.value,'$.old') FROM json_each(?1) j WHERE j.key = settings.key)`).bind(JSON.stringify(pairs)).run();
  const same = (rows, old, cols) => rows.length === old.length
    && rows.every((r, i) => cols.every((c, j) => r[c] === old[i][j]) && !r.description && !r.map_url && !r.image && !r.phone && !r.whatsapp);
  const ev = (await db.prepare(`SELECT time,title,location,description,map_url FROM events ORDER BY order_index,id`).all()).results;
  if (same(ev, OLD_EVENTS, ['time', 'title', 'location'])) {
    await db.prepare(`DELETE FROM events`).run();
    await bulkInsert(db, 'events', ['time', 'title', 'location', 'description', 'map_url', 'order_index'], DEFAULT_EVENTS);
  }
  const st = (await db.prepare(`SELECT name,address,description,map_url,image,phone,whatsapp FROM stores ORDER BY order_index,id`).all()).results
    .map((r) => ({ ...r, description: '' }));
  if (same(st, OLD_STORES, ['name', 'address'])) {
    await db.prepare(`DELETE FROM stores`).run();
    await bulkInsert(db, 'stores', ['name', 'description', 'address', 'image', 'phone', 'whatsapp', 'map_url', 'order_index'], DEFAULT_STORES);
  }
}

async function seedLists(db) {
  const seed = async (table, cols, rows) => {
    const c = await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first();
    if (c.n === 0) await bulkInsert(db, table, cols, rows);
  };
  await seed('events', ['time', 'title', 'location', 'description', 'map_url', 'order_index'], DEFAULT_EVENTS);
  await seed('stores', ['name', 'description', 'address', 'image', 'phone', 'whatsapp', 'map_url', 'order_index'], DEFAULT_STORES);
  await seed('gift_categories', ['name', 'image', 'order_index'], DEFAULT_GIFT_CATEGORIES);
}

// Uma única instrução por lote: o D1 gratuito permite 50 consultas por pedido.
// Os nomes de tabela e coluna vêm sempre de listas fixas deste ficheiro, nunca do utilizador.
export function bulkInsert(db, table, cols, rows, verb = 'INSERT') {
  const select = cols.map((c) => `json_extract(value,'$.${c}')`).join(',');
  return db.prepare(`${verb} INTO ${table}(${cols.join(',')}) SELECT ${select} FROM json_each(?)`).bind(JSON.stringify(rows)).run();
}
