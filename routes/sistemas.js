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

  const doc    = new PDFDocument({ size: 'A4', margin: 0 });
  const W      = doc.page.width;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recibo-${pago.numero_recibo}.pdf"`);
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
