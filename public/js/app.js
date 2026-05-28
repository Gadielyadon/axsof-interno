// ═══ HELPERS GLOBALES ═════════════════════════════════════════════
function fmt(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtFecha(f) {
  if (!f) return '—';
  const [y,m,d] = f.split('-');
  return `${d}/${m}/${y}`;
}
function inicialNombre(n) {
  return (n||'?').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
}
function fmtInput(input) {
  const pos = input.selectionStart;
  const prevLen = input.value.length;
  let raw = input.value.replace(/\./g,'').replace(/[^0-9]/g,'');
  if (raw === '') { input.value = ''; return; }
  const formatted = parseInt(raw,10).toLocaleString('es-AR').replace(/,/g,'.');
  input.value = formatted;
  const diff = formatted.length - prevLen;
  try { input.setSelectionRange(pos+diff, pos+diff); } catch(e) {}
}
function getNumVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value.replace(/\./g,'').replace(',','.')) || 0;
}
async function api(url, opts={}) {
  const r = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error||'Error'); }
  return r.json();
}
function toast(msg, tipo='ok') {
  const t = document.getElementById('toast');
  t.textContent = (tipo==='err'?'❌ ':tipo==='warn'?'⚠️ ':'✅ ') + msg;
  t.className = `toast show`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), tipo==='err'?4000:2500);
}
function abrirModal(id)  { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

// ═══ NAVEGACIÓN ═══════════════════════════════════════════════════
let _paginaActual = 'dashboard';

function iniciarApp() {
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navegarA(a.dataset.page);
      if (window.innerWidth <= 768) cerrarSidebar();
    });
  });
  navegarA('dashboard');
}

function navegarA(page) {
  _paginaActual = page;
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.remove('active');
    if (a.dataset.page === page) {
      a.classList.add('active');
      // Color activo según sección
      const colorClass = { motos:'motos', sistemas:'sistemas', presupuestos:'pres', bitacora:'bita' };
      const cc = colorClass[page]; if (cc) a.classList.add(cc);
    }
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  const titulos = { dashboard:'Panel general', motos:'Cuentas Motos', sistemas:'Cuentas Sistemas', presupuestos:'Presupuestos', bitacora:'Bitácora' };
  document.getElementById('topbar-title').textContent = titulos[page] || page;

  const badge = document.getElementById('topbar-badge');
  if (badge) {
    badge.className = 'topbar-badge';
    if (page === 'motos')    { badge.textContent = 'Motos';    badge.classList.add('motos');    badge.style.display=''; }
    else if (page === 'sistemas') { badge.textContent = 'Sistemas'; badge.classList.add('sistemas'); badge.style.display=''; }
    else badge.style.display = 'none';
  }

  if (page === 'dashboard')    cargarDashboard();
  if (page === 'motos')        { _motoVista='lista'; cargarListaMotos(); }
  if (page === 'sistemas')     { _sisVista='lista'; cargarListaSistemas(); }
  if (page === 'presupuestos') cargarPresupuestos();
  if (page === 'bitacora')     cargarBitacora();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  s.classList.toggle('open');
  if (o) o.classList.toggle('show', s.classList.contains('open'));
}
function cerrarSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const o = document.getElementById('sidebar-overlay');
  if (o) o.classList.remove('show');
}

