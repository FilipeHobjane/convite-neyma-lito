// Save the Date "porta": fotografias, vídeo e o botão "Aceito reservar este dia".
// Só esse botão abre o convite: regista a aceitação e, em câmara lenta, as duas metades
// da fotografia da união juntam-se numa só. Todo o texto entra por textContent, nunca como HTML.
(() => {
  const bootEl = document.getElementById('boot');
  if (!bootEl) { location.replace('/guarde-a-data'); return; }
  const { s, guest } = JSON.parse(bootEl.textContent);
  const app = document.getElementById('app');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  }
  // ---------- Cores do painel ----------
  const root = document.documentElement.style;
  const colours = { '--bg': s.color_std_bg, '--text': s.color_std_text, '--soft': s.color_std_soft, '--button': s.color_std_button, '--detail': s.color_std_detail, '--frame': s.color_std_frame };
  for (const [k, v] of Object.entries(colours)) if (/^#[0-9a-f]{6}$/i.test(v || '')) root.setProperty(k, v);
  // Texto do botão escuro ou claro, conforme a cor do botão.
  const lum = (hex) => { const n = parseInt(String(hex || '#000000').slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  root.setProperty('--on-button', lum(s.color_std_button) > 0.55 ? '#1a0f09' : '#fbf6ef');
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme && s.color_std_bg) theme.setAttribute('content', s.color_std_bg);

  // ---------- Dados ----------
  const WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const [y, m, d] = (s.wedding_date || '').split('-').map(Number);
  const weekday = d ? WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : '';
  const pad = (n) => String(n).padStart(2, '0');
  const token = (/^\/guarde-a-data\/([\w-]{8,40})/.exec(location.pathname) || [])[1] || '';
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';
  const fill = (t) => String(t || '').replace(/\{casal\}/g, () => s.couple_display || '');

  // ---------- Página ----------
  const photos = [s.std_photo || s.cover_image, s.std_photo_2, s.std_photo_3].filter((id) => /^[a-f0-9]{32}$/.test(id || ''));
  const gallery = photos.length ? h('section', { class: `galeria n${photos.length}`, 'aria-label': `Fotografias de ${s.couple_display}` },
    photos.map((id, i) => h('div', { class: 'foto' }, h('img', { src: `/media/${id}`, alt: i ? '' : `Fotografia de ${s.couple_display}`, loading: i ? 'lazy' : 'eager', decoding: 'async' })))) : null;
  let video = null;
  if (/^[a-f0-9]{32}$/.test(s.std_video || '')) {
    video = h('video', { controls: true, playsInline: true, preload: 'metadata', src: `/media/${s.std_video}`, 'aria-label': `Vídeo de ${s.couple_display}` });
    video.setAttribute('playsinline', '');
    if (photos[0]) video.poster = `/media/${photos[0]}`;
  }

  const greeting = guest ? h('p', { class: 'saudacao' }, guest.salutation ? guest.salutation : h('span', null, 'Para ', h('strong', null, guest.name))) : null;

  const button = h('button', { class: 'botao-chave', type: 'button', 'aria-describedby': 'dica' }, h('span', { class: 'nucleo' }, s.std_button));
  const hint = h('p', { class: 'dica', id: 'dica' }, s.std_tap_hint);
  const error = h('p', { class: 'erro', role: 'alert', hidden: true });

  app.append(h('div', { class: 'aura', 'aria-hidden': 'true' }), h('main', { class: 'palco' },
    h('header', { class: 'topo' },
      guest && guest.cover_line ? h('p', { class: 'para' }, guest.cover_line) : null,
      greeting,
      h('p', { class: 'rotulo' }, [s.std_title, s.std_kind].filter(Boolean).join(' · ')),
      h('h1', { class: 'nomes' }, firstName(s.bride_name), h('span', { class: 'e', 'aria-label': 'e' }, '&'), firstName(s.groom_name)),
      d ? h('p', { class: 'data', 'aria-label': `${d}/${m}/${y}` }, h('span', null, pad(d)), h('i'), h('span', null, pad(m)), h('i'), h('span', null, String(y))) : null,
      h('p', { class: 'data-ext' }, [weekday, s.std_place].filter(Boolean).join(' · '))),
    gallery,
    video ? h('section', { class: 'video' }, video) : null,
    h('section', { class: 'pedido' }, h('h2', null, s.std_question), s.std_lock_text ? h('p', null, s.std_lock_text) : null),
    h('div', { class: 'chave' }, button, hint, error)));

  // ---------- União: a fotografia surge partida ao meio e as metades juntam-se devagar ----------
  const isId = (id) => /^[a-f0-9]{32}$/.test(id || '');
  const unionId = [s.std_union_photo, s.std_photo, s.cover_image].find(isId) || '';
  // Rasgo irregular, igual nas duas metades, para que encaixem na perfeição.
  const tear = [];
  for (let i = 0; i <= 20; i++) tear.push([50 + Math.sin(i * 2.3) * 3.2 + (i % 2 ? 1.6 : -1.6), i * 5]);
  const pts = (list) => list.map(([x, yy]) => `${x.toFixed(2)}% ${yy}%`).join(',');
  const leftClip = `polygon(0% 0%,${pts(tear)},0% 100%)`;
  const rightClip = `polygon(100% 0%,${pts(tear)},100% 100%)`;
  const half = (side, clip) => {
    const el = h('div', { class: `metade ${side}` }, h('img', { src: unionId ? `/media/${unionId}` : '', alt: '', decoding: 'async' }));
    el.style.setProperty('clip-path', clip);
    el.style.setProperty('-webkit-clip-path', clip);
    return el;
  };
  const union = h('div', { class: 'uniao', 'aria-hidden': 'true' },
    h('div', { class: 'cena' },
      h('div', { class: 'quadro' }, half('esq', leftClip), half('dir', rightClip),
        h('div', { class: 'inteira' }, h('img', { src: unionId ? `/media/${unionId}` : '', alt: '', decoding: 'async' })), h('span', { class: 'luz' })),
      h('p', { class: 'legenda' }, fill(s.std_door_caption))));
  if (unionId) document.body.append(union);

  // ---------- Aceitar ----------
  let busy = false;
  async function accept() {
    if (busy) return;
    busy = true;
    error.hidden = true;
    if (video && !video.paused) video.pause();
    button.classList.add('aceite');
    hint.textContent = 'A abrir o convite…';
    const started = performance.now();
    const animate = unionId && !reduced();
    if (animate) requestAnimationFrame(() => { union.classList.add('visivel'); requestAnimationFrame(() => union.classList.add('unir')); });
    let next = '';
    try {
      const r = await fetch('/api/aceitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'same-origin' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Não foi possível abrir o convite.');
      next = data.next || (token ? `/c/${token}` : '/');
    } catch (err) {
      busy = false;
      union.className = 'uniao';
      button.classList.remove('aceite');
      hint.textContent = s.std_tap_hint;
      error.textContent = `${err.message && !/fetch|network/i.test(err.message) ? err.message : 'Sem ligação à internet.'} Toque de novo para tentar.`;
      error.hidden = false;
      return;
    }
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 70]); } catch { /* opcional */ }
    if (!animate) { location.assign(next); return; }
    const wait = (ms) => new Promise((ok) => setTimeout(ok, Math.max(0, ms - (performance.now() - started))));
    // 0 a 3,6 s: as metades aproximam-se; 3,6 s: a luz sela a união e a cor volta; depois entra o convite.
    await wait(3700);
    union.classList.add('restaurada');
    await wait(6200);
    union.classList.add('entrar');
    await wait(7000);
    location.assign(next);
  }
  button.addEventListener('click', accept);
  // Ao voltar atrás para esta página, recomeça do início.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    busy = false;
    button.classList.remove('aceite');
    union.className = 'uniao';
    hint.textContent = s.std_tap_hint;
  });
})();
