/**
 * components/GestionRepuestos.js
 * Pantalla CRUD para la gestión del inventario de repuestos.
 *
 * Operaciones:
 *  - Listar todos los repuestos con precio y stock.
 *  - Crear nuevos repuestos.
 *  - Editar precio y cantidad en bodega.
 *  - Eliminar repuestos (con validación de uso en órdenes pendientes).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { repuestosAPI } from '../services/api';

/* ── Utilidades ─────────────────────────────────────────────────────────── */

/** Formatea un número como moneda colombiana (COP) */
const formatCOP = (valor) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);

/* ── Constantes ─────────────────────────────────────────────────────────── */

const FORM_INICIAL      = { nombre: '', precio: '', cantidadEnBodega: '' };
const UMBRAL_STOCK_BAJO = 3;

/* ── Componente principal ───────────────────────────────────────────────── */

function GestionRepuestos() {
  // Estado de datos
  const [repuestos,  setRepuestos]  = useState([]);
  const [form,       setForm]       = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState(null);

  // Estado de UI
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');
  const [exito,    setExito]    = useState('');

  /* ── Carga inicial ────────────────────────────────────────────────── */
  const cargarRepuestos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { data } = await repuestosAPI.getAll();
      setRepuestos(data);
    } catch {
      setError('No se pudo conectar con el servidor. Verifique que el backend esté activo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarRepuestos(); }, [cargarRepuestos]);

  /* ── Helpers de UI ────────────────────────────────────────────────── */
  const limpiarMensajes = () => { setError(''); setExito(''); };

  const manejarCambio = ({ target: { name, value } }) =>
    setForm(prev => ({ ...prev, [name]: value }));

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    limpiarMensajes();
  };

  /* ── Validación del formulario ────────────────────────────────────── */
  const validarForm = () => {
    if (!form.nombre.trim()) {
      setError('El nombre del repuesto es obligatorio.');
      return false;
    }
    if (!form.precio || Number(form.precio) <= 0) {
      setError('El precio debe ser mayor a cero.');
      return false;
    }
    if (form.cantidadEnBodega === '' || Number(form.cantidadEnBodega) < 0) {
      setError('La cantidad en bodega no puede ser negativa.');
      return false;
    }
    return true;
  };

  /* ── Guardar (crear o actualizar) ─────────────────────────────────── */
  const guardar = async (e) => {
    e.preventDefault();
    limpiarMensajes();
    if (!validarForm()) return;

    const datos = {
      nombre:           form.nombre.trim(),
      precio:           Number(form.precio),
      cantidadEnBodega: Number(form.cantidadEnBodega)
    };

    setCargando(true);
    try {
      if (editandoId) {
        await repuestosAPI.update(editandoId, datos);
        setExito(`Repuesto "${datos.nombre}" actualizado correctamente.`);
      } else {
        await repuestosAPI.create(datos);
        setExito(`Repuesto "${datos.nombre}" registrado correctamente.`);
      }
      await cargarRepuestos();
      cancelarEdicion();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el repuesto.');
    } finally {
      setCargando(false);
    }
  };

  /* ── Iniciar edición ──────────────────────────────────────────────── */
  const iniciarEdicion = (repuesto) => {
    limpiarMensajes();
    setEditandoId(repuesto.id);
    setForm({
      nombre:           repuesto.nombre,
      precio:           String(repuesto.precio),
      cantidadEnBodega: String(repuesto.cantidadEnBodega)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Eliminar ─────────────────────────────────────────────────────── */
  const eliminar = async (repuesto) => {
    if (!window.confirm(
      `¿Confirma la eliminación del repuesto "${repuesto.nombre}"?\nEsta acción no se puede deshacer.`
    )) return;

    limpiarMensajes();
    setCargando(true);
    try {
      await repuestosAPI.remove(repuesto.id);
      setExito(`Repuesto "${repuesto.nombre}" eliminado correctamente.`);
      await cargarRepuestos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el repuesto.');
    } finally {
      setCargando(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Encabezado de página */}
      <h1 className="pagina-titulo">Gestión de Inventario</h1>
      <p className="pagina-subtitulo">
        Administre el catálogo de repuestos: precios, existencias y disponibilidad.
      </p>

      {/* Mensajes de estado */}
      {error && <div className="alerta alerta-error"  role="alert">{error}</div>}
      {exito && <div className="alerta alerta-exito"  role="status">{exito}</div>}

      {/* ── Formulario de creación / edición ──────────────────────────── */}
      <div className="card">
        <h2 className="card__titulo">
          {editandoId ? 'Editar Repuesto' : 'Nuevo Repuesto'}
        </h2>

        <form onSubmit={guardar} noValidate aria-label="Formulario de repuesto">
          <div className="form-fila">

            {/* Nombre */}
            <div className="form-grupo" style={{ flex: 2 }}>
              <label htmlFor="nombre-input">Nombre del repuesto</label>
              <input
                id="nombre-input"
                type="text"
                name="nombre"
                className="form-control"
                placeholder="Ej: Filtro de aceite"
                value={form.nombre}
                onChange={manejarCambio}
                disabled={cargando}
                required
                aria-required="true"
                autoComplete="off"
              />
            </div>

            {/* Precio */}
            <div className="form-grupo">
              <label htmlFor="precio-input">Precio (COP)</label>
              <input
                id="precio-input"
                type="number"
                name="precio"
                className="form-control"
                placeholder="Ej: 25000"
                value={form.precio}
                onChange={manejarCambio}
                min="1"
                disabled={cargando}
                required
                aria-required="true"
              />
            </div>

            {/* Cantidad en bodega */}
            <div className="form-grupo">
              <label htmlFor="cantidad-input">Cantidad en bodega</label>
              <input
                id="cantidad-input"
                type="number"
                name="cantidadEnBodega"
                className="form-control"
                placeholder="Ej: 10"
                value={form.cantidadEnBodega}
                onChange={manejarCambio}
                min="0"
                disabled={cargando}
                required
                aria-required="true"
              />
            </div>

          </div>

          {/* Acciones del formulario */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primario"
              disabled={cargando}
            >
              {cargando
                ? 'Guardando...'
                : editandoId ? 'Actualizar' : 'Registrar repuesto'}
            </button>

            {editandoId && (
              <button
                type="button"
                className="btn btn-secundario"
                onClick={cancelarEdicion}
                disabled={cargando}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Tabla de inventario ────────────────────────────────────────── */}
      <div className="card">
        <h2 className="card__titulo">
          <span className="card__titulo-texto">Inventario Actual</span>
          <span className="card__titulo-meta">
            {repuestos.length} {repuestos.length === 1 ? 'repuesto' : 'repuestos'}
          </span>
        </h2>

        {/* Aviso de stock bajo */}
        {repuestos.some(r => r.cantidadEnBodega < UMBRAL_STOCK_BAJO) && (
          <div className="alerta alerta-advertencia" style={{ marginBottom: '1rem' }}>
            Uno o más repuestos tienen menos de {UMBRAL_STOCK_BAJO} unidades en bodega.
            Revise los registros marcados como{' '}
            <span className="badge-stock-bajo">Stock bajo</span>.
          </div>
        )}

        {/* Estado de carga */}
        {cargando && repuestos.length === 0 ? (
          <div className="spinner-contenedor" aria-label="Cargando repuestos">
            <div className="spinner" role="status" />
          </div>
        ) : repuestos.length === 0 ? (
          <div className="alerta alerta-info">
            No hay repuestos registrados. Use el formulario para agregar el primero.
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table aria-label="Inventario de repuestos">
              <thead>
                <tr>
                  <th style={{ width: '2.5rem' }}>#</th>
                  <th>Nombre</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ textAlign: 'center' }}>Cant. en Bodega</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {repuestos.map((repuesto, idx) => {
                  const stockBajo = repuesto.cantidadEnBodega < UMBRAL_STOCK_BAJO;
                  return (
                    <tr key={repuesto.id}>
                      <td style={{ color: 'var(--c-texto-suave)', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>
                      <td>
                        {repuesto.nombre}
                        {stockBajo && (
                          <span className="badge-stock-bajo" aria-label="Stock bajo">
                            Stock bajo
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCOP(repuesto.precio)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          color: stockBajo ? 'var(--c-advertencia)' : 'var(--c-exito)'
                        }}>
                          {repuesto.cantidadEnBodega}
                        </span>
                        <span style={{ color: 'var(--c-texto-suave)', marginLeft: '0.25rem', fontSize: '0.8rem' }}>
                          uds.
                        </span>
                      </td>
                      <td>
                        <div className="td-acciones" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secundario btn-sm"
                            onClick={() => iniciarEdicion(repuesto)}
                            disabled={cargando}
                            aria-label={`Editar ${repuesto.nombre}`}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-peligro btn-sm"
                            onClick={() => eliminar(repuesto)}
                            disabled={cargando}
                            aria-label={`Eliminar ${repuesto.nombre}`}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionRepuestos;
