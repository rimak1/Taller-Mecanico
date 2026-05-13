/**
 * routes/repuestos.js
 * CRUD completo para la entidad Repuesto.
 * Gestiona el inventario de piezas y repuestos del taller.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../helpers/db');

const router = express.Router();

// ─── GET /api/repuestos ──────────────────────────────────────────────────────
// Retorna la lista completa de repuestos en inventario
router.get('/', (req, res) => {
  try {
    const db = readDB();
    res.json(db.repuestos);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer los repuestos', detalle: error.message });
  }
});

// ─── GET /api/repuestos/:id ──────────────────────────────────────────────────
// Retorna un repuesto específico por su ID
router.get('/:id', (req, res) => {
  try {
    const db = readDB();
    const repuesto = db.repuestos.find(r => r.id === req.params.id);

    if (!repuesto) {
      return res.status(404).json({ error: 'Repuesto no encontrado' });
    }

    res.json(repuesto);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar el repuesto', detalle: error.message });
  }
});

// ─── POST /api/repuestos ─────────────────────────────────────────────────────
// Crea un nuevo repuesto en el inventario
router.post('/', (req, res) => {
  try {
    const { nombre, precio, cantidadEnBodega } = req.body;

    // ── Validaciones de negocio ──────────────────────────────────────────────
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del repuesto es obligatorio' });
    }
    if (precio === undefined || precio === null || Number(precio) <= 0) {
      return res.status(400).json({ error: 'El precio debe ser mayor a 0' });
    }
    if (cantidadEnBodega === undefined || cantidadEnBodega === null || Number(cantidadEnBodega) < 0) {
      return res.status(400).json({ error: 'La cantidad en bodega no puede ser negativa' });
    }

    const db = readDB();

    // Verificar que no exista un repuesto con el mismo nombre (case-insensitive)
    const existe = db.repuestos.some(
      r => r.nombre.toLowerCase() === nombre.trim().toLowerCase()
    );
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un repuesto con ese nombre' });
    }

    // Crear el nuevo repuesto
    const nuevoRepuesto = {
      id: uuidv4(),
      nombre: nombre.trim(),
      precio: Number(precio),
      cantidadEnBodega: Number(cantidadEnBodega)
    };

    db.repuestos.push(nuevoRepuesto);
    writeDB(db);

    res.status(201).json(nuevoRepuesto);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear el repuesto', detalle: error.message });
  }
});

// ─── PUT /api/repuestos/:id ──────────────────────────────────────────────────
// Actualiza precio y/o cantidad en bodega de un repuesto existente
router.put('/:id', (req, res) => {
  try {
    const db = readDB();
    const index = db.repuestos.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Repuesto no encontrado' });
    }

    const { nombre, precio, cantidadEnBodega } = req.body;

    // ── Validaciones opcionales (solo si se envían los campos) ───────────────
    if (nombre !== undefined && nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }
    if (precio !== undefined && Number(precio) <= 0) {
      return res.status(400).json({ error: 'El precio debe ser mayor a 0' });
    }
    if (cantidadEnBodega !== undefined && Number(cantidadEnBodega) < 0) {
      return res.status(400).json({ error: 'La cantidad en bodega no puede ser negativa' });
    }

    // Aplicar cambios (solo los campos enviados)
    const repuestoActual = db.repuestos[index];
    const repuestoActualizado = {
      ...repuestoActual,
      nombre:           nombre !== undefined ? nombre.trim() : repuestoActual.nombre,
      precio:           precio !== undefined ? Number(precio) : repuestoActual.precio,
      cantidadEnBodega: cantidadEnBodega !== undefined ? Number(cantidadEnBodega) : repuestoActual.cantidadEnBodega
    };

    db.repuestos[index] = repuestoActualizado;
    writeDB(db);

    res.json(repuestoActualizado);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el repuesto', detalle: error.message });
  }
});

// ─── DELETE /api/repuestos/:id ───────────────────────────────────────────────
// Elimina un repuesto (solo si no está en uso en órdenes pendientes)
router.delete('/:id', (req, res) => {
  try {
    const db = readDB();
    const index = db.repuestos.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Repuesto no encontrado' });
    }

    // Verificar que el repuesto no esté en órdenes pendientes
    const enUso = db.ordenes.some(
      orden =>
        orden.estado === 'pendiente' &&
        orden.items.some(item => item.repuestoId === req.params.id)
    );

    if (enUso) {
      return res.status(409).json({
        error: 'No se puede eliminar: el repuesto está en uso en una orden pendiente'
      });
    }

    const repuestoEliminado = db.repuestos[index];
    db.repuestos.splice(index, 1);
    writeDB(db);

    res.json({ mensaje: 'Repuesto eliminado correctamente', repuesto: repuestoEliminado });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el repuesto', detalle: error.message });
  }
});

module.exports = router;
