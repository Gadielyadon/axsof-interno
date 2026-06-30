const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const LOGO  = path.join(__dirname, '../public/img/logo-motos.png');
const ROJO  = '#D92B2B';
const NEGRO = '#1a1a1a';
const GRIS  = '#666666';
const GRIS2 = '#999999';
const LINEA = '#e5e5e5';
const VERDE = '#16a34a';
const AZUL  = '#2563eb';

function fmtM(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtF(f) {
  if (!f) return '';
  const [y, m, d] = f.split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

// Escapa texto para insertarlo de forma segura dentro del HTML
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Reenvía los parámetros del recibo manual (fecha/suma/concepto/monto) al link del PDF
function fwdQS(query) {
  const keys = ['fecha', 'suma', 'concepto', 'monto'];
  const parts = [];
  keys.forEach(k => {
    if (query[k] != null && query[k] !== '') parts.push(k + '=' + encodeURIComponent(query[k]));
  });
  return parts.length ? '&' + parts.join('&') : '';
}

// Página HTML (mobile-friendly) que muestra el recibo y un botón claro para DESCARGAR el PDF.
// Resuelve el problema de que en el celular el PDF "inline" no ofrece opción de guardar.
function htmlReciboMoto(d) {
  const fwd     = fwdQS(d.query);
  const linkVer = `/api/motos/recibo/${d.movId}?pdf=1${fwd}`;
  const linkDl  = `/api/motos/recibo/${d.movId}?pdf=1&dl=1${fwd}`;
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
       background:#f3f4f6;color:#1a1a1a;padding:16px;padding-bottom:96px;-webkit-text-size-adjust:100%}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;
        box-shadow:0 6px 24px rgba(0,0,0,.10)}
  .head{background:#D92B2B;color:#fff;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .head img{height:46px;background:#fff;border-radius:8px;padding:4px}
  .head .num{font-size:1.5rem;font-weight:800;text-align:right;line-height:1.1}
  .head .num small{display:block;font-size:.72rem;font-weight:500;opacity:.85;letter-spacing:.08em}
  .body{padding:20px}
  .row{display:flex;gap:20px;margin-bottom:16px}
  .row>div{flex:1}
  .lbl{font-size:.66rem;letter-spacing:.09em;color:#9aa0a6;font-weight:600;margin-bottom:3px}
  .val{font-size:.98rem}
  .val.b{font-weight:700}
  .sep{height:1px;background:#ececec;margin:14px 0}
  .suma{background:#fff5f5;border:1px solid #D92B2B;border-radius:10px;padding:16px;text-align:center;margin:6px 0 4px}
  .suma .m{color:#D92B2B;font-size:2rem;font-weight:800}
  .det{display:flex;justify-content:space-between;align-items:center;font-size:.92rem}
  .det .g{color:#16a34a;font-weight:700}
  .foot{background:#f5f5f5;text-align:center;color:#9aa0a6;font-size:.72rem;padding:12px}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e5e5e5;
       padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:10px;
       max-width:480px;margin:0 auto}
  .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;
       font-size:1rem;font-weight:700;border-radius:10px;padding:14px;border:0;cursor:pointer}
  .btn-dl{background:#D92B2B;color:#fff}
  .btn-ver{background:#fff;color:#D92B2B;border:1.5px solid #D92B2B}
  .hint{max-width:480px;margin:10px auto 0;text-align:center;color:#9aa0a6;font-size:.74rem;line-height:1.4}
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <img src="/img/logo-motos.png" alt="Logo" onerror="this.style.display='none'">
      <div class="num"><small>N° RECIBO</small>${esc(d.numeroRecibo)}</div>
    </div>
    <div class="body">
      <div class="row">
        <div><div class="lbl">FECHA</div><div class="val">${esc(d.fechaManual)}</div></div>
        <div><div class="lbl">CLIENTE</div><div class="val b">${esc(d.clienteNombre)}</div>
          ${d.clienteDni ? `<div style="font-size:.78rem;color:#666;margin-top:2px">DNI: ${esc(d.clienteDni)}</div>` : ''}
        </div>
      </div>
      ${d.moto ? `<div class="sep"></div><div class="lbl">VEHÍCULO / MOTO</div><div class="val" style="margin-top:2px">${esc(d.moto)}</div>` : ''}
      <div class="sep"></div>
      <div class="lbl">ABONA LA SUMA DE</div>
      <div class="suma"><div class="m">${esc(d.sumaDeStr)}</div></div>
      <div class="lbl" style="margin-top:14px">EN CONCEPTO DE</div>
      <div class="val" style="margin-top:2px">${esc(d.concepto)}</div>
      <div class="sep"></div>
      <div class="lbl">DETALLE</div>
      <div class="det" style="margin-top:8px"><span style="color:#666">Monto abonado</span><span class="g">${esc(d.montoDetalle)}</span></div>
      ${d.notas ? `<div style="font-size:.78rem;color:#9aa0a6;margin-top:10px">Notas: ${esc(d.notas)}</div>` : ''}
    </div>
    <div class="foot">Yadon Automotores — Catamarca<br>Fecha: ${esc(d.fechaManual)}</div>
  </div>
  <p class="hint">Tocá <b>Descargar recibo</b> para guardar el PDF en tu teléfono.</p>
  <div class="bar">
    <a class="btn btn-ver" href="${linkVer}" target="_blank" rel="noopener">👁️ Ver PDF</a>
    <a class="btn btn-dl" href="${linkDl}" download="${esc(nombrePdf)}">⬇️ Descargar recibo</a>
  </div>
</body>
</html>`;
}

// ── CLIENTES ──────────────────────────────────────────────────────

router.get('/clientes', (req, res) => {
  const clientes = db.query(`
    SELECT c.*,
      (SELECT saldo_nuevo FROM motos_movimientos WHERE cliente_id=c.id ORDER BY fecha DESC, id DESC LIMIT 1) as saldo_actual,
      (SELECT fecha       FROM motos_movimientos WHERE cliente_id=c.id ORDER BY fecha DESC, id DESC LIMIT 1) as ultimo_mov,
      (SELECT COUNT(*)    FROM motos_movimientos WHERE cliente_id=c.id AND abono=1) as total_abonos
    FROM motos_clientes c
    ORDER BY c.nombre ASC
  `);
  clientes.forEach(c => {
    if (c.saldo_actual === null || c.saldo_actual === undefined) c.saldo_actual = c.saldo_inicial;
  });
  res.json(clientes);
});

router.get('/clientes/:id', (req, res) => {
  const c = db.get('SELECT * FROM motos_clientes WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  c.saldo_actual = db.saldoActualMoto(c.id);
  res.json(c);
});

router.post('/clientes', (req, res) => {
  const { nombre, telefono, dni, moto_descripcion, saldo_inicial, tasa_mensual,
          modalidad, cuota_fija, total_cuotas, observaciones, fecha_inicio } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const r = db.run(
    `INSERT INTO motos_clientes
      (nombre, telefono, dni, moto_descripcion, saldo_inicial, tasa_mensual,
       modalidad, cuota_fija, total_cuotas, observaciones, fecha_inicio)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [nombre, telefono||'', dni||'', moto_descripcion||'',
     parseFloat(saldo_inicial)||0, parseFloat(tasa_mensual)||6,
     modalidad||'interes', parseFloat(cuota_fija)||0, parseInt(total_cuotas)||0,
     observaciones||'', fecha_inicio||new Date().toISOString().split('T')[0]]
  );
  res.json({ id: r.lastInsertRowid });
});

router.put('/clientes/:id', (req, res) => {
  const { nombre, telefono, dni, moto_descripcion, tasa_mensual,
          modalidad, cuota_fija, total_cuotas, observaciones, estado } = req.body;
  db.run(
    `UPDATE motos_clientes SET nombre=?, telefono=?, dni=?, moto_descripcion=?,
     tasa_mensual=?, modalidad=?, cuota_fija=?, total_cuotas=?, observaciones=?, estado=?
     WHERE id=?`,
    [nombre, telefono||'', dni||'', moto_descripcion||'',
     parseFloat(tasa_mensual)||6, modalidad||'interes',
     parseFloat(cuota_fija)||0, parseInt(total_cuotas)||0,
     observaciones||'', estado||'activo', req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/clientes/:id', (req, res) => {
  db.run('DELETE FROM motos_movimientos WHERE cliente_id=?', [req.params.id]);
  db.run('DELETE FROM motos_clientes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── MOVIMIENTOS ───────────────────────────────────────────────────

router.get('/clientes/:id/movimientos', (req, res) => {
  const movs = db.query(
    'SELECT * FROM motos_movimientos WHERE cliente_id=? ORDER BY fecha ASC, id ASC',
    [req.params.id]
  );
  res.json(movs);
});

router.post('/clientes/:id/movimientos', (req, res) => {
  const clienteId = parseInt(req.params.id);
  const cliente   = db.get('SELECT * FROM motos_clientes WHERE id=?', [clienteId]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { fecha, pago, abono, notas } = req.body;
  const saldoAnt = db.saldoActualMoto(clienteId);
  const esAbono  = abono ? 1 : 0;
  const interes  = (esAbono && cliente.modalidad === 'interes')
    ? Math.round(saldoAnt * (cliente.tasa_mensual / 100))
    : 0;
  const pagoNum  = esAbono ? (parseFloat(pago) || 0) : 0;
  const saldoNuevo = esAbono
    ? Math.max(0, saldoAnt + interes - pagoNum)
    : saldoAnt;

  const numRecibo = esAbono ? db.siguienteReciboMotos() : '';

  const r = db.run(
    `INSERT INTO motos_movimientos
      (cliente_id, fecha, saldo_anterior, interes, pago, saldo_nuevo, abono, numero_recibo, notas)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [clienteId, fecha, saldoAnt, interes, pagoNum, saldoNuevo, esAbono, numRecibo, notas||'']
  );

  if (saldoNuevo === 0)
    db.run("UPDATE motos_clientes SET estado='cancelado' WHERE id=?", [clienteId]);

  res.json({ id: r.lastInsertRowid, numero_recibo: numRecibo, saldo_nuevo: saldoNuevo });
});

router.delete('/movimientos/:id', (req, res) => {
  db.run('DELETE FROM motos_movimientos WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── RECIBO PDF (rojo/blanco — estilo Yadon) ───────────────────────

router.get('/recibo/:movId', (req, res) => {
  const mov     = db.get('SELECT * FROM motos_movimientos WHERE id=?', [req.params.movId]);
  if (!mov) return res.status(404).json({ error: 'No encontrado' });
  const cliente = db.get('SELECT * FROM motos_clientes WHERE id=?', [mov.cliente_id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const esCuotas = cliente.modalidad === 'cuotas';
  let numeroCuota = 0;
  if (esCuotas) {
    const previos = db.query(
      'SELECT id FROM motos_movimientos WHERE cliente_id=? AND abono=1 AND id<=? ORDER BY id ASC',
      [mov.cliente_id, mov.id]
    );
    numeroCuota = previos.length;
  }

  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m] = (mov.fecha || '').split('-');
  const mesLabel = m ? `${meses[parseInt(m)-1]} ${y}` : '';

  // Valores editables por query params (vienen del modal manual)
  const conceptoDefault = esCuotas
    ? `Cuota ${numeroCuota} de ${cliente.total_cuotas} — ${cliente.moto_descripcion || ''}`
    : `Corresponde a cuota del mes de ${mesLabel}`;

  const fechaManual  = req.query.fecha    ? decodeURIComponent(req.query.fecha)    : fmtF(mov.fecha);
  const concepto     = req.query.concepto ? decodeURIComponent(req.query.concepto) : conceptoDefault;
  const sumaDeStr    = req.query.suma     ? decodeURIComponent(req.query.suma)      : fmtM(mov.pago);
  const montoDetalle = req.query.monto    ? decodeURIComponent(req.query.monto)     : fmtM(mov.pago);

  // Si NO se pide el PDF explícito, devolvemos la página con el botón de descarga.
  const wantPdf = req.query.pdf === '1' || req.query.pdf === 'true';
  if (!wantPdf) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(htmlReciboMoto({
      movId: mov.id,
      numeroRecibo: mov.numero_recibo,
      fechaManual, concepto, sumaDeStr, montoDetalle,
      clienteNombre: cliente.nombre,
      clienteDni: cliente.dni,
      moto: cliente.moto_descripcion,
      notas: mov.notas,
      query: req.query
    }));
  }
  const forzarDescarga = req.query.dl === '1' || req.query.dl === 'true';

  const doc    = new PDFDocument({ size: 'A5', margin: 0 });
  const W      = doc.page.width;
  const H      = doc.page.height;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${forzarDescarga ? 'attachment' : 'inline'}; filename="recibo-${mov.numero_recibo}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  // Franja roja
  doc.rect(0, 0, W, 70).fill(ROJO);
  if (fs.existsSync(LOGO)) doc.image(LOGO, 18, 8, { height: 52 });
  doc.fontSize(9).fillColor('rgba(255,255,255,.7)').font('Helvetica')
     .text('RECIBO', 0, 16, { align: 'right', width: W - 18 });
  doc.fontSize(20).fillColor('white').font('Helvetica-Bold')
     .text(`N° ${mov.numero_recibo}`, 0, 28, { align: 'right', width: W - 18 });

  let posY = 85;

  // Fecha + Cliente
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('FECHA', 28, posY);
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('CLIENTE', W/2, posY);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(fechaManual, 28, posY + 12);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica-Bold').text(cliente.nombre, W/2, posY + 12, { width: W/2 - 28 });
  if (cliente.dni) {
    doc.fontSize(8).fillColor(GRIS).font('Helvetica').text(`DNI: ${cliente.dni}`, W/2, posY + 26, { width: W/2 - 28 });
  }
  posY += 46;

  // Vehículo
  if (cliente.moto_descripcion) {
    doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
    posY += 10;
    doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('VEHÍCULO / MOTO', 28, posY);
    doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(cliente.moto_descripcion, 28, posY + 12, { width: W - 56 });
    posY += 30;
  }

  doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
  posY += 12;

  // ABONA LA SUMA DE (editable)
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('ABONA LA SUMA DE', 28, posY);
  doc.rect(28, posY + 12, W - 56, 44).fill('#fff5f5').stroke(ROJO);
  doc.fontSize(24).fillColor(ROJO).font('Helvetica-Bold')
     .text(sumaDeStr, 28, posY + 20, { align: 'center', width: W - 56 });
  posY += 70;

  // EN CONCEPTO DE (editable)
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('EN CONCEPTO DE', 28, posY);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(concepto, 28, posY + 12, { width: W - 56 });
  posY += 36;

  // DETALLE — solo monto abonado (sin saldo restante)
  doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
  posY += 10;
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('DETALLE', 28, posY);
  posY += 14;

  // Monto abonado (editable)
  doc.fontSize(9).fillColor(GRIS).font('Helvetica').text('Monto abonado', 28, posY);
  doc.fontSize(9).fillColor(VERDE).font('Helvetica-Bold')
     .text(montoDetalle, 0, posY, { align: 'right', width: W - 28 });
  posY += 15;

  // Notas del movimiento (si las hay)
  if (mov.notas) {
    posY += 4;
    doc.fontSize(8).fillColor(GRIS2).font('Helvetica')
       .text(`Notas: ${mov.notas}`, 28, posY, { width: W - 56 });
  }

  // Pie
  const yPie = H - 38;
  doc.rect(0, yPie, W, 38).fill('#f5f5f5');
  doc.moveTo(0, yPie).lineTo(W, yPie).strokeColor(LINEA).lineWidth(0.5).stroke();
  doc.fontSize(7.5).fillColor(GRIS2).font('Helvetica')
     .text('Yadon Automotores — Catamarca', 0, yPie + 8, { align: 'center' })
     .text(`Fecha: ${fechaManual}`, 0, yPie + 20, { align: 'center' });

  doc.end();
});

module.exports = router;