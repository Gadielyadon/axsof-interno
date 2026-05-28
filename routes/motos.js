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

  const doc    = new PDFDocument({ size: 'A5', margin: 0 });
  const W      = doc.page.width;
  const H      = doc.page.height;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recibo-${mov.numero_recibo}.pdf"`);
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