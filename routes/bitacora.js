const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── CATEGORÍAS ────────────────────────────────────────────────────

router.get('/categorias', (req, res) => {
  const cats = db.query('SELECT * FROM bitacora_categorias ORDER BY nombre ASC');
  cats.forEach(c => {
    const nota = db.get(
      'SELECT contenido, actualizado_en FROM bitacora_notas WHERE categoria_id=? ORDER BY id DESC LIMIT 1',
      [c.id]
    );
    c.contenido       = nota ? nota.contenido       : '';
    c.actualizado_en  = nota ? nota.actualizado_en  : null;
    c.nota_id         = nota ? nota.id : null;
  });
  res.json(cats);
});

router.post('/categorias', (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const existe = db.get('SELECT id FROM bitacora_categorias WHERE nombre=?', [nombre]);
  if (existe) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
  const r = db.run(
    'INSERT INTO bitacora_categorias (nombre, color) VALUES (?,?)',
    [nombre.trim(), color||'#2563eb']
  );
  // Crear nota vacía inicial
  db.run('INSERT INTO bitacora_notas (categoria_id, contenido) VALUES (?,?)', [r.lastInsertRowid, '']);
  res.json({ id: r.lastInsertRowid });
});

router.put('/categorias/:id', (req, res) => {
  const { nombre, color } = req.body;
  db.run('UPDATE bitacora_categorias SET nombre=?, color=? WHERE id=?',
    [nombre, color||'#2563eb', req.params.id]);
  res.json({ ok: true });
});

router.delete('/categorias/:id', (req, res) => {
  db.run('DELETE FROM bitacora_notas WHERE categoria_id=?', [req.params.id]);
  db.run('DELETE FROM bitacora_categorias WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── CONTENIDO (nota por categoría) ───────────────────────────────

router.get('/categorias/:id/contenido', (req, res) => {
  const nota = db.get(
    'SELECT * FROM bitacora_notas WHERE categoria_id=? ORDER BY id DESC LIMIT 1',
    [req.params.id]
  );
  res.json(nota || { contenido: '', actualizado_en: null });
});

router.put('/categorias/:id/contenido', (req, res) => {
  const { contenido } = req.body;
  const existe = db.get('SELECT id FROM bitacora_notas WHERE categoria_id=?', [req.params.id]);
  if (existe) {
    db.run(
      "UPDATE bitacora_notas SET contenido=?, actualizado_en=datetime('now') WHERE categoria_id=?",
      [contenido||'', req.params.id]
    );
  } else {
    db.run('INSERT INTO bitacora_notas (categoria_id, contenido) VALUES (?,?)',
      [req.params.id, contenido||'']);
  }
  res.json({ ok: true });
});

// Para sendBeacon (POST)
router.post('/categorias/:id/contenido', (req, res) => {
  const { contenido } = req.body;
  const existe = db.get('SELECT id FROM bitacora_notas WHERE categoria_id=?', [req.params.id]);
  if (existe) {
    db.run(
      "UPDATE bitacora_notas SET contenido=?, actualizado_en=datetime('now') WHERE categoria_id=?",
      [contenido||'', req.params.id]
    );
  } else {
    db.run('INSERT INTO bitacora_notas (categoria_id, contenido) VALUES (?,?)',
      [req.params.id, contenido||'']);
  }
  res.json({ ok: true });
});

module.exports = router;
