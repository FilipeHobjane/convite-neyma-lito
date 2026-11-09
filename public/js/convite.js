// Convite público. Todo o texto entra por textContent, nunca como HTML, para evitar XSS.
(() => {
  const bootEl = document.getElementById('boot');
  if (!bootEl) { location.replace('/'); return; }
  const data = JSON.parse(bootEl.textContent);
  const { s, chapters, events, gallery, messages, stores, categories, gifts, rsvp, invalidToken } = data;
  let guest = data.guest;
  const app = document.getElementById('app');

  // ---------- Auxiliares ----------
  function h(tag, props, ...kids) {
    const el = document.createElementNS(tag === 'svg' || tag === 'path' || tag === 'circle' ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k in el && k !== 'list' && !(el instanceof SVGElement)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid);
    }
    return el;
  }
  const media = (id) => `/media/${id}`;
  const icon = (d) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, h('path', { d }));
  const ICONS = {
    home: 'M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8',
    clock: 'M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    pin: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.800 12 21 12 21ZM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z',
    photo: 'M4 5h16v14H4zM4 16l5-5 4 4 2.500-2.500L20 17M15.500 9h.01',
    check: 'M4 12.500 9.500 18 20 6.500',
    gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.500 3 8 3.500 7 7 12 7Zm0 0s1.500-4 4-3.500S17 7 12 7Z',
    note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    share: 'M12 3v13M7.500 7.500 12 3l4.500 4.500M5 13v8h14v-8',
    cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  };
  const heading = (eyebrow, title) => h('div', { class: 'head' },
    h('div', { class: 'eyebrow' }, eyebrow), h('h2', null, title), h('div', { class: 'rule' }, h('i')));
  const sectionHead = (k) => heading(s[`${k}_eyebrow`], s[`${k}_title`]);
  const shown = (k) => s[`show_${k}`] !== '0';
  const section = (id, cls, ...kids) => h('section', { id, class: `${cls || ''} reveal` }, ...kids);
  const toastEl = h('div', { class: 'toast', role: 'status' });
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
  }
  async function post(url, body) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { throw new Error('Sem ligação à internet. A sua resposta não foi enviada; tente novamente.'); }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Não foi possível enviar. Tente novamente.');
    return out;
  }
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const parts = (iso) => { const [y, m, d] = (iso || '').split('-').map(Number); return { y, m, d }; };
  const longDate = (iso) => { const p = parts(iso); return p.d ? `${p.d} de ${MONTHS[p.m - 1]} de ${p.y}` : ''; };
  const weekday = (iso) => { const p = parts(iso); return p.d ? WEEK[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] : ''; };
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';
  const mapHref = (url, place) => url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tema: valores já validados no servidor.
  const root = document.documentElement.style;
  const theme = { '--primary': s.color_primary, '--secondary': s.color_secondary, '--bg': s.color_background, '--text': s.color_text, '--titles': s.color_titles, '--buttons': s.color_buttons, '--gold': s.color_gold, '--font-titles': s.font_titles, '--font-text': s.font_text, '--title-size': s.font_title_size, '--text-size': s.font_text_size };
  for (const [k, v] of Object.entries(theme)) if (v) root.setProperty(k, v);

  const tz = rsvp.tz || '+02:00';
  const eventStart = Date.parse(`${s.wedding_date}T${s.wedding_time || '00:00'}:00${tz}`);
  const isPast = () => Date.now() > eventStart + 864e5;

  // ---------- Calendário (.ics) ----------
  function downloadIcs() {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };
    const esc = (v) => String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Convite//PT', 'BEGIN:VEVENT', `UID:${s.wedding_date}@convite`, `DTSTAMP:${fmt(Date.now())}`, `DTSTART:${fmt(eventStart)}`, `DTEND:${fmt(eventStart + 8 * 36e5)}`, `SUMMARY:${esc(`Casamento de ${s.couple_display}`)}`, `LOCATION:${esc(events[0] ? events[0].location : '')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'casamento.ics' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const calBtn = (cls) => h('button', { class: `btn ${cls || ''}`, type: 'button', onclick: downloadIcs }, icon(ICONS.cal), 'Guardar na agenda');

  // ---------- Partilha: usa sempre o link geral, nunca o link pessoal ----------
  const shareText = () => `💍 ${s.couple_display}\n\n${s.share_message}\n\nVeja o nosso convite:\n${location.origin}/`;
  const shareBtn = (cls) => h('a', { class: `btn ${cls || ''}`, target: '_blank', rel: 'noopener', href: `https://wa.me/?text=${encodeURIComponent(shareText())}` }, icon(ICONS.share), 'Partilhar no WhatsApp');

  // ---------- Envelope e carta ----------
  // Escreve letra a letra, sem partir palavras. Devolve o instante em que termina (ms).
  function inkWrite(el, text, start, step) {
    if (reducedMotion()) { el.textContent = text; return 0; }
    el.replaceChildren();
    let i = 0;
    text.split(/(\s+)/).filter(Boolean).forEach((part) => {
      const word = h('span', { class: 'word' });
      Array.from(part).forEach((c) => {
        const ch = h('span', { class: 'ch' }, c);
        ch.style.setProperty('--d', `${Math.round(start + i * step)}ms`);
        word.append(ch);
        i++;
      });
      el.append(word);
    });
    return start + i * step;
  }

  function cover() {
    const envBtn = h('button', { class: 'env', type: 'button', 'aria-label': 'Abrir o convite' },
      h('div', { class: 'env-body' }),
      h('div', { class: 'env-letter' }, s.couple_display),
      h('div', { class: 'env-pocket' }),
      h('div', { class: 'env-flap' }),
      h('div', { class: 'env-seal' },
        h('i', { class: 'seal-half l' }, s.envelope_seal_text), h('i', { class: 'seal-half r' }, s.envelope_seal_text),
        [1, 2, 3, 4, 5].map(() => h('span', { class: 'shard' }))));
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, reducedMotion() ? 0 : ms));
    const finish = () => {
      timers.forEach(clearTimeout);
      box.classList.add('gone');
      document.body.classList.remove('locked');
      try { sessionStorage.setItem('opened', '1'); } catch { /* opcional */ }
      setTimeout(() => box.remove(), 1000);
    };
    const go = h('button', { class: 'btn letter-go', type: 'button', onclick: finish }, 'Abrir o convite');
    const greeting = guest
      ? guest.salutation || s.letter_greeting_personal.split('{nome}').join(guest.name)
      : s.letter_greeting_general;
    const message = (guest && guest.personal_message) || s.letter_message;
    const lines = [h('p', { class: 'hand hand-to', 'aria-hidden': 'true' }), h('p', { class: 'hand hand-msg', 'aria-hidden': 'true' }), h('p', { class: 'hand hand-by', 'aria-hidden': 'true' })];
    const letter = h('div', { class: 'letter' }, h('div', { class: 'letter-in' },
      h('p', { class: 'sr' }, `${greeting} ${message} ${s.couple_display}`), lines, go));
    const showLetter = () => {
      const texts = [greeting, message, s.couple_display];
      const step = Math.min(30, 5000 / Math.max(texts.join('').length, 1));
      let at = 500;
      texts.forEach((text, i) => { at = inkWrite(lines[i], text, at, step) + 250; });
      box.classList.add('reading');
      later(() => { go.classList.add('show'); go.focus({ preventScroll: true }); }, at);
    };
    const box = h('div', { class: 'cover' },
      h('button', { class: 'skip', type: 'button', onclick: () => { startMusic(); finish(); } }, 'Saltar abertura'),
      guest ? h('div', null, h('div', { class: 'cover-to' }, guest.cover_line || 'Para'), h('div', { class: 'cover-guest' }, guest.name)) : null,
      envBtn,
      h('div', null, h('div', { class: 'cover-names' }, s.couple_display), h('div', { class: 'cover-date' }, longDate(s.wedding_date))),
      h('div', { class: 'cover-hint' }, s.cover_hint),
      shown('letter') ? letter : null);
    const open = () => {
      if (envBtn.classList.contains('broken')) return;
      envBtn.classList.add('broken');
      try { if (navigator.vibrate) navigator.vibrate([25, 40, 60]); } catch { /* opcional */ }
      startMusic();
      later(() => envBtn.classList.add('open'), 420);
      if (shown('letter')) later(showLetter, 1450);
      else later(finish, 1670);
    };
    envBtn.addEventListener('click', open);
    let startY = 0;
    box.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchend', (e) => { if (startY - e.changedTouches[0].clientY > 40) open(); }, { passive: true });
    return box;
  }

  // ---------- Hero e contagem ----------
  function countdown() {
    const box = h('div', { class: 'count', role: 'timer' });
    const units = [['Dias', 864e5], ['Horas', 36e5], ['Min', 6e4], ['Seg', 1e3]];
    const cells = units.map(([label]) => { const b = h('b'); box.append(h('div', null, b, h('small', null, label))); return b; });
    let timer;
    const tick = () => {
      let left = eventStart - Date.now();
      if (left <= 0) {
        clearInterval(timer);
        box.replaceWith(h('p', { class: 'after-note' }, isPast() ? s.thanks_after_event : 'O grande dia chegou!'));
        return;
      }
      units.forEach(([, ms], i) => {
        const v = Math.floor(left / ms);
        left -= v * ms;
        cells[i].textContent = i ? String(v).padStart(2, '0') : v;
      });
    };
    timer = setInterval(tick, 1000);
    queueMicrotask(tick);
    return box;
  }

  function hero() {
    return h('header', { id: 'inicio', class: `hero ${s.cover_image ? 'photo' : ''}` },
      s.cover_image ? h('img', { class: 'hero-img', src: media(s.cover_image), alt: '', fetchpriority: 'high' }) : null,
      h('div', null,
        h('div', { class: 'eyebrow' }, isPast() ? s.hero_eyebrow_after : s.hero_eyebrow),
        h('h1', null, h('span', null, firstName(s.bride_name)), h('i', null, '&'), h('span', null, firstName(s.groom_name))),
        h('div', { class: 'hero-date' }, `${weekday(s.wedding_date)}, ${longDate(s.wedding_date)}`),
        shown('countdown') ? countdown() : null));
  }

  // ---------- Conteúdo ----------
  function welcome() {
    return section('boas-vindas', '', h('div', { class: 'wrap' },
      heading(guest ? `Olá, ${firstName(guest.name)}` : s.welcome_title, s.story_title),
      h('p', { class: 'quote' }, `“${s.bible_quote}”`),
      h('p', { class: 'quote-by' }, s.bible_reference),
      s.story_text ? h('p', { class: 'lead', style: null }, h('br'), `${s.story_text}. — ${s.story_author}`) : null));
  }

  function chaptersView() {
    if (!chapters.length) return null;
    return section('historia', '', h('div', { class: 'wrap wide' },
      sectionHead('chapters'),
      h('div', { class: 'chapters' }, chapters.map((c) => h('article', { class: 'chapter reveal' },
        c.image ? h('img', { class: 'chapter-img', src: media(c.image), alt: '', loading: 'lazy', decoding: 'async' }) : null,
        h('div', null,
          c.label ? h('div', { class: 'eyebrow' }, c.label) : null,
          h('h3', null, c.title),
          c.text ? h('p', { class: 'pre' }, c.text) : null))))));
  }

  function person(name, photo, label, father, mother) {
    return h('div', null,
      photo ? h('img', { class: 'portrait', src: media(photo), alt: name, loading: 'lazy' }) : null,
      h('h3', null, name),
      h('small', null, label, h('br'), father, h('br'), mother));
  }

  function couple() {
    const validity = guest
      ? (guest.max_companions > 0 ? `Convite válido para ${guest.max_companions + 1} pessoas` : 'Convite válido para 1 pessoa')
      : s.invite_validity;
    return section('noivos', 'tint', h('div', { class: 'wrap' },
      sectionHead('couple'),
      h('div', { class: 'couple' },
        person(s.bride_name, s.bride_photo, 'Filha de', s.bride_father, s.bride_mother),
        person(s.groom_name, s.groom_photo, 'Filho de', s.groom_father, s.groom_mother)),
      h('div', { class: 'formal' },
        h('p', { class: 'pre' }, s.formal_text),
        h('h3', null, guest ? guest.name : s.guest_label),
        h('small', null, validity), h('small', null, s.children_notice))));
  }

  function calendar() {
    const { y, m, d } = parts(s.wedding_date);
    if (!d) return null;
    const blanks = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => h('span', { class: 'dow' }, x));
    for (let i = 0; i < blanks; i++) cells.push(h('span'));
    for (let i = 1; i <= total; i++) cells.push(h('span', { class: i === d ? 'day' : null, 'aria-current': i === d ? 'date' : null }, i));
    return section('data', '', h('div', { class: 'wrap' },
      sectionHead('date'),
      h('div', { class: 'calendar' }, h('div', { class: 'cal-title' }, `${MONTHS[m - 1]} ${y}`), h('div', { class: 'cal-grid' }, cells)),
      h('div', { class: 'actions' }, calBtn('ghost'))));
  }

  function program() {
    if (!events.length) return null;
    return section('programa', 'tint', h('div', { class: 'wrap' },
      sectionHead('program'),
      h('ol', { class: 'prog' }, events.map((e) => h('li', null,
        h('time', null, e.time),
        h('div', null, h('h3', null, e.title), e.location ? h('p', null, e.location) : null, e.description ? h('p', null, e.description) : null))))));
  }

  function places() {
    const seen = new Map();
    for (const e of events) {
      if (!e.location) continue;
      const cur = seen.get(e.location);
      if (!cur || (!cur.map_url && e.map_url)) seen.set(e.location, e);
    }
    if (!seen.size) return null;
    return section('local', '', h('div', { class: 'wrap wide' },
      sectionHead('places'),
      h('div', { class: 'places' }, [...seen.values()].map((e) => h('div', { class: 'place' },
        h('h3', null, e.location),
        h('a', { class: 'btn ghost small', target: '_blank', rel: 'noopener', href: mapHref(safeHref(e.map_url), e.location) }, icon(ICONS.pin), 'Abrir no mapa'))))));
  }

  const SWATCH = { terracotta: '#b5583b', 'dark green': '#22402f', 'cedar rose': '#a9625f', 'bordô': '#5e1f27', 'mocha mousse': '#a47864', 'warm beige': '#d6bea0', brown: '#5b3a29', olive: '#6b6b3a', 'muted teal': '#5d8583', preto: '#111111', 'castanho escuro': '#3b2619', castanho: '#6b4530', camel: '#b98d57', bege: '#d9c6a5' };
  function tabs(items) {
    const panel = h('div');
    const btns = items.map((item, i) => h('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false',
      onclick: (e) => { btns.forEach((b) => b.setAttribute('aria-selected', b === e.currentTarget ? 'true' : 'false')); panel.replaceChildren(item.render()); },
    }, item.label));
    panel.append(items[0].render());
    return [h('div', { class: 'tabs', role: 'tablist' }, btns), panel];
  }
  function palette(colors, image) {
    return h('div', null,
      h('div', { class: 'swatches' }, (colors || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
        const col = SWATCH[c.toLowerCase()];
        const dot = h('i');
        if (col) dot.style.background = col;
        return h('div', null, col ? dot : null, c);
      })),
      image ? h('img', { class: 'dc-img', src: media(image), alt: 'Paleta sugerida', loading: 'lazy' }) : null);
  }
  function dresscode() {
    return section('dress-code', '', h('div', { class: 'wrap' },
      sectionHead('dress'),
      s.dresscode_text ? h('p', { class: 'rules' }, s.dresscode_text) : null,
      tabs([
        { label: 'Mulheres', render: () => palette(s.dresscode_women_colors, s.dresscode_women_image) },
        { label: 'Homens', render: () => palette(s.dresscode_men_colors, s.dresscode_men_image) },
      ]),
      s.dresscode_warning ? h('p', { class: 'warning' }, s.dresscode_warning) : null));
  }

  function galleryView() {
    if (!gallery.length) return null;
    let index = 0;
    const big = h('img', { alt: '' });
    const show = (i) => { index = (i + gallery.length) % gallery.length; big.src = media(gallery[index].media_id); big.alt = `Fotografia ${index + 1} de ${gallery.length}`; };
    const lb = h('dialog', { class: 'lb' }, big,
      h('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', onclick: () => lb.close() }, '×'),
      gallery.length > 1 ? h('button', { class: 'p', type: 'button', 'aria-label': 'Anterior', onclick: () => show(index - 1) }, '‹') : null,
      gallery.length > 1 ? h('button', { class: 'n', type: 'button', 'aria-label': 'Seguinte', onclick: () => show(index + 1) }, '›') : null);
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(index - 1); if (e.key === 'ArrowRight') show(index + 1); });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1)); }, { passive: true });
    return section('galeria', 'tint', h('div', { class: 'wrap wide' },
      sectionHead('gallery'),
      h('div', { class: 'gallery' }, gallery.map((p, i) => h('button', { type: 'button', 'aria-label': `Ampliar fotografia ${i + 1}`, onclick: () => { show(i); lb.showModal(); } },
        h('img', { src: media(i === 0 ? p.media_id : (p.thumb_id || p.media_id)), alt: '', loading: i < 2 ? 'eager' : 'lazy', decoding: 'async' })))),
      lb));
  }

  // ---------- Passe e pétalas ----------
  const passFacts = () => {
    const p = parts(s.wedding_date);
    return [
      ['Data', p.d ? `${p.d} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}` : ''],
      ['Hora', (s.wedding_time || '').replace(':', 'h')],
      ['Local', events[0] ? events[0].location : ''],
      ['Pessoas', String(1 + (guest.companions || 0))],
    ].filter(([, v]) => v);
  };

  // Desenhado num canvas próprio: a imagem não depende de bibliotecas nem contém o link pessoal.
  async function savePass() {
    const fontTitles = s.font_titles;
    const fontText = s.font_text;
    if (document.fonts) await Promise.all([document.fonts.load(`italic 60px ${fontTitles}`), document.fonts.load(`20px ${fontText}`)]).catch(() => {});
    const canvas = h('canvas', { width: 900, height: 1200 });
    const c = canvas.getContext('2d');
    const center = (text, y) => c.fillText(text, 450, y);
    const wrapLines = (text, width) => text.split(/\s+/).reduce((out, word) => {
      const next = out.length ? `${out[out.length - 1]} ${word}` : word;
      if (out.length && c.measureText(next).width <= width) out[out.length - 1] = next;
      else out.push(word);
      return out;
    }, []);
    c.fillStyle = s.color_primary;
    c.fillRect(0, 0, 900, 1200);
    c.fillStyle = '#fffcf6';
    c.fillRect(60, 60, 780, 1080);
    c.strokeStyle = s.color_gold;
    c.lineWidth = 2;
    c.strokeRect(84, 84, 732, 1032);
    c.textAlign = 'center';
    c.fillStyle = s.color_primary;
    c.beginPath();
    c.arc(450, 210, 62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f6e4c4';
    c.font = `italic 44px ${fontTitles}`;
    c.textBaseline = 'middle';
    center(s.envelope_seal_text, 210);
    c.textBaseline = 'alphabetic';
    c.fillStyle = s.color_secondary;
    c.font = `26px ${fontText}`;
    center('PASSE DE CONVIDADO', 335);
    c.fillStyle = s.color_primary;
    c.font = `italic 68px ${fontTitles}`;
    let y = 430;
    wrapLines(guest.name, 660).slice(0, 3).forEach((line) => { center(line, y); y += 76; });
    c.fillStyle = s.color_text;
    c.font = `30px ${fontText}`;
    center(s.couple_display, y + 10);
    y += 70;
    c.strokeStyle = s.color_gold;
    c.setLineDash([10, 10]);
    c.beginPath();
    c.moveTo(130, y);
    c.lineTo(770, y);
    c.stroke();
    c.setLineDash([]);
    y += 70;
    passFacts().forEach(([label, value]) => {
      c.fillStyle = s.color_secondary;
      c.font = `22px ${fontText}`;
      center(label.toUpperCase(), y);
      c.fillStyle = s.color_primary;
      c.font = `42px ${fontTitles}`;
      wrapLines(value, 640).slice(0, 2).forEach((line) => { y += 48; center(line, y); });
      y += 62;
    });
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('Não foi possível criar a imagem.');
    const file = new File([blob], 'passe-casamento.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] }).catch((e) => { if (e.name !== 'AbortError') throw e; });
      return;
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function passView() {
    return h('div', { class: 'pass' },
      h('div', { class: 'pass-mono' }, s.envelope_seal_text),
      h('div', { class: 'legend' }, 'Passe de convidado'),
      h('div', { class: 'pass-name' }, guest.name),
      h('dl', { class: 'pass-facts' }, passFacts().map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
      h('button', {
        class: 'btn ghost full', type: 'button',
        onclick: () => savePass().catch(() => toast('Não foi possível guardar o passe. Tente fazer uma captura do ecrã.')),
      }, 'Guardar passe'));
  }

  function petals() {
    if (reducedMotion()) return;
    const canvas = h('canvas', { class: 'petals', 'aria-hidden': 'true' });
    const c = canvas.getContext('2d');
    if (!c) return;
    document.body.append(canvas);
    const w = innerWidth;
    const hh = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * ratio;
    canvas.height = hh * ratio;
    c.scale(ratio, ratio);
    const colours = [s.color_gold, s.color_primary, '#e4c98f', '#f3dcc0', '#b9545f'];
    const list = Array.from({ length: 70 }, (_, i) => ({
      x: Math.random() * w, y: -20 - Math.random() * hh, size: 4 + Math.random() * 6, speed: 1.3 + Math.random() * 1.8,
      turn: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.1, sway: Math.random() * 6.28, colour: colours[i % colours.length],
    }));
    const begin = performance.now();
    const frame = (now) => {
      const fade = Math.max(0, Math.min(1, (5200 - (now - begin)) / 1000));
      c.clearRect(0, 0, w, hh);
      let alive = false;
      list.forEach((p) => {
        p.y += p.speed; p.turn += p.spin; p.sway += 0.03;
        if (p.y < hh + 20) alive = true;
        c.save();
        c.globalAlpha = fade;
        c.translate(p.x + Math.sin(p.sway) * 16, p.y);
        c.rotate(p.turn);
        c.fillStyle = p.colour;
        c.beginPath();
        c.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.29);
        c.fill();
        c.restore();
      });
      if (alive && fade > 0) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  // ---------- RSVP ----------
  function thanksPanel(status, target) {
    const yes = status === 'sim';
    const withPass = guest && yes && shown('celebration');
    const list = [];
    if (guest && yes) {
      if (!withPass) list.push(h('li', null, `${1 + (guest.companions || 0)} pessoa(s) confirmada(s)`));
      (guest.companion_names || []).forEach((n) => list.push(h('li', null, n)));
    }
    const personal = guest ? `${location.origin}/c/${guest.token}` : '';
    return h('div', { class: 'thanks', tabindex: '-1' },
      h('svg', { class: 'sealmark', viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'aria-hidden': 'true' }, h('circle', { cx: '18', cy: '24', r: '11' }), h('circle', { cx: '30', cy: '24', r: '11' })),
      h('h3', null, yes ? 'Até breve!' : 'Obrigado'),
      h('p', null, yes ? s.thanks_yes : s.thanks_no),
      withPass ? passView() : null,
      list.length ? h('ul', null, list) : null,
      h('div', { class: 'actions' },
        yes ? calBtn('') : null,
        yes && events[0] && events[0].location ? h('a', { class: 'btn ghost', target: '_blank', rel: 'noopener', href: mapHref(safeHref(events[0].map_url), events[0].location) }, icon(ICONS.pin), 'Ver o local') : null),
      rsvp.open && personal ? h('p', { style: null }, h('br'),
        h('button', { class: 'link', type: 'button', onclick: () => target.replaceChildren(rsvpForm(target)) }, 'Alterar a minha resposta'), ' · ',
        h('button', { class: 'link', type: 'button', onclick: () => copy(personal, 'Link pessoal copiado. Guarde-o para alterar a resposta.') }, 'Copiar o meu link')) : null);
  }

  function rsvpForm(target) {
    const allowed = guest ? guest.max_companions : Number(s.public_max_companions || 0);
    let count = guest ? guest.companions || 0 : 0;
    const err = h('p', { class: 'err', role: 'alert' });
    const nameInput = guest ? null : h('input', { type: 'text', name: 'nome', required: true, maxLength: 120, autocomplete: 'name' });
    // Em branco mantém o número que os noivos já têm; só se escreve para o mudar.
    const hint = guest && guest.phone_hint ? `Já temos o número terminado em ${guest.phone_hint}` : '+258 …';
    const phone = h('input', { type: 'tel', name: 'telefone', maxLength: 30, autocomplete: 'tel', inputMode: 'tel', placeholder: hint, 'aria-label': hint });
    const notes = h('textarea', { name: 'observacao', rows: 3, maxLength: 1000, value: guest ? guest.notes || '' : '' });
    const trap = h('div', { class: 'hp', 'aria-hidden': 'true' }, h('input', { type: 'text', name: 'website', tabIndex: -1, autocomplete: 'off' }));
    const radio = (value, text) => h('label', null, h('input', { type: 'radio', name: 'status', value, required: true, checked: guest && guest.status === value }), text);
    const namesBox = h('div');
    const companionNames = guest ? [...(guest.companion_names || [])] : [];
    const out = h('output', null, String(count));
    const drawNames = () => {
      out.textContent = String(count);
      namesBox.replaceChildren(...Array.from({ length: count }, (_, i) => h('label', { class: 'field' }, h('span', null, `Nome do acompanhante ${i + 1}`),
        h('input', { type: 'text', maxLength: 120, value: companionNames[i] || '', oninput: (e) => { companionNames[i] = e.target.value; } }))));
    };
    const step = (delta) => { count = Math.max(0, Math.min(allowed, count + delta)); drawNames(); };
    const companionsBox = allowed > 0 ? h('div', null,
      h('div', { class: 'field' }, h('span', null, `Acompanhantes (até ${allowed})`),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': 'Menos um', onclick: () => step(-1) }, '−'), out,
          h('button', { type: 'button', 'aria-label': 'Mais um', onclick: () => step(1) }, '+'))),
      namesBox) : null;
    drawNames();
    const submit = h('button', { class: 'btn full', type: 'submit' }, guest && guest.status !== 'pendente' ? 'Actualizar resposta' : 'Confirmar');
    const form = h('form', {
      novalidate: false,
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        const status = form.elements.status.value;
        try {
          const out2 = await post('/api/rsvp', {
            token: guest ? guest.token : undefined,
            nome: nameInput ? nameInput.value : undefined,
            telefone: phone.value, status, observacao: notes.value,
            acompanhantes: status === 'sim' ? count : 0,
            nomes_acompanhantes: companionNames.slice(0, count),
            website: trap.querySelector('input').value,
          });
          if (out2.token) {
            guest = {
              ...(guest || { name: nameInput.value.trim(), max_companions: allowed }), token: out2.token, status,
              phone: phone.value, notes: notes.value, companions: status === 'sim' ? count : 0,
              companion_names: status === 'sim' ? companionNames.slice(0, count).filter(Boolean) : [],
            };
          }
          const panel = thanksPanel(status, target);
          target.replaceChildren(panel);
          panel.focus({ preventScroll: true });
          target.scrollIntoView({ block: 'center' });
          if (status === 'sim' && shown('celebration')) petals();
        } catch (ex) {
          err.textContent = ex.message;
          submit.disabled = false;
        }
      },
    },
      guest ? h('p', { style: null, class: 'lead' }, h('strong', null, guest.name), h('br'), h('br')) : h('label', { class: 'field' }, h('span', null, 'Nome completo'), nameInput),
      h('fieldset', null, h('legend', { class: 'legend' }, 'Poderá estar presente?'),
        h('div', { class: 'choice' }, radio('sim', 'Sim, estarei presente'), radio('nao', 'Infelizmente, não poderei ir'))),
      companionsBox,
      h('label', { class: 'field' }, h('span', null, 'Telefone (opcional)'), phone),
      h('label', { class: 'field' }, h('span', null, 'Observação (opcional)'), notes),
      trap, err, submit);
    return form;
  }

  function rsvpView() {
    const target = h('div', { class: 'card' });
    const answered = guest && guest.status !== 'pendente';
    if (!rsvp.open) {
      target.append(answered ? thanksPanel(guest.status, target) : h('div', { class: 'thanks' },
        h('h3', null, isPast() ? 'Obrigado' : 'Confirmações encerradas'),
        h('p', null, isPast() ? s.thanks_after_event : 'O prazo de confirmação já terminou. Em caso de dúvida, contacte os noivos.')));
    } else if (answered) target.append(thanksPanel(guest.status, target));
    else if (!guest && s.rsvp_public !== '1') {
      target.append(h('div', { class: 'thanks' }, h('p', null, 'Utilize o link pessoal que recebeu para confirmar a sua presença.')));
    } else target.append(rsvpForm(target));
    return section('rsvp', 'rsvp', h('div', { class: 'wrap' },
      sectionHead('rsvp'),
      rsvp.open ? h('p', { class: 'lead' }, s.rsvp_intro) : null,
      rsvp.open && rsvp.deadline ? h('p', { class: 'deadline' }, `até ${longDate(rsvp.deadline)}`) : null,
      target));
  }

  // ---------- Mensagens ----------
  function messagesView() {
    const err = h('p', { class: 'err', role: 'alert' });
    const nome = h('input', { type: 'text', required: true, maxLength: 120, value: guest ? guest.name : '', autocomplete: 'name' });
    const relacao = h('input', { type: 'text', maxLength: 80, placeholder: 'Ex.: amigo, familiar' });
    const msg = h('textarea', { rows: 4, required: true, maxLength: 800 });
    const trap = h('input', { type: 'text', tabIndex: -1, autocomplete: 'off' });
    const submit = h('button', { class: 'btn full', type: 'submit' }, 'Enviar mensagem');
    const form = h('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        try {
          await post('/api/mensagem', { nome: nome.value, relacao: relacao.value, mensagem: msg.value, website: trap.value });
          form.replaceChildren(h('div', { class: 'thanks' }, h('h3', null, 'Mensagem recebida'), h('p', null, 'Obrigado! Será publicada depois de os noivos a lerem.')));
        } catch (ex) { err.textContent = ex.message; submit.disabled = false; }
      },
    },
      h('label', { class: 'field' }, h('span', null, 'Nome'), nome),
      h('label', { class: 'field' }, h('span', null, 'Relação (opcional)'), relacao),
      h('label', { class: 'field' }, h('span', null, 'Mensagem'), msg),
      h('div', { class: 'hp', 'aria-hidden': 'true' }, trap), err, submit);
    return section('mensagens', 'tint', h('div', { class: 'wrap wide' },
      sectionHead('messages'),
      messages.length ? h('div', { class: 'notes' }, messages.map((m) => h('blockquote', { class: 'note' }, h('p', null, `“${m.mensagem}”`), h('footer', null, m.nome, m.relacao ? ` · ${m.relacao}` : '')))) : null,
      form));
  }

  // ---------- Presentes ----------
  function copy(text, done) {
    const ok = () => toast(done || 'Copiado');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, () => toast(text));
    else toast(text);
  }

  function giftCard(g) {
    const body = h('div', null, h('h4', null, g.name), g.description ? h('p', null, g.description) : null);
    const place = h('div', { class: 'pick' });
    if (!g.available) place.append(h('span', { class: 'taken' }, 'Já escolhido'));
    else if (!guest || !guest.token) place.append(h('span', { class: 'taken' }, 'Para escolher, abra o convite pelo seu link pessoal.'));
    else {
      const name = h('p', { class: 'taken' }, `Em nome de ${guest.name}`);
      const err = h('p', { class: 'err', role: 'alert' });
      const btn = h('button', { class: 'btn small', type: 'submit' }, 'Escolher');
      place.append(h('form', {
        class: 'pick',
        onsubmit: async (e) => {
          e.preventDefault();
          if (!window.confirm(`Escolher “${g.name}”? Depois não é possível trocar.`)) return;
          btn.disabled = true;
          err.textContent = '';
          try {
            await post(`/api/presente/${g.id}`, { token: guest.token });
            g.available = 0;
            place.replaceChildren(h('span', { class: 'taken' }, 'Reservado. Muito obrigado!'));
          } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
        },
      }, name, err, btn));
    }
    body.append(place);
    return h('article', { class: 'item' }, g.image ? h('img', { src: media(g.image), alt: '', loading: 'lazy' }) : null, body);
  }

  function giftsList() {
    return h('div', null,
      s.gift_rule_text ? h('p', { class: 'rules pre' }, s.gift_rule_text) : null,
      categories.map((c) => {
        const list = gifts.filter((g) => g.category_id === c.id);
        return list.length ? [h('h3', { class: 'gift-cat' }, c.name), c.image ? h('img', { class: 'dc-img', src: media(c.image), alt: '', loading: 'lazy' }) : null, h('div', { class: 'shops' }, list.map(giftCard))] : null;
      }));
  }

  function payRow(title, value, sub, copyValue) {
    return h('div', { class: 'pay' },
      h('div', null, h('strong', null, title), h('span', null, value), sub.filter(Boolean).map((x) => h('small', null, x))),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => copy(copyValue || value, 'Número copiado') }, 'Copiar'));
  }

  function moneyPanel() {
    return h('div', null,
      s.mpesa_number ? payRow('M-Pesa', s.mpesa_number, [s.mpesa_holder]) : null,
      s.emola_number ? payRow('E-Mola', s.emola_number, [s.emola_holder]) : null,
      s.bank_account ? payRow('Conta bancária', s.bank_account, [s.bank_nib ? `NIB: ${s.bank_nib}` : '', s.bank_holder]) : null);
  }

  function storesPanel() {
    return h('div', { class: 'shops' }, stores.map((st) => h('article', { class: 'item' },
      st.image ? h('img', { src: media(st.image), alt: '', loading: 'lazy' }) : null,
      h('div', null, h('h4', null, st.name), st.description ? h('p', null, st.description) : null, st.address ? h('p', null, st.address) : null,
        h('a', { class: 'btn ghost small', style: null, target: '_blank', rel: 'noopener', href: mapHref(safeHref(st.map_url), `${st.name} ${st.address || ''}`) }, 'Ver localização')))));
  }

  function giftsView() {
    const items = [];
    if (gifts.length) items.push({ label: 'Lista', render: giftsList });
    if (s.mpesa_number || s.emola_number || s.bank_account) items.push({ label: 'Monetário', render: moneyPanel });
    if (stores.length) items.push({ label: 'Lojas', render: storesPanel });
    if (!items.length) return null;
    return section('presentes', '', h('div', { class: 'wrap wide' },
      sectionHead('gifts'),
      h('p', { class: 'lead pre' }, s.gift_intro), h('br'),
      tabs(items)));
  }

  function manualView() {
    let items = [];
    try { items = JSON.parse(s.manual_guest_items || '[]'); } catch { /* lista vazia */ }
    if (!items.length) return null;
    return section('manual', 'tint', h('div', { class: 'wrap' },
      sectionHead('manual'),
      h('ol', { class: 'manual' }, items.map((i) => h('li', null, h('div', null, h('h3', null, i.title), h('p', null, i.text)))))));
  }

  let installEvent = null;
  function footer() {
    const install = h('button', {
      class: 'btn ghost', type: 'button', hidden: true,
      onclick: async () => { if (installEvent) { installEvent.prompt(); installEvent = null; install.hidden = true; } },
    }, 'Instalar convite');
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; install.hidden = false; });
    return h('footer', { class: 'foot' },
      h('h2', null, s.footer_brand),
      h('p', null, s.footer_text),
      h('div', { class: 'actions' }, shareBtn('ghost'), install),
      h('nav', null,
        safeHref(s.footer_instagram) ? h('a', { href: s.footer_instagram, target: '_blank', rel: 'noopener' }, 'Instagram') : null,
        s.footer_whatsapp ? h('a', { href: `https://wa.me/${s.footer_whatsapp}`, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null,
        s.footer_email ? h('a', { href: `mailto:${s.footer_email}` }, 'Email') : null),
      h('p', { class: 'fine' }, s.footer_copyright));
  }

  // ---------- Música ----------
  let audio = null;
  let musicBtn = null;
  function startMusic() {
    if (!audio) return;
    audio.play().then(() => musicBtn.classList.add('on')).catch(() => {});
  }
  function musicControl() {
    if (!s.music_file || s.music_enabled !== '1') return null;
    audio = h('audio', { src: media(s.music_file), loop: true, preload: 'none' });
    musicBtn = h('button', {
      class: 'music', type: 'button', 'aria-label': 'Ligar ou desligar a música',
      onclick: () => { if (audio.paused) startMusic(); else { audio.pause(); musicBtn.classList.remove('on'); } },
    }, icon(ICONS.note));
    return [audio, musicBtn];
  }

  // ---------- Montagem ----------
  const nav = [
    ['inicio', 'Início', ICONS.home], ['programa', 'Programa', ICONS.clock], ['local', 'Local', ICONS.pin],
    ['rsvp', 'Confirmar', ICONS.check], ['presentes', 'Presentes', ICONS.gift],
  ];
  const view = [
    hero(), shown('welcome') && welcome(), shown('chapters') && chaptersView(), shown('couple') && couple(), shown('date') && calendar(),
    shown('program') && program(), shown('places') && places(), shown('dress') && dresscode(),
    shown('gallery') && galleryView(), shown('rsvp') && rsvpView(), shown('messages') && messagesView(),
    shown('gifts') && giftsView(), shown('manual') && manualView(),
  ];
  const sections = view.filter(Boolean);
  const links = nav.filter(([id]) => sections.some((v) => v.id === id)).map(([id, label, d]) => h('a', { href: `#${id}`, 'data-id': id }, icon(d), label));
  const opened = (() => { try { return sessionStorage.getItem('opened') === '1'; } catch { return false; } })();
  if (shown('envelope') && !opened && !location.hash) {
    document.body.classList.add('locked');
    app.append(cover());
  }
  if (invalidToken) app.append(h('div', { class: 'alert', role: 'alert' }, 'Este link pessoal não foi encontrado. Pode usar o convite geral abaixo.'));
  app.append(
    ...sections, footer(), h('nav', { class: 'dock', 'aria-label': 'Navegação' }, links), toastEl);
  const music = musicControl();
  if (music) app.append(...music);

  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((list) => list.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));
    const spy = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.dataset.id === e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((el) => { if (nav.some(([id]) => id === el.id)) spy.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }
  if (location.hash) { const t = document.querySelector(location.hash.replace(/[^#\w-]/g, '')); if (t) t.scrollIntoView({ behavior: 'instant' }); }
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
