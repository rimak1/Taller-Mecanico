/**
 * server.js
 * Servidor principal Express para el sistema de facturación del taller mecánico.
 * Expone la API REST en el puerto 3001.
 */

const express = require('express');
const cors    = require('cors');

// ─── Rutas de la API ────────────────────────────────────────────────────────
const repuestosRouter = require('./routes/repuestos');
const ordenesRouter   = require('./routes/ordenes');
const clientesRouter  = require('./routes/clientes');
const facturasRouter  = require('./routes/facturas');

// ─── Configuración de la aplicación ─────────────────────────────────────────
const app  = express();
const PORT = 3001;

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors());          // Permitir peticiones desde el frontend (puerto 3000)
app.use(express.json());  // Parsear cuerpos JSON

// ─── Montaje de rutas ────────────────────────────────────────────────────────
app.use('/api/repuestos', repuestosRouter);
app.use('/api/ordenes',   ordenesRouter);
app.use('/api/clientes',  clientesRouter);
app.use('/api/facturas',  facturasRouter);

// ─── Ruta de salud ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'API del taller funcionando correctamente' });
});

// ─── Manejo de rutas no encontradas ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Inicio del servidor ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor del taller corriendo en http://localhost:${PORT}`);
  console.log(`📂 Base de datos: ${__dirname}/data/db.json`);
});
