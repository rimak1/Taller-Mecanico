/**
 * routes/clientes.js
 * Rutas de consulta para la entidad Cliente.
 */

const express = require('express');
const { readDB } = require('../helpers/db');

const router = express.Router();

// ─── GET /api/clientes ───────────────────────────────────────────────────────
// Retorna la lista completa de clientes registrados
router.get('/', (req, res) => {
  try {
    const db = readDB();
    res.json(db.clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los clientes', detalle: error.message });
  }
});

// ─── GET /api/clientes/:id ───────────────────────────────────────────────────
// Retorna un cliente específico por su ID
router.get('/:id', (req, res) => {
  try {
    const db = readDB();
    const cliente = db.clientes.find(c => c.id === req.params.id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar el cliente', detalle: error.message });
  }
});

module.exports = router;
