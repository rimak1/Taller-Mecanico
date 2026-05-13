/**
 * routes/facturas.js
 * Rutas de consulta para la entidad Factura.
 */

const express = require('express');
const { readDB } = require('../helpers/db');

const router = express.Router();

// ─── GET /api/facturas ───────────────────────────────────────────────────────
// Retorna todas las facturas generadas
router.get('/', (req, res) => {
  try {
    const db = readDB();

    // Enriquecer cada factura con los datos del cliente
    const facturasConCliente = db.facturas.map(factura => {
      const cliente = db.clientes.find(c => c.id === factura.clienteId) || null;
      return { ...factura, cliente };
    });

    res.json(facturasConCliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las facturas', detalle: error.message });
  }
});

// ─── GET /api/facturas/:id ───────────────────────────────────────────────────
// Retorna una factura específica con todos sus detalles
router.get('/:id', (req, res) => {
  try {
    const db = readDB();
    const factura = db.facturas.find(f => f.id === req.params.id);

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    // Enriquecer con datos del cliente y la orden original
    const cliente = db.clientes.find(c => c.id === factura.clienteId) || null;
    const orden   = db.ordenes.find(o => o.id === factura.ordenId) || null;
    const pago    = db.pagos.find(p => p.ordenId === factura.ordenId) || null;

    res.json({ ...factura, cliente, orden, pago });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la factura', detalle: error.message });
  }
});

module.exports = router;
