const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');

const DB_PATH    = path.join(__dirname, 'axsoft.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
let _db = null;

async function init() {
  const SQL = await initSqlJs();
  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  _db.run('PRAGMA foreign_keys = ON;');

  // ── MOTOS: clientes con financiación (cuotas fijas o con interés)
  _db.run(`
    CREATE TABLE IF NOT EXISTS motos_clientes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre           TEXT    NOT NULL,
      telefono         TEXT    DEFAULT '',
      dni              TEXT    DEFAULT '',
      moto_descripcion TEXT    DEFAULT '',
      saldo_inicial    REAL    NOT NULL DEFAULT 0,
      tasa_mensual     REAL    NOT NULL DEFAULT 6,
      modalidad        TEXT    NOT NULL DEFAULT 'interes',
      cuota_fija       REAL    DEFAULT 0,
      total_cuotas     INTEGER DEFAULT 0,
      observaciones    TEXT    DEFAULT '',
      fecha_inicio     TEXT    NOT NULL DEFAULT (date('now')),
      estado           TEXT    NOT NULL DEFAULT 'activo',
      creado_en        TEXT    DEFAULT (datetime('now'))
    );
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS motos_movimientos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id     INTEGER NOT NULL REFERENCES motos_clientes(id),
      fecha          TEXT    NOT NULL,
      saldo_anterior REAL    NOT NULL,
      interes        REAL    NOT NULL DEFAULT 0,
      pago           REAL    NOT NULL DEFAULT 0,
      saldo_nuevo    REAL    NOT NULL,
      abono          INTEGER NOT NULL DEFAULT 0,
      tipo           TEXT    NOT NULL DEFAULT 'pago',
      porcentaje     REAL    DEFAULT 0,
      numero_recibo  TEXT    DEFAULT '',
      notas          TEXT    DEFAULT '',
      creado_en      TEXT    DEFAULT (datetime('now'))
    );
  `);
  migrarColumnasMotos();

  // ── SISTEMAS: clientes con cuota fija mensual (sin cálculo de interés)
  _db.run(`
    CREATE TABLE IF NOT EXISTS sistemas_clientes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre          TEXT    NOT NULL,
      telefono        TEXT    DEFAULT '',
      email           TEXT    DEFAULT '',
      sistema         TEXT    DEFAULT '',
      rubro           TEXT    DEFAULT '',
      cuota_mensual   REAL    NOT NULL DEFAULT 0,
      dia_vencimiento INTEGER DEFAULT 10,
      observaciones   TEXT    DEFAULT '',
      fecha_alta      TEXT    DEFAULT (date('now')),
      estado          TEXT    NOT NULL DEFAULT 'activo',
      creado_en       TEXT    DEFAULT (datetime('now'))
    );
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS sistemas_pagos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id     INTEGER NOT NULL REFERENCES sistemas_clientes(id),
      fecha          TEXT    NOT NULL,
      monto          REAL    NOT NULL DEFAULT 0,
      concepto       TEXT    DEFAULT '',
      numero_recibo  TEXT    DEFAULT '',
      notas          TEXT    DEFAULT '',
      creado_en      TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── PRESUPUESTOS
  _db.run(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      numero          TEXT    NOT NULL UNIQUE,
      cliente_nombre  TEXT    NOT NULL,
      cliente_tel     TEXT    DEFAULT '',
      cliente_email   TEXT    DEFAULT '',
      contacto        TEXT    DEFAULT '',
      validez         TEXT    DEFAULT '30 días',
      items           TEXT    NOT NULL,
      notas           TEXT    DEFAULT '',
      total           REAL    NOT NULL DEFAULT 0,
      estado          TEXT    NOT NULL DEFAULT 'enviado',
      fecha           TEXT    DEFAULT (date('now')),
      creado_en       TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── BITÁCORA (por categorías)
  _db.run(`
    CREATE TABLE IF NOT EXISTS bitacora_categorias (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT    NOT NULL UNIQUE,
      color       TEXT    DEFAULT '#2563eb',
      creado_en   TEXT    DEFAULT (datetime('now'))
    );
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS bitacora_notas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL REFERENCES bitacora_categorias(id) ON DELETE CASCADE,
      contenido    TEXT    NOT NULL DEFAULT '',
      actualizado_en TEXT  DEFAULT (datetime('now')),
      creado_en    TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ── CONFIG
  _db.run(`
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  // Contadores
  if (!get("SELECT valor FROM config WHERE clave='ultimo_recibo_motos'"))
    run("INSERT INTO config VALUES ('ultimo_recibo_motos','0')");
  if (!get("SELECT valor FROM config WHERE clave='ultimo_recibo_sistemas'"))
    run("INSERT INTO config VALUES ('ultimo_recibo_sistemas','0')");
  if (!get("SELECT valor FROM config WHERE clave='ultimo_presupuesto'"))
    run("INSERT INTO config VALUES ('ultimo_presupuesto','0')");

  save();
  setInterval(() => save(), 10000);
  setInterval(() => hacerBackup(), 6 * 60 * 60 * 1000);
  hacerBackup();

  console.log('[db] Base de datos iniciada:', DB_PATH);
}

// Migra la tabla motos_movimientos si viene de una versión anterior sin
// las columnas 'tipo' (pago / sin_pago / mora) y 'porcentaje' (recargo aplicado).
function migrarColumnasMotos() {
  const cols = query("PRAGMA table_info(motos_movimientos)").map(c => c.name);
  if (!cols.includes('tipo')) {
    _db.run("ALTER TABLE motos_movimientos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'pago'");
    _db.run("UPDATE motos_movimientos SET tipo='sin_pago' WHERE abono=0");
    _db.run("UPDATE motos_movimientos SET tipo='pago'     WHERE abono=1");
  }
  if (!cols.includes('porcentaje')) {
    _db.run("ALTER TABLE motos_movimientos ADD COLUMN porcentaje REAL DEFAULT 0");
  }
  save();
}

function hacerBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR))
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    save();
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora  = ahora.toTimeString().slice(0,5).replace(':', 'h');
    const dest  = path.join(BACKUP_DIR, `axsoft-${fecha}_${hora}.db`);
    if (!fs.existsSync(DB_PATH)) return;
    fs.copyFileSync(DB_PATH, dest);
    console.log('[backup]', dest);
    const arch = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort();
    if (arch.length > 30)
      arch.slice(0, arch.length - 30).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  } catch (e) {
    console.error('[backup] Error:', e.message);
  }
}

function save() {
  try {
    if (!_db) return;
    const data = Buffer.from(_db.export());
    const tmp  = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error('[save] Error:', e.message);
  }
}

function run(sql, params = []) {
  _db.run(sql, params);
  const row = get('SELECT last_insert_rowid() as id');
  save();
  return { lastInsertRowid: row ? row.id : null };
}

function get(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function query(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── Helpers de negocio ─────────────────────────────────────────────────────

function siguienteReciboMotos() {
  const row = get("SELECT valor FROM config WHERE clave='ultimo_recibo_motos'");
  const n   = parseInt(row ? row.valor : '0') + 1;
  _db.run("UPDATE config SET valor=? WHERE clave='ultimo_recibo_motos'", [String(n)]);
  save();
  return 'M-' + String(n).padStart(6, '0');
}

function siguienteReciboSistemas() {
  const row = get("SELECT valor FROM config WHERE clave='ultimo_recibo_sistemas'");
  const n   = parseInt(row ? row.valor : '0') + 1;
  _db.run("UPDATE config SET valor=? WHERE clave='ultimo_recibo_sistemas'", [String(n)]);
  save();
  return 'S-' + String(n).padStart(6, '0');
}

function siguientePresupuesto() {
  const row = get("SELECT valor FROM config WHERE clave='ultimo_presupuesto'");
  const n   = parseInt(row ? row.valor : '0') + 1;
  _db.run("UPDATE config SET valor=? WHERE clave='ultimo_presupuesto'", [String(n)]);
  save();
  return 'PRES-' + String(n).padStart(4, '0');
}

function saldoActualMoto(clienteId) {
  const u = get(
    'SELECT saldo_nuevo FROM motos_movimientos WHERE cliente_id=? ORDER BY fecha DESC, id DESC LIMIT 1',
    [clienteId]
  );
  if (u) return u.saldo_nuevo;
  const c = get('SELECT saldo_inicial FROM motos_clientes WHERE id=?', [clienteId]);
  return c ? c.saldo_inicial : 0;
}

function calcularProximoInteresMoto(clienteId) {
  const cliente = get('SELECT * FROM motos_clientes WHERE id=?', [clienteId]);
  if (!cliente) return 0;
  const saldo = saldoActualMoto(clienteId);
  return Math.round(saldo * (cliente.tasa_mensual / 100));
}

// Para clientes en modalidad "cuotas": cuántas cuotas debería haber pagado a
// esta altura (según fecha_inicio y hoy) vs. cuántas cubrió con lo que pagó.
// Los recargos por mora no cuentan como pago, así que no "tapan" cuotas.
function cuotasAtrasadasMoto(cliente) {
  if (!cliente || cliente.modalidad !== 'cuotas' || !cliente.cuota_fija) return 0;
  if (cliente.estado === 'cancelado') return 0;
  const [yIni, mIni] = (cliente.fecha_inicio || '').split('-').map(Number);
  if (!yIni || !mIni) return 0;
  const hoy = new Date();
  const mesesTranscurridos = Math.min(
    cliente.total_cuotas || 999,
    Math.max(0, (hoy.getFullYear() - yIni) * 12 + (hoy.getMonth() + 1 - mIni) + 1)
  );
  const totalPagado = get(
    "SELECT COALESCE(SUM(pago),0) as t FROM motos_movimientos WHERE cliente_id=? AND tipo='pago'",
    [cliente.id]
  ).t;
  const cuotasCubiertas = Math.floor(totalPagado / cliente.cuota_fija);
  return Math.max(0, mesesTranscurridos - cuotasCubiertas);
}

// Recalcula TODO el historial de movimientos de un cliente en orden cronológico
// (fecha, luego id como desempate). Se usa después de crear, editar o borrar
// cualquier movimiento, así el saldo siempre queda consistente aunque se hayan
// cargado movimientos con fechas fuera de orden.
function recomputeSaldosMoto(clienteId) {
  const cliente = get('SELECT * FROM motos_clientes WHERE id=?', [clienteId]);
  if (!cliente) return 0;
  const movs = query(
    'SELECT * FROM motos_movimientos WHERE cliente_id=? ORDER BY fecha ASC, id ASC',
    [clienteId]
  );
  let saldo = cliente.saldo_inicial;
  movs.forEach(m => {
    const saldoAnt = saldo;
    let interes = 0, saldoNuevo = saldoAnt;
    if (m.tipo === 'pago') {
      interes = (cliente.modalidad === 'interes')
        ? Math.round(saldoAnt * (cliente.tasa_mensual / 100))
        : 0;
      saldoNuevo = Math.max(0, saldoAnt + interes - m.pago);
    } else if (m.tipo === 'mora') {
      interes = Math.round(saldoAnt * ((m.porcentaje || 0) / 100));
      saldoNuevo = saldoAnt + interes;
    }
    _db.run(
      'UPDATE motos_movimientos SET saldo_anterior=?, interes=?, saldo_nuevo=? WHERE id=?',
      [saldoAnt, interes, saldoNuevo, m.id]
    );
    saldo = saldoNuevo;
  });
  // Si quedó saldado, marcar cancelado; si tenía saldo 0 y ahora debe, reactivar
  if (saldo === 0 && movs.some(m => m.tipo === 'pago')) {
    _db.run("UPDATE motos_clientes SET estado='cancelado' WHERE id=?", [clienteId]);
  } else if (saldo > 0 && cliente.estado === 'cancelado') {
    _db.run("UPDATE motos_clientes SET estado='activo' WHERE id=?", [clienteId]);
  }
  save();
  return saldo;
}

module.exports = {
  init, run, get, query, save, hacerBackup,
  siguienteReciboMotos, siguienteReciboSistemas, siguientePresupuesto,
  saldoActualMoto, calcularProximoInteresMoto, cuotasAtrasadasMoto,
  recomputeSaldosMoto
};
