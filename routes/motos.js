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
       font-size:1rem;font-weight:700;border-radius:10px;padding:14px;border:0;cursor:pointer;font-family:inherit}
  .btn:disabled{opacity:.7}
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
        // 1) Celular moderno: abre el menú nativo Compartir/Guardar
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Recibo' }); }
          catch(e){ if (e && e.name === 'AbortError') {/* canceló */} else { throw e; } }
        } else {
          // 2) Compu o navegador sin Compartir: descarga directa
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = PDF_NAME;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        }
      } catch(err){
        // 3) Último recurso: abrir el PDF para que lo guarde con el botón Compartir del visor
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
      (SELECT saldo_nuevo FROM motos_movimientos WHERE cliente_id=c.id ORDER BY fecha DESC, id DESC LIMIT 1) as saldo_actual,
      (SELECT fecha       FROM motos_movimientos WHERE cliente_id=c.id ORDER BY fecha DESC, id DESC LIMIT 1) as ultimo_mov,
      (SELECT COUNT(*)    FROM motos_movimientos WHERE cliente_id=c.id AND abono=1) as total_abonos
    FROM motos_clientes c
    ORDER BY c.nombre ASC
  `);
  clientes.forEach(c => {
    if (c.saldo_actual === null || c.saldo_actual === undefined) c.saldo_actual = c.saldo_inicial;
    if (c.modalidad === 'cuotas') {
      const r = db.resumenCronogramaMoto(c.id);
      if (r.tiene_cronograma) {
        c.saldo_actual = r.capital_pendiente + r.mora_total;
        c.cuotas_atrasadas = r.cuotas_vencidas + r.cuotas_parciales;
      } else {
        c.cuotas_atrasadas = db.cuotasAtrasadasMoto(c);
      }
    } else {
      c.cuotas_atrasadas = 0;
    }
  });
  res.json(clientes);
});

router.get('/clientes/:id', (req, res) => {
  const c = db.get('SELECT * FROM motos_clientes WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  c.saldo_actual = db.saldoActualMoto(c.id);
  if (c.modalidad === 'cuotas') {
    const r = db.resumenCronogramaMoto(c.id);
    if (r.tiene_cronograma) c.saldo_actual = r.capital_pendiente + r.mora_total;
  }
  c.cuotas_atrasadas = db.cuotasAtrasadasMoto(c);
  res.json(c);
});

router.post('/clientes', (req, res) => {
  const { nombre, telefono, dni, moto_descripcion, saldo_inicial, tasa_mensual,
          modalidad, cuota_fija, total_cuotas, observaciones, fecha_inicio, mora_porcentaje, dia_vencimiento } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  if (!fecha_inicio) return res.status(400).json({ error: 'La fecha de inicio es obligatoria' });
  const r = db.run(
    `INSERT INTO motos_clientes
      (nombre, telefono, dni, moto_descripcion, saldo_inicial, tasa_mensual,
       modalidad, cuota_fija, total_cuotas, observaciones, fecha_inicio, mora_porcentaje, dia_vencimiento)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [nombre, telefono||'', dni||'', moto_descripcion||'',
     parseFloat(saldo_inicial)||0, parseFloat(tasa_mensual)||6,
     modalidad||'interes', parseFloat(cuota_fija)||0, parseInt(total_cuotas)||0,
     observaciones||'', fecha_inicio, parseFloat(mora_porcentaje)||6,
     dia_vencimiento ? parseInt(dia_vencimiento) : null]
  );
  // Si es cuota fija, generamos el cronograma de cuotas de una.
  if (modalidad === 'cuotas') db.generarCronogramaMoto(r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

router.put('/clientes/:id', (req, res) => {
  const { nombre, telefono, dni, moto_descripcion, tasa_mensual,
          modalidad, cuota_fija, total_cuotas, observaciones, estado, fecha_inicio, mora_porcentaje, dia_vencimiento } = req.body;
  if (!fecha_inicio) return res.status(400).json({ error: 'La fecha de inicio es obligatoria' });
  db.run(
    `UPDATE motos_clientes SET nombre=?, telefono=?, dni=?, moto_descripcion=?,
     tasa_mensual=?, modalidad=?, cuota_fija=?, total_cuotas=?, observaciones=?, estado=?,
     fecha_inicio=?, mora_porcentaje=?, dia_vencimiento=?
     WHERE id=?`,
    [nombre, telefono||'', dni||'', moto_descripcion||'',
     parseFloat(tasa_mensual)||6, modalidad||'interes',
     parseFloat(cuota_fija)||0, parseInt(total_cuotas)||0,
     observaciones||'', estado||'activo', fecha_inicio, parseFloat(mora_porcentaje)||6,
     dia_vencimiento ? parseInt(dia_vencimiento) : null,
     req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/clientes/:id', (req, res) => {
  const cid = req.params.id;
  const cuotas = db.query('SELECT id FROM motos_cuotas WHERE cliente_id=?', [cid]);
  cuotas.forEach(c => db.run('DELETE FROM motos_cuota_movimientos WHERE cuota_id=?', [c.id]));
  db.run('DELETE FROM motos_cuotas WHERE cliente_id=?', [cid]);
  db.run('DELETE FROM motos_movimientos WHERE cliente_id=?', [cid]);
  db.run('DELETE FROM motos_clientes WHERE id=?', [cid]);
  res.json({ ok: true });
});

// ── CRONOGRAMA DE CUOTAS (modalidad='cuotas') ──────────────────────

// Genera o regenera desde cero el cronograma de un cliente.
router.post('/clientes/:id/cronograma', (req, res) => {
  const cliente = db.get('SELECT * FROM motos_clientes WHERE id=?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (cliente.modalidad !== 'cuotas') return res.status(400).json({ error: 'Solo aplica a clientes de cuota fija' });
  const cuotas = db.generarCronogramaMoto(cliente.id);
  res.json({ ok: true, cuotas: cuotas.length });
});

router.get('/clientes/:id/cuotas', (req, res) => {
  res.json({
    cuotas: db.listarCuotasMoto(req.params.id),
    resumen: db.resumenCronogramaMoto(req.params.id)
  });
});

// Registrar un pago libre (se imputa en cascada a las cuotas más antiguas pendientes).
router.post('/clientes/:id/cuotas/pago', (req, res) => {
  const { monto, fecha, notas, cuotaInicioId, medioPago } = req.body;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
  const resultado = db.registrarPagoCuotasMoto(req.params.id, monto, fecha, notas, cuotaInicioId, medioPago);
  res.json({ ok: true, ...resultado, resumen: db.resumenCronogramaMoto(req.params.id) });
});

// Fija (o quita, con monto=null) un ajuste manual de mora para una cuota puntual.
// Mientras no haya ajuste, la mora se calcula sola según los meses de atraso.
router.post('/clientes/:id/cuotas/:cuotaId/mora', (req, res) => {
  const { monto, fecha, notas } = req.body;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
  const val = db.ajustarMoraManualCuotaMoto(req.params.cuotaId, monto, fecha, notas);
  if (val === null && monto !== null && monto !== '') return res.status(404).json({ error: 'Cuota no encontrada' });
  res.json({ ok: true, monto: val, resumen: db.resumenCronogramaMoto(req.params.id) });
});

// Deshacer un movimiento puntual (pago) de una cuota.
router.delete('/clientes/:id/cuotas/movimientos/:movId', (req, res) => {
  const ok = db.eliminarMovCuotaMoto(req.params.movId);
  if (!ok) return res.status(404).json({ error: 'Movimiento no encontrado' });
  res.json({ ok: true, resumen: db.resumenCronogramaMoto(req.params.id) });
});

// ── MOVIMIENTOS (historial anterior, modalidad='interes' o legado) ─

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

  let { fecha, pago, abono, notas, tipo, moraAplicada, porcentaje, moraDesde, moraHasta } = req.body;
  // Compatibilidad: si no viene 'tipo', lo inferimos de 'abono' (como antes)
  if (!tipo) tipo = abono ? 'pago' : 'sin_pago';

  const esAbono   = tipo === 'pago' ? 1 : 0;
  const pagoNum   = tipo === 'pago' ? (parseFloat(pago) || 0) : 0;
  const aplicaMora = !!moraAplicada;
  const pct        = aplicaMora ? (parseFloat(porcentaje) || 0) : 0;
  const cantCuotas = aplicaMora ? db.mesesEntreFechas(moraDesde, moraHasta) : 0;
  const numRecibo  = tipo === 'pago' ? db.siguienteReciboMotos() : '';

  // Insertamos con valores de saldo provisorios; el recompute de abajo los deja bien.
  const r = db.run(
    `INSERT INTO motos_movimientos
      (cliente_id, fecha, saldo_anterior, interes, pago, saldo_nuevo, abono, tipo, porcentaje, mora_aplicada, cuotas_mora, mora_desde, mora_hasta, numero_recibo, notas)
     VALUES (?,?,0,0,?,0,?,?,?,?,?,?,?,?,?)`,
    [clienteId, fecha, pagoNum, esAbono, tipo, pct, aplicaMora ? 1 : 0, cantCuotas,
     aplicaMora ? (moraDesde||'') : '', aplicaMora ? (moraHasta||'') : '', numRecibo, notas||'']
  );

  // Recalcula todo el historial: aplica la fórmula de mora e ignora fechas fuera de orden.
  const saldoFinal = db.recomputeSaldosMoto(clienteId);

  res.json({ id: r.lastInsertRowid, numero_recibo: numRecibo, saldo_nuevo: saldoFinal });
});

// Editar un movimiento existente (fecha, monto, mora, notas).
// Recalcula todo el historial del cliente después del cambio.
router.put('/clientes/:id/movimientos/:movId', (req, res) => {
  const clienteId = parseInt(req.params.id);
  const movId     = parseInt(req.params.movId);
  const mov = db.get('SELECT * FROM motos_movimientos WHERE id=? AND cliente_id=?', [movId, clienteId]);
  if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });

  let { fecha, pago, tipo, moraAplicada, porcentaje, moraDesde, moraHasta, notas } = req.body;
  if (!tipo) tipo = mov.tipo;
  const pagoNum    = tipo === 'pago' ? (parseFloat(pago) || 0) : 0;
  const esAbono    = tipo === 'pago' ? 1 : 0;
  const aplicaMora = !!moraAplicada;
  const pct        = aplicaMora ? (parseFloat(porcentaje) || 0) : 0;
  const cantCuotas = aplicaMora ? db.mesesEntreFechas(moraDesde, moraHasta) : 0;
  // Si pasa a ser un pago y no tenía recibo asignado todavía, le damos uno.
  const numRecibo = (tipo === 'pago' && !mov.numero_recibo) ? db.siguienteReciboMotos() : mov.numero_recibo;

  db.run(
    `UPDATE motos_movimientos
     SET fecha=?, pago=?, tipo=?, porcentaje=?, mora_aplicada=?, cuotas_mora=?, mora_desde=?, mora_hasta=?, abono=?, numero_recibo=?, notas=?
     WHERE id=?`,
    [fecha || mov.fecha, pagoNum, tipo, pct, aplicaMora ? 1 : 0, cantCuotas,
     aplicaMora ? (moraDesde||'') : '', aplicaMora ? (moraHasta||'') : '',
     esAbono, numRecibo, notas ?? mov.notas, movId]
  );

  const saldoFinal = db.recomputeSaldosMoto(clienteId);
  res.json({ ok: true, saldo_nuevo: saldoFinal });
});

