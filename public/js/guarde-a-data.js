// Save the Date. A data fica escondida por uma folha dourada que o convidado raspa.
// Todo o texto entra por textContent, nunca como HTML.
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

  const root = document.documentElement.style;
  const theme = { '--primary': s.color_primary, '--gold': s.color_gold, '--font-titles': s.font_titles, '--font-text': s.font_text };
  for (const [k, v] of Object.entries(theme)) if (v) root.setProperty(k, v);

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const [y, m, d] = (s.wedding_date || '').split('-').map(Number);
  const weekday = d ? WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : '';
  // A mesma hora do convite, para as duas contagens coincidirem.
  const target = Date.parse(`${s.wedding_date}T${s.wedding_time || '00:00'}:00${s.event_tz || '+02:00'}`);
  const past = Date.now() > target + 864e5;
  // O código do link pessoal é o mesmo do convite.
  const token = (/^\/guarde-a-data\/([\w-]{8,40})/.exec(location.pathname) || [])[1];
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';

  function downloadIcs() {
    const pad = (n) => String(n).padStart(2, '0');
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const now = new Date();
    const esc = (v) => String(v || '').replace(/([,;\\])/g, '\\$1');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Convite//PT', 'BEGIN:VEVENT', `UID:save-the-date-${s.wedding_date}@convite`,
      `DTSTAMP:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T000000Z`,
      `DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`,
      `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`,
      `SUMMARY:${esc(`Casamento de ${s.couple_display}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'guarde-a-data.ics' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Página ----------
  const photoId = s.std_photo || s.cover_image;
  const foil = h('canvas', { class: 'foil', role: 'img', 'aria-label': 'Folha dourada que esconde a data' });
  // Com vídeo, a foto fica por cima até o vídeo ter imagem: nunca aparece o arco vazio.
  // O vídeo só tem endereço quando é preciso: assim é descarregado uma única vez.
  const videoUrl = s.std_video ? `/media/${s.std_video}` : '';
  const video = s.std_video ? h('video', {
    class: 'photo', muted: true, loop: true, playsInline: true, preload: 'auto', 'aria-label': `Vídeo de ${s.couple_display}`,
  }) : null;
  const cover = video && photoId ? h('img', { class: 'photo cover', src: `/media/${photoId}`, alt: '', fetchpriority: 'high' }) : null;
  if (video) {
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    if (cover) video.addEventListener('timeupdate', () => { if (!video.paused && video.currentTime > 0.05) cover.classList.add('off'); });
  }
  // O iPhone só deixa um vídeo tocar com som depois de um toque simples; raspar é arrastar e não conta.
  // O toque no selo de entrada inicia o vídeo com som e pára-o logo: a partir daí o iPhone aceita o som
  // sem novo toque. O vídeo fica a correr sem som por baixo do dourado, já carregado para a revelação.
  function unlockVideo() {
    if (!video) return;
    if (!video.getAttribute('src')) video.src = videoUrl;
    video.muted = false;
    video.play().catch(() => {});
    video.pause();
    video.muted = true;
    video.play().catch(() => {});
  }
  let pendingVideo = false;
  function startVideo() {
    if (!pendingVideo) return;
    if (!video.getAttribute('src')) video.src = videoUrl;
    video.muted = false;
    video.play().then(() => { pendingVideo = false; }).catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }
  // Se mesmo assim o telemóvel recusar, qualquer toque seguinte, em qualquer parte do ecrã, volta a tentar.
  if (video) ['touchend', 'pointerup', 'click'].forEach((n) => addEventListener(n, startVideo, { passive: true }));
  // Ao voltar à página (outra app, ecrã bloqueado), o telemóvel pode ter parado o vídeo: retoma-o.
  const resume = () => {
    if (!video || !finished || !video.paused || document.visibilityState !== 'visible') return;
    pendingVideo = true;
    startVideo();
  };
  document.addEventListener('visibilitychange', resume);
  addEventListener('pageshow', resume);
  const ticket = h('div', { class: 'ticket' },
    video || (photoId ? h('img', { class: 'photo', src: `/media/${photoId}`, alt: `Fotografia de ${s.couple_display}`, fetchpriority: 'high' }) : null),
    cover,
    h('div', { class: 'date' }, h('small', null, weekday), h('b', null, d), h('em', null, `${MONTHS[m - 1]} de ${y}`)),
    foil);
  const dias = h('b', null, '0');
  const horas = h('b', null, '00');
  const mins = h('b', null, '00');
  const count = h('div', { class: 'count', role: 'timer' },
    h('div', null, dias, h('small', null, 'Dias')), h('div', null, horas, h('small', null, 'Horas')), h('div', null, mins, h('small', null, 'Min')));
  // Depois do casamento, a página agradece em vez de convidar.
  const after = h('div', { class: 'after', hidden: true, 'aria-live': 'polite' },
    h('p', { class: 'line' }, past ? s.thanks_after_event : s.std_message), past ? null : count,
    past ? null : h('button', { class: 'btn', type: 'button', onclick: downloadIcs }, 'Guardar na agenda'),
    s.show_std_invite === '1' ? h('a', { class: 'btn ghost', href: token ? `/c/${token}` : '/' }, past ? 'Ver o convite' : 'Abrir o convite') : null,
    !past && s.std_next && s.show_std_invite !== '1' ? h('p', { class: 'next' }, s.std_next) : null);
  const before = h('p', { class: 'hint' }, s.std_hint);
  const names = [firstName(s.bride_name), firstName(s.groom_name)];
  const heading = () => h('div', null,
    h('h1', { class: 'title' }, s.std_title),
    h('div', { class: 'title-rule' }, h('i')),
    guest && guest.cover_line ? h('p', { class: 'line-to' }, guest.cover_line) : null,
    guest ? h('p', { class: 'to' }, guest.cover_line ? guest.name : `Para ${guest.name}`) : null);
  app.append(h('main', { class: 'arch' },
    heading(),
    h('p', { class: 'names' }, names[0], h('i', null, '&'), names[1]),
    ticket, before, after));
  // Selo de entrada: só existe com vídeo, porque é ele que permite a música começar sozinha.
  if (video) {
    const gate = h('div', { class: 'gate' },
      heading(),
      h('button', {
        class: 'gate-seal', type: 'button', 'aria-label': 'Abrir o Save the Date',
        onclick: () => {
          unlockVideo();
          gate.classList.add('gone');
          setTimeout(() => gate.remove(), 700);
        },
      }, s.envelope_seal_text),
      h('p', { class: 'hint' }, 'Toque no selo para abrir'));
    document.body.append(gate);
  }

  // ---------- Folha dourada ----------
  const ctx = foil.getContext('2d', { willReadFrequently: true });
  let finished = false;
  let drawing = false;
  let last = null;
  let strokes = 0;

  function paintFoil() {
    const box = foil.getBoundingClientRect();
    const { width: w, height: fh } = box;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    foil.width = Math.round(w * ratio);
    foil.height = Math.round(fh * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const g = ctx.createLinearGradient(0, 0, w, fh);
    [[0, '#8f6d33'], [0.28, '#e9d29c'], [0.5, '#b98f4b'], [0.72, '#f0dcae'], [1, '#94723a']].forEach(([at, c]) => g.addColorStop(at, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, fh);
    // Grão fixo: a folha parece metal e não uma cor lisa.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,245,215,.16)' : 'rgba(80,50,15,.13)';
      ctx.fillRect(((i * 7919) % 1000) / 1000 * w, ((i * 104729) % 1000) / 1000 * fh, 1.4, 1.4);
    }
    ctx.fillStyle = s.color_primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic 500 34px ${s.font_titles}`;
    ctx.fillText(s.envelope_seal_text, w / 2, fh / 2 - 12);
    ctx.font = `500 11px ${s.font_text}`;
    ctx.fillText('R A S P E   A Q U I', w / 2, fh / 2 + 22);
  }

  const point = (e) => { const b = foil.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  function check() {
    const { data } = ctx.getImageData(0, 0, foil.width, foil.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 96) { total++; if (data[i] < 40) clear++; }
    if (total && clear / total > 0.46) finish();
  }
  function scratch(from, to) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    strokes++;
  }
  foil.addEventListener('pointerdown', (e) => {
    if (finished) return;
    drawing = true;
    last = point(e);
    try { foil.setPointerCapture(e.pointerId); } catch { /* opcional */ }
    scratch(last, { x: last.x + 0.1, y: last.y + 0.1 });
  });
  foil.addEventListener('pointermove', (e) => {
    if (!drawing || finished) return;
    const p = point(e);
    scratch(last, p);
    last = p;
  });
  // Ao levantar o dedo: no toque, o iPhone só aceita iniciar o vídeo no touchend; com o rato, no pointerup.
  const lift = () => { drawing = false; if (finished) return; check(); };
  foil.addEventListener('touchend', lift);
  foil.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') lift(); });
  foil.addEventListener('pointercancel', () => { drawing = false; });

  function tick() {
    const left = target - Date.now();
    if (!(left > 0)) { count.hidden = true; return; }
    dias.textContent = Math.floor(left / 864e5);
    horas.textContent = String(Math.floor((left % 864e5) / 36e5)).padStart(2, '0');
    mins.textContent = String(Math.floor((left % 36e5) / 6e4)).padStart(2, '0');
  }

  function finish() {
    if (finished) return;
    finished = true;
    drawing = false;
    foil.classList.add('gone');
    ticket.classList.add('done');
    before.hidden = true;
    after.hidden = false;
    if (video) {
      if (video.readyState > 0) video.currentTime = 0;
      pendingVideo = true;
      startVideo();
    }
    tick();
    setInterval(tick, 30000);
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 70]); } catch { /* opcional */ }
    petals();
  }

  function petals() {
    if (reduced()) return;
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
    const colours = ['#e4c98f', s.color_gold, '#f3dcc0', '#b9545f', '#fff4dc'];
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

  paintFoil();
  // A letra pode chegar depois do primeiro desenho; a folha só é redesenhada se ninguém a raspou.
  const repaint = () => { if (!finished && !strokes) paintFoil(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(repaint);
  addEventListener('resize', repaint);
})();
