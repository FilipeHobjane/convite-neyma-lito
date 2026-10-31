// Painel de administração. Sem bibliotecas: pode ser editado com qualquer editor de texto.
(() => {
  const root = document.getElementById('admin');
  let D = null; // dados carregados de /api/admin/all
  let current = 'resumo';

  // ---------- Auxiliares ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  }
  const toastEl = h('div', { class: 'toast', role: 'status' });
  let tt;
  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.className = `toast on${bad ? ' bad' : ''}`;
    clearTimeout(tt);
    tt = setTimeout(() => { toastEl.className = 'toast'; }, bad ? 5000 : 2500);
  }
  async function api(path, method = 'GET', body) {
    const opts = { method, headers: {} };
    if (body instanceof Uint8Array || body instanceof Blob) { opts.body = body; opts.headers['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    let res;
    try { res = await fetch(`/api/admin/${path}`, opts); } catch { throw new Error('Sem ligação. Nada foi guardado.'); }
    if (res.status === 401 && path !== 'login') { showLogin(); throw new Error('Sessão terminada.'); }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Ocorreu um erro.');
    return out;
  }
  // Executa uma acção, mostra o resultado e recarrega o ecrã.
  async function act(fn, done) {
    try {
      await fn();
      if (done) toast(done);
      await load();
    } catch (e) { toast(e.message, true); }
  }
  const media = (id) => `/media/${id}`;
  const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(+d) ? iso : d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }); };
  const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

  // ---------- Imagens: reduzidas no navegador, sem processamento no servidor ----------
  async function resize(file, maxDim, quality = 0.82) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = h('canvas', { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Imagem inválida.'))), 'image/jpeg', quality));
  }
  async function uploadBlob(blob, mime, name) {
    const meta = await api('media', 'POST', { mime, name, size: blob.size });
    for (let i = 0; i < meta.chunks; i++) {
      const part = new Uint8Array(await blob.slice(i * meta.chunk_size, (i + 1) * meta.chunk_size).arrayBuffer());
      await api(`media/${meta.id}/${i}`, 'PUT', part);
    }
    return meta.id;
  }
  const uploadImage = async (file, maxDim = 1600) => uploadBlob(await resize(file, maxDim), 'image/jpeg', file.name);

  // ---------- Formulários ----------
  function field(def, values) {
    const v = values[def.k] ?? '';
    const common = { name: def.k };
    let input;
    if (def.t === 'area') input = h('textarea', { ...common, rows: def.rows || 3, value: v });
    else if (def.t === 'check') return h('label', { class: 'check' }, h('input', { ...common, type: 'checkbox', checked: v === '1' || v === 1 }), def.l);
    else if (def.t === 'select') input = h('select', common, def.options.map(([val, txt]) => h('option', { value: val, selected: String(val) === String(v) }, txt)));
    else input = h('input', { ...common, type: def.t || 'text', value: v, placeholder: def.ph || '', step: def.step, min: def.min, max: def.max });
    return h('label', { class: 'f' }, h('span', null, def.l), input, def.help ? h('small', { class: 'muted' }, def.help) : null);
  }
  function readForm(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      out[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
    }
    return out;
  }
  function settingsForm(title, defs, cols = 'two') {
    const form = h('form', {
      class: 'card',
      onsubmit: (e) => { e.preventDefault(); act(() => api('settings', 'PUT', readForm(form)), 'Alterações guardadas.'); },
    }, h('h2', null, title), h('div', { class: `grid ${cols}` }, defs.map((d) => field(d, D.settings))),
    h('div', { class: 'space' }, h('button', { class: 'btn' }, 'Guardar')));
    return form;
  }
  function imageSetting(label, key, maxDim) {
    return imageInput(label, D.settings[key], async (id) => act(() => api('settings', 'PUT', { [key]: id }), 'Imagem actualizada.'), maxDim);
  }
  function imageInput(label, value, onChange, maxDim) {
    const preview = value ? h('img', { src: media(value), alt: '' }) : h('div', { class: 'ph' });
    return h('div', { class: 'imgf' }, preview, h('div', null,
      h('div', { class: 'muted' }, label),
      h('div', { class: 'row space' },
        h('label', { class: 'btn alt sm file' }, value ? 'Substituir' : 'Carregar',
          h('input', {
            type: 'file', accept: 'image/*',
            onchange: async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              toast('A carregar…');
              try { onChange(await uploadImage(file, maxDim)); } catch (ex) { toast(ex.message, true); }
            },
          })),
        value ? h('button', { class: 'btn bad sm', type: 'button', onclick: () => onChange('') }, 'Remover') : null)));
  }

  // ---------- Convidados ----------
  let guestFilter = { q: '', status: '' };
  const STATUS = { sim: 'Confirmado', nao: 'Não vem', pendente: 'Sem resposta' };
  const guestLink = (g) => `${location.origin}/c/${g.token}`;
  const fold = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function guestDialog(g) {
    const isNew = !g;
    const v = g || { status: 'pendente', max_companions: 0, companions: 0 };
    const names = (() => { try { return JSON.parse(v.companion_names || '[]').join('\n'); } catch { return ''; } })();
    const err = h('p', { class: 'err' });
    const dlg = h('dialog');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const data = readForm(form);
        data.companion_names = data.companion_names.split('\n').map((x) => x.trim()).filter(Boolean);
        try {
          await api(isNew ? 'guests' : `guests/${g.id}`, isNew ? 'POST' : 'PUT', data);
          dlg.close();
          dlg.remove();
          toast('Convidado guardado.');
          await load();
        } catch (ex) { err.textContent = ex.message; }
      },
    },
      h('h2', null, isNew ? 'Novo convidado' : 'Editar convidado'),
      h('div', { class: 'grid two' },
        field({ k: 'name', l: 'Nome' }, v), field({ k: 'phone', l: 'Telefone', ph: '+258…' }, v),
        field({ k: 'group_name', l: 'Relação (define o modelo)', t: 'select', options: [...new Set(['', ...templates().slice(0, -1).map((t) => t.label), v.group_name || ''])].map((x) => [x, x || 'Sem relação']) }, v),
        field({ k: 'max_companions', l: 'Acompanhantes autorizados', t: 'number', min: 0, max: 50 }, v),
        field({ k: 'status', l: 'Estado', t: 'select', options: Object.entries(STATUS) }, v),
        field({ k: 'companions', l: 'Acompanhantes confirmados', t: 'number', min: 0, max: 50 }, v)),
      h('div', { class: 'grid space' },
        field({ k: 'salutation', l: 'Saudação na carta (opcional)', ph: 'Querida tia Ana,', help: 'Vazio: usa a saudação geral com o nome do convidado.' }, v),
        field({ k: 'personal_message', l: 'Mensagem pessoal na carta (opcional)', t: 'area', help: 'Só este convidado a vê, pelo seu link pessoal. Vazio: usa a mensagem geral.' }, v),
        field({ k: 'companion_names', l: 'Nomes dos acompanhantes (um por linha)', t: 'area' }, { companion_names: names }),
        field({ k: 'notes', l: 'Observação do convidado', t: 'area', rows: 2 }, v),
        field({ k: 'admin_notes', l: 'Notas internas (nunca públicas)', t: 'area', rows: 2 }, v)),
      err,
      h('div', { class: 'row end space' },
        h('button', { class: 'btn alt', type: 'button', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cancelar'),
        h('button', { class: 'btn' }, 'Guardar')));
    dlg.append(form);
    document.body.append(dlg);
    dlg.showModal();
  }

  // ---------- Modelos, telefones e mensagens ----------
  const templates = () => { try { return JSON.parse(D.settings.relation_templates || '[]'); } catch { return []; } };
  const knownRelation = (name) => templates().slice(0, -1).find((t) => fold(t.label).trim() === fold(name).trim());
  const templateFor = (g) => knownRelation(g.group_name) || templates().slice(-1)[0] || {};
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';
  // Número internacional só com dígitos. Em Moçambique, 9 dígitos a começar por 8 ganham o 258.
  function phoneDigits(raw) {
    let d = String(raw || '').replace(/\.0+$/, '').replace(/\D/g, '').replace(/^00/, '');
    if (/^8\d{8}$/.test(d)) d = `258${d}`;
    return /^[1-9]\d{9,14}$/.test(d) ? d : '';
  }
  const prettyDate = () => {
    const [y, m, d] = (D.settings.wedding_date || '').split('-').map(Number);
    return d ? `${d}/${String(m).padStart(2, '0')}/${y}` : '';
  };
  const fillText = (text, g, link) => String(text || '')
    .replace(/\{nome\}/g, () => g.name).replace(/\{primeiro_nome\}/g, () => firstName(g.name))
    .replace(/\{casal\}/g, () => D.settings.couple_display).replace(/\{data\}/g, () => prettyDate()).replace(/\{link\}/g, () => link);
  const SEND = {
    savedate: { label: 'Save the Date', col: 'savedate_sent_at', waKey: 'wa_savedate', fallback: 'std_share_message', link: (g) => `${location.origin}/guarde-a-data/${g.token}` },
    invite: { label: 'Convite', col: 'invite_sent_at', waKey: 'wa_invite', fallback: 'share_message', link: guestLink },
  };
  function sendMessage(g, kind) {
    const k = SEND[kind];
    const link = k.link(g);
    const text = templateFor(g)[k.waKey] || `{nome}, ${D.settings[k.fallback]}\n\n{link}`;
    const out = fillText(text, g, link);
    return out.includes(link) ? out : `${out}\n\n${link}`;
  }

  // ---------- Enviar: rever cada pessoa antes de abrir o WhatsApp ----------
  function sendDialog(g, kind, queue = []) {
    const k = SEND[kind];
    const tpl = templateFor(g);
    const digits = phoneDigits(g.phone);
    const dlg = h('dialog', { class: 'send' });
    const close = () => { dlg.close(); dlg.remove(); load(); };
    const text = h('textarea', { rows: 6, value: sendMessage(g, kind), 'aria-label': 'Mensagem do WhatsApp', oninput: () => sync() });
    const confirmBox = h('input', { type: 'checkbox', onchange: () => sync() });
    const wa = h('a', { class: 'btn wa', target: '_blank', rel: 'noopener' }, 'Abrir no WhatsApp');
    const done = h('p', { class: 'notice', hidden: true }, 'WhatsApp aberto e registado aqui. Confirme lá que a mensagem foi enviada: o painel não consegue vê-lo.');
    const next = queue.find((x) => x.id !== g.id);
    const nextBtn = next ? h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => { dlg.close(); dlg.remove(); sendDialog(next, kind, queue.filter((x) => x.id !== g.id)); } }, `Seguinte: ${next.name}`) : null;
    function sync() {
      const ready = confirmBox.checked && digits && text.value.trim();
      wa.classList.toggle('off', !ready);
      wa.setAttribute('aria-disabled', ready ? 'false' : 'true');
      wa.href = ready ? `https://wa.me/${digits}?text=${encodeURIComponent(text.value)}` : '#';
    }
    wa.addEventListener('click', async (e) => {
      if (wa.classList.contains('off')) { e.preventDefault(); return; }
      done.hidden = false;
      if (nextBtn) nextBtn.hidden = false;
      try { await api(`guests/${g.id}/sent`, 'POST', { kind }); g[k.col] = new Date().toISOString(); } catch (ex) { toast(ex.message, true); }
    });
    sync();
    dlg.append(
      h('h2', null, `Enviar ${k.label} a ${g.name}`),
      g[k.col] ? h('p', { class: 'notice' }, `Atenção: já foi aberto no WhatsApp para esta pessoa em ${fmtDate(g[k.col])}.`) : null,
      digits ? null : h('p', { class: 'err' }, `O telefone "${g.phone || 'em falta'}" não é válido. Corrija-o em Convidados antes de enviar.`),
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Nome'), h('dd', null, g.name)),
        h('div', null, h('dt', null, 'WhatsApp'), h('dd', null, digits ? `+${digits}` : '-')),
        h('div', null, h('dt', null, 'Relação'), h('dd', null, g.group_name || 'Sem relação')),
        h('div', null, h('dt', null, 'Modelo usado'), h('dd', null, tpl.label || '-')),
        h('div', null, h('dt', null, 'Acompanhantes'), h('dd', null, g.max_companions))),
      h('h3', null, 'O que a pessoa vai ver'),
      h('div', { class: 'card-preview' },
        tpl.cover_line ? h('small', null, fillText(tpl.cover_line, g, '')) : null,
        h('strong', null, g.name),
        kind === 'invite' ? [
          h('p', { class: 'hello' }, g.salutation || fillText(tpl.salutation, g, '') || fillText(D.settings.letter_greeting_personal, g, '').replace('{nome}', g.name)),
          h('p', null, g.personal_message || fillText(tpl.message, g, '') || D.settings.letter_message),
        ] : h('p', null, D.settings.std_message)),
      h('p', { class: 'row space' }, h('a', { href: k.link(g), target: '_blank', rel: 'noopener' }, 'Abrir como este convidado')),
      h('h3', { class: 'space' }, 'Mensagem do WhatsApp'),
      text,
      h('label', { class: 'check space' }, confirmBox, `Confirmo que quero enviar a ${g.name} e que os dados acima identificam esta pessoa.`),
      done,
      h('div', { class: 'row end space' }, h('button', { class: 'btn alt', type: 'button', onclick: close }, 'Fechar'), wa, nextBtn));
    document.body.append(dlg);
    dlg.showModal();
  }

  let sendFilter = { kind: 'savedate', relation: '', pending: true };
  function viewSend() {
    const k = SEND[sendFilter.kind];
    const all = D.guests;
    const shown = all.filter((g) => (!sendFilter.relation || (g.group_name || '') === sendFilter.relation) && (!sendFilter.pending || !g[k.col]));
    const queue = shown.filter((g) => phoneDigits(g.phone));
    const relations = [...new Set(all.map((g) => g.group_name || ''))].sort();
    const redraw = () => render();
    return [
      h('h1', null, 'Enviar pelo WhatsApp'),
      h('div', { class: 'card' },
        h('div', { class: 'grid two' },
          h('label', { class: 'f' }, h('span', null, 'O que enviar'), h('select', { onchange: (e) => { sendFilter.kind = e.target.value; redraw(); } },
            Object.entries(SEND).map(([v, x]) => h('option', { value: v, selected: sendFilter.kind === v }, x.label)))),
          h('label', { class: 'f' }, h('span', null, 'Relação'), h('select', { onchange: (e) => { sendFilter.relation = e.target.value; redraw(); } },
            h('option', { value: '' }, 'Todas'), relations.filter(Boolean).map((r) => h('option', { value: r, selected: sendFilter.relation === r }, r))))),
        h('label', { class: 'check space' }, h('input', { type: 'checkbox', checked: sendFilter.pending, onchange: (e) => { sendFilter.pending = e.target.checked; redraw(); } }), 'Mostrar só quem ainda não recebeu'),
        h('p', { class: 'muted' }, `${all.filter((g) => g[k.col]).length} de ${all.length} já abertos no WhatsApp. O WhatsApp não permite envio automático gratuito: cada mensagem abre pronta e é você quem carrega em enviar.`),
        queue.length ? h('button', { class: 'btn space', type: 'button', onclick: () => sendDialog(queue[0], sendFilter.kind, queue.slice(1)) }, `Começar por ${queue[0].name} (${queue.length} na fila)`) : null),
      h('div', { class: 'card' }, h('table', { class: 'tbl cards' },
        h('thead', null, h('tr', null, ['Convidado', 'Relação e modelo', k.label, ''].map((t) => h('th', null, t)))),
        h('tbody', null, shown.length ? shown.map((g) => h('tr', null,
          h('td', null, h('strong', null, g.name), h('div', { class: phoneDigits(g.phone) ? 'muted' : 'dup' }, phoneDigits(g.phone) ? `+${phoneDigits(g.phone)}` : 'Telefone em falta ou inválido')),
          h('td', null, g.group_name || 'Sem relação', h('div', { class: 'muted' }, `Modelo: ${templateFor(g).label || '-'}`)),
          h('td', null, g[k.col] ? h('span', { class: 'tag sim' }, `Aberto ${fmtDate(g[k.col])}`) : h('span', { class: 'tag pendente' }, 'Por enviar')),
          h('td', null, h('div', { class: 'row' },
            h('button', { class: 'btn sm', type: 'button', onclick: () => sendDialog(g, sendFilter.kind) }, 'Rever e enviar'),
            g[k.col] ? h('button', { class: 'btn alt sm', type: 'button', onclick: () => act(() => api(`guests/${g.id}/sent`, 'POST', { kind: sendFilter.kind, undo: true }), 'Marcado como não enviado.') }, 'Desmarcar') : null))))
          : h('tr', null, h('td', { colSpan: 4, class: 'muted' }, 'Ninguém nesta lista.'))))),
    ];
  }

  // ---------- Importar do Excel ----------
  const IMPORT_FIELDS = { name: /^(nome|convidado)/, phone: /^(telefone|telemovel|numero|whatsapp|contacto|celular)/, group_name: /^(relacao|grupo|proximidade|nivel|o que)/, max_companions: /^acompanhante/, salutation: /^(saudacao|tratamento)/, personal_message: /^mensagem/ };
  function rowsToGuests(table) {
    const head = (table[0] || []).map((c) => fold(c).trim());
    const hasHead = head.some((c) => IMPORT_FIELDS.name.test(c));
    const order = hasHead ? Object.fromEntries(Object.entries(IMPORT_FIELDS).map(([k, re]) => [k, head.findIndex((c) => re.test(c))])) : { name: 0, phone: 1, group_name: 2, max_companions: 3, salutation: 4, personal_message: 5 };
    return (hasHead ? table.slice(1) : table).map((r) => {
      const get = (k) => (order[k] >= 0 ? r[order[k]] || '' : '');
      const raw = get('phone');
      const digits = phoneDigits(raw);
      const companions = Number(get('max_companions') || 0);
      return { name: get('name'), phone: digits ? `+${digits}` : raw, rawOk: Boolean(digits), group_name: get('group_name'), max_companions: Number.isFinite(companions) ? Math.max(0, Math.floor(companions)) : 0, salutation: get('salutation'), personal_message: get('personal_message') };
    }).filter((g) => g.name || g.phone);
  }
  function importPreview(rows) {
    const seen = new Set();
    const old = D.guests.map((g) => ({ name: fold(g.name), phone: phoneDigits(g.phone) }));
    const items = rows.map((g) => {
      const problems = [];
      const key = `${fold(g.name)}|${phoneDigits(g.phone)}`;
      if (g.name.trim().length < 2) problems.push('Sem nome: não será importado');
      if (!g.rawOk) problems.push(g.phone ? 'Telefone inválido' : 'Sem telefone');
      if (!knownRelation(g.group_name)) problems.push(g.group_name ? `Relação "${g.group_name}" desconhecida: usa o modelo geral` : 'Sem relação: usa o modelo geral');
      if (seen.has(key)) problems.push('Linha repetida no ficheiro');
      seen.add(key);
      const digits = phoneDigits(g.phone);
      const exists = old.some((o) => (digits && o.phone === digits) || (o.name === fold(g.name) && (!digits || !o.phone || o.phone === digits)));
      return { g, problems, exists };
    });
    const valid = items.filter((i) => i.g.name.trim().length >= 2);
    const dlg = h('dialog', { class: 'wide' });
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.append(
      h('h2', null, 'Confirmar a importação'),
      h('p', { class: 'muted' }, `${valid.filter((i) => !i.exists).length} novo(s), ${valid.filter((i) => i.exists).length} a actualizar, ${items.filter((i) => i.problems.length).length} com avisos. Quem já existe mantém o link, a resposta e o registo de envio.`),
      h('div', { class: 'scroll' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Nome', 'Telefone', 'Relação', 'Acomp.', 'Estado'].map((t) => h('th', null, t)))),
        h('tbody', null, items.map((i) => h('tr', null,
          h('td', null, i.g.name || '-'), h('td', null, i.g.phone || '-'), h('td', null, i.g.group_name || '-'), h('td', null, i.g.max_companions),
          h('td', null, h('span', { class: `tag ${i.exists ? 'pendente' : 'sim'}` }, i.exists ? 'Actualizar' : 'Novo'), i.problems.map((p) => h('div', { class: 'dup' }, p)))))))),
      h('div', { class: 'row end space' },
        h('button', { class: 'btn alt', type: 'button', onclick: close }, 'Cancelar'),
        h('button', {
          class: 'btn', type: 'button', disabled: !valid.length,
          onclick: async () => {
            close();
            try {
              const out = await api('guests/import', 'POST', { rows: valid.map((i) => i.g) });
              toast(`${out.imported} novo(s) e ${out.updated} actualizado(s).`);
              await load();
            } catch (ex) { toast(ex.message, true); }
          },
        }, `Importar ${valid.length} convidado(s)`)));
    document.body.append(dlg);
    dlg.showModal();
  }
  function downloadModel() {
    const labels = templates().slice(0, -1).map((t) => t.label);
    const blob = window.Excel.createModel([
      ['Nome', 'Telefone', 'Relação', 'Acompanhantes', 'Saudação (opcional)', 'Mensagem (opcional)'],
      ['Ana Macuácua (exemplo: apague esta linha)', '841234567', labels[0] || 'Família', '1', 'Querida tia Ana,', 'Os seus almoços de domingo fizeram de nós uma família.'],
    ], { relationColumn: 2, relations: labels }, [34, 18, 22, 15, 26, 60]);
    const a = h('a', { href: URL.createObjectURL(blob), download: 'modelo-convidados.xlsx' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importDialog() {
    const dlg = h('dialog');
    const close = () => { dlg.close(); dlg.remove(); };
    const err = h('p', { class: 'err', role: 'alert' });
    const area = h('textarea', { rows: 5, placeholder: 'João Macuácua; 841234567; Família; 1\nMaria Sitoe; 871234567; Amigos; 0' });
    const go = (table) => {
      const rows = rowsToGuests(table);
      if (!rows.length) { err.textContent = 'Não foram encontrados convidados. Confirme que a primeira coluna tem o nome.'; return; }
      close();
      importPreview(rows);
    };
    dlg.append(
      h('h2', null, 'Importar do Excel'),
      h('ol', { class: 'steps' },
        h('li', null, 'Descarregue o modelo e preencha uma linha por convidado.'),
        h('li', null, 'Na coluna Relação, escolha o nível de proximidade: é ela que define o texto.'),
        h('li', null, 'Carregue o ficheiro aqui e confirme a lista antes de importar.')),
      h('div', { class: 'row space' },
        h('button', { class: 'btn alt', type: 'button', onclick: downloadModel }, 'Descarregar modelo'),
        h('label', { class: 'btn file' }, 'Escolher ficheiro Excel', h('input', {
          type: 'file', accept: '.xlsx,.csv,.txt',
          onchange: async (e) => {
            err.textContent = '';
            try { if (e.target.files[0]) go(await window.Excel.readFile(e.target.files[0])); } catch (ex) { err.textContent = ex.message; }
          },
        }))),
      err,
      h('details', { class: 'space' }, h('summary', null, 'Ou colar uma lista'),
        h('p', { class: 'muted' }, 'Nome; Telefone; Relação; Acompanhantes; Saudação; Mensagem'), area,
        h('button', { class: 'btn alt space', type: 'button', onclick: () => go(window.Excel.readText(area.value)) }, 'Rever a lista')),
      h('div', { class: 'row end space' }, h('button', { class: 'btn alt', type: 'button', onclick: close }, 'Cancelar')));
    document.body.append(dlg);
    dlg.showModal();
  }

  function viewGuests() {
    const tbody = h('tbody');
    const counts = {};
    D.guests.forEach((g) => { const n = fold(g.name); counts[n] = (counts[n] || 0) + 1; });
    const draw = () => {
      const q = fold(guestFilter.q);
      const list = D.guests.filter((g) => (!guestFilter.status || g.status === guestFilter.status) && (!q || fold(`${g.name} ${g.phone} ${g.group_name}`).includes(q)));
      tbody.replaceChildren(...list.map((g) => h('tr', null,
        h('td', null, h('strong', null, g.name), counts[fold(g.name)] > 1 ? h('div', { class: 'dup' }, 'Possível duplicado') : null,
          h('div', { class: 'muted' }, [g.phone, g.group_name, g.source === 'aberto' ? 'via link geral' : ''].filter(Boolean).join(' · '))),
        h('td', null, h('span', { class: `tag ${g.status}` }, STATUS[g.status]), g.responded_at ? h('div', { class: 'muted' }, fmtDate(g.responded_at)) : null),
        h('td', null, `${g.companions}/${g.max_companions}`, h('span', { class: 'muted' }, ' acomp.')),
        h('td', null, g.notes ? h('div', { class: 'muted' }, g.notes) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn alt sm', type: 'button', onclick: () => guestDialog(g) }, 'Editar'),
            h('button', { class: 'btn alt sm', type: 'button', onclick: () => navigator.clipboard.writeText(guestLink(g)).then(() => toast('Link copiado.')) }, 'Copiar link'),
            h('button', { class: 'btn alt sm', type: 'button', onclick: () => sendDialog(g, 'invite') }, 'Enviar convite'),
            h('button', { class: 'btn alt sm', type: 'button', onclick: () => sendDialog(g, 'savedate') }, 'Enviar Save the Date'),
            h('button', { class: 'btn bad sm', type: 'button', onclick: () => { if (confirm(`Eliminar ${g.name}?`)) act(() => api(`guests/${g.id}`, 'DELETE'), 'Eliminado.'); } }, 'Eliminar'))))));
      if (!list.length) tbody.append(h('tr', null, h('td', { colSpan: 4, class: 'muted' }, 'Nenhum convidado encontrado.')));
    };
    draw();
    return [
      h('h1', null, 'Convidados'),
      h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => guestDialog(null) }, 'Novo convidado'),
          h('button', { class: 'btn alt', type: 'button', onclick: importDialog }, 'Importar do Excel'),
          h('a', { class: 'btn alt', href: '/api/admin/export/guests.csv' }, 'Exportar para Excel (CSV)')),
        h('div', { class: 'grid two space' },
          h('label', { class: 'f' }, h('span', null, 'Pesquisar'), h('input', { type: 'search', value: guestFilter.q, oninput: (e) => { guestFilter.q = e.target.value; draw(); } })),
          h('label', { class: 'f' }, h('span', null, 'Estado'), h('select', { onchange: (e) => { guestFilter.status = e.target.value; draw(); } },
            h('option', { value: '' }, 'Todos'), Object.entries(STATUS).map(([k, l]) => h('option', { value: k, selected: guestFilter.status === k }, l)))))),
      h('div', { class: 'card' }, h('table', { class: 'tbl cards' },
        h('thead', null, h('tr', null, ['Convidado', 'Estado', 'Acompanhantes', 'Acções'].map((t) => h('th', null, t)))), tbody)),
    ];
  }

  // ---------- Listas genéricas ----------
  function crud(path, title, defs, items, opts = {}) {
    const row = (item) => {
      const values = { ...item };
      const form = h('form', {
        onsubmit: (e) => {
          e.preventDefault();
          const data = { ...values, ...readForm(form) };
          act(() => (item ? api(`${path}/${item.id}`, 'PUT', data) : api(path, 'POST', data)), 'Guardado.');
        },
      },
        h('div', { class: 'grid two' }, defs.map((d) => field(d, values))),
        opts.image ? h('div', { class: 'space' }, imageInput('Imagem', values.image, (id) => {
          if (item) act(() => api(`${path}/${item.id}`, 'PUT', { ...values, ...readForm(form), image: id }), 'Imagem actualizada.');
          else { values.image = id; toast('Imagem pronta. Clique em Adicionar.'); }
        })) : null,
        h('div', { class: 'row space' },
          h('button', { class: 'btn sm' }, item ? 'Guardar' : 'Adicionar'),
          item && opts.ordered ? [
            h('button', { class: 'btn alt sm', type: 'button', 'aria-label': 'Subir', onclick: () => act(() => api(`${path}/${item.id}/move`, 'POST', { direction: 'up' })) }, '↑'),
            h('button', { class: 'btn alt sm', type: 'button', 'aria-label': 'Descer', onclick: () => act(() => api(`${path}/${item.id}/move`, 'POST', { direction: 'down' })) }, '↓'),
          ] : null,
          item && opts.extra ? opts.extra(item) : null,
          item ? h('button', { class: 'btn bad sm', type: 'button', onclick: () => { if (confirm(opts.deleteWarn || 'Eliminar?')) act(() => api(`${path}/${item.id}`, 'DELETE'), 'Eliminado.'); } }, 'Eliminar') : null));
      return form;
    };
    return h('div', { class: 'card' }, h('h2', null, title),
      h('div', { class: 'list' }, items.map(row), h('details', null, h('summary', null, 'Adicionar novo'), h('div', { class: 'space' }, row(null)))));
  }

  // ---------- Ecrãs ----------
  const VIEWS = {
    resumo: ['Resumo', () => {
      const st = D.stats;
      const stat = (n, l) => h('div', { class: 'stat' }, h('b', null, n), h('small', null, l));
      const d = D.settings;
      const past = Date.parse(`${d.wedding_date}T23:59:59${d.event_tz || '+02:00'}`) < Date.now();
      const closed = Date.parse(`${d.rsvp_deadline}T23:59:59${d.event_tz || '+02:00'}`) < Date.now();
      return [
        h('h1', null, 'Resumo'),
        past ? h('p', { class: 'notice' }, `A data do casamento (${d.wedding_date}) já passou. O convite mostra o modo de agradecimento. Altere-a em Data e confirmações, se necessário.`)
          : closed ? h('p', { class: 'notice' }, `O prazo de confirmação (${d.rsvp_deadline}) já terminou: os convidados não conseguem responder.`) : null,
        h('div', { class: 'stats' }, stat(st.pessoas, 'pessoas confirmadas'), stat(st.sim, 'convidados confirmados'), stat(st.acompanhantes, 'acompanhantes'), stat(st.pendente, 'sem resposta'), stat(st.nao, 'não vêm'), stat(`${st.taxa}%`, 'taxa de resposta'), stat(st.mensagens_pendentes, 'mensagens por aprovar'), stat(st.presentes_escolhidos, 'presentes escolhidos')),
        h('div', { class: 'card' }, h('h2', null, 'Link geral do convite'),
          h('p', null, h('a', { href: '/', target: '_blank', rel: 'noopener' }, `${location.origin}/`)),
          h('p', { class: 'muted' }, 'Para saber quem ainda não respondeu, adicione os convidados e envie a cada um o seu link pessoal.')),
        h('div', { class: 'card' }, h('h2', null, 'Armazenamento'),
          h('p', { class: 'muted' }, `${mb(D.storage.used)} de ${mb(D.storage.limit)} usados em ${D.storage.files} ficheiro(s).`),
          h('div', { class: 'bar' }, (() => { const i = h('i'); i.style.width = `${Math.min(100, (D.storage.used / D.storage.limit) * 100)}%`; return i; })())),
      ];
    }],
    convidados: ['Convidados', viewGuests],
    enviar: ['Enviar pelo WhatsApp', viewSend],
    modelos: ['Modelos por relação', () => {
      const list = templates();
      const box = h('div', { class: 'list' });
      const fields = [['label', 'Relação (o nome usado no Excel)'], ['cover_line', 'Frase por cima do nome no envelope'], ['salutation', 'Saudação da carta'], ['message', 'Mensagem da carta', 3], ['wa_savedate', 'WhatsApp: Save the Date', 4], ['wa_invite', 'WhatsApp: convite', 4]];
      const addRow = (t, isGeneral) => box.append(h('div', { class: 'tpl' },
        h('div', { class: 'grid two' }, fields.map(([k, l, rows]) => h('label', { class: 'f' }, h('span', null, l),
          rows ? h('textarea', { rows, value: t[k] || '', 'data-k': k }) : h('input', { value: t[k] || '', 'data-k': k, readOnly: isGeneral && k === 'label' })))),
        isGeneral ? h('p', { class: 'muted space' }, 'Modelo geral: usado por quem não tem relação reconhecida. Em branco, valem os textos gerais de Carta e história e de Save the Date.')
          : h('button', { class: 'btn bad sm space', type: 'button', onclick: (e) => e.target.closest('.tpl').remove() }, 'Remover')));
      list.forEach((t, i) => addRow(t, i === list.length - 1));
      const read = () => [...box.children].map((row) => Object.fromEntries([...row.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.value])));
      return [
        h('h1', null, 'Modelos por relação'),
        h('p', { class: 'muted' }, 'Cada convidado recebe o texto do nível de proximidade indicado no Excel. Pode usar {nome}, {primeiro_nome}, {casal}, {data} e {link}. A saudação e a mensagem de um convidado, se existirem, têm prioridade.'),
        h('form', {
          class: 'card',
          onsubmit: (e) => { e.preventDefault(); act(() => api('settings', 'PUT', { relation_templates: JSON.stringify(read()) }), 'Modelos guardados.'); },
        }, box, h('div', { class: 'row space' },
          h('button', { class: 'btn alt', type: 'button', onclick: () => { const rows = read(); const general = box.lastElementChild; addRow({ label: `Nova relação ${rows.length}` }, false); box.insertBefore(box.lastElementChild, general); } }, 'Acrescentar relação'),
          h('button', { class: 'btn' }, 'Guardar modelos'))),
      ];
    }],
    mensagens: ['Mensagens', () => [
      h('h1', null, 'Mensagens'),
      h('div', { class: 'card list' }, D.messages.length ? D.messages.map((m) => h('div', null,
        h('strong', null, m.nome), m.relacao ? h('span', { class: 'muted' }, ` · ${m.relacao}`) : null, ' ',
        h('span', { class: `tag ${m.oculto ? 'nao' : m.aprovado ? 'sim' : 'pendente'}` }, m.oculto ? 'Oculta' : m.aprovado ? 'Publicada' : 'Por aprovar'),
        h('p', null, m.mensagem),
        h('div', { class: 'row space' },
          !m.aprovado || m.oculto ? h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => api(`messages/${m.id}`, 'PUT', { ...m, aprovado: 1, oculto: 0 }), 'Publicada.') }, 'Aprovar') : null,
          m.aprovado && !m.oculto ? h('button', { class: 'btn alt sm', type: 'button', onclick: () => act(() => api(`messages/${m.id}`, 'PUT', { ...m, oculto: 1 }), 'Ocultada.') }, 'Ocultar') : null,
          h('button', { class: 'btn bad sm', type: 'button', onclick: () => { if (confirm('Eliminar esta mensagem?')) act(() => api(`messages/${m.id}`, 'DELETE'), 'Eliminada.'); } }, 'Eliminar')))) : h('p', { class: 'muted' }, 'Ainda não há mensagens.')),
    ]],
    casal: ['Dados do casal', () => [
      h('h1', null, 'Dados do casal'),
      settingsForm('Noivos', [
        { k: 'bride_name', l: 'Nome da noiva' }, { k: 'groom_name', l: 'Nome do noivo' },
        { k: 'bride_father', l: 'Pai da noiva' }, { k: 'groom_father', l: 'Pai do noivo' },
        { k: 'bride_mother', l: 'Mãe da noiva' }, { k: 'groom_mother', l: 'Mãe do noivo' },
        { k: 'couple_display', l: 'Nome de apresentação' }, { k: 'envelope_seal_text', l: 'Selo do envelope' },
      ]),
      h('div', { class: 'card' }, h('h2', null, 'Fotografias'), h('div', { class: 'grid two' },
        imageSetting('Noiva', 'bride_photo'), imageSetting('Noivo', 'groom_photo'), imageSetting('Capa (também usada na pré-visualização do WhatsApp)', 'cover_image', 1920))),
    ]],
    data: ['Data e confirmações', () => [
      h('h1', null, 'Data e confirmações'),
      settingsForm('Data', [
        { k: 'wedding_date', l: 'Data do casamento', t: 'date' }, { k: 'wedding_time', l: 'Hora', t: 'time' },
        { k: 'event_tz', l: 'Fuso horário', help: 'Moçambique: +02:00' }, { k: 'rsvp_deadline', l: 'Prazo de confirmação', t: 'date' },
      ]),
      settingsForm('Confirmações', [
        { k: 'rsvp_public', l: 'Permitir confirmar pelo link geral (sem link pessoal)', t: 'check' },
        { k: 'public_max_companions', l: 'Acompanhantes permitidos no link geral', t: 'number', min: 0, max: 20 },
        { k: 'rsvp_intro', l: 'Texto de introdução', t: 'area', rows: 2 },
        { k: 'thanks_yes', l: 'Agradecimento: vem', t: 'area', rows: 2 }, { k: 'thanks_no', l: 'Agradecimento: não vem', t: 'area', rows: 2 },
        { k: 'thanks_after_event', l: 'Agradecimento depois do casamento', t: 'area', rows: 2 },
      ]),
    ]],
    textos: ['Textos', () => [
      h('h1', null, 'Textos do convite'),
      settingsForm('Boas-vindas e história', [
        { k: 'welcome_title', l: 'Saudação' }, { k: 'bible_reference', l: 'Referência da citação' },
        { k: 'bible_quote', l: 'Citação', t: 'area', rows: 2 }, { k: 'story_title', l: 'Título' },
        { k: 'story_text', l: 'Frase do casal', t: 'area', rows: 2 }, { k: 'story_author', l: 'Autoria da frase' },
      ]),
      settingsForm('Convite formal', [
        { k: 'formal_text', l: 'Texto', t: 'area' }, { k: 'guest_label', l: 'Tratamento geral' },
        { k: 'invite_validity', l: 'Validade no link geral' }, { k: 'children_notice', l: 'Aviso sobre crianças' },
      ]),
      settingsForm('Partilha e pesquisa', [
        { k: 'site_title', l: 'Título da página' }, { k: 'site_description', l: 'Descrição' },
        { k: 'share_message', l: 'Mensagem de partilha no WhatsApp', t: 'area', rows: 2 },
      ]),
      settingsForm('Rodapé', [
        { k: 'footer_brand', l: 'Nome' }, { k: 'footer_text', l: 'Texto' }, { k: 'footer_instagram', l: 'Instagram (URL)' },
        { k: 'footer_whatsapp', l: 'WhatsApp (só dígitos, com 258)' }, { k: 'footer_email', l: 'Email' }, { k: 'footer_copyright', l: 'Direitos' },
      ]),
    ]],
    carta: ['Carta e história', () => [
      h('h1', null, 'Carta e história'),
      settingsForm('Carta de abertura', [
        { k: 'show_letter', l: 'Mostrar a carta depois de abrir o envelope', t: 'check' },
        { k: 'show_celebration', l: 'Mostrar pétalas e passe ao confirmar', t: 'check' },
        { k: 'letter_greeting_personal', l: 'Saudação no link pessoal', help: '{nome} é substituído pelo nome do convidado.' },
        { k: 'letter_greeting_general', l: 'Saudação no link geral' },
        { k: 'letter_message', l: 'Mensagem geral', t: 'area', help: 'Para uma mensagem diferente, edite o convidado em Convidados.' },
      ]),
      crud('chapters', 'Capítulos da história', [
        { k: 'label', l: 'Etiqueta', ph: 'Capítulo um' }, { k: 'title', l: 'Título' },
        { k: 'text', l: 'Texto', t: 'area' },
      ], D.chapters, { ordered: true, image: true }),
      h('p', { class: 'muted' }, 'Sem capítulos, esta secção não aparece no convite.'),
    ]],
    savedate: ['Save the Date', () => [
      h('h1', null, 'Save the Date'),
      h('div', { class: 'card' }, h('h2', null, 'Link geral'),
        h('p', null, h('a', { href: '/guarde-a-data', target: '_blank', rel: 'noopener' }, `${location.origin}/guarde-a-data`)),
        h('p', { class: 'muted' }, 'Para mostrar o nome de cada pessoa, envie por Enviar pelo WhatsApp. A data é a de Data e confirmações.')),
      h('div', { class: 'card' }, h('h2', null, 'Fotografia'),
        imageSetting('Aparece ao raspar. Ao alto fica melhor, com os rostos a meio ou acima do meio. Sem foto, usa a capa do convite.', 'std_photo')),
      settingsForm('Textos', [
        { k: 'show_savedate', l: 'Save the Date activo (desligado, os links abrem o convite)', t: 'check' },
        { k: 'std_title', l: 'Título (aparece em maiúsculas)' }, { k: 'std_hint', l: 'Instrução para raspar' },
        { k: 'std_message', l: 'Frase depois de raspar', t: 'area', rows: 2 },
        { k: 'std_next', l: 'Aviso sobre o convite', t: 'area', rows: 2 },
        { k: 'std_share_message', l: 'Mensagem no WhatsApp para quem não tem modelo próprio', t: 'area', rows: 2 },
      ]),
    ]],
    programa: ['Programa e locais', () => [
      h('h1', null, 'Programa e locais'),
      h('p', { class: 'muted' }, 'Cada local diferente aparece na secção Localização. Sem endereço de mapa, o botão pesquisa o nome no Google Maps.'),
      crud('events', 'Momentos do dia', [
        { k: 'time', l: 'Hora', ph: '11h00' }, { k: 'title', l: 'Título' }, { k: 'location', l: 'Local' },
        { k: 'map_url', l: 'Endereço do mapa', ph: 'https://…' }, { k: 'description', l: 'Descrição' },
      ], D.events, { ordered: true }),
    ]],
    dresscode: ['Dress code', () => [
      h('h1', null, 'Dress code'),
      settingsForm('Sugestões', [
        { k: 'dresscode_text', l: 'Introdução' }, { k: 'dresscode_warning', l: 'Aviso' },
        { k: 'dresscode_women_colors', l: 'Mulheres (separar por vírgulas)', t: 'area', rows: 2 },
        { k: 'dresscode_men_colors', l: 'Homens (separar por vírgulas)', t: 'area', rows: 2 },
      ]),
      h('div', { class: 'card' }, h('h2', null, 'Imagens'), h('div', { class: 'grid two' }, imageSetting('Mulheres', 'dresscode_women_image'), imageSetting('Homens', 'dresscode_men_image'))),
    ]],
    galeria: ['Galeria', () => [
      h('h1', null, 'Galeria'),
      h('div', { class: 'card' },
        h('label', { class: 'btn file' }, 'Adicionar fotografias', h('input', {
          type: 'file', accept: 'image/*', multiple: true,
          onchange: async (e) => {
            const files = [...e.target.files];
            try {
              for (let i = 0; i < files.length; i++) {
                toast(`A carregar ${i + 1} de ${files.length}…`);
                const media_id = await uploadImage(files[i], 1600);
                const thumb_id = await uploadBlob(await resize(files[i], 640, 0.72), 'image/jpeg', `mini-${files[i].name}`);
                await api('gallery', 'POST', { media_id, thumb_id });
              }
              toast('Fotografias adicionadas.');
            } catch (ex) { toast(ex.message, true); }
            load();
          },
        })),
        h('p', { class: 'muted space' }, 'São reduzidas automaticamente antes do envio. A fotografia principal aparece primeiro e em destaque.')),
      h('div', { class: 'photos' }, D.gallery.map((p) => h('figure', null,
        h('img', { src: media(p.thumb_id || p.media_id), alt: '', loading: 'lazy' }),
        p.is_main ? h('span', { class: 'tag sim' }, 'Principal') : null,
        h('div', { class: 'row space' },
          h('button', { class: 'btn alt sm', type: 'button', 'aria-label': 'Definir como principal', onclick: () => act(() => api(`gallery/${p.id}/main`, 'POST')) }, '★'),
          h('button', { class: 'btn alt sm', type: 'button', 'aria-label': 'Antes', onclick: () => act(() => api(`gallery/${p.id}/move`, 'POST', { direction: 'up' })) }, '←'),
          h('button', { class: 'btn alt sm', type: 'button', 'aria-label': 'Depois', onclick: () => act(() => api(`gallery/${p.id}/move`, 'POST', { direction: 'down' })) }, '→'),
          h('button', { class: 'btn bad sm', type: 'button', 'aria-label': 'Eliminar', onclick: () => { if (confirm('Eliminar esta fotografia?')) act(() => api(`gallery/${p.id}`, 'DELETE'), 'Eliminada.'); } }, '✕'))))),
    ]],
    musica: ['Música', () => {
      const d = D.settings;
      return [
        h('h1', null, 'Música'),
        h('div', { class: 'card' },
          h('p', null, d.music_file ? 'Há uma música carregada.' : 'Nenhuma música carregada.'),
          d.music_file ? h('audio', { controls: true, src: media(d.music_file) }) : null,
          h('div', { class: 'row space' },
            h('label', { class: 'btn alt file' }, 'Carregar música', h('input', {
              type: 'file', accept: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.m4a,.ogg,.wav',
              onchange: async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                toast('A carregar música…');
                act(async () => {
                  const type = file.type === 'audio/mp3' ? 'audio/mpeg' : file.type === 'audio/x-m4a' ? 'audio/mp4' : file.type;
                  const id = await uploadBlob(file, type, file.name);
                  await api('settings', 'PUT', { music_file: id, music_enabled: '1' });
                }, 'Música carregada e activada.');
              },
            })),
            d.music_file ? h('button', { class: 'btn alt', type: 'button', onclick: () => act(() => api('settings', 'PUT', { music_enabled: d.music_enabled === '1' ? '0' : '1' })) }, d.music_enabled === '1' ? 'Desactivar no convite' : 'Activar no convite') : null,
            d.music_file ? h('button', { class: 'btn bad', type: 'button', onclick: () => { if (confirm('Eliminar a música?')) act(() => api('settings', 'PUT', { music_file: '', music_enabled: '0' }), 'Eliminada.'); } }, 'Eliminar') : null),
          h('p', { class: 'muted space' }, 'A música só começa quando o convidado abre o envelope, porque os telemóveis bloqueiam som automático. Máximo de 30 MB; recomenda-se menos de 5 MB para poupar dados móveis.')),
      ];
    }],
    presentes: ['Presentes', () => [
      h('h1', null, 'Presentes'),
      settingsForm('Regras', [
        { k: 'gift_intro', l: 'Introdução', t: 'area' }, { k: 'gift_rule_text', l: 'Regra', t: 'area' },
        { k: 'gift_one_per_guest', l: 'Limitar a 1 presente por convidado', t: 'check' },
      ]),
      settingsForm('Presente monetário', [
        { k: 'mpesa_number', l: 'M-Pesa: número' }, { k: 'mpesa_holder', l: 'M-Pesa: titular' },
        { k: 'emola_number', l: 'E-Mola: número' }, { k: 'emola_holder', l: 'E-Mola: titular' },
        { k: 'bank_account', l: 'Banco: conta' }, { k: 'bank_nib', l: 'NIB' }, { k: 'bank_holder', l: 'Banco: titular' },
      ]),
      crud('gift-categories', 'Categorias', [{ k: 'name', l: 'Nome' }], D.categories, { ordered: true, image: true, deleteWarn: 'Eliminar a categoria e todos os seus presentes?' }),
      crud('gifts', 'Lista de presentes', [
        { k: 'name', l: 'Nome' }, { k: 'description', l: 'Descrição' },
        { k: 'category_id', l: 'Categoria', t: 'select', options: D.categories.map((c) => [c.id, c.name]) },
      ], D.gifts, {
        image: true,
        extra: (g) => (g.chosen_by ? [h('span', { class: 'tag pendente' }, `Escolhido por ${g.chosen_by}`),
          h('button', { class: 'btn alt sm', type: 'button', onclick: () => act(() => api(`gifts/${g.id}/reset`, 'POST'), 'Disponível novamente.') }, 'Repor')] : null),
      }),
    ]],
    lojas: ['Lojas', () => [
      h('h1', null, 'Lojas sugeridas'),
      crud('stores', 'Lojas', [
        { k: 'name', l: 'Nome' }, { k: 'description', l: 'Descrição' }, { k: 'address', l: 'Endereço' },
        { k: 'map_url', l: 'Endereço do mapa' }, { k: 'phone', l: 'Telefone' }, { k: 'whatsapp', l: 'WhatsApp' },
      ], D.stores, { ordered: true, image: true }),
    ]],
    manual: ['Informações', () => {
      let items = [];
      try { items = JSON.parse(D.settings.manual_guest_items || '[]'); } catch { /* vazio */ }
      const list = h('div', { class: 'grid' });
      const addRow = (i = { title: '', text: '' }) => list.append(h('div', { class: 'grid two' },
        h('input', { placeholder: 'Título', value: i.title, 'data-m': 't', 'aria-label': 'Título' }),
        h('input', { placeholder: 'Texto', value: i.text, 'data-m': 'x', 'aria-label': 'Texto' })));
      items.forEach(addRow);
      addRow();
      return [
        h('h1', null, 'Manual do Bom Convidado'),
        h('form', {
          class: 'card',
          onsubmit: (e) => {
            e.preventDefault();
            const data = [...list.children].map((r) => ({ title: r.querySelector('[data-m=t]').value, text: r.querySelector('[data-m=x]').value })).filter((r) => r.title.trim());
            act(() => api('settings', 'PUT', { manual_guest_items: JSON.stringify(data) }), 'Guardado.');
          },
        }, list, h('p', { class: 'muted space' }, 'Deixe o título vazio para remover uma linha.'),
        h('div', { class: 'row space' }, h('button', { class: 'btn alt', type: 'button', onclick: () => addRow() }, 'Mais uma linha'), h('button', { class: 'btn' }, 'Guardar'))),
      ];
    }],
    seccoes: ['Secções e títulos', () => [
      h('h1', null, 'Secções e títulos'),
      h('p', { class: 'muted' }, 'Mostre, esconda e dê nome a cada parte do convite. Esconder não apaga o conteúdo.'),
      settingsForm('Abertura', [
        { k: 'show_envelope', l: 'Mostrar o envelope de abertura', t: 'check' },
        { k: 'show_countdown', l: 'Mostrar a contagem decrescente', t: 'check' },
        { k: 'show_welcome', l: 'Mostrar as boas-vindas', t: 'check' },
        { k: 'cover_hint', l: 'Texto debaixo do envelope' },
        { k: 'hero_eyebrow', l: 'Texto acima dos nomes' },
        { k: 'hero_eyebrow_after', l: 'Texto acima dos nomes, depois do casamento' },
      ]),
      Object.entries(D.sections).map(([k, [label]]) => settingsForm(label, [
        { k: `show_${k}`, l: 'Mostrar esta secção', t: 'check' },
        { k: `${k}_title`, l: 'Título' },
        { k: `${k}_eyebrow`, l: 'Frase acima do título' },
      ])),
    ]],
    senha: ['Senha', () => {
      const err = h('p', { class: 'err', role: 'alert' });
      const form = h('form', {
        class: 'card',
        onsubmit: async (e) => {
          e.preventDefault();
          err.textContent = '';
          const { current, next, repeat } = readForm(form);
          if (next !== repeat) { err.textContent = 'As novas senhas não coincidem.'; return; }
          try {
            await api('password', 'POST', { current, next });
            form.reset();
            toast('Senha alterada. As sessões noutros aparelhos terminaram.');
          } catch (ex) { err.textContent = ex.message; }
        },
      },
        h('div', { class: 'grid' },
          field({ k: 'current', l: 'Senha actual', t: 'password' }, {}),
          field({ k: 'next', l: 'Nova senha (mínimo 12 caracteres)', t: 'password' }, {}),
          field({ k: 'repeat', l: 'Repetir a nova senha', t: 'password' }, {})),
        err, h('div', { class: 'space' }, h('button', { class: 'btn' }, 'Mudar senha')));
      return [h('h1', null, 'Senha do painel'), form,
        h('p', { class: 'muted' }, 'Esqueceu a senha? Veja docs/RECUPERACAO.md: não perde nenhum dado.')];
    }],
    tema: ['Aparência', () => {
      const fontName = (v) => v.split(',')[0].replace(/'/g, '');
      return [
        h('h1', null, 'Aparência'),
        settingsForm('Cores e letra', [
          { k: 'color_primary', l: 'Principal', t: 'color' }, { k: 'color_gold', l: 'Dourado', t: 'color' },
          { k: 'color_background', l: 'Fundo', t: 'color' }, { k: 'color_text', l: 'Texto', t: 'color' },
          { k: 'color_titles', l: 'Títulos', t: 'color' }, { k: 'color_buttons', l: 'Botões', t: 'color' },
          { k: 'color_secondary', l: 'Secundária', t: 'color' },
          { k: 'font_titles', l: 'Letra dos títulos', t: 'select', options: D.fonts.titles.map((f) => [f, fontName(f)]) },
          { k: 'font_text', l: 'Letra do texto', t: 'select', options: D.fonts.text.map((f) => [f, fontName(f)]) },
          { k: 'font_title_size', l: 'Tamanho dos títulos', t: 'number', step: 0.1, min: 0.6, max: 5 },
          { k: 'font_text_size', l: 'Tamanho do texto', t: 'number', step: 0.05, min: 0.6, max: 2 },
        ]),
        h('button', { class: 'btn alt', type: 'button', onclick: () => { if (confirm('Repor a aparência original?')) act(() => api('settings', 'PUT', D.theme_defaults), 'Aparência reposta.'); } }, 'Repor aparência original'),
      ];
    }],
    backup: ['Cópias de segurança', () => {
      const status = h('p', { class: 'muted', role: 'status' });
      const toB64 = (bytes) => {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return btoa(bin);
      };
      const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      async function download() {
        const res = await api('backup/data');
        const media_ = res.tables.media;
        const blobs = [];
        for (let i = 0; i < media_.length; i++) {
          status.textContent = `A copiar ficheiro ${i + 1} de ${media_.length}…`;
          const m = media_[i];
          const parts = [];
          for (let c = 0; c < m.chunks; c++) {
            const r = await fetch(`/api/admin/backup/chunk/${m.id}/${c}`);
            if (!r.ok) throw new Error(`Falha ao copiar ${m.name || m.id}.`);
            parts.push(new Uint8Array(await r.arrayBuffer()));
          }
          const whole = new Uint8Array(m.size);
          let at = 0;
          for (const p of parts) { whole.set(p, at); at += p.length; }
          blobs.push(JSON.stringify({ id: m.id, data: toB64(whole) }));
        }
        const out = new Blob([JSON.stringify({ format: res.format, version: res.version, created_at: res.created_at, tables: res.tables }).slice(0, -1), ',"files":[', blobs.join(','), ']}'], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(out), download: `convite-backup-${res.created_at.slice(0, 10)}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        status.textContent = `Cópia concluída (${mb(out.size)}). Guarde o ficheiro num local privado.`;
      }
      async function restore(file) {
        const data = JSON.parse(await file.text());
        if (data.format !== 'convite-backup') throw new Error('Este ficheiro não é uma cópia do convite.');
        const answer = prompt(`Isto substitui TODOS os dados actuais pelos de ${data.created_at}.\nEscreva RESTAURAR para continuar.`);
        if (answer !== 'RESTAURAR') { status.textContent = 'Restauro cancelado. Nada foi alterado.'; return; }
        status.textContent = 'A restaurar dados…';
        await api('restore/begin', 'POST', { confirm: 'RESTAURAR' });
        for (const [table, rows] of Object.entries(data.tables)) {
          let batch = [];
          let size = 0;
          for (const row of rows) {
            const n = JSON.stringify(row).length;
            if (size + n > 800000 && batch.length) { await api(`restore/table/${table}`, 'POST', { rows: batch }); batch = []; size = 0; }
            batch.push(row); size += n;
          }
          if (batch.length) await api(`restore/table/${table}`, 'POST', { rows: batch });
        }
        const metas = Object.fromEntries(data.tables.media.map((m) => [m.id, m]));
        for (let i = 0; i < (data.files || []).length; i++) {
          status.textContent = `A restaurar ficheiro ${i + 1} de ${data.files.length}…`;
          const f = data.files[i];
          const bytes = fromB64(f.data);
          const cs = metas[f.id].chunk_size;
          for (let c = 0; c < metas[f.id].chunks; c++) await api(`media/${f.id}/${c}`, 'PUT', bytes.subarray(c * cs, (c + 1) * cs));
        }
        await load(); // redesenha o ecrã, por isso o aviso vem depois
        toast('Restauro concluído.');
      }
      return [
        h('h1', null, 'Cópias de segurança'),
        h('div', { class: 'card' }, h('h2', null, 'Descarregar cópia'),
          h('p', { class: 'muted' }, 'Um único ficheiro com convidados, mensagens, textos, fotos e música. Contém dados pessoais: guarde-o em local privado.'),
          h('button', { class: 'btn space', type: 'button', onclick: (e) => { e.target.disabled = true; download().catch((x) => { status.textContent = x.message; }).finally(() => { e.target.disabled = false; }); } }, 'Descarregar cópia completa')),
        h('div', { class: 'card' }, h('h2', null, 'Restaurar cópia'),
          h('p', { class: 'muted' }, 'Substitui todos os dados actuais. Descarregue antes uma cópia do estado actual.'),
          h('label', { class: 'btn bad file space' }, 'Escolher ficheiro de cópia', h('input', { type: 'file', accept: '.json,application/json', onchange: (e) => { if (e.target.files[0]) restore(e.target.files[0]).catch((x) => { status.textContent = x.message; }); } }))),
        status,
      ];
    }],
  };

  function showLogin() {
    const err = h('p', { class: 'err', role: 'alert' });
    const pass = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    root.replaceChildren(h('div', { class: 'login' }, h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        try { await api('login', 'POST', { password: pass.value }); await load(); } catch (ex) { err.textContent = ex.message; }
      },
    }, h('h1', null, 'Painel do Convite'),
    h('label', { class: 'f' }, h('span', null, 'Senha'), pass), err,
    h('button', { class: 'btn space' }, 'Entrar'))), toastEl);
    pass.focus();
  }

  function render() {
    const scroll = window.scrollY;
    const side = h('nav', { class: 'side', 'aria-label': 'Secções' },
      h('div', { class: 'brand' }, D.settings.couple_display),
      Object.entries(VIEWS).map(([k, [label]]) => h('button', {
        type: 'button', 'aria-current': k === current ? 'page' : null,
        onclick: () => { current = k; location.hash = k; render(); scrollTo(0, 0); },
      }, label)),
      h('div', { class: 'bottom' },
        h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'Ver convite'),
        h('button', { type: 'button', onclick: async () => { await api('logout', 'POST', {}); showLogin(); } }, 'Sair')));
    const main = h('main', { class: 'main' }, VIEWS[current][1]());
    const topbar = h('div', { class: 'topbar' }, h('strong', null, VIEWS[current][0]), h('button', { type: 'button', onclick: () => side.classList.toggle('open') }, 'Menu'));
    root.replaceChildren(topbar, h('div', { class: 'shell' }, side, main), toastEl);
    scrollTo(0, scroll);
  }

  async function load() {
    D = await api('all');
    const fromHash = location.hash.slice(1);
    if (VIEWS[fromHash]) current = fromHash;
    render();
  }

  fetch('/api/admin/me').then((r) => (r.ok ? load() : showLogin())).catch(() => showLogin());
})();