// ═══ DASHBOARD ════════════════════════════════════════════════════
async function cargarDashboard() {
  try {
    const [motos, sistemas, pres] = await Promise.all([
      api('/api/motos/clientes'),
      api('/api/sistemas/clientes'),
      api('/api/presupuestos'),
    ]);
    const motosActivos = motos.filter(c => c.estado === 'activo');
    const sisActivos   = sistemas.filter(c => c.estado === 'activo');
    const presPend     = pres.filter(p => p.estado === 'enviado');
    const totalDeuda   = motosActivos.reduce((s,c) => s + (c.saldo_actual||0), 0);
    const totalSis     = sisActivos.reduce((s,c) => s + (c.cuota_mensual||0), 0);

    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div><div><div class="stat-val">${motosActivos.length}</div><div class="stat-lbl">Cuentas motos activas</div></div></div>
      <div class="stat-card"><div class="stat-icon azul"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><div><div class="stat-val">${sisActivos.length}</div><div class="stat-lbl">Clientes sistemas activos</div></div></div>
      <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><div class="stat-val" style="font-size:1.1rem">${fmt(totalDeuda)}</div><div class="stat-lbl">Deuda total motos</div></div></div>
      <div class="stat-card"><div class="stat-icon azul"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><div class="stat-val" style="font-size:1.1rem">${fmt(totalSis)}</div><div class="stat-lbl">Facturación mensual sistemas</div></div></div>
      ${presPend.length ? `<div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-val">${presPend.length}</div><div class="stat-lbl">Presupuestos pendientes</div></div></div>` : ''}
    `;

    // Últimas motos
    const top5motos = motosActivos.sort((a,b)=>(b.saldo_actual||0)-(a.saldo_actual||0)).slice(0,5);
    document.getElementById('dash-motos').innerHTML = top5motos.length
      ? top5motos.map(c => `
        <div class="cliente-card" onclick="navegarA('motos');setTimeout(()=>abrirCuentaMoto(${c.id}),100)">
          <div class="cliente-avatar">${inicialNombre(c.nombre)}</div>
          <div class="cliente-info"><div class="cliente-nombre">${c.nombre}</div><div class="cliente-sub">${c.moto_descripcion||'—'}</div></div>
          <div class="cliente-saldo"><div class="saldo-num">${fmt(c.saldo_actual)}</div><div class="saldo-lbl">saldo</div></div>
        </div>`).join('')
      : '<div class="empty-state"><p>Sin cuentas motos activas</p></div>';

    // Últimos sistemas
    const top5sis = sisActivos.sort((a,b)=>a.nombre.localeCompare(b.nombre)).slice(0,5);
    document.getElementById('dash-sistemas').innerHTML = top5sis.length
      ? top5sis.map(c => `
        <div class="cliente-card sistemas" onclick="navegarA('sistemas');setTimeout(()=>abrirCuentaSistema(${c.id}),100)">
          <div class="cliente-avatar azul">${inicialNombre(c.nombre)}</div>
          <div class="cliente-info"><div class="cliente-nombre">${c.nombre}</div><div class="cliente-sub">${c.sistema||'—'}</div></div>
          <div class="cliente-saldo"><div class="saldo-num azul">${fmt(c.cuota_mensual)}/mes</div><div class="saldo-lbl">${c.ultimo_pago?'último: '+fmtFecha(c.ultimo_pago):'sin pagos'}</div></div>
        </div>`).join('')
      : '<div class="empty-state"><p>Sin clientes sistemas activos</p></div>';
  } catch(e) {
    console.error(e);
  }
}

// ═══ MOTOS ════════════════════════════════════════════════════════
let _motoVista = 'lista';
let _motosAll  = [];
let _motoActual = null;
let _motoMovs   = [];

async function cargarListaMotos() {
  _motoVista = 'lista';
  document.getElementById('vista-lista-motos').style.display = '';
  document.getElementById('vista-cuenta-motos').style.display = 'none';
  _motosAll = await api('/api/motos/clientes');
  renderListaMotos(_motosAll);
}

function renderListaMotos(lista) {
  const el = document.getElementById('lista-motos');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg><p>No hay clientes todavía. ¡Agregá el primero!</p></div>';
    return;
  }
  el.innerHTML = lista.map(c => {
    const saldo = c.saldo_actual || 0;
    const badge = c.estado==='cancelado'
      ? `<span class="badge badge-green">✓ Cancelado</span>`
      : saldo === 0 ? `<span class="badge badge-green">✓ Al día</span>` : '';
    return `<div class="cliente-card" onclick="abrirCuentaMoto(${c.id})">
      <div class="cliente-avatar">${inicialNombre(c.nombre)}</div>
      <div class="cliente-info">
        <div class="cliente-nombre">${c.nombre}</div>
        <div class="cliente-sub">${c.moto_descripcion||'—'} ${badge}</div>
      </div>
      <div class="cliente-saldo">
        <div class="saldo-num">${fmt(saldo)}</div>
        <div class="saldo-lbl">${c.ultimo_mov?'últ. '+fmtFecha(c.ultimo_mov):'sin mov.'}</div>
      </div>
    </div>`;
  }).join('');
}

function filtrarMotos() {
  const q = document.getElementById('search-motos').value.toLowerCase();
  renderListaMotos(_motosAll.filter(c =>
    c.nombre.toLowerCase().includes(q) || (c.moto_descripcion||'').toLowerCase().includes(q)
  ));
}

async function abrirCuentaMoto(id) {
  _motoActual = await api(`/api/motos/clientes/${id}`);
  _motoMovs   = await api(`/api/motos/clientes/${id}/movimientos`);
  _motoVista  = 'cuenta';
  document.getElementById('vista-lista-motos').style.display = 'none';
  document.getElementById('vista-cuenta-motos').style.display = '';
  renderCuentaMoto();
}

function renderCuentaMoto() {
  const c = _motoActual;
  document.getElementById('moto-cuenta-nombre').textContent = c.nombre;
  document.getElementById('moto-cuenta-sub').textContent = c.moto_descripcion || '';

  const saldo = c.saldo_actual || 0;
  const esCuotas = c.modalidad === 'cuotas';
  const totalAbonos = _motoMovs.filter(m=>m.abono).length;

  document.getElementById('moto-cuenta-resumen').innerHTML = `
    <div class="resumen-item"><div class="r-lbl">Saldo actual</div><div class="r-val rojo">${fmt(saldo)}</div></div>
    <div class="resumen-item"><div class="r-lbl">Saldo inicial</div><div class="r-val">${fmt(c.saldo_inicial)}</div></div>
    ${esCuotas
      ? `<div class="resumen-item"><div class="r-lbl">Cuota fija</div><div class="r-val">${fmt(c.cuota_fija)}</div></div>
         <div class="resumen-item"><div class="r-lbl">Cuotas abonadas</div><div class="r-val">${totalAbonos} / ${c.total_cuotas}</div></div>`
      : `<div class="resumen-item"><div class="r-lbl">Tasa mensual</div><div class="r-val">${c.tasa_mensual}%</div></div>
         <div class="resumen-item"><div class="r-lbl">Próximo interés</div><div class="r-val monto-naranja">${fmt(Math.round(saldo*(c.tasa_mensual/100)))}</div></div>`
    }
    ${c.observaciones ? `<div class="resumen-item" style="grid-column:1/-1"><div class="r-lbl">Observaciones</div><div class="r-val" style="font-size:.88rem;font-weight:500">${c.observaciones}</div></div>` : ''}
  `;

  const tbody = document.getElementById('moto-mov-tbody');
  if (!_motoMovs.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">Sin movimientos todavía</td></tr>`;
    return;
  }
  tbody.innerHTML = _motoMovs.map(m => {
    const estadoBadge = m.abono
      ? `<span class="badge badge-green">✓ Abonó</span>`
      : `<span class="badge badge-red">✗ No abonó</span>`;
    const reciboBtns = m.abono
      ? `<a href="/api/motos/recibo/${m.id}" target="_blank" class="btn-recibo">📄 Ver</a>
         <button class="btn-recibo" style="margin-left:.3rem;background:var(--orange-bg);color:var(--orange);border-color:rgba(217,119,6,.2)" onclick="abrirReciboManualMoto(${m.id})">✏️ Manual</button>`
      : '—';
    return `<tr>
      <td>${fmtFecha(m.fecha)}</td>
      <td>${estadoBadge}</td>
      <td class="monto-rojo">${fmt(m.saldo_anterior)}</td>
      <td class="monto-naranja">${m.interes ? fmt(m.interes) : '—'}</td>
      <td class="monto-verde">${m.pago ? fmt(m.pago) : '—'}</td>
      <td class="monto-rojo">${fmt(m.saldo_nuevo)}</td>
      <td>${reciboBtns}</td>
      <td><button class="btn-eliminar" onclick="eliminarMovMoto(${m.id})" title="Eliminar">🗑</button></td>
    </tr>`;
  }).join('');
}

