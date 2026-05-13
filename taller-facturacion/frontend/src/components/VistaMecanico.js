/**
 * components/VistaMecanico.js
 * Vista exclusiva del rol Mecánico.
 *
 * Muestra las órdenes en estado "en_reparacion" y permite confirmar
 * el cierre técnico, lo que cambia el estado a "lista_para_facturar"
 * y habilita al cajero para cobrar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ordenesAPI } from '../services/api';

/* ── Utilidades ─────────────────────────────────────────────────────────── */
const formatCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatFecha = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

/* ── Componente ─────────────────────────────────────────────────────────── */
function VistaMecanico() {
  const [ordenes,       setOrdenes]       = useState([]);
  const [cargando,      setCargando]      = useState(false);
  const [error,         setError]         = useState('');
  // Modal de cierre técnico
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mecanico,      setMecanico]      = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cerrando,      setCerrando]      = useState(false);
  const [exitoCierre,   setExitoCierre]   = useState('');

  /* ── Cargar órdenes en reparación ─────────────────────────────────── */
  const cargarOrdenes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { data } = await ordenesAPI.getAll();
      // Filtrar solo las que están en reparación
      setOrdenes(data.filter(o => o.estado === 'en_reparacion'));
    } catch {
      setError('No se pudo conectar con el servidor. Verifique que el backend esté activo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarOrdenes(); }, [cargarOrdenes]);

  /* ── Abrir modal de cierre ────────────────────────────────────────── */
  const abrirCierre = (orden) => {
    setOrdenSeleccionada(orden);
    setMecanico('');
    setObservaciones('');
    setExitoCierre('');
  };

  /* ── Confirmar cierre técnico ─────────────────────────────────────── */
  const confirmarCierre = async () => {
    if (!mecanico.trim()) {
      setError('Ingrese el nombre del mecánico responsable.');
      return;
    }
    setError('');
    setCerrando(true);
    try {
      await ordenesAPI.cerrar(ordenSeleccionada.id, {
        mecanico:      mecanico.trim(),
        observaciones: observaciones.trim()
      });
      setExitoCierre(
        `Cierre técnico confirmado para la orden ${ordenSeleccionada.id}. La orden está lista para facturar.`
      );
      // Retirar la orden de la lista local
      setOrdenes(prev => prev.filter(o => o.id !== ordenSeleccionada.id));
      // Cerrar modal tras 1.5 s
      setTimeout(() => {
        setOrdenSeleccionada(null);
        setExitoCierre('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al confirmar el cierre técnico.');
    } finally {
      setCerrando(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div>
      <h1 className="pagina-titulo">Órdenes en Reparación</h1>
      <p className="pagina-subtitulo">
        Revise el trabajo completado y confirme el cierre técnico para habilitar la facturación.
      </p>

      {error && <div className="alerta alerta-error" role="alert">{error}</div>}

      {/* Aviso de rol */}
      <div className="alerta alerta-info" style={{ marginBottom: '1.5rem' }}>
        <strong>Vista Mecánico.</strong> Solo se muestran las órdenes pendientes de cierre técnico.
        Una vez confirmado, el cajero podrá proceder con el cobro.
      </div>

      {/* Tabla de órdenes */}
      <div className="card">
        <h2 className="card__titulo">
          <span className="card__titulo-texto">Órdenes Activas</span>
          <span className="card__titulo-meta">
            {ordenes.length} {ordenes.length === 1 ? 'orden' : 'órdenes'} en reparación
          </span>
        </h2>

        {cargando ? (
          <div className="spinner-contenedor"><div className="spinner" /></div>
        ) : ordenes.length === 0 ? (
          <div className="alerta alerta-info">
            No hay órdenes en reparación en este momento.
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table aria-label="Órdenes en reparación">
              <thead>
                <tr>
                  <th>N.° Orden</th>
                  <th>Placa</th>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Total Bruto</th>
                  <th style={{ textAlign: 'right' }}>Saldo Neto</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map(orden => (
                  <tr key={orden.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--c-texto-suave)' }}>
                      {orden.id}
                    </td>
                    <td style={{ fontWeight: 600 }}>{orden.vehiculoPlaca}</td>
                    <td>{orden.vehiculoMarca}</td>
                    <td>{orden.cliente?.nombre || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCOP(orden.totalBruto)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCOP(orden.saldoNeto)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="estado-badge estado-badge--en-reparacion">
                        En reparación
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-confirmar btn-sm"
                        onClick={() => abrirCierre(orden)}
                      >
                        Confirmar Cierre
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de cierre técnico ──────────────────────────────────── */}
      {ordenSeleccionada && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cierre-titulo"
          onClick={e => { if (e.target === e.currentTarget && !cerrando) setOrdenSeleccionada(null); }}
        >
          <div className="modal" style={{ maxWidth: '520px' }}>

            <div className="modal__cabecera">
              <h2 className="modal__titulo" id="cierre-titulo">Confirmar Cierre Técnico</h2>
              <button
                className="btn btn-secundario btn-sm"
                onClick={() => setOrdenSeleccionada(null)}
                disabled={cerrando}
              >
                Cancelar
              </button>
            </div>

            {/* Resumen de la orden */}
            <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="info-item">
                <div className="info-item__etiqueta">Placa</div>
                <div className="info-item__valor">{ordenSeleccionada.vehiculoPlaca}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Vehículo</div>
                <div className="info-item__valor">{ordenSeleccionada.vehiculoMarca}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Cliente</div>
                <div className="info-item__valor">{ordenSeleccionada.cliente?.nombre || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Saldo neto</div>
                <div className="info-item__valor" style={{ fontWeight: 700 }}>
                  {formatCOP(ordenSeleccionada.saldoNeto)}
                </div>
              </div>
            </div>

            {/* Detalle de ítems */}
            <div className="tabla-contenedor" style={{ marginBottom: '1.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Repuesto / Servicio</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenSeleccionada.items.map(item => (
                    <tr key={item.repuestoId}>
                      <td>{item.nombre}</td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ textAlign: 'right' }}>
                        {formatCOP(item.cantidad * item.precioUnitario)}
                      </td>
                    </tr>
                  ))}
                  <tr className="fila-mano-obra">
                    <td>Mano de obra ({ordenSeleccionada.horasTrabajo} h)</td>
                    <td style={{ textAlign: 'center' }}>{ordenSeleccionada.horasTrabajo}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCOP(ordenSeleccionada.horasTrabajo * ordenSeleccionada.costoHora)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Formulario de cierre */}
            {exitoCierre ? (
              <div className="alerta alerta-exito">{exitoCierre}</div>
            ) : (
              <>
                {error && <div className="alerta alerta-error">{error}</div>}

                <div className="form-grupo">
                  <label htmlFor="mecanico-input">Mecánico responsable</label>
                  <input
                    id="mecanico-input"
                    type="text"
                    className="form-control"
                    placeholder="Nombre completo del mecánico"
                    value={mecanico}
                    onChange={e => setMecanico(e.target.value)}
                    disabled={cerrando}
                    autoComplete="off"
                  />
                </div>

                <div className="form-grupo">
                  <label htmlFor="obs-input">Observaciones técnicas (opcional)</label>
                  <textarea
                    id="obs-input"
                    className="form-control"
                    placeholder="Describa brevemente el trabajo realizado..."
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    disabled={cerrando}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                <div className="modal__acciones">
                  <button
                    className="btn btn-confirmar btn-lg"
                    onClick={confirmarCierre}
                    disabled={cerrando || !mecanico.trim()}
                  >
                    {cerrando ? 'Confirmando...' : 'Confirmar Cierre Técnico'}
                  </button>
                  <button
                    className="btn btn-secundario"
                    onClick={() => setOrdenSeleccionada(null)}
                    disabled={cerrando}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default VistaMecanico;
