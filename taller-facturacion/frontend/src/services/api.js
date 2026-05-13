/**
 * services/api.js
 * Capa de servicio para comunicación con la API REST del backend.
 * Centraliza todas las llamadas HTTP usando Axios.
 */

import axios from 'axios';

// URL base de la API (el proxy de CRA redirige al puerto 3001)
const BASE_URL = 'http://localhost:3001/api';

// Instancia de Axios con configuración base
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ─── API de Repuestos ────────────────────────────────────────────────────────
export const repuestosAPI = {
  /** Obtiene todos los repuestos del inventario */
  getAll: () => api.get('/repuestos'),

  /** Obtiene un repuesto por su ID */
  getOne: (id) => api.get(`/repuestos/${id}`),

  /** Crea un nuevo repuesto */
  create: (data) => api.post('/repuestos', data),

  /** Actualiza un repuesto existente */
  update: (id, data) => api.put(`/repuestos/${id}`, data),

  /** Elimina un repuesto por su ID */
  remove: (id) => api.delete(`/repuestos/${id}`)
};

// ─── API de Órdenes de Trabajo ───────────────────────────────────────────────
export const ordenesAPI = {
  /** Obtiene todas las órdenes (enriquecidas con cliente) */
  getAll: () => api.get('/ordenes'),

  /** Busca órdenes por placa del vehículo (incluye anticipos) */
  buscarPorPlaca: (placa) => api.get(`/ordenes/buscar?placa=${encodeURIComponent(placa)}`),

  /**
   * Mecánico confirma el cierre técnico de una orden.
   * Cambia el estado de "en_reparacion" a "lista_para_facturar".
   * @param {string} id
   * @param {{ mecanico: string, observaciones?: string }} data
   */
  cerrar: (id, { mecanico, observaciones }) =>
    api.post(`/ordenes/${id}/cerrar`, { mecanico, observaciones }),

  /**
   * Cajero registra un tramo de pago parcial.
   * Puede llamarse N veces hasta que saldoPendiente = 0.
   * Cuando saldo = 0 el backend cierra la orden y genera la factura.
   * @param {string} id
   * @param {{ monto: number, metodo: string }} data
   */
  pagoParcial: (id, { monto, metodo }) =>
    api.post(`/ordenes/${id}/pago-parcial`, { monto, metodo }),

  /**
   * Cajero cobra una orden en un solo pago (alias legacy).
   * @param {string} id
   * @param {{ monto: number, metodo: string }} data
   */
  cobrar: (id, { monto, metodo }) => api.post(`/ordenes/${id}/cobrar`, { monto, metodo })
};

// ─── API de Clientes ─────────────────────────────────────────────────────────
export const clientesAPI = {
  /** Obtiene todos los clientes registrados */
  getAll: () => api.get('/clientes')
};

// ─── API de Facturas ─────────────────────────────────────────────────────────
export const facturasAPI = {
  /** Obtiene todas las facturas generadas */
  getAll: () => api.get('/facturas'),

  /** Obtiene una factura específica con todos sus detalles */
  getOne: (id) => api.get(`/facturas/${id}`)
};

export default api;
