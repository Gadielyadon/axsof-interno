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
const NEGRO = '#1a1a1a';

router.get('/', (req, res) => {
  res.json(db.query('SELECT * FROM presupuestos ORDER BY creado_en DESC'));
});

router.get('/:id', (req, res) => {
  const p = db.get('SELECT * FROM presupuestos WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  p.items = JSON.parse(p.items);
  res.json(p);
});

router.post('/', (req, res) => {
  const { cliente_nombre, cliente_tel, cliente_email, contacto, validez, items, notas } = req.body;
  if (!cliente_nombre || !items?.length) return res.status(400).json({ error: 'Faltan datos' });
  const total  = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const numero = db.siguientePresupuesto();
  const r = db.run(
    `INSERT INTO presupuestos
      (numero, cliente_nombre, cliente_tel, cliente_email, contacto, validez, items, notas, total)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [numero, cliente_nombre, cliente_tel||'', cliente_email||'', contacto||'',
     validez||'30 días', JSON.stringify(items), notas||'', total]
  );
  res.json({ id: r.lastInsertRowid, numero });
});

router.put('/:id/estado', (req, res) => {
  db.run('UPDATE presupuestos SET estado=? WHERE id=?', [req.body.estado, req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM presupuestos WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/:id/pdf', async (req, res) => {
  const p = db.get('SELECT * FROM presupuestos WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  try {
    const buf = await generarPresupuestoPDF({ ...p, items: JSON.parse(p.items) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${p.numero}.pdf"`);
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error generando PDF' });
  }
});

function generarPresupuestoPDF(datos) {
  return new Promise((resolve, reject) => {
    const doc  = new PDFDocument({ size: 'A4', margin: 0 });
    const W    = doc.page.width;
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.rect(0, 0, W, 90).fill(AZUL);
    if (fs.existsSync(LOGO)) {
      doc.image(LOGO, 30, 8, { width: 100, height: 74 });
    } else {
      doc.fontSize(18).fillColor('white').font('Helvetica-Bold').text('AxSoft', 30, 28);
    }
    const fecha = datos.fecha
      ? new Date(datos.fecha + 'T12:00:00').toLocaleDateString('es-AR')
      : new Date().toLocaleDateString('es-AR');
    doc.fontSize(12).fillColor('white').font('Helvetica-Bold')
       .text(`PRESUPUESTO N°  ${datos.numero}`, 0, 28, { align: 'right', width: W - 30 });
    doc.fontSize(9).fillColor('#A8C4E0').font('Helvetica')
       .text(`Fecha: ${fecha}`, 0, 48, { align: 'right', width: W - 30 });

    doc.fontSize(15).fillColor(AZUL).font('Helvetica-Bold')
       .text('PRESUPUESTO', 0, 115, { align: 'center' });
    doc.moveTo(W/2 - 80, 136).lineTo(W/2 + 80, 136).strokeColor(AZUL2).lineWidth(2).stroke();

    function campo(label, valor, x, y) {
      doc.fontSize(7.5).fillColor(GRIS).font('Helvetica').text(label.toUpperCase(), x, y);
      doc.fontSize(11).fillColor(NEGRO).font('Helvetica').text(String(valor||'—'), x, y + 12);
    }

    doc.rect(40, 150, W - 80, 80).fillColor('#F4F6FA').fill();
    doc.fontSize(8).fillColor(AZUL).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 55, 162);
    campo('Empresa / Nombre', datos.cliente_nombre, 55, 175);
    campo('Contacto',         datos.contacto||'—',  W/2 + 10, 175);
    campo('Teléfono',         datos.cliente_tel||'—', 55, 210);
    campo('Email',            datos.cliente_email||'—', W/2 + 10, 210);

    let ty = 248;
    doc.rect(40, ty, W - 80, 20).fillColor(AZUL).fill();
    doc.fontSize(8.5).fillColor('white').font('Helvetica-Bold');
    doc.text('DESCRIPCIÓN', 55,    ty + 6);
    doc.text('CANT.',       W - 200, ty + 6, { width: 50, align: 'right' });
    doc.text('PRECIO',      W - 140, ty + 6, { width: 60, align: 'right' });
    doc.text('SUBTOTAL',    W - 70,  ty + 6, { width: 60, align: 'right' });
    ty += 20;

    let total = 0;
    const items = typeof datos.items === 'string' ? JSON.parse(datos.items) : datos.items;
    items.forEach((item, i) => {
      const subtotal = item.cantidad * item.precio;
      total += subtotal;
      doc.rect(40, ty, W - 80, 22).fillColor(i % 2 === 0 ? '#F4F6FA' : '#FFFFFF').fill();
      doc.fontSize(9.5).fillColor(NEGRO).font('Helvetica');
      doc.text(item.descripcion, 55, ty + 7, { width: W - 280 });
      doc.text(String(item.cantidad), W - 200, ty + 7, { width: 50, align: 'right' });
      doc.text('$ ' + Number(item.precio).toLocaleString('es-AR'), W - 140, ty + 7, { width: 60, align: 'right' });
      doc.text('$ ' + Number(subtotal).toLocaleString('es-AR'),    W - 70,  ty + 7, { width: 60, align: 'right' });
      ty += 22;
    });

    doc.moveTo(W/2, ty + 4).lineTo(W - 40, ty + 4).strokeColor(AZUL2).lineWidth(1).stroke();
    doc.fontSize(12).fillColor(AZUL).font('Helvetica-Bold');
    doc.text('TOTAL:', W - 180, ty + 12, { width: 80, align: 'right' });
    doc.text('$ ' + Number(total).toLocaleString('es-AR'), W - 80, ty + 12, { width: 70, align: 'right' });
    ty += 40;

    doc.rect(40, ty, 220, 22).fillColor('#EAF1FB').fill();
    doc.fontSize(9).fillColor(AZUL2).font('Helvetica-Bold')
       .text(`Validez del presupuesto: ${datos.validez || '30 días'}`, 50, ty + 7);

    if (datos.notas) {
      ty += 36;
      doc.fontSize(8).fillColor(GRIS).font('Helvetica-Bold').text('OBSERVACIONES:', 40, ty);
      doc.fontSize(9).fillColor(NEGRO).font('Helvetica').text(datos.notas, 40, ty + 14, { width: W - 80 });
    }

    const yPie = doc.page.height - 60;
    doc.moveTo(30, yPie).lineTo(W - 30, yPie).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(GRIS).font('Helvetica')
       .text('AxSoft Solutions — Soluciones Informáticas a medida', 0, yPie + 10, { align: 'center' })
       .text('axsoftsoluciones.com.ar  |  info@axsoftsoluciones.com.ar', 0, yPie + 22, { align: 'center' });

    doc.end();
  });
}

module.exports = router;
