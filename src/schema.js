// Estrutura da base de dados (SQLite puro: funciona em D1 e em ficheiro local)
// e valores iniciais do convite. Editáveis depois no painel; nunca sobrepõem dados gravados.

export const SCHEMA_VERSION = '2';

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
     created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)`,
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

// Secções do convite: a chave dá os nomes eyebrow, title e show nas definições.
export const SECTIONS = {
  couple: ['Os noivos', 'Com a bênção dos nossos pais', 'Os Noivos'],
  date: ['Calendário', 'Reserve este dia', 'Guarde a Data'],
  program: ['Programa', 'O nosso dia', 'Programa'],
  places: ['Localização', 'Como chegar', 'Localização'],
  dress: ['Dress code', 'O que vestir', 'Dress Code'],
  gallery: ['Galeria', 'Nossos momentos', 'Galeria'],
  rsvp: ['Confirmação de presença', 'Conto consigo?', 'Confirmação de Presença'],
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
  guests: ['id', 'token', 'name', 'phone', 'group_name', 'max_companions', 'status', 'companions', 'companion_names', 'notes', 'admin_notes', 'source', 'responded_at', 'created_at'],
  messages: ['id', 'nome', 'relacao', 'mensagem', 'aprovado', 'oculto', 'data_criacao'],
  gallery: ['id', 'media_id', 'thumb_id', 'is_main', 'order_index'],
  gift_categories: ['id', 'name', 'image', 'order_index'],
  gifts: ['id', 'category_id', 'name', 'description', 'image', 'available', 'chosen_by'],
  stores: ['id', 'name', 'description', 'address', 'image', 'phone', 'whatsapp', 'map_url', 'order_index'],
  media: ['id', 'mime', 'name', 'size', 'chunks', 'chunk_size', 'created_at'],
};

export const DEFAULT_THEME = {
  color_primary: '#5e1f27',
  color_secondary: '#75604f',
  color_background: '#f8f2e7',
  color_text: '#2e211c',
  color_titles: '#5e1f27',
  color_buttons: '#5e1f27',
  color_gold: '#a98544',
  font_titles: "'Cormorant Garamond', serif",
  font_text: "'Jost', sans-serif",
  font_title_size: '2.4',
  font_text_size: '1',
};

export const FONT_OPTIONS = {
  titles: ["'Cormorant Garamond', serif", "'Playfair Display', serif", "'Marcellus', serif"],
  text: ["'Jost', sans-serif", "'Lato', sans-serif", "'Cormorant Garamond', serif"],
};

export const DEFAULT_SETTINGS = {
  bride_name: 'Nelde Alberto Fumo',
  groom_name: 'Nilton Manhiça',
  couple_display: 'Nelde & Nilton',
  wedding_date: '2026-10-17',
  wedding_time: '11:00',
  event_tz: '+02:00',
  site_title: 'Convite de Casamento | Nelde & Nilton',
  site_description: 'Venha celebrar connosco o nosso grande dia.',
  groom_father: 'Roberto Alfredo Manhiça',
  groom_mother: 'Jessica Alberto Manhiça',
  bride_father: 'Alberto Jose Fumo',
  bride_mother: 'Adelaide Narenque',
  groom_photo: '',
  bride_photo: '',
  welcome_title: 'Seja bem-vindo(a)',
  bible_quote: 'Encontrei o amor da minha vida. Segurei-o e não o deixarei ir.',
  bible_reference: 'Cânticos 3:4',
  story_title: 'Dois Corações, Um Caminho',
  story_text: 'E entre tantos caminhos, escolhemos caminhar lado a lado',
  story_author: 'Nelde & Nilton',
  formal_text: 'Com a bênção de Deus e de seus pais,\nTemos a honra de convidá-lo(a)\npara comemorar esta data especial connosco.',
  guest_label: 'Caro(a) Convidado(a)',
  invite_validity: 'Convite válido para 1 pessoa',
  children_notice: 'Não extensivo a crianças',
  dresscode_text: 'Escolha para ver as sugestões de cores',
  dresscode_women_colors: 'Terracotta, Dark Green, Cedar Rose, Bordô, Mocha Mousse, Warm Beige, Brown, Olive, Muted Teal',
  dresscode_men_colors: 'Preto, Castanho escuro, Castanho, Camel, Bege',
  dresscode_warning: 'Proibido usar a cor branca',
  dresscode_women_image: '',
  dresscode_men_image: '',
  rsvp_deadline: '2026-09-20',
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
  mpesa_number: '+258 84 4747730',
  mpesa_holder: 'Nilton Manhiça',
  emola_number: '+258 86 65 0750',
  emola_holder: 'Nelde Checo',
  bank_account: '402630414',
  bank_nib: '000100000040263041457',
  bank_holder: 'O casal',
  footer_brand: 'Nelde & Nilton',
  footer_text: 'Um convite digital para o casamento de Nelde & Nilton',
  footer_instagram: '',
  footer_whatsapp: '',
  footer_email: '',
  footer_copyright: '© 2026 Todos os direitos reservados.',
  music_file: '',
  music_enabled: '0',
  cover_image: '',
  envelope_seal_text: 'N&N',
  manual_guest_items: JSON.stringify([
    { title: 'Convidado não convida', text: 'O convite é pessoal e intransferível' },
    { title: 'Seja pontual', text: 'A cerimónia começa às 10h00' },
    { title: 'Tire muitas fotos', text: 'Capture os melhores momentos' },
    { title: 'Aproveite a festa', text: 'Dance, celebre e seja feliz' },
  ]),
  show_envelope: '1',
  show_countdown: '1',
  show_welcome: '1',
  cover_hint: 'Toque no envelope para abrir',
  hero_eyebrow: 'Vamos casar',
  hero_eyebrow_after: 'Casámos',
  ...SECTION_SETTINGS,
  ...DEFAULT_THEME,
};

const EV = (time, title, location, order_index) => ({ time, title, location, description: '', map_url: '', order_index });
export const DEFAULT_EVENTS = [
  EV('11h00', 'Cerimónia Religiosa', 'Igreja Santo António da Poliana', 1),
  EV('12h30', 'Cerimónia Civil', 'Igreja Santo António da Poliana', 2),
  EV('14h00', 'Cocktail Hour', 'Salão de Eventos Tulipa', 3),
  EV('14h50', 'Corte do Bolo', 'Salão de Eventos Tulipa', 4),
  EV('15h30', "Copo d'Água", 'Salão de Eventos Tulipa', 5),
];

export const DEFAULT_STORES = [
  { name: 'Casa das Loiças', description: 'Loja especializada em loiças, vidros e artigos de mesa.', address: 'Avenida Karl Marx', image: '', phone: '', whatsapp: '', map_url: '', order_index: 0 },
  { name: 'Louça Amiga', description: 'Variedade em louças e utensílios para sua casa.', address: 'Avenida Karl Marx', image: '', phone: '', whatsapp: '', map_url: '', order_index: 1 },
];

export const DEFAULT_GIFT_CATEGORIES = ['Eletrodomésticos', 'Cozinha', 'Mobília'].map((name, i) => ({ name, image: '', order_index: i }));

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
    await db.prepare(`INSERT OR IGNORE INTO settings(key,value) SELECT key, value FROM json_each(?)`).bind(JSON.stringify(DEFAULT_SETTINGS)).run();
    if (current === null) await seedLists(db);
    await db.prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version',?)`).bind(SCHEMA_VERSION).run();
  }
  readyFor = db;
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