function volverListaMotos() { cargarListaMotos(); }

// Modal nuevo movimiento moto
function abrirNuevoMovMoto() {
  document.getElementById('mm-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('mm-estado').value = 'abono';
  document.getElementById('mm-pago').value = '';
  document.getElementById('mm-notas').value = '';
  seleccionarEstadoMoto('abono');
  // Preview info
  const c = _motoActual;
  const saldo = c.saldo_actual || 0;
  const esCuotas = c.modalidad === 'cuotas';
  document.getElementById('mm-info').innerHTML = `
    <div><div class="pi-lbl">Saldo actual</div><div class="pi-val rojo">${fmt(saldo)}</div></div>
    <div><div class="pi-lbl">${esCuotas ? 'Cuota fija' : 'Interés estimado'}</div>
      <div class="pi-val">${esCuotas ? fmt(c.cuota_fija) : fmt(Math.round(saldo*(c.tasa_mensual/100)))}</div></div>
  `;
  if (esCuotas && c.cuota_fija) {
    document.getElementById('mm-pago').value = c.cuota_fija.toLocaleString('es-AR').replace(/,/g,'.');
  }
  abrirModal('modal-mov-moto');
}

function seleccionarEstadoMoto(estado) {
  document.getElementById('mm-estado').value = estado;
  document.getElementById('btn-mm-abono').classList.toggle('activo', estado==='abono');
  document.getElementById('btn-mm-noabono').classList.toggle('activo', estado==='no-abono');
  document.getElementById('mm-seccion-pago').style.display = estado==='abono' ? '' : 'none';
}

async function confirmarMovMoto() {
  const estado = document.getElementById('mm-estado').value;
  const fecha  = document.getElementById('mm-fecha').value;
  const notas  = document.getElementById('mm-notas').value;
  const pago   = estado==='abono' ? getNumVal('mm-pago') : 0;
  if (!fecha) return toast('Ingresá la fecha', 'warn');
  if (estado==='abono' && !pago) return toast('Ingresá el monto abonado', 'warn');
  try {
    await api(`/api/motos/clientes/${_motoActual.id}/movimientos`, {
      method:'POST', body:JSON.stringify({ fecha, pago, abono: estado==='abono', notas })
    });
    cerrarModal('modal-mov-moto');
    toast('Movimiento guardado');
    await abrirCuentaMoto(_motoActual.id);
  } catch(e) { toast(e.message,'err'); }
}

async function eliminarMovMoto(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  await api(`/api/motos/movimientos/${id}`, { method:'DELETE' });
  toast('Movimiento eliminado');
  await abrirCuentaMoto(_motoActual.id);
}

// Modal nuevo/editar cliente moto
function abrirNuevoMoto() {
  document.getElementById('modal-moto-titulo').textContent = 'Nueva cuenta moto';
  ['fm-id','fm-nombre','fm-telefono','fm-dni','fm-moto','fm-saldo','fm-tasa','fm-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('fm-tasa').value = '6';
  document.getElementById('fm-modalidad').value = 'interes';
  document.getElementById('fm-fecha-inicio').value = new Date().toISOString().split('T')[0];
  document.getElementById('fm-id').value = '';
  cambiarModalidadMoto();
  abrirModal('modal-moto-cliente');
}

function editarMotoActual() {
  const c = _motoActual;
  document.getElementById('modal-moto-titulo').textContent = 'Editar cliente';
  document.getElementById('fm-id').value        = c.id;
  document.getElementById('fm-nombre').value    = c.nombre;
  document.getElementById('fm-telefono').value  = c.telefono||'';
  document.getElementById('fm-dni').value       = c.dni||'';
  document.getElementById('fm-moto').value      = c.moto_descripcion||'';
  document.getElementById('fm-tasa').value      = c.tasa_mensual||6;
  document.getElementById('fm-modalidad').value = c.modalidad||'interes';
  document.getElementById('fm-obs').value       = c.observaciones||'';
  document.getElementById('fm-fecha-inicio').value = c.fecha_inicio||'';
  // Al editar no mostramos saldo (ya existe)
  document.getElementById('grupo-fm-saldo').style.display = 'none';
  cambiarModalidadMoto();
  if (c.modalidad === 'cuotas') {
    document.getElementById('fm-cuota').value      = c.cuota_fija||'';
    document.getElementById('fm-total-cuotas').value = c.total_cuotas||'';
  }
  abrirModal('modal-moto-cliente');
}

function cambiarModalidadMoto() {
  const m = document.getElementById('fm-modalidad').value;
  document.getElementById('grupo-fm-tasa').style.display   = m==='interes' ? '' : 'none';
  document.getElementById('grupo-fm-cuotas').style.display = m==='cuotas'  ? '' : 'none';
}

async function guardarClienteMoto() {
  const id = document.getElementById('fm-id').value;
  const body = {
    nombre:          document.getElementById('fm-nombre').value.trim(),
    telefono:        document.getElementById('fm-telefono').value.trim(),
    dni:             document.getElementById('fm-dni').value.trim(),
    moto_descripcion:document.getElementById('fm-moto').value.trim(),
    tasa_mensual:    parseFloat(document.getElementById('fm-tasa').value)||6,
    modalidad:       document.getElementById('fm-modalidad').value,
    cuota_fija:      getNumVal('fm-cuota'),
    total_cuotas:    parseInt(document.getElementById('fm-total-cuotas').value)||0,
    observaciones:   document.getElementById('fm-obs').value.trim(),
    fecha_inicio:    document.getElementById('fm-fecha-inicio').value,
  };
  if (!body.nombre) return toast('Nombre requerido','warn');
  try {
    if (id) {
      body.estado = _motoActual.estado;
      await api(`/api/motos/clientes/${id}`, { method:'PUT', body:JSON.stringify(body) });
      toast('Cliente actualizado');
      cerrarModal('modal-moto-cliente');
      await abrirCuentaMoto(parseInt(id));
    } else {
      body.saldo_inicial = getNumVal('fm-saldo');
      const r = await api('/api/motos/clientes', { method:'POST', body:JSON.stringify(body) });
      toast('Cliente creado');
      cerrarModal('modal-moto-cliente');
      await abrirCuentaMoto(r.id);
    }
  } catch(e) { toast(e.message,'err'); }
}

// ═══ SISTEMAS ═════════════════════════════════════════════════════
let _sisVista   = 'lista';
let _sistemasAll = [];
let _sisActual  = null;
let _sisPagos   = [];

async function cargarListaSistemas() {
  _sisVista = 'lista';
  document.getElementById('vista-lista-sis').style.display = '';
  document.getElementById('vista-cuenta-sis').style.display = 'none';
  _sistemasAll = await api('/api/sistemas/clientes');
  renderListaSistemas(_sistemasAll);
}

function renderListaSistemas(lista) {
  const el = document.getElementById('lista-sistemas');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg><p>Sin clientes todavía</p></div>';
    return;
  }
  el.innerHTML = lista.map(c => {
    const diasDesdeUltimo = c.ultimo_pago
      ? Math.round((Date.now() - new Date(c.ultimo_pago+'T00:00:00').getTime()) / 86400000)
      : null;
    const badge = diasDesdeUltimo !== null && diasDesdeUltimo > 35
      ? `<span class="badge badge-red">⚠ ${diasDesdeUltimo}d sin pagar</span>`
      : c.ultimo_pago ? `<span class="badge badge-green">✓ ${fmtFecha(c.ultimo_pago)}</span>` : '';
    return `<div class="cliente-card sistemas" onclick="abrirCuentaSistema(${c.id})">
      <div class="cliente-avatar azul">${inicialNombre(c.nombre)}</div>
      <div class="cliente-info">
        <div class="cliente-nombre">${c.nombre}</div>
        <div class="cliente-sub">${c.sistema||'—'} ${badge}</div>
      </div>
      <div class="cliente-saldo">
        <div class="saldo-num azul">${fmt(c.cuota_mensual)}<span style="font-size:.65rem;font-weight:500">/mes</span></div>
        <div class="saldo-lbl">${c.total_pagos||0} pago${c.total_pagos!==1?'s':''}</div>
      </div>
    </div>`;
  }).join('');
}

function filtrarSistemas() {
  const q = document.getElementById('search-sistemas').value.toLowerCase();
  renderListaSistemas(_sistemasAll.filter(c =>
    c.nombre.toLowerCase().includes(q) || (c.sistema||'').toLowerCase().includes(q) || (c.rubro||'').toLowerCase().includes(q)
  ));
}

async function abrirCuentaSistema(id) {
  _sisActual = await api(`/api/sistemas/clientes/${id}`);
  _sisPagos  = await api(`/api/sistemas/clientes/${id}/pagos`);
  _sisVista  = 'cuenta';
  document.getElementById('vista-lista-sis').style.display = 'none';
  document.getElementById('vista-cuenta-sis').style.display = '';
  renderCuentaSistema();
}

function renderCuentaSistema() {
  const c = _sisActual;
  document.getElementById('sis-cuenta-nombre').textContent = c.nombre;
  document.getElementById('sis-cuenta-sub').textContent = `${c.sistema||''}${c.rubro?' · '+c.rubro:''}`;

  document.getElementById('sis-cuenta-resumen').innerHTML = `
    <div class="resumen-item"><div class="r-lbl">Cuota mensual</div><div class="r-val azul">${fmt(c.cuota_mensual)}</div></div>
    <div class="resumen-item"><div class="r-lbl">Día de vencimiento</div><div class="r-val">Día ${c.dia_vencimiento||10}</div></div>
    <div class="resumen-item"><div class="r-lbl">Total pagos</div><div class="r-val verde">${_sisPagos.length}</div></div>
    <div class="resumen-item"><div class="r-lbl">Total cobrado</div><div class="r-val">${fmt(_sisPagos.reduce((s,p)=>s+p.monto,0))}</div></div>
    ${c.telefono?`<div class="resumen-item"><div class="r-lbl">Teléfono</div><div class="r-val" style="font-size:.9rem">${c.telefono}</div></div>`:''}
    ${c.email?`<div class="resumen-item"><div class="r-lbl">Email</div><div class="r-val" style="font-size:.9rem">${c.email}</div></div>`:''}
    ${c.observaciones?`<div class="resumen-item" style="grid-column:1/-1"><div class="r-lbl">Observaciones</div><div class="r-val" style="font-size:.88rem;font-weight:500">${c.observaciones}</div></div>`:''}
  `;

  const tbody = document.getElementById('sis-pagos-tbody');
  if (!_sisPagos.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Sin pagos registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = _sisPagos.map(p => `<tr>
    <td>${fmtFecha(p.fecha)}</td>
    <td class="monto-azul">${fmt(p.monto)}</td>
    <td>${p.concepto||'—'}</td>
    <td><a href="/api/sistemas/recibo/${p.id}" target="_blank" class="btn-recibo">📄 Ver</a></td>
    <td><button class="btn-eliminar" onclick="eliminarPagoSis(${p.id})" title="Eliminar">🗑</button></td>
  </tr>`).join('');
}

function volverListaSistemas() { cargarListaSistemas(); }

function abrirNuevoPagoSis() {
  document.getElementById('sp-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('sp-monto').value = _sisActual.cuota_mensual
    ? _sisActual.cuota_mensual.toLocaleString('es-AR').replace(/,/g,'.')
    : '';
  document.getElementById('sp-concepto').value = '';
  document.getElementById('sp-notas').value = '';
  abrirModal('modal-pago-sis');
}

async function confirmarPagoSis() {
  const fecha   = document.getElementById('sp-fecha').value;
  const monto   = getNumVal('sp-monto');
  const concepto= document.getElementById('sp-concepto').value.trim();
  const notas   = document.getElementById('sp-notas').value.trim();
  if (!fecha) return toast('Ingresá la fecha','warn');
  if (!monto) return toast('Ingresá el monto','warn');
  try {
    await api(`/api/sistemas/clientes/${_sisActual.id}/pagos`, {
      method:'POST', body:JSON.stringify({ fecha, monto, concepto, notas })
    });
    cerrarModal('modal-pago-sis');
    toast('Pago registrado');
    await abrirCuentaSistema(_sisActual.id);
  } catch(e) { toast(e.message,'err'); }
}

async function eliminarPagoSis(id) {
  if (!confirm('¿Eliminar este pago?')) return;
  await api(`/api/sistemas/pagos/${id}`, { method:'DELETE' });
  toast('Pago eliminado');
  await abrirCuentaSistema(_sisActual.id);
}

// Modal nuevo/editar cliente sistema
function abrirNuevoSistema() {
  document.getElementById('modal-sis-titulo').textContent = 'Nuevo cliente sistema';
  ['fs-id','fs-nombre','fs-telefono','fs-email','fs-sistema','fs-rubro','fs-cuota','fs-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('fs-dia').value = '10';
  document.getElementById('fs-fecha-alta').value = new Date().toISOString().split('T')[0];
  abrirModal('modal-sis-cliente');
}

function editarSisActual() {
  const c = _sisActual;
  document.getElementById('modal-sis-titulo').textContent = 'Editar cliente';
  document.getElementById('fs-id').value         = c.id;
  document.getElementById('fs-nombre').value     = c.nombre;
  document.getElementById('fs-telefono').value   = c.telefono||'';
  document.getElementById('fs-email').value      = c.email||'';
  document.getElementById('fs-sistema').value    = c.sistema||'';
  document.getElementById('fs-rubro').value      = c.rubro||'';
  document.getElementById('fs-cuota').value      = c.cuota_mensual
    ? c.cuota_mensual.toLocaleString('es-AR').replace(/,/g,'.') : '';
  document.getElementById('fs-dia').value        = c.dia_vencimiento||10;
  document.getElementById('fs-obs').value        = c.observaciones||'';
  document.getElementById('fs-fecha-alta').value = c.fecha_alta||'';
  abrirModal('modal-sis-cliente');
}

async function guardarClienteSis() {
  const id = document.getElementById('fs-id').value;
  const body = {
    nombre:         document.getElementById('fs-nombre').value.trim(),
    telefono:       document.getElementById('fs-telefono').value.trim(),
    email:          document.getElementById('fs-email').value.trim(),
    sistema:        document.getElementById('fs-sistema').value.trim(),
    rubro:          document.getElementById('fs-rubro').value.trim(),
    cuota_mensual:  getNumVal('fs-cuota'),
    dia_vencimiento:parseInt(document.getElementById('fs-dia').value)||10,
    observaciones:  document.getElementById('fs-obs').value.trim(),
    fecha_alta:     document.getElementById('fs-fecha-alta').value,
  };
  if (!body.nombre) return toast('Nombre requerido','warn');
  try {
    if (id) {
      body.estado = _sisActual.estado;
      await api(`/api/sistemas/clientes/${id}`, { method:'PUT', body:JSON.stringify(body) });
      toast('Cliente actualizado');
      cerrarModal('modal-sis-cliente');
      await abrirCuentaSistema(parseInt(id));
    } else {
      const r = await api('/api/sistemas/clientes', { method:'POST', body:JSON.stringify(body) });
      toast('Cliente creado');
      cerrarModal('modal-sis-cliente');
      await abrirCuentaSistema(r.id);
    }
  } catch(e) { toast(e.message,'err'); }
}

// ═══ PRESUPUESTOS ═════════════════════════════════════════════════
let _presAll = [];
let _itemIdx = 0;

async function cargarPresupuestos() {
  _presAll = await api('/api/presupuestos');
  renderPresupuestos(_presAll);
}

function renderPresupuestos(lista) {
  const el = document.getElementById('pres-lista');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg><p>Sin presupuestos todavía</p></div>';
    return;
  }
  const badgeEstado = e => {
    if (e==='aceptado')  return '<span class="pres-estado pres-aceptado">✓ Aceptado</span>';
    if (e==='rechazado') return '<span class="pres-estado pres-rechazado">✗ Rechazado</span>';
    return '<span class="pres-estado pres-enviado">Enviado</span>';
  };
  el.innerHTML = `<div class="table-wrap"><table class="mov-table">
    <thead><tr><th>N°</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>
    <tbody>${lista.map(p=>`<tr>
      <td style="font-size:.8rem;color:var(--text-muted)">${p.numero}</td>
      <td><div style="font-weight:600">${p.cliente_nombre}</div>${p.contacto?`<div style="font-size:.75rem;color:var(--text-muted)">${p.contacto}</div>`:''}</td>
      <td>${fmtFecha(p.fecha)}</td>
      <td class="monto-azul">${fmt(p.total)}</td>
      <td>${badgeEstado(p.estado)}</td>
      <td style="white-space:nowrap;display:flex;gap:.4rem;align-items:center">
        <a href="/api/presupuestos/${p.id}/pdf" target="_blank" class="btn-recibo">📄 PDF</a>
        ${p.estado!=='aceptado'?`<button class="btn-sm btn-secondary" style="padding:.28rem .6rem;font-size:.72rem" onclick="cambiarEstadoPres(${p.id},'aceptado')">✓ Aceptar</button>
        <button class="btn-sm btn-secondary" style="padding:.28rem .6rem;font-size:.72rem" onclick="cambiarEstadoPres(${p.id},'rechazado')">✗</button>`:''}
        <button class="btn-eliminar" onclick="eliminarPres(${p.id})">🗑</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function cambiarEstadoPres(id, estado) {
  await api(`/api/presupuestos/${id}/estado`, { method:'PUT', body:JSON.stringify({estado}) });
  toast(`Presupuesto ${estado}`);
  cargarPresupuestos();
}

async function eliminarPres(id) {
  if (!confirm('¿Eliminar este presupuesto?')) return;
  await api(`/api/presupuestos/${id}`, { method:'DELETE' });
  toast('Presupuesto eliminado');
  cargarPresupuestos();
}

function abrirNuevoPresupuesto() {
  ['pr-nombre','pr-contacto','pr-tel','pr-email','pr-notas'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('pr-validez').value = '30 días';
  document.getElementById('items-container').innerHTML = '';
  _itemIdx = 0;
  document.getElementById('total-pres').textContent = 'Total: $ 0';
  agregarItemPres();
  abrirModal('modal-nuevo-pres');
}

function agregarItemPres(desc='', cant=1, precio=0) {
  const i = _itemIdx++;
  const div = document.createElement('div');
  div.className = 'item-row';
  div.id = 'item-' + i;
  div.innerHTML = `
    <input placeholder="Descripción" value="${desc}" oninput="calcTotalPres()">
    <input type="number" value="${cant}" min="1" oninput="calcTotalPres()" style="text-align:center">
    <input type="number" value="${precio}" min="0" placeholder="0" oninput="calcTotalPres()" style="text-align:right">
    <button class="btn-del-item" onclick="this.parentElement.remove();calcTotalPres()">✕</button>`;
  document.getElementById('items-container').appendChild(div);
  calcTotalPres();
}

function calcTotalPres() {
  let total = 0;
  document.querySelectorAll('#items-container .item-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const cant   = parseFloat(inputs[1].value)||0;
    const precio = parseFloat(inputs[2].value)||0;
    total += cant * precio;
  });
  document.getElementById('total-pres').textContent = 'Total: $ ' + total.toLocaleString('es-AR');
}

async function guardarPresupuesto() {
  const nombre = document.getElementById('pr-nombre').value.trim();
  if (!nombre) return toast('Ingresá el nombre del cliente','warn');
  const items = [];
  document.querySelectorAll('#items-container .item-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const desc   = inputs[0].value.trim();
    const cant   = parseFloat(inputs[1].value)||1;
    const precio = parseFloat(inputs[2].value)||0;
    if (desc) items.push({ descripcion:desc, cantidad:cant, precio });
  });
  if (!items.length) return toast('Agregá al menos un ítem','warn');
  try {
    const r = await api('/api/presupuestos', { method:'POST', body:JSON.stringify({
      cliente_nombre: nombre,
      contacto:  document.getElementById('pr-contacto').value.trim(),
      cliente_tel:   document.getElementById('pr-tel').value.trim(),
      cliente_email: document.getElementById('pr-email').value.trim(),
      validez:       document.getElementById('pr-validez').value.trim(),
      notas:         document.getElementById('pr-notas').value.trim(),
      items
    })});
    cerrarModal('modal-nuevo-pres');
    toast('Presupuesto creado');
    window.open(`/api/presupuestos/${r.id}/pdf`, '_blank');
    cargarPresupuestos();
  } catch(e) { toast(e.message,'err'); }
}

// ═══ BITÁCORA ═════════════════════════════════════════════════════
let _bitaCats   = [];
let _bitaActual = null;
let _bitaTimer  = null;
let _bitaUltimo = '';

async function cargarBitacora() {
  _bitaCats = await api('/api/bitacora/categorias');
  renderBitaCats();
  if (_bitaCats.length && !_bitaActual) {
    seleccionarBitaCat(_bitaCats[0].id);
  } else if (_bitaActual) {
    const c = _bitaCats.find(c=>c.id===_bitaActual);
    if (c) seleccionarBitaCat(c.id);
  }
}

function renderBitaCats() {
  const el = document.getElementById('bita-cats');
  if (!_bitaCats.length) {
    el.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:.5rem 1rem">Sin categorías todavía.<br>Creá la primera.</div>';
    return;
  }
  el.innerHTML = _bitaCats.map(c => `
    <div class="bita-cat-item${_bitaActual===c.id?' active':''}" onclick="seleccionarBitaCat(${c.id})">
      <div class="bita-cat-dot" style="background:${c.color||'#2563eb'}"></div>
      <div style="flex:1;min-width:0">
        <div class="bita-cat-nombre">${c.nombre}</div>
        ${c.actualizado_en?`<div class="bita-cat-fecha">${formatBitaFecha(c.actualizado_en)}</div>`:''}
      </div>
      <button class="btn-eliminar" onclick="event.stopPropagation();eliminarBitaCat(${c.id})" title="Eliminar">🗑</button>
    </div>`).join('');
}

async function seleccionarBitaCat(id) {
  // Guardar la anterior si hay cambios
  if (_bitaActual && _bitaActual !== id) await guardarBita(true);
  _bitaActual = id;
  renderBitaCats();
  const data = await api(`/api/bitacora/categorias/${id}/contenido`);
  _bitaUltimo = data.contenido || '';
  const editor = document.getElementById('bita-editor');
  editor.innerHTML = `
    <div class="bita-toolbar">
      <div class="bita-estado-info">
        <div class="bita-dot" id="bita-dot"></div>
        <span id="bita-estado">Guardado</span>
        <span id="bita-fecha" style="font-size:.72rem;color:var(--text-muted)">${data.actualizado_en?'· '+formatBitaFecha(data.actualizado_en):''}</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn-sm btn-secondary" onclick="insertarFechaBita()">+ Fecha y hora</button>
        <button class="btn-sm btn-primary azul" onclick="guardarBitaYa()">Guardar</button>
      </div>
    </div>
    <textarea class="bita-ta" id="bita-ta"
      placeholder="Escribí acá... se guarda automáticamente.\n\nUsá '+ Fecha y hora' para marcar entradas."
      oninput="bitaOnInput()"
      onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();guardarBitaYa()}"
    >${_bitaUltimo.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>`;
  setTimeout(() => {
    const ta = document.getElementById('bita-ta');
    if (ta) { ta.focus(); ta.scrollTop = ta.scrollHeight; }
  }, 50);
}

function bitaOnInput() {
  const dot = document.getElementById('bita-dot');
  const est = document.getElementById('bita-estado');
  if (dot) dot.className = 'bita-dot saving';
  if (est) est.textContent = 'Escribiendo...';
  clearTimeout(_bitaTimer);
  _bitaTimer = setTimeout(() => guardarBita(), 1500);
}

async function guardarBita(silent=false) {
  if (!_bitaActual) return;
  const ta = document.getElementById('bita-ta');
  if (!ta) return;
  const contenido = ta.value;
  if (contenido === _bitaUltimo) { marcarBitaGuardado(); return; }
  await api(`/api/bitacora/categorias/${_bitaActual}/contenido`, {
    method:'PUT', body:JSON.stringify({ contenido })
  });
  _bitaUltimo = contenido;
  marcarBitaGuardado();
  // Actualizar fecha en la lista
  const cat = _bitaCats.find(c=>c.id===_bitaActual);
  if (cat) { cat.actualizado_en = new Date().toISOString().replace('T',' ').slice(0,19); renderBitaCats(); }
}

async function guardarBitaYa() {
  clearTimeout(_bitaTimer);
  await guardarBita();
  toast('Bitácora guardada');
}

function marcarBitaGuardado() {
  const dot = document.getElementById('bita-dot');
  const est = document.getElementById('bita-estado');
  const fec = document.getElementById('bita-fecha');
  if (dot) dot.className = 'bita-dot';
  if (est) est.textContent = 'Guardado';
  if (fec) fec.textContent = '· ' + new Date().toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function insertarFechaBita() {
  const ta = document.getElementById('bita-ta');
  if (!ta) return;
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const hora  = ahora.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const sep   = `\n\n─── ${fecha} · ${hora} ──────────────\n`;
  const pos   = ta.selectionStart;
  ta.value    = ta.value.substring(0,pos) + sep + ta.value.substring(ta.selectionEnd);
  ta.setSelectionRange(pos+sep.length, pos+sep.length);
  ta.focus();
  bitaOnInput();
}

function formatBitaFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ','T')+'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function abrirNuevaBitaCat() {
  document.getElementById('nb-nombre').value = '';
  document.getElementById('nb-color').value  = '#2563eb';
  abrirModal('modal-nueva-cat');
}

async function guardarNuevaBitaCat() {
  const nombre = document.getElementById('nb-nombre').value.trim();
  const color  = document.getElementById('nb-color').value;
  if (!nombre) return toast('Ingresá un nombre','warn');
  try {
    const r = await api('/api/bitacora/categorias', { method:'POST', body:JSON.stringify({ nombre, color }) });
    toast('Categoría creada');
    cerrarModal('modal-nueva-cat');
    _bitaActual = null;
    await cargarBitacora();
    seleccionarBitaCat(r.id);
  } catch(e) { toast(e.message,'err'); }
}

async function eliminarBitaCat(id) {
  if (!confirm('¿Eliminar esta categoría y todo su contenido?')) return;
  await api(`/api/bitacora/categorias/${id}`, { method:'DELETE' });
  toast('Categoría eliminada');
  if (_bitaActual === id) _bitaActual = null;
  await cargarBitacora();
  if (_bitaCats.length) seleccionarBitaCat(_bitaCats[0].id);
  else document.getElementById('bita-editor').innerHTML = '<div class="bita-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16"/></svg><span>Seleccioná o creá una categoría</span></div>';
}

// Guardar antes de cerrar ventana
window.addEventListener('beforeunload', () => {
  if (_bitaActual) {
    const ta = document.getElementById('bita-ta');
    if (ta && ta.value !== _bitaUltimo) {
      const blob = new Blob([JSON.stringify({contenido:ta.value})], {type:'application/json'});
      navigator.sendBeacon(`/api/bitacora/categorias/${_bitaActual}/contenido`, blob);
    }
  }
});

// ── Recibo manual moto ────────────────────────────────────────────
function abrirReciboManualMoto(movId) {
  const mov = _motoMovs.find(m => m.id === movId);
  if (!mov) return;
  const c = _motoActual;
  const esCuotas = c.modalidad === 'cuotas';
  const previos  = _motoMovs.filter(m => m.abono && m.id <= movId).length;
  let conceptoDefault;
  if (esCuotas) {
    conceptoDefault = 'Cuota ' + previos + ' de ' + c.total_cuotas + ' — ' + (c.moto_descripcion||'');
  } else {
    const parts = (mov.fecha||'').split('-');
    const y = parts[0]; const mm = parts[1];
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    conceptoDefault = 'Corresponde a cuota del mes de ' + meses[parseInt(mm)-1] + ' de ' + y;
  }
  // Precarga todos los campos
  document.getElementById('rm-mov-id').value  = movId;
  document.getElementById('rm-fecha').value   = fmtFecha(mov.fecha);
  document.getElementById('rm-suma').value    = fmt(mov.pago).replace('$','').trim();
  document.getElementById('rm-concepto').value= conceptoDefault;
  document.getElementById('rm-monto').value   = fmt(mov.pago).replace('$','').trim();
  abrirModal('modal-recibo-manual-moto');
}

function verReciboManualMoto() {
  const movId    = document.getElementById('rm-mov-id').value;
  const fecha    = encodeURIComponent(document.getElementById('rm-fecha').value.trim());
  const suma     = encodeURIComponent('$' + document.getElementById('rm-suma').value.trim());
  const concepto = encodeURIComponent(document.getElementById('rm-concepto').value.trim());
  const monto    = encodeURIComponent('$' + document.getElementById('rm-monto').value.trim());
  if (!concepto) return toast('Ingresá el concepto', 'warn');
  window.open('/api/motos/recibo/' + movId + '?fecha=' + fecha + '&suma=' + suma + '&concepto=' + concepto + '&monto=' + monto, '_blank');
  cerrarModal('modal-recibo-manual-moto');
}