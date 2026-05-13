/**
 * routes/ordenes.js
 * Rutas para la gestión de órdenes de trabajo.
 *
 * Ciclo de vida de una orden:
 *   en_reparacion  ──► (mecánico: POST /cerrar)
 *   lista_para_facturar ──► (cajero: POST /pago-parcial, uno o varios)
 *   cerrada   ← estado final inmutable (saldo = 0, factura generada)
 *
 * Endpoints:
 *   GET  /api/ordenes
 *   GET  /api/ordenes/buscar?placa=XXX
 *   POST /api/ordenes/:id/cerrar          — Mecánico confirma cierre técnico
 *   POST /api/ordenes/:id/pago-parcial    — Cajero registra un tramo de pago
 *   POST /api/ordenes/:id/cobrar          — Alias legacy (pago único completo)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../helpers/db');

const router = express.Router();

/* ── Constantes de estado ─────────────────────────────────────────────────── */
const ESTADO = {
  EN_REPARACION:       'en_reparacion',
  LISTA_PARA_FACTURAR: 'lista_para_facturar',
  CERRADA:             'cerrada'          // estado final inmutable
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Genera el XML DIAN simulado para una factura */
function generarXmlDian(facturaId, fecha, total) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${facturaId.slice(0, 8).toUpperCase()}</ID>
  <IssueDate>${fecha.slice(0, 10)}</IssueDate>
  <DocumentCurrencyCode>COP</DocumentCurrencyCode>
  <LegalMonetaryTotal>
    <PayableAmount currencyID="COP">${total}</PayableAmount>
  </LegalMonetaryTotal>
  <!-- Generado por TallerPro MVP — DIAN Mock -->
</Invoice>`;
}

/** Suma todos los pagos de cobro registrados para una orden */
function calcularTotalCobrado(pagos, ordenId) {
  return pagos
    .filter(p => p.ordenId === ordenId && p.tipo === 'cobro')
    .reduce((acc, p) => acc + p.monto, 0);
}

/* ── GET /api/ordenes ─────────────────────────────────────────────────────── */
router.get('/', (req, res) => {
  try {
    const db = readDB();
    const ordenes = db.ordenes.map(o => {
      const cobrado = calcularTotalCobrado(db.pagos, o.id);
      return {
        ...o,
        cliente:        db.clientes.find(c => c.id === o.clienteId) || null,
        totalCobrado:   cobrado,
        saldoPendiente: Math.max(0, o.saldoNeto - cobrado)
      };
    });
    res.json(ordenes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las órdenes', detalle: error.message });
  }
});

/* ── GET /api/ordenes/buscar?placa=XXX ────────────────────────────────────── */
router.get('/buscar', (req, res) => {
  try {
    const { placa } = req.query;
    if (!placa?.trim()) {
      return res.status(400).json({ error: 'Debe proporcionar una placa para buscar' });
    }

    const db = readDB();
    const normalizada = placa.trim().toUpperCase().replace(/[-\s]/g, '');

    const ordenes = db.ordenes.filter(
      o => o.vehiculoPlaca.toUpperCase().replace(/[-\s]/g, '') === normalizada
    );

    if (!ordenes.length) {
      return res.status(404).json({
        error: `No se encontraron órdenes para la placa ${placa.toUpperCase()}`
      });
    }

    const resultado = ordenes.map(o => {
      const cobrado = calcularTotalCobrado(db.pagos, o.id);
      return {
        ...o,
        cliente:        db.clientes.find(c => c.id === o.clienteId) || null,
        anticipos:      db.pagos.filter(p => p.ordenId === o.id && p.tipo === 'anticipo'),
        pagos:          db.pagos.filter(p => p.ordenId === o.id && p.tipo === 'cobro'),
        totalCobrado:   cobrado,
        saldoPendiente: Math.max(0, o.saldoNeto - cobrado)
      };
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar la orden', detalle: error.message });
  }
});

/* ── POST /api/ordenes/:id/cerrar ─────────────────────────────────────────── */
/**
 * Mecánico confirma cierre técnico.
 * Body: { mecanico: string, observaciones?: string }
 */
router.post('/:id/cerrar', (req, res) => {
  try {
    const { mecanico, observaciones } = req.body;
    const ordenId = req.params.id;

    if (!mecanico?.trim()) {
      return res.status(400).json({ error: 'El nombre del mecánico es obligatorio' });
    }

    const db  = readDB();
    const idx = db.ordenes.findIndex(o => o.id === ordenId);

    if (idx === -1) return res.status(404).json({ error: 'Orden no encontrada' });

    const orden = db.ordenes[idx];

    if (orden.estado !== ESTADO.EN_REPARACION) {
      return res.status(409).json({
        error: `No se puede cerrar. Estado actual: "${orden.estado}".`
      });
    }

    db.ordenes[idx] = {
      ...orden,
      estado: ESTADO.LISTA_PARA_FACTURAR,
      cierreTecnico: {
        mecanico:      mecanico.trim(),
        fecha:         new Date().toISOString(),
        observaciones: observaciones?.trim() || ''
      }
    };

    writeDB(db);
    res.json({ mensaje: 'Cierre técnico confirmado.', orden: db.ordenes[idx] });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar la orden', detalle: error.message });
  }
});

/* ── POST /api/ordenes/:id/pago-parcial ───────────────────────────────────── */
/**
 * TRANSACCIÓN DE PAGO FRACCIONADO.
 *
 * Registra un tramo de pago. Puede llamarse varias veces hasta que el saldo
 * llegue a $0. Cuando el saldo queda en $0:
 *   - Se genera la Factura con XML DIAN simulado.
 *   - La orden pasa al estado "cerrada" (inmutable).
 *   - Se descuenta el inventario.
 *
 * Body: { monto: number, metodo: "efectivo"|"tarjeta" }
 *
 * Respuesta:
 *   { pago, saldoPendiente, cerrada: bool, factura? }
 */
router.post('/:id/pago-parcial', (req, res) => {
  try {
    const { monto, metodo } = req.body;
    const ordenId = req.params.id;

    // ── Validaciones básicas ─────────────────────────────────────────────
    if (monto === undefined || monto === null || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
    }
    if (!metodo || !['efectivo', 'tarjeta'].includes(metodo)) {
      return res.status(400).json({ error: 'Método de pago inválido. Use "efectivo" o "tarjeta"' });
    }

    const db  = readDB();
    const idx = db.ordenes.findIndex(o => o.id === ordenId);

    if (idx === -1) return res.status(404).json({ error: 'Orden no encontrada' });

    const orden = db.ordenes[idx];

    // ── Precondición: bloquear si no tiene cierre técnico ────────────────
    if (orden.estado === ESTADO.EN_REPARACION) {
      return res.status(409).json({
        error: 'Acción bloqueada: la orden aún está en reparación.',
        codigoBloqueo: 'REQUIERE_CIERRE_TECNICO'
      });
    }

    // ── Inmutabilidad: bloquear si ya está cerrada ───────────────────────
    if (orden.estado === ESTADO.CERRADA) {
      return res.status(409).json({
        error: 'Esta orden ya fue cerrada y facturada. El registro es inmutable.',
        codigoBloqueo: 'ORDEN_CERRADA'
      });
    }

    if (orden.estado !== ESTADO.LISTA_PARA_FACTURAR) {
      return res.status(409).json({ error: `Estado inválido: "${orden.estado}"` });
    }

    // ── Calcular saldo pendiente actual ──────────────────────────────────
    const totalCobradoAntes = calcularTotalCobrado(db.pagos, ordenId);
    const saldoPendiente    = Math.max(0, orden.saldoNeto - totalCobradoAntes);

    if (saldoPendiente === 0) {
      return res.status(409).json({
        error: 'El saldo de esta orden ya está en $0. No se requieren más pagos.',
        codigoBloqueo: 'SALDO_CERO'
      });
    }

    // El monto no puede exceder el saldo pendiente (no se aceptan overpayments en parciales)
    const montoAplicado = Math.min(Number(monto), saldoPendiente);
    const ahora         = new Date().toISOString();

    // ── Registrar el tramo de pago ───────────────────────────────────────
    const nuevoPago = {
      id:      uuidv4(),
      ordenId: ordenId,
      monto:   montoAplicado,
      metodo:  metodo,
      tipo:    'cobro',
      fecha:   ahora
    };
    db.pagos.push(nuevoPago);

    // ── Calcular nuevo saldo ─────────────────────────────────────────────
    const totalCobradoDespues = totalCobradoAntes + montoAplicado;
    const nuevoSaldo          = Math.max(0, orden.saldoNeto - totalCobradoDespues);
    let   facturaGenerada     = null;

    // ── Si saldo = 0: cerrar la orden y generar factura ──────────────────
    if (nuevoSaldo === 0) {
      const facturaId = uuidv4();

      // Construir resumen de métodos de pago usados
      const todosPagos = db.pagos.filter(p => p.ordenId === ordenId && p.tipo === 'cobro');
      const metodosPago = todosPagos.reduce((acc, p) => {
        acc[p.metodo] = (acc[p.metodo] || 0) + p.monto;
        return acc;
      }, {});

      facturaGenerada = {
        id:            facturaId,
        ordenId:       ordenId,
        clienteId:     orden.clienteId,
        fecha:         ahora,
        total:         orden.saldoNeto,
        estado:        'pagada',
        // Resumen de métodos: "efectivo + tarjeta" si fue fraccionado
        metodoPago:    Object.keys(metodosPago).join(' + '),
        desglosePagos: metodosPago,
        items:         orden.items,
        horasTrabajo:  orden.horasTrabajo,
        costoHora:     orden.costoHora,
        totalBruto:    orden.totalBruto,
        abonosPrevios: orden.abonosPrevios,
        vehiculoPlaca: orden.vehiculoPlaca,
        vehiculoMarca: orden.vehiculoMarca,
        cierreTecnico: orden.cierreTecnico,
        // Inmutabilidad: timestamp de cierre
        fechaCierre:   ahora,
        dian: {
          enviada:    true,
          cufe:       uuidv4().replace(/-/g, '').slice(0, 40).toUpperCase(),
          fechaEnvio: ahora,
          xml:        generarXmlDian(facturaId, ahora, orden.saldoNeto)
        }
      };

      // Descontar inventario
      orden.items.forEach(item => {
        const ri = db.repuestos.findIndex(r => r.id === item.repuestoId);
        if (ri !== -1) {
          db.repuestos[ri].cantidadEnBodega = Math.max(
            0, db.repuestos[ri].cantidadEnBodega - item.cantidad
          );
        }
      });

      // Cerrar la orden (estado inmutable)
      db.ordenes[idx] = {
        ...orden,
        estado:      ESTADO.CERRADA,
        fechaCierre: ahora
      };

      db.facturas.push(facturaGenerada);
    }

    writeDB(db);

    const cliente = db.clientes.find(c => c.id === orden.clienteId) || null;

    res.status(201).json({
      mensaje:        nuevoSaldo === 0
        ? 'Pago completado. Orden cerrada y factura generada.'
        : `Pago parcial registrado. Saldo pendiente: $${nuevoSaldo.toLocaleString('es-CO')}`,
      pago:           nuevoPago,
      totalCobrado:   totalCobradoDespues,
      saldoPendiente: nuevoSaldo,
      cerrada:        nuevoSaldo === 0,
      factura:        facturaGenerada ? { ...facturaGenerada, cliente } : null,
      orden:          db.ordenes[idx]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el pago', detalle: error.message });
  }
});

/* ── POST /api/ordenes/:id/cobrar (alias legacy) ──────────────────────────── */
/**
 * Mantiene compatibilidad con el flujo anterior (pago único).
 * Internamente delega a la lógica de pago-parcial.
 */
router.post('/:id/cobrar', (req, res, next) => {
  // Redirigir internamente al endpoint de pago-parcial
  req.url = `/${req.params.id}/pago-parcial`;
  req.params.id = req.params.id;
  next('route');
});

// Handler real del alias (duplica la lógica de pago-parcial para el alias)
router.post('/:id/cobrar', (req, res) => {
  const { monto, metodo } = req.body;
  const ordenId = req.params.id;

  if (monto === undefined || monto === null || Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
  }
  if (!metodo || !['efectivo', 'tarjeta'].includes(metodo)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  try {
    const db  = readDB();
    const idx = db.ordenes.findIndex(o => o.id === ordenId);
    if (idx === -1) return res.status(404).json({ error: 'Orden no encontrada' });

    const orden = db.ordenes[idx];

    if (orden.estado === ESTADO.EN_REPARACION) {
      return res.status(409).json({
        error: 'Acción bloqueada: la orden aún está en reparación.',
        codigoBloqueo: 'REQUIERE_CIERRE_TECNICO'
      });
    }
    if (orden.estado === ESTADO.CERRADA) {
      return res.status(409).json({
        error: 'Esta orden ya fue cerrada y facturada. El registro es inmutable.',
        codigoBloqueo: 'ORDEN_CERRADA'
      });
    }
    if (orden.estado !== ESTADO.LISTA_PARA_FACTURAR) {
      return res.status(409).json({ error: `Estado inválido: "${orden.estado}"` });
    }

    const totalCobradoAntes = calcularTotalCobrado(db.pagos, ordenId);
    const saldoPendiente    = Math.max(0, orden.saldoNeto - totalCobradoAntes);

    if (Number(monto) < saldoPendiente) {
      return res.status(400).json({
        error: `Monto insuficiente para cerrar la orden. Use /pago-parcial para pagos fraccionados.`
      });
    }

    const ahora     = new Date().toISOString();
    const nuevoPago = {
      id: uuidv4(), ordenId, monto: Number(monto), metodo, tipo: 'cobro', fecha: ahora
    };
    db.pagos.push(nuevoPago);

    const facturaId = uuidv4();
    const todosPagos = db.pagos.filter(p => p.ordenId === ordenId && p.tipo === 'cobro');
    const metodosPago = todosPagos.reduce((acc, p) => {
      acc[p.metodo] = (acc[p.metodo] || 0) + p.monto; return acc;
    }, {});

    const nuevaFactura = {
      id: facturaId, ordenId, clienteId: orden.clienteId, fecha: ahora,
      total: orden.saldoNeto, estado: 'pagada',
      metodoPago: Object.keys(metodosPago).join(' + '),
      desglosePagos: metodosPago,
      items: orden.items, horasTrabajo: orden.horasTrabajo, costoHora: orden.costoHora,
      totalBruto: orden.totalBruto, abonosPrevios: orden.abonosPrevios,
      vehiculoPlaca: orden.vehiculoPlaca, vehiculoMarca: orden.vehiculoMarca,
      cierreTecnico: orden.cierreTecnico, fechaCierre: ahora,
      dian: {
        enviada: true,
        cufe: uuidv4().replace(/-/g, '').slice(0, 40).toUpperCase(),
        fechaEnvio: ahora,
        xml: generarXmlDian(facturaId, ahora, orden.saldoNeto)
      }
    };

    orden.items.forEach(item => {
      const ri = db.repuestos.findIndex(r => r.id === item.repuestoId);
      if (ri !== -1) db.repuestos[ri].cantidadEnBodega = Math.max(0, db.repuestos[ri].cantidadEnBodega - item.cantidad);
    });

    db.ordenes[idx] = { ...orden, estado: ESTADO.CERRADA, fechaCierre: ahora };
    db.facturas.push(nuevaFactura);
    writeDB(db);

    const cliente = db.clientes.find(c => c.id === orden.clienteId) || null;
    res.status(201).json({
      mensaje: 'Orden cobrada y facturada exitosamente',
      factura: { ...nuevaFactura, cliente },
      pago: nuevoPago,
      orden: db.ordenes[idx],
      cerrada: true,
      saldoPendiente: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar el cobro', detalle: error.message });
  }
});

module.exports = router;
