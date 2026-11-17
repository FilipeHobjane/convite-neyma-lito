// Save the Date "porta": fotografias, vídeo e o botão "Aceito reservar este dia".
// Só esse botão abre o convite: regista a aceitação, faz florir a grinalda de rosas,
// toca o sino e abre as portas da igreja. Todo o texto entra por textContent, nunca como HTML.
(() => {
  const bootEl = document.getElementById('boot');
  if (!bootEl) { location.replace('/guarde-a-data'); return; }
  const { s, guest } = JSON.parse(bootEl.textContent);
  const app = document.getElementById('app');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

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
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.append(el);
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

  const coroa = svg('svg', { viewBox: '0 0 164 164', 'aria-hidden': 'true' });
  const button = h('button', { class: 'botao-chave', type: 'button', 'aria-describedby': 'dica' }, coroa, h('span', { class: 'nucleo' }, s.std_button));
  const hint = h('p', { class: 'dica', id: 'dica' }, s.std_tap_hint);
  const error = h('p', { class: 'erro', role: 'alert', hidden: true });

  app.append(h('div', { class: 'aura', 'aria-hidden': 'true' }), h('main', { class: 'palco' },
    h('header', { class: 'topo' },
      guest && guest.cover_line ? h('p', { class: 'para' }, guest.cover_line) : null,
      greeting,
      h('p', { class: 'rotulo' }, [s.std_title, s.std_kind].filter(Boolean).join(' · ')),
      h('h1', { class: 'nomes' }, firstName(s.bride_name), h('span', { class: 'e' }, 'E'), firstName(s.groom_name)),
      d ? h('p', { class: 'data', 'aria-label': `${d}/${m}/${y}` }, h('span', null, pad(d)), h('i'), h('span', null, pad(m)), h('i'), h('span', null, String(y))) : null,
      h('p', { class: 'data-ext' }, [weekday, s.std_place].filter(Boolean).join(' · '))),
    gallery,
    video ? h('section', { class: 'video' }, video) : null,
    h('section', { class: 'pedido' }, h('h2', null, s.std_question), s.std_lock_text ? h('p', null, s.std_lock_text) : null),
    h('div', { class: 'chave' }, button, hint, error)));

  // ---------- Grinalda: um ramo corre à volta do botão e as rosas abrem-se à sua passagem ----------
  (() => {
    const N = 14; const R = 70; const C = 82; const RUN = 1.3;
    const defs = svg('defs', {}, coroa);
    // v: esmeralda, r: chocolate
    [['v', '#7fe0b5', '#0f6b4f', '#063d2c'], ['r', '#b98366', '#5a3523', '#2a170d']].forEach(([id, light, mid, dark]) => {
      const g = svg('radialGradient', { id: `pet-${id}`, cx: '40%', cy: '35%', r: '75%' }, defs);
      svg('stop', { offset: '0%', 'stop-color': light }, g);
      svg('stop', { offset: '60%', 'stop-color': mid }, g);
      svg('stop', { offset: '100%', 'stop-color': dark }, g);
      const sym = svg('symbol', { id: `rosa-${id}`, viewBox: '-12 -12 24 24', overflow: 'visible' }, defs);
      for (let k = 0; k < 5; k++) svg('ellipse', { cx: 0, cy: -5.2, rx: 5.4, ry: 6.2, fill: `url(#pet-${id})`, stroke: dark, 'stroke-width': 0.35, 'stroke-opacity': 0.5, transform: `rotate(${k * 72})` }, sym);
      for (let k = 0; k < 3; k++) svg('ellipse', { cx: 0, cy: -2.6, rx: 3.6, ry: 4, fill: `url(#pet-${id})`, stroke: dark, 'stroke-width': 0.35, 'stroke-opacity': 0.6, transform: `rotate(${k * 120 + 40})` }, sym);
      svg('path', { d: 'M0,0 m-.8,0 a.8,.8 0 1 1 1.6,0 a1.7,1.7 0 1 1 -3.4,0 a2.6,2.6 0 1 1 5.2,.3', fill: 'none', stroke: dark, 'stroke-width': 0.7, 'stroke-linecap': 'round' }, sym);
    });
    svg('circle', { class: 'trilho-anel', cx: C, cy: C, r: R }, coroa);
    let path = '';
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2 - Math.PI / 2;
      const rr = R + Math.sin((i / 240) * Math.PI * 2 * N) * 3.2;
      path += `${i ? 'L' : 'M'}${(C + rr * Math.cos(a)).toFixed(2)},${(C + rr * Math.sin(a)).toFixed(2)}`;
    }
    const vine = svg('path', { class: 'ramo', d: path }, coroa);
    vine.style.setProperty('--comp', String(Math.ceil(vine.getTotalLength ? vine.getTotalLength() : 460)));
    for (let i = 0; i < N; i++) {
      const delay = (i / N) * RUN;
      const fa = ((i + 0.5) / N) * Math.PI * 2 - Math.PI / 2;
      const fx = C + (R + 5) * Math.cos(fa); const fy = C + (R + 5) * Math.sin(fa);
      const wf = svg('g', { transform: `translate(${fx.toFixed(2)} ${fy.toFixed(2)}) rotate(${((fa * 180) / Math.PI + 60).toFixed(1)})` }, coroa);
      svg('ellipse', { class: 'folhinha', cx: 0, cy: 0, rx: 4.6, ry: 1.9 }, wf).style.setProperty('animation-delay', `${(delay + 0.12).toFixed(2)}s`);
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const w = svg('g', { transform: `translate(${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)})` }, coroa);
      const rose = svg('g', { class: 'rosa' }, w);
      svg('use', { href: `#rosa-${i % 2 ? 'r' : 'v'}`, x: -11, y: -11, width: 22, height: 22, transform: `rotate(${i * 53})` }, rose);
      rose.style.setProperty('animation-delay', `${delay.toFixed(2)}s`);
    }
  })();

  // ---------- Porta da igreja ----------
  const door = h('div', { class: 'porta', 'aria-hidden': 'true' },
    h('div', { class: 'cena' },
      h('div', { class: 'cruz' }),
      h('div', { class: 'arco' },
        h('div', { class: 'folha esq' }, h('div', { class: 'painel alto' }), h('div', { class: 'painel' }), h('span', { class: 'argola' })),
        h('div', { class: 'folha dir' }, h('div', { class: 'painel alto' }), h('div', { class: 'painel' }), h('span', { class: 'argola' }))),
      h('div', { class: 'degrau' }),
      h('p', { class: 'legenda' }, fill(s.std_door_caption))));
  document.body.append(door);

  // ---------- Sino ----------
  // Com uma gravação carregada no painel, toca-a (os telemóveis tocam <audio> mesmo em silêncio).
  // Sem gravação, um repique de seis sinos gerado no próprio telemóvel.
  let audioCtx = null;
  function synthPeal() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const ctx = audioCtx;
    const len = Math.floor(ctx.sampleRate * 3.8);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const data = buf.getChannelData(c); for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = ctx.createConvolver(); conv.buffer = buf;
    const wet = ctx.createGain(); wet.gain.value = 0.55; conv.connect(wet).connect(ctx.destination);
    const bell = (t, nominal, vol) => {
      const prime = nominal / 2; const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination); out.connect(conv);
      [[0.5, 0.35, 4.5], [1, 0.5, 3.2], [1.2, 0.45, 2.6], [1.5, 0.22, 2], [2, 0.6, 2.2], [2.5, 0.18, 1.3], [2.67, 0.2, 1.1], [3, 0.16, 0.9], [4.03, 0.1, 0.5]].forEach(([r, a, dur]) => {
        [-0.35, 0.35].forEach((det) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = prime * r + det;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * 0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
        });
      });
    };
    const notes = [784, 698.5, 659.3, 587.3, 523.3, 440];
    let t = ctx.currentTime + 0.05;
    for (let round = 0; round < 3; round++) { notes.forEach((f) => { bell(t, f, 0.9 - round * 0.15); t += 0.34; }); t += round % 2 ? 0.34 : 0; }
  }
  function ringBell() {
    try {
      if (/^[a-f0-9]{32}$/.test(s.std_bell || '')) {
        const a = new Audio(`/media/${s.std_bell}`);
        a.play().catch(() => synthPeal());
      } else synthPeal();
    } catch { /* o som é opcional */ }
  }

  // ---------- Aceitar ----------
  let busy = false;
  async function accept() {
    if (busy) return;
    busy = true;
    error.hidden = true;
    if (video && !video.paused) video.pause();
    button.classList.add('aceite');
    hint.textContent = 'A abrir o convite…';
    ringBell();
    const started = performance.now();
    let next = '';
    try {
      const r = await fetch('/api/aceitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'same-origin' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Não foi possível abrir o convite.');
      next = data.next || (token ? `/c/${token}` : '/');
    } catch (err) {
      busy = false;
      button.classList.remove('aceite');
      hint.textContent = s.std_tap_hint;
      error.textContent = `${err.message && !/fetch|network/i.test(err.message) ? err.message : 'Sem ligação à internet.'} Toque de novo para tentar.`;
      error.hidden = false;
      return;
    }
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 70]); } catch { /* opcional */ }
    if (reduced()) { location.assign(next); return; }
    const wait = (ms) => new Promise((ok) => setTimeout(ok, Math.max(0, ms - (performance.now() - started))));
    await wait(1700);
    door.classList.add('visivel');
    await wait(2700);
    door.classList.add('aberta');
    await wait(4700);
    door.classList.add('entrar');
    await wait(5500);
    location.assign(next);
  }
  button.addEventListener('click', accept);
  // Ao voltar atrás para esta página, recomeça do início.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    busy = false;
    button.classList.remove('aceite');
    door.className = 'porta';
    hint.textContent = s.std_tap_hint;
  });
})();
