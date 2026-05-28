const express = require('express');
const path    = require('path');
const db      = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/motos',        require('./routes/motos'));
app.use('/api/sistemas',     require('./routes/sistemas'));
app.use('/api/presupuestos', require('./routes/presupuestos'));
app.use('/api/bitacora',     require('./routes/bitacora'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
db.init().then(() => {
  app.listen(PORT, () => console.log(`AxSoft v2 corriendo en http://localhost:${PORT}`));
}).catch(err => { console.error('Error DB:', err); process.exit(1); });
