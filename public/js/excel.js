// Ler e criar ficheiros Excel (.xlsx) sem bibliotecas. Um .xlsx é um ZIP com ficheiros XML.
// Tudo corre no navegador: a folha nunca é enviada para o servidor, só as linhas já validadas.
window.Excel = (() => {
  const u16 = (v, p) => v.getUint16(p, true);
  const u32 = (v, p) => v.getUint32(p, true);

  async function unzip(buffer) {
    const view = new DataView(buffer);
    let end = buffer.byteLength - 22;
    while (end >= 0 && u32(view, end) !== 0x06054b50) end--;
    if (end < 0) throw new Error('Este ficheiro não é um Excel válido (.xlsx).');
    const files = new Map();
    let p = u32(view, end + 16);
    for (let i = 0; i < u16(view, end + 10); i++) {
      const method = u16(view, p + 10);
      const size = u32(view, p + 20);
      const nameLen = u16(view, p + 28);
      const local = u32(view, p + 42);
      const name = new TextDecoder().decode(new Uint8Array(buffer, p + 46, nameLen)).replace(/\\/g, '/');
      const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
      const raw = new Uint8Array(buffer, start, size);
      files.set(name, method === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
      p += 46 + nameLen + u16(view, p + 30) + u16(view, p + 32);
    }
    return files;
  }

  const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  const column = (ref) => [...ref.replace(/\d/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

  // A folha "Exportar para Admin" da planilha de convidados, se existir; senão, a primeira folha do livro.
  function firstSheet(files) {
    const book = files.get('xl/workbook.xml');
    const rels = files.get('xl/_rels/workbook.xml.rels');
    if (book && rels) {
      const sheets = tags(xml(book), 'sheet');
      const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const sheet = sheets.find((s) => plain(s.getAttribute('name')).startsWith('exportar')) || sheets[0];
      const id = sheet && (sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id'));
      const rel = tags(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === id);
      if (rel) {
        const target = rel.getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
        if (files.has(`xl/${target}`)) return files.get(`xl/${target}`);
      }
    }
    const name = [...files.keys()].filter((n) => /^xl\/worksheets\/.+\.xml$/.test(n)).sort()[0];
    if (!name) throw new Error('Não foi encontrada nenhuma folha neste ficheiro.');
    return files.get(name);
  }

  async function readXlsx(buffer) {
    const files = await unzip(buffer);
    const shared = files.has('xl/sharedStrings.xml')
      ? tags(xml(files.get('xl/sharedStrings.xml')), 'si').map((si) => tags(si, 't').map((t) => t.textContent).join(''))
      : [];
    return tags(xml(firstSheet(files)), 'row').map((row) => {
      const out = [];
      tags(row, 'c').forEach((c, i) => {
        const at = c.getAttribute('r') ? column(c.getAttribute('r')) : i;
        const type = c.getAttribute('t');
        const v = tags(c, 'v')[0];
        let value = '';
        if (type === 's') value = shared[Number(v && v.textContent)] ?? '';
        else if (type === 'inlineStr') value = tags(c, 't').map((t) => t.textContent).join('');
        else if (v) value = v.textContent;
        out[at] = value;
      });
      return Array.from(out, (x) => String(x ?? '').trim());
    });
  }

  function readText(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const sep = /\t/.test(lines[0] || '') ? '\t' : /;/.test(lines[0] || '') ? ';' : ',';
    return lines.map((line) => {
      const cells = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') quoted = false;
          else cur += c;
        } else if (c === '"' && !cur) quoted = true;
        else if (c === sep) { cells.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      cells.push(cur.trim());
      return cells;
    });
  }

  async function readFile(file) {
    if (/\.xlsx$/i.test(file.name)) return readXlsx(await file.arrayBuffer());
    if (/\.xls$/i.test(file.name)) throw new Error('Formato .xls antigo: no Excel, escolha Guardar como → Livro do Excel (.xlsx).');
    return readText(await file.text());
  }

  // ---------- Criar o modelo ----------
  const CRC = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  function zip(entries) {
    const enc = new TextEncoder();
    const locals = [];
    const central = [];
    let offset = 0;
    for (const [name, text] of entries) {
      const n = enc.encode(name);
      const d = enc.encode(text);
      const crc = crc32(d);
      const head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
      head.setUint32(14, crc, true); head.setUint32(18, d.length, true); head.setUint32(22, d.length, true); head.setUint16(26, n.length, true);
      locals.push(new Uint8Array(head.buffer), n, d);
      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true);
      dir.setUint32(16, crc, true); dir.setUint32(20, d.length, true); dir.setUint32(24, d.length, true); dir.setUint16(28, n.length, true); dir.setUint32(42, offset, true);
      central.push(new Uint8Array(dir.buffer), n);
      offset += 30 + n.length + d.length;
    }
    const size = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...locals, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const letter = (i) => String.fromCharCode(65 + i);

  function createModel(rows, options, widths) {
    const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => `<c r="${letter(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ' s="2"'}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
    const list = options.relationColumn !== undefined && options.relations.join(',').length <= 250
      ? `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${letter(options.relationColumn)}2:${letter(options.relationColumn)}2000"><formula1>"${esc(options.relations.join(','))}"</formula1></dataValidation></dataValidations>`
      : '';
    return zip([
      ['[Content_Types].xml', `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ['_rels/.rels', `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `${header}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Convidados" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      // Coluna de texto (formato 49): o Excel não transforma o telefone em número.
      ['xl/styles.xml', `${header}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5E1F27"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="49" applyNumberFormat="1"/></cellXfs></styleSheet>`],
      ['xl/worksheets/sheet1.xml', `${header}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1" style="2"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData>${list}</worksheet>`],
    ]);
  }

  return { readFile, readText, readXlsx, createModel };
})();
