const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const LOGO  = path.join(__dirname, '../public/img/logo-axsoft.png');
const AZUL  = '#1A2B5E';
const AZUL2 = '#2E86DE';
const GRIS  = '#888888';
const VERDE = '#0F6E56';
const NEGRO = '#1a1a1a';

function fmtM(n) {
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtF(f) {
  if (!f) return '';
  const [y, m, d] = f.split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fwdQS(query) {
  const keys = ['fecha', 'concepto'];
  const parts = [];
  keys.forEach(k => {
    if (query[k] != null && query[k] !== '') parts.push(k + '=' + encodeURIComponent(query[k]));
  });
  return parts.length ? '&' + parts.join('&') : '';
}

// Página HTML con botón de descarga para el recibo de Sistemas (resuelve la descarga en celular).
function htmlReciboSistemas(d) {
  const fwd     = fwdQS(d.query);
  const linkVer = `/api/sistemas/recibo/${d.pagoId}?pdf=1${fwd}`;
  const linkDl  = `/api/sistemas/recibo/${d.pagoId}?pdf=1&dl=1${fwd}`;
  const nombrePdf = `recibo-${d.numeroRecibo || ''}.pdf`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Recibo N° ${esc(d.numeroRecibo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
       background:#eef1f6;color:#1a1a1a;padding:16px;padding-bottom:96px;-webkit-text-size-adjust:100%}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;
        box-shadow:0 6px 24px rgba(0,0,0,.10)}
  .head{background:#1A2B5E;color:#fff;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .head img{height:50px;background:#fff;border-radius:8px;padding:5px}
  .head .num{font-size:1.1rem;font-weight:800;text-align:right;line-height:1.2}
  .head .num small{display:block;font-size:.72rem;font-weight:500;color:#A8C4E0;margin-top:3px}
  .body{padding:20px}
  .title{color:#1A2B5E;font-size:1.15rem;font-weight:800;text-align:center;letter-spacing:.04em;margin:4px 0 4px}
  .uline{height:2px;width:140px;background:#2E86DE;margin:0 auto 18px}
  .lbl{font-size:.66rem;letter-spacing:.09em;color:#9aa0a6;font-weight:600;margin-bottom:3px}
  .val{font-size:.98rem;margin-bottom:14px}
  .montbox{background:#F4F6FA;border-radius:10px;padding:18px;text-align:center;margin:8px 0}
  .montbox .l{font-size:.72rem;color:#888;letter-spacing:.08em}
  .montbox .m{color:#1A2B5E;font-size:2.1rem;font-weight:800;margin-top:4px}
  .pagado{display:inline-block;background:#E1F5EE;color:#0F6E56;border:1px solid #0F6E56;border-radius:8px;
          font-weight:800;padding:6px 16px;font-size:.95rem;margin:4px auto 0}
  .foot{background:#f5f5f5;text-align:center;color:#9aa0a6;font-size:.72rem;padding:12px;line-height:1.5}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e5e5e5;
       padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:10px;
       max-width:480px;margin:0 auto}
  .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;
       font-size:1rem;font-weight:700;border-radius:10px;padding:14px;border:0;cursor:pointer;font-family:inherit}
  .btn:disabled{opacity:.7}
  .btn-dl{background:#1A2B5E;color:#fff}
  .btn-ver{background:#fff;color:#1A2B5E;border:1.5px solid #1A2B5E}
  .hint{max-width:480px;margin:10px auto 0;text-align:center;color:#9aa0a6;font-size:.74rem;line-height:1.4}
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <img src="/img/logo-axsoft.png" alt="Logo" onerror="this.style.display='none'">
      <div class="num">RECIBO N° ${esc(d.numeroRecibo)}<small>Fecha: ${esc(d.fechaManual)}</small></div>
    </div>
    <div class="body">
      <div class="title">COMPROBANTE DE PAGO</div>
      <div class="uline"></div>
      <div class="lbl">CLIENTE</div><div class="val">${esc(d.clienteNombre)}</div>
      <div class="lbl">SISTEMA CONTRATADO</div><div class="val">${esc(d.sistema) || '—'}</div>
      <div class="lbl">CONCEPTO</div><div class="val">${esc(d.concepto)}</div>
      <div class="montbox">
        <div class="l">TOTAL ABONADO</div>
        <div class="m">${esc(d.montoStr)}</div>
        <div class="pagado">✓ PAGADO</div>
      </div>
      ${d.notas ? `<div class="lbl" style="margin-top:6px">ACLARACIONES</div><div class="val">${esc(d.notas)}</div>` : ''}
    </div>
    <div class="foot">AxSoft Solutions — Soluciones Informáticas a medida<br>axsoftsoluciones.com.ar | info@axsoftsoluciones.com.ar</div>
  </div>
  <p class="hint" id="hint">Tocá <b>Descargar recibo</b> y elegí <b>Guardar en Archivos</b> o <b>Guardar imagen</b>.</p>
  <div class="bar">
    <a class="btn btn-ver" href="${linkVer}" target="_blank" rel="noopener">👁️ Ver</a>
    <button class="btn btn-dl" id="btnDl" onclick="descargarRecibo(this)">⬇️ Descargar recibo</button>
  </div>
  <script>
    var PDF_URL  = ${JSON.stringify(linkDl)};
    var PDF_NAME = ${JSON.stringify(nombrePdf)};
    async function descargarRecibo(btn){
      var txt = btn.innerHTML;
      btn.innerHTML = '⏳ Generando…'; btn.disabled = true;
      try{
        var resp = await fetch(PDF_URL);
        if(!resp.ok) throw new Error('HTTP ' + resp.status);
        var blob = await resp.blob();
        var file = new File([blob], PDF_NAME, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Recibo' }); }
          catch(e){ if (e && e.name === 'AbortError') {/* canceló */} else { throw e; } }
        } else {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = PDF_NAME;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        }
      } catch(err){
        window.open(PDF_URL, '_blank');
      } finally {
        btn.innerHTML = txt; btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

// ── CLIENTES ──────────────────────────────────────────────────────

router.get('/clientes', (req, res) => {
  const clientes = db.query(`
    SELECT c.*,
      (SELECT fecha FROM sistemas_pagos WHERE cliente_id=c.id ORDER BY fecha DESC LIMIT 1) as ultimo_pago,
      (SELECT COUNT(*) FROM sistemas_pagos WHERE cliente_id=c.id) as total_pagos
    FROM sistemas_clientes c
    ORDER BY c.nombre ASC
  `);
  res.json(clientes);
});

router.get('/clientes/:id', (req, res) => {
  const c = db.get('SELECT * FROM sistemas_clientes WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  res.json(c);
});

router.post('/clientes', (req, res) => {
  const { nombre, telefono, email, sistema, rubro, cuota_mensual, dia_vencimiento, observaciones, fecha_alta } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const r = db.run(
    `INSERT INTO sistemas_clientes
      (nombre, telefono, email, sistema, rubro, cuota_mensual, dia_vencimiento, observaciones, fecha_alta)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [nombre, telefono||'', email||'', sistema||'', rubro||'',
     parseFloat(cuota_mensual)||0, parseInt(dia_vencimiento)||10,
     observaciones||'', fecha_alta||new Date().toISOString().split('T')[0]]
  );
  res.json({ id: r.lastInsertRowid });
});

router.put('/clientes/:id', (req, res) => {
  const { nombre, telefono, email, sistema, rubro, cuota_mensual, dia_vencimiento, observaciones, estado } = req.body;
  db.run(
    `UPDATE sistemas_clientes SET nombre=?, telefono=?, email=?, sistema=?, rubro=?,
     cuota_mensual=?, dia_vencimiento=?, observaciones=?, estado=? WHERE id=?`,
    [nombre, telefono||'', email||'', sistema||'', rubro||'',
     parseFloat(cuota_mensual)||0, parseInt(dia_vencimiento)||10,
     observaciones||'', estado||'activo', req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/clientes/:id', (req, res) => {
  db.run('DELETE FROM sistemas_pagos WHERE cliente_id=?', [req.params.id]);
  db.run('DELETE FROM sistemas_clientes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── PAGOS ─────────────────────────────────────────────────────────

router.get('/clientes/:id/pagos', (req, res) => {
  const pagos = db.query(
    'SELECT * FROM sistemas_pagos WHERE cliente_id=? ORDER BY fecha DESC, id DESC',
    [req.params.id]
  );
  res.json(pagos);
});

router.post('/clientes/:id/pagos', (req, res) => {
  const clienteId = parseInt(req.params.id);
  const cliente   = db.get('SELECT * FROM sistemas_clientes WHERE id=?', [clienteId]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { fecha, monto, concepto, notas } = req.body;
  const montoNum    = parseFloat(monto) || cliente.cuota_mensual;
  const numRecibo   = db.siguienteReciboSistemas();
  const conceptoFin = concepto || `Cuota mensual — ${cliente.sistema || 'Sistema'}`;

  const r = db.run(
    `INSERT INTO sistemas_pagos (cliente_id, fecha, monto, concepto, numero_recibo, notas)
     VALUES (?,?,?,?,?,?)`,
    [clienteId, fecha, montoNum, conceptoFin, numRecibo, notas||'']
  );
  res.json({ id: r.lastInsertRowid, numero_recibo: numRecibo });
});

router.delete('/pagos/:id', (req, res) => {
  db.run('DELETE FROM sistemas_pagos WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── RECIBO PDF (azul oscuro — estilo AxSoft) ──────────────────────

router.get('/recibo/:pagoId', (req, res) => {
  const pago    = db.get('SELECT * FROM sistemas_pagos WHERE id=?', [req.params.pagoId]);
  if (!pago) return res.status(404).json({ error: 'No encontrado' });
  const cliente = db.get('SELECT * FROM sistemas_clientes WHERE id=?', [pago.cliente_id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const concepto    = req.query.concepto ? decodeURIComponent(req.query.concepto) : pago.concepto;
  const fechaManual = req.query.fecha    ? decodeURIComponent(req.query.fecha)    : fmtF(pago.fecha);

  // Si NO se pide el PDF explícito, devolvemos la página con el botón de descarga.
  const wantPdf = req.query.pdf === '1' || req.query.pdf === 'true';
  if (!wantPdf) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(htmlReciboSistemas({
      pagoId: pago.id,
      numeroRecibo: pago.numero_recibo,
      fechaManual, concepto,
      montoStr: fmtM(pago.monto),
      clienteNombre: cliente.nombre,
      sistema: cliente.sistema,
      notas: pago.notas,
      query: req.query
    }));
  }
  const forzarDescarga = req.query.dl === '1' || req.query.dl === 'true';

  const doc    = new PDFDocument({ size: 'A4', margin: 0 });
  const W      = doc.page.width;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${forzarDescarga ? 'attachment' : 'inline'}; filename="recibo-${pago.numero_recibo}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  // Banda azul
  doc.rect(0, 0, W, 90).fill(AZUL);
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, 30, 8, { width: 100, height: 74 });
  } else {
    doc.fontSize(18).fillColor('white').font('Helvetica-Bold').text('AxSoft', 30, 28);
  }
  doc.fontSize(12).fillColor('white').font('Helvetica-Bold')
     .text(`RECIBO N°  ${pago.numero_recibo}`, 0, 28, { align: 'right', width: W - 30 });
  doc.fontSize(9).fillColor('#A8C4E0').font('Helvetica')
     .text(`Fecha: ${fechaManual}`, 0, 48, { align: 'right', width: W - 30 });

  // Título
  doc.fontSize(15).fillColor(AZUL).font('Helvetica-Bold')
     .text('COMPROBANTE DE PAGO', 0, 115, { align: 'center' });
  doc.moveTo(W/2 - 110, 136).lineTo(W/2 + 110, 136).strokeColor(AZUL2).lineWidth(2).stroke();

  function campo(label, valor, x, y) {
    doc.fontSize(7.5).fillColor(GRIS).font('Helvetica').text(label.toUpperCase(), x, y);
    doc.fontSize(11).fillColor(NEGRO).font('Helvetica').text(String(valor||'—'), x, y + 12);
  }

  campo('Cliente',              cliente.nombre,             40, 160);
  campo('Sistema contratado',   cliente.sistema||'—',       40, 195);
  campo('Concepto',             concepto,                   40, 230);

  doc.moveTo(40, 262).lineTo(W - 40, 262).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

  // Monto
  doc.rect(40, 278, W - 80, 80).fillColor('#F4F6FA').fill();
  doc.fontSize(9).fillColor(GRIS).font('Helvetica')
     .text('TOTAL ABONADO', 0, 296, { align: 'center' });
  doc.fontSize(32).fillColor(AZUL).font('Helvetica-Bold')
     .text(fmtM(pago.monto), 0, 312, { align: 'center' });

  // Sello PAGADO
  doc.save();
  doc.translate(W - 100, 255).rotate(-18);
  doc.roundedRect(-55, -20, 110, 40, 8).fillAndStroke('#E1F5EE', VERDE);
  doc.fontSize(17).fillColor(VERDE).font('Helvetica-Bold').text('PAGADO', -55, -10, { width: 110, align: 'center' });
  doc.restore();

  if (pago.notas && String(pago.notas).trim()) {
    const acY = 380;
    doc.fontSize(8).fillColor(AZUL).font('Helvetica-Bold').text('ACLARACIONES', 40, acY);
    doc.moveTo(40, acY + 12).lineTo(140, acY + 12).strokeColor(AZUL2).lineWidth(1).stroke();
    doc.fontSize(10).fillColor(NEGRO).font('Helvetica')
       .text(String(pago.notas), 40, acY + 20, { width: W - 80 });
  }

  // Pie
  const yPie = doc.page.height - 60;
  doc.moveTo(30, yPie).lineTo(W - 30, yPie).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(GRIS).font('Helvetica')
     .text('AxSoft Solutions — Soluciones Informáticas a medida', 0, yPie + 10, { align: 'center' })
     .text('axsoftsoluciones.com.ar  |  info@axsoftsoluciones.com.ar', 0, yPie + 22, { align: 'center' });

  doc.end();
});

module.exports = router;