router.delete('/movimientos/:id', (req, res) => {
  const mov = db.get('SELECT cliente_id FROM motos_movimientos WHERE id=?', [req.params.id]);
  db.run('DELETE FROM motos_movimientos WHERE id=?', [req.params.id]);
  if (mov) db.recomputeSaldosMoto(mov.cliente_id);
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
  doc.fontSize(9).fillColor('white').fillOpacity(0.7).font('Helvetica')
     .text('RECIBO', 0, 16, { align: 'right', width: W - 18 });
  doc.fillOpacity(1);
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

// ── RECIBO de un pago del cronograma (puede cubrir 1 o varias cuotas) ──
router.get('/pagos/:pagoId/recibo', (req, res) => {
  const pago = db.get('SELECT * FROM motos_pagos WHERE id=?', [req.params.pagoId]);
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  const cliente = db.get('SELECT * FROM motos_clientes WHERE id=?', [pago.cliente_id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const detalle = db.query(
    `SELECT m.monto, c.numero FROM motos_cuota_movimientos m
     JOIN motos_cuotas c ON c.id = m.cuota_id
     WHERE m.pago_id=? ORDER BY c.numero ASC`,
    [pago.id]
  );

  const forzarDescarga = req.query.dl === '1' || req.query.dl === 'true';
  const doc = new PDFDocument({ size: 'A5', margin: 0 });
  const W = doc.page.width, H = doc.page.height;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${forzarDescarga ? 'attachment' : 'inline'}; filename="recibo-${pago.numero_recibo}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  doc.rect(0, 0, W, 70).fill(ROJO);
  if (fs.existsSync(LOGO)) doc.image(LOGO, 18, 8, { height: 52 });
  doc.fontSize(9).fillColor('white').fillOpacity(0.7).font('Helvetica')
     .text('RECIBO', 0, 16, { align: 'right', width: W - 18 });
  doc.fillOpacity(1);
  doc.fontSize(20).fillColor('white').font('Helvetica-Bold')
     .text(`N° ${pago.numero_recibo}`, 0, 28, { align: 'right', width: W - 18 });

  let posY = 85;
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('FECHA', 28, posY);
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('CLIENTE', W/2, posY);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(fmtF(pago.fecha), 28, posY + 12);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica-Bold').text(cliente.nombre, W/2, posY + 12, { width: W/2 - 28 });
  if (cliente.dni) doc.fontSize(8).fillColor(GRIS).font('Helvetica').text(`DNI: ${cliente.dni}`, W/2, posY + 26, { width: W/2 - 28 });
  posY += 46;

  if (cliente.moto_descripcion) {
    doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
    posY += 10;
    doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('VEHÍCULO / MOTO', 28, posY);
    doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(cliente.moto_descripcion, 28, posY + 12, { width: W - 56 });
    posY += 30;
  }
  doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
  posY += 12;

  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('ABONA LA SUMA DE', 28, posY);
  doc.rect(28, posY + 12, W - 56, 44).fill('#fff5f5').stroke(ROJO);
  doc.fontSize(24).fillColor(ROJO).font('Helvetica-Bold')
     .text(fmtM(pago.monto), 28, posY + 20, { align: 'center', width: W - 56 });
  posY += 70;

  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('MEDIO DE PAGO', 28, posY);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(pago.medio_pago || '—', 28, posY + 12, { width: W - 56 });
  posY += 34;

  doc.moveTo(28, posY).lineTo(W - 28, posY).strokeColor(LINEA).lineWidth(0.5).stroke();
  posY += 10;
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text('APLICADO A', 28, posY);
  posY += 14;
  detalle.forEach(d => {
    doc.fontSize(9).fillColor(GRIS).font('Helvetica').text(`Cuota N°${d.numero}`, 28, posY);
    doc.fontSize(9).fillColor(VERDE).font('Helvetica-Bold').text(fmtM(d.monto), 0, posY, { align: 'right', width: W - 28 });
    posY += 15;
  });

  if (pago.notas) {
    posY += 4;
    doc.fontSize(8).fillColor(GRIS2).font('Helvetica').text(`Notas: ${pago.notas}`, 28, posY, { width: W - 56 });
  }

  const yPie = H - 38;
  doc.rect(0, yPie, W, 38).fill('#f5f5f5');
  doc.moveTo(0, yPie).lineTo(W, yPie).strokeColor(LINEA).lineWidth(0.5).stroke();
  doc.fontSize(7.5).fillColor(GRIS2).font('Helvetica')
     .text('Yadon Automotores — Catamarca', 0, yPie + 8, { align: 'center' })
     .text(`Fecha: ${fmtF(pago.fecha)}`, 0, yPie + 20, { align: 'center' });
  doc.end();
});

// ── ESTADO DE CUENTA completo (cronograma de cuotas + subtotales) ──
router.get('/clientes/:id/estado-cuenta', (req, res) => {
  const cliente = db.get('SELECT * FROM motos_clientes WHERE id=?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const todasLasCuotas = db.listarCuotasMoto(cliente.id);

  // Por defecto solo se incluye lo realmente adeudado (vencidas/parciales),
  // no las cuotas futuras que todavía no vencieron. Se puede elegir a mano
  // qué cuotas entran pasando ?cuotas=1,2,3 (ids) desde la pantalla.
  let cuotas;
  if (req.query.cuotas) {
    const ids = String(req.query.cuotas).split(',').map(n => parseInt(n)).filter(Boolean);
    cuotas = todasLasCuotas.filter(c => ids.includes(c.id));
  } else {
    cuotas = todasLasCuotas.filter(c => c.estado === 'vencida' || c.estado === 'parcial');
  }

  const capitalPendiente = cuotas.reduce((s, c) => s + Math.max(0, c.monto - c.pagado), 0);
  const moraTotal = cuotas.reduce((s, c) => s + (c.mora || 0), 0);
  const resumen = {
    capital_pendiente: capitalPendiente,
    mora_total: moraTotal,
    total_a_pagar: capitalPendiente + moraTotal
  };
  const forzarDescarga = req.query.dl === '1' || req.query.dl === 'true';

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const W = doc.page.width, H = doc.page.height;
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${forzarDescarga ? 'attachment' : 'inline'}; filename="estado-cuenta-${cliente.nombre.replace(/\s+/g,'-')}.pdf"`);
    res.send(Buffer.concat(chunks));
  });

  const M = 40; // margen
  const badgeColor = { pagada: VERDE, parcial: '#d97706', vencida: ROJO, pendiente: GRIS2 };
  const badgeLabel = { pagada: 'Pagada', parcial: 'Parcial', vencida: 'Vencida', pendiente: 'Pendiente' };

  function header() {
    doc.rect(0, 0, W, 80).fill(ROJO);
    if (fs.existsSync(LOGO)) doc.image(LOGO, M, 12, { height: 56 });
    doc.fontSize(11).fillColor('white').fillOpacity(0.75).font('Helvetica')
       .text('ESTADO DE CUENTA', 0, 24, { align: 'right', width: W - M });
    doc.fontSize(9).fillColor('white').fillOpacity(0.75).font('Helvetica')
       .text(`Emitido el ${fmtF(new Date().toISOString().split('T')[0])}`, 0, 42, { align: 'right', width: W - M });
    doc.fillOpacity(1);
    return 100;
  }

  let y = header();

  // Datos del cliente
  doc.fontSize(14).fillColor(NEGRO).font('Helvetica-Bold').text(cliente.nombre, M, y);
  y += 20;
  const datos = [
    cliente.dni ? `DNI: ${cliente.dni}` : null,
    cliente.telefono ? `Tel: ${cliente.telefono}` : null,
    cliente.moto_descripcion ? `Vehículo: ${cliente.moto_descripcion}` : null,
  ].filter(Boolean).join('   ·   ');
  if (datos) { doc.fontSize(9).fillColor(GRIS).font('Helvetica').text(datos, M, y); y += 16; }
  doc.fontSize(9).fillColor(GRIS).font('Helvetica')
     .text(`Cuota fija: ${fmtM(cliente.cuota_fija)}   ·   Mora: ${cliente.mora_porcentaje||6}% por cuota vencida   ·   Cliente desde: ${fmtF(cliente.fecha_inicio)}`, M, y);
  y += 26;

  doc.moveTo(M, y).lineTo(W-M, y).strokeColor(LINEA).lineWidth(1).stroke();
  y += 16;

  // Tabla de cuotas
  const cols = [
    { key:'numero',  label:'N°',          w:30,  align:'left'  },
    { key:'venc',    label:'Vencimiento', w:80,  align:'left'  },
    { key:'monto',   label:'Monto',       w:80,  align:'right' },
    { key:'pagado',  label:'Pagado',      w:80,  align:'right' },
    { key:'mora',    label:'Mora',        w:80,  align:'right' },
    { key:'estado',  label:'Estado',      w:105, align:'right' },
  ];
  const tableW = cols.reduce((s,c)=>s+c.w,0);

  function tableHeader() {
    doc.rect(M, y, tableW, 22).fill('#f5f5f5');
    let x = M;
    cols.forEach(c => {
      doc.fontSize(8).fillColor(GRIS2).font('Helvetica-Bold')
         .text(c.label, x+6, y+7, { width: c.w-10, align: c.align });
      x += c.w;
    });
    y += 22;
  }
  tableHeader();

  cuotas.forEach((cu, i) => {
    if (y > H - 140) { doc.addPage(); y = 40; tableHeader(); }
    if (i % 2 === 1) doc.rect(M, y, tableW, 22).fill('#fafafa');
    let x = M;
    const vals = {
      numero: String(cu.numero),
      venc: fmtF(cu.vencimiento).replace(' de ', '/').replace(' de ', '/'),
      monto: fmtM(cu.monto),
      pagado: cu.pagado ? fmtM(cu.pagado) : '—',
      mora: cu.mora ? fmtM(cu.mora) : '—',
      estado: badgeLabel[cu.estado] || cu.estado,
    };
    cols.forEach(c => {
      doc.fontSize(9).font('Helvetica')
         .fillColor(c.key==='estado' ? (badgeColor[cu.estado]||NEGRO) : NEGRO)
         .text(vals[c.key], x+6, y+6, { width: c.w-10, align: c.align });
      x += c.w;
    });
    y += 22;
    doc.moveTo(M, y).lineTo(M+tableW, y).strokeColor(LINEA).lineWidth(0.5).stroke();
  });

  y += 20;
  if (y > H - 130) { doc.addPage(); y = 40; }

  // Subtotales
  const boxX = M + tableW - 220, boxW = 220;
  doc.rect(boxX, y, boxW, 90).fill('#faf7f2').stroke(LINEA);
  let sy = y + 12;
  function fila(lbl, val, color, bold) {
    doc.fontSize(9).fillColor(GRIS).font('Helvetica').text(lbl, boxX+14, sy);
    doc.fontSize(bold?12:10).fillColor(color||NEGRO).font(bold?'Helvetica-Bold':'Helvetica')
       .text(val, boxX, sy-2, { align:'right', width: boxW-14 });
    sy += bold ? 24 : 20;
  }
  fila('Capital pendiente', fmtM(resumen.capital_pendiente), ROJO);
  fila('Mora acumulada', fmtM(resumen.mora_total), '#d97706');
  doc.moveTo(boxX+14, sy).lineTo(boxX+boxW-14, sy).strokeColor(LINEA).stroke();
  sy += 8;
  fila('TOTAL A PAGAR', fmtM(resumen.total_a_pagar), ROJO, true);

  const yPie = H - 40;
  doc.moveTo(0, yPie).lineTo(W, yPie).strokeColor(LINEA).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(GRIS2).font('Helvetica')
     .text('Yadon Automotores — Catamarca', 0, yPie + 12, { align: 'center', width: W });
  doc.end();
});

module.exports = router;