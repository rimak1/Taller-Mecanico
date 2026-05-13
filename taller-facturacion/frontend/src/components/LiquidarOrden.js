/**
 * components/LiquidarOrden.js
 * Vista del Cajero — Liquidación, cobro y facturación con pagos fraccionados.
 *
 * Reglas de negocio:
 *  - Pagos fraccionados: se pueden registrar N tramos de pago (efectivo + tarjeta)
 *    hasta que el saldo llegue a $0. Cada tramo llama a POST /pago-parcial.
 *  - Inmutabilidad: cuando el saldo = $0 la orden pasa a "cerrada". Todos los
 *    controles de edición se deshabilitan visualmente (bloqueo anti-fraude).
 *  - Bloqueo por estado: solo se cobran órdenes "lista_para_facturar".
 *  - Pasarela simulada: tarjeta tiene retraso de 2 s.
 *  - DIAN mock: al cerrar se muestra confirmación con CUFE.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ordenesAPI } from '../services/api';

const formatCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatFecha = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const simularPasarelaTarjeta = () => new Promise(r => setTimeout(r, 2000));

const ETIQUETA_ESTADO = {
  en_reparacion:       'En reparación',
  lista_para_facturar: 'Lista para facturar',
  cerrada:             'Cerrada / Facturada'
};

const ESTADOS_ACTIVOS = ['en_reparacion', 'lista_para_facturar'];

/* ─────────────────────────────────────────────────────────────────────────── */
function LiquidarOrden({ rol }) {
  const [todasOrdenes,    setTodasOrdenes]    = useState([]);
  const [filtroEstado,    setFiltroEstado]    = useState('todas');
  const [cargandoPanel,   setCargandoPanel]   = useState(false);

  const [placa,           setPlaca]           = useState('');
  const [orden,           setOrden]           = useState(null);
  const [cliente,         setCliente]         = useState(null);
  const [anticipos,       setAnticipos]       = useState([]);

  // Pagos fraccionados registrados en esta sesión
  const [tramosRegistrados, setTramosRegistrados] = useState([]);
  const [saldoPendiente,    setSaldoPendiente]    = useState(0);

  // Formulario del tramo actual
  const [montoTramo,      setMontoTramo]      = useState('');
  const [metodoTramo,     setMetodoTramo]     = useState('efectivo');

  const [cargando,        setCargando]        = useState(false);
  const [procesandoPago,  setProcesandoPago]  = useState(false);
  const [mensajePasarela, setMensajePasarela] = useState('');
  const [error,           setError]           = useState('');
  const [exito,           setExito]           = useState('');
  const [factura,         setFactura]         = useState(null);
  const [mostrarModal,    setMostrarModal]    = useState(false);
  const [dianEnviada,     setDianEnviada]     = useState(false);

  const limpiarMensajes = () => { setError(''); setExito(''); setMensajePasarela(''); };

  /* ── Cargar panel ─────────────────────────────────────────────────────── */
  const cargarTodasOrdenes = useCallback(async () => {
    setCargandoPanel(true);
    try {
      const { data } = await ordenesAPI.getAll();
      setTodasOrdenes(data.filter(o => ESTADOS_ACTIVOS.includes(o.estado)));
    } catch { /* fallo silencioso */ }
    finally { setCargandoPanel(false); }
  }, []);

  useEffect(() => { cargarTodasOrdenes(); }, [cargarTodasOrdenes]);

  /* ── Cargar orden completa ────────────────────────────────────────────── */
  const cargarOrdenCompleta = (ordenCompleta) => {
    setOrden(ordenCompleta);
    setCliente(ordenCompleta.cliente || null);
    setAnticipos(ordenCompleta.anticipos || []);
    const cobrado = ordenCompleta.totalCobrado || 0;
    const saldo   = Math.max(0, ordenCompleta.saldoNeto - cobrado);
    setSaldoPendiente(saldo);
    setTramosRegistrados(ordenCompleta.pagos || []);
    setMontoTramo(String(saldo));
    setFactura(null);
  };

  /* ── Seleccionar desde panel ──────────────────────────────────────────── */
  const seleccionarOrdenDesdePanel = async (ordenPreview) => {
    limpiarMensajes();
    setOrden(null); setCliente(null); setFactura(null);
    setAnticipos([]); setTramosRegistrados([]);
    setPlaca(ordenPreview.vehiculoPlaca);
    setCargando(true);
    try {
      const { data: ordenes } = await ordenesAPI.buscarPorPlaca(ordenPreview.vehiculoPlaca);
      const oc = ordenes.find(o => o.id === ordenPreview.id)
        || ordenes.find(o => o.estado === 'lista_para_facturar')
        || ordenes.find(o => o.estado === 'en_reparacion');
      if (oc) {
        cargarOrdenCompleta(oc);
        setTimeout(() => {
          document.getElementById('detalle-orden')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch { setError('No se pudo cargar el detalle de la orden.'); }
    finally { setCargando(false); }
  };

  /* ── Buscar por placa ─────────────────────────────────────────────────── */
  const buscarOrden = async () => {
    if (!placa.trim()) { setError('Ingrese la placa del vehículo para buscar.'); return; }
    limpiarMensajes();
    setOrden(null); setCliente(null); setFactura(null);
    setAnticipos([]); setTramosRegistrados([]);
    setCargando(true);
    try {
      const { data: ordenes } = await ordenesAPI.buscarPorPlaca(placa.trim());
      const oc = ordenes.find(o => o.estado === 'lista_para_facturar')
        || ordenes.find(o => o.estado === 'en_reparacion');
      if (!oc) { setError(`No hay órdenes activas para la placa "${placa.toUpperCase()}".`); return; }
      cargarOrdenCompleta(oc);
    } catch (err) {
      setError(err.response?.data?.error || 'No se encontró la orden. Verifique la placa.');
    } finally { setCargando(false); }
  };

  /* ── Registrar tramo de pago ──────────────────────────────────────────── */
  const registrarTramo = async () => {
    limpiarMensajes();
    if (rol !== 'cajero') { setError('Solo el cajero puede procesar cobros.'); return; }
    if (orden.estado === 'en_reparacion') {
      setError('Acción bloqueada: la orden aún está en reparación.'); return;
    }
    if (orden.estado === 'cerrada') {
      setError('Esta orden ya está cerrada. El registro es inmutable.'); return;
    }

    const montoNum = Number(montoTramo);
    if (!montoTramo || isNaN(montoNum) || montoNum <= 0) {
      setError('Ingrese un monto válido.'); return;
    }

    setProcesandoPago(true);

    if (metodoTramo === 'tarjeta') {
      setMensajePasarela('Conectando con la pasarela bancaria...');
      await simularPasarelaTarjeta();
      setMensajePasarela('Transacción aprobada por la entidad bancaria.');
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const { data } = await ordenesAPI.pagoParcial(orden.id, {
        monto:  montoNum,
        metodo: metodoTramo
      });

      // Actualizar tramos y saldo
      setTramosRegistrados(prev => [...prev, data.pago]);
      setSaldoPendiente(data.saldoPendiente);

      if (data.cerrada) {
        // Orden cerrada: inmutabilidad activada
        setFactura(data.factura);
        setDianEnviada(data.factura?.dian?.enviada === true);
        setExito('Saldo en $0. Orden cerrada y factura generada.');
        setMostrarModal(true);
        setOrden(prev => ({ ...prev, estado: 'cerrada' }));
        setTodasOrdenes(prev => prev.filter(o => o.id !== orden.id));
        setMontoTramo('0');
      } else {
        setExito(`Tramo registrado. Saldo pendiente: ${formatCOP(data.saldoPendiente)}`);
        setMontoTramo(String(data.saldoPendiente));
      }
    } catch (err) {
      const { error: msg, codigoBloqueo } = err.response?.data || {};
      if (codigoBloqueo === 'ORDEN_CERRADA') {
        setError('Esta orden ya fue cerrada. El registro es inmutable.');
        setOrden(prev => ({ ...prev, estado: 'cerrada' }));
      } else if (codigoBloqueo === 'REQUIERE_CIERRE_TECNICO') {
        setError('Acción bloqueada: el mecánico aún no ha confirmado el cierre técnico.');
      } else {
        setError(msg || 'Error al registrar el pago.');
      }
    } finally {
      setProcesandoPago(false);
      setMensajePasarela('');
    }
  };

  const ordenesFiltradas = filtroEstado === 'todas'
    ? todasOrdenes
    : todasOrdenes.filter(o => o.estado === filtroEstado);

  const calcularSubtotal  = (item) => item.cantidad * item.precioUnitario;
  const estaEnReparacion  = orden?.estado === 'en_reparacion';
  const estaCerrada       = orden?.estado === 'cerrada';
  const puedeRegistrarPago = !estaEnReparacion && !estaCerrada && saldoPendiente > 0;
  const porcentajeCobrado  = orden
    ? Math.min(100, Math.round(((orden.saldoNeto - saldoPendiente) / orden.saldoNeto) * 100))
    : 0;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div>
      <h1 className="pagina-titulo">Liquidar y Cobrar Orden</h1>
      <p className="pagina-subtitulo">
        Seleccione una orden del panel o búsquela por placa. Puede registrar pagos
        fraccionados hasta que el saldo llegue a $0.
      </p>

      {error && <div className="alerta alerta-error" role="alert">{error}</div>}
      {exito && <div className="alerta alerta-exito" role="status">{exito}</div>}

      {/* ── Panel de órdenes activas ───────────────────────────────────── */}
      <div className="card">
        <h2 className="card__titulo">
          <span className="card__titulo-texto">Órdenes Activas</span>
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            {[
              { valor: 'todas',               etiqueta: 'Todas'              },
              { valor: 'lista_para_facturar', etiqueta: 'Listas para cobrar' },
              { valor: 'en_reparacion',       etiqueta: 'En reparación'      }
            ].map(f => (
              <button
                key={f.valor}
                className={`btn btn-sm ${filtroEstado === f.valor ? 'btn-primario' : 'btn-ghost'}`}
                onClick={() => setFiltroEstado(f.valor)}
              >
                {f.etiqueta}
              </button>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={cargarTodasOrdenes}
              disabled={cargandoPanel}
              aria-label="Actualizar lista"
            >
              {cargandoPanel ? '...' : 'Actualizar'}
            </button>
          </div>
        </h2>

        {cargandoPanel ? (
          <div className="spinner-contenedor" style={{ padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="alerta alerta-info" style={{ marginBottom: 0 }}>
            {filtroEstado === 'todas'
              ? 'No hay órdenes activas en este momento.'
              : `No hay órdenes con estado "${ETIQUETA_ESTADO[filtroEstado] || filtroEstado}".`}
          </div>
        ) : (
          <div className="ordenes-grid">
            {ordenesFiltradas.map(o => (
              <TarjetaOrden
                key={o.id}
                orden={o}
                activa={orden?.id === o.id}
                onClick={() => seleccionarOrdenDesdePanel(o)}
                cargando={cargando}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Búsqueda manual ───────────────────────────────────────────── */}
      <div className="card">
        <h2 className="card__titulo">Búsqueda por Placa</h2>
        <div className="busqueda-fila">
          <div className="form-grupo">
            <label htmlFor="placa-input">Placa del vehículo</label>
            <input
              id="placa-input"
              type="text"
              className="form-control"
              placeholder="Ej: ABC-123"
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && buscarOrden()}
              disabled={cargando}
              autoComplete="off"
            />
          </div>
          <button className="btn btn-primario" onClick={buscarOrden} disabled={cargando}>
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* ── Detalle de la orden ────────────────────────────────────────── */}
      {orden && (
        <div id="detalle-orden">

          {/* Alerta de bloqueo por estado */}
          {estaEnReparacion && (
            <div className="alerta alerta-bloqueo" role="alert">
              <strong>Cobro bloqueado.</strong> Esta orden aún está en reparación.
              El mecánico debe confirmar el cierre técnico antes de que pueda cobrarse.
            </div>
          )}

          {/* Banner de inmutabilidad cuando la orden está cerrada */}
          {estaCerrada && (
            <div className="banner-inmutable" role="status">
              <div className="banner-inmutable__icono" aria-hidden="true">&#9632;</div>
              <div>
                <strong>Orden cerrada — Registro inmutable.</strong>
                <span> Esta orden fue facturada y no puede modificarse. Todos los controles están bloqueados.</span>
              </div>
            </div>
          )}

          {/* Info del vehículo y cliente */}
          <div className={`card${estaCerrada ? ' card--inmutable' : ''}`}>
            <h2 className="card__titulo">
              <span className="card__titulo-texto">Vehículo y Cliente</span>
              <span className={`estado-badge estado-badge--${orden.estado.replace(/_/g, '-')}`}>
                {ETIQUETA_ESTADO[orden.estado] || orden.estado}
              </span>
            </h2>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-item__etiqueta">Placa</div>
                <div className="info-item__valor">{orden.vehiculoPlaca}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Vehículo</div>
                <div className="info-item__valor">{orden.vehiculoMarca}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Cliente</div>
                <div className="info-item__valor">{cliente?.nombre || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Documento</div>
                <div className="info-item__valor">{cliente?.documento || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">Correo</div>
                <div className="info-item__valor">{cliente?.correo || '—'}</div>
              </div>
              <div className="info-item">
                <div className="info-item__etiqueta">N.° Orden</div>
                <div className="info-item__valor" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                  {orden.id}
                </div>
              </div>
            </div>

            {orden.cierreTecnico && (
              <div className="cierre-tecnico-info">
                <span className="cierre-tecnico-info__etiqueta">Cierre técnico</span>
                <span>
                  {orden.cierreTecnico.mecanico} &mdash; {formatFecha(orden.cierreTecnico.fecha)}
                  {orden.cierreTecnico.observaciones && (
                    <span style={{ color: 'var(--c-texto-suave)', marginLeft: '0.5rem' }}>
                      — {orden.cierreTecnico.observaciones}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Tabla de ítems */}
          <div className={`card${estaCerrada ? ' card--inmutable' : ''}`}>
            <h2 className="card__titulo">Detalle de la Orden</h2>
            <div className="tabla-contenedor">
              <table aria-label="Ítems de la orden de trabajo">
                <thead>
                  <tr>
                    <th style={{ width: '2.5rem' }}>#</th>
                    <th>Descripción</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {orden.items.map((item, idx) => (
                    <tr key={item.repuestoId}>
                      <td style={{ color: 'var(--c-texto-suave)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td>{item.nombre}</td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ textAlign: 'right', color: 'var(--c-texto-suave)' }}>
                        {formatCOP(item.precioUnitario)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCOP(calcularSubtotal(item))}
                      </td>
                    </tr>
                  ))}
                  <tr className="fila-mano-obra">
                    <td style={{ color: 'var(--c-texto-suave)', fontSize: '0.8rem' }}>
                      {orden.items.length + 1}
                    </td>
                    <td>
                      Mano de obra
                      <span style={{ color: 'var(--c-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.85rem' }}>
                        ({orden.horasTrabajo} h × {formatCOP(orden.costoHora)}/h)
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{orden.horasTrabajo}</td>
                    <td style={{ textAlign: 'right', color: 'var(--c-texto-suave)' }}>
                      {formatCOP(orden.costoHora)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCOP(orden.horasTrabajo * orden.costoHora)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Anticipos */}
            {anticipos.length > 0 && (
              <div className="anticipos-lista">
                <div className="anticipos-lista__titulo">Anticipos / Abonos registrados</div>
                {anticipos.map(a => (
                  <div key={a.id} className="anticipos-lista__fila">
                    <span>{formatFecha(a.fecha)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{a.metodo}</span>
                    {a.nota && <span style={{ color: 'var(--c-texto-suave)', fontSize: '0.82rem' }}>{a.nota}</span>}
                    <span style={{ fontWeight: 700, color: 'var(--c-peligro)' }}>
                      − {formatCOP(a.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen financiero */}
            <div className="resumen-financiero" aria-label="Resumen financiero">
              <div className="resumen-fila">
                <span className="resumen-fila__etiqueta">Subtotal bruto</span>
                <span>{formatCOP(orden.totalBruto)}</span>
              </div>
              {orden.abonosPrevios > 0 && (
                <div className="resumen-fila resumen-fila--descuento">
                  <span className="resumen-fila__etiqueta">Abonos / Anticipos</span>
                  <span>− {formatCOP(orden.abonosPrevios)}</span>
                </div>
              )}
              <div className="resumen-fila resumen-fila--total">
                <span className="resumen-fila__etiqueta">Saldo neto a pagar</span>
                <span>{formatCOP(orden.saldoNeto)}</span>
              </div>
            </div>
          </div>

          {/* ── Sección de pagos fraccionados ─────────────────────────── */}
          <div className={`card${estaCerrada ? ' card--inmutable' : ''}`}>
            <h2 className="card__titulo">
              <span className="card__titulo-texto">Registro de Pagos</span>
              {estaCerrada && (
                <span className="badge-inmutable">Bloqueado</span>
              )}
            </h2>

            {/* Barra de progreso del cobro */}
            <div className="progreso-cobro" aria-label={`${porcentajeCobrado}% cobrado`}>
              <div className="progreso-cobro__cabecera">
                <span className="progreso-cobro__etiqueta">Progreso del cobro</span>
                <span className="progreso-cobro__porcentaje">{porcentajeCobrado}%</span>
              </div>
              <div className="progreso-cobro__barra" role="progressbar"
                aria-valuenow={porcentajeCobrado} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`progreso-cobro__relleno${estaCerrada ? ' progreso-cobro__relleno--completo' : ''}`}
                  style={{ width: `${porcentajeCobrado}%` }}
                />
              </div>
              <div className="progreso-cobro__montos">
                <span>Cobrado: <strong>{formatCOP(orden.saldoNeto - saldoPendiente)}</strong></span>
                <span>Pendiente: <strong style={{ color: saldoPendiente === 0 ? 'var(--c-exito)' : 'var(--c-peligro)' }}>
                  {formatCOP(saldoPendiente)}
                </strong></span>
              </div>
            </div>

            {/* Tramos de pago ya registrados en esta sesión */}
            {tramosRegistrados.length > 0 && (
              <div className="tramos-lista">
                <div className="tramos-lista__titulo">Tramos registrados</div>
                {tramosRegistrados.map((t, i) => (
                  <div key={t.id || i} className="tramos-lista__fila">
                    <span className="tramos-lista__num">#{i + 1}</span>
                    <span style={{ textTransform: 'capitalize', color: 'var(--c-texto-suave)' }}>
                      {t.metodo}
                    </span>
                    <span>{formatFecha(t.fecha)}</span>
                    <span style={{ fontWeight: 700, color: 'var(--c-exito)', textAlign: 'right' }}>
                      {formatCOP(t.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario de nuevo tramo — deshabilitado si está cerrada */}
            {puedeRegistrarPago && (
              <>
                <div className="form-fila" style={{ marginTop: '1.25rem' }}>
                  <div className="form-grupo">
                    <label htmlFor="monto-tramo">Monto a pagar ahora (COP)</label>
                    <input
                      id="monto-tramo"
                      type="number"
                      className="form-control"
                      placeholder={`Máx. ${formatCOP(saldoPendiente)}`}
                      value={montoTramo}
                      onChange={e => setMontoTramo(e.target.value)}
                      min="1"
                      max={saldoPendiente}
                      disabled={procesandoPago}
                    />
                  </div>
                  <div className="form-grupo">
                    <label htmlFor="metodo-tramo">Método de pago</label>
                    <select
                      id="metodo-tramo"
                      className="form-control"
                      value={metodoTramo}
                      onChange={e => setMetodoTramo(e.target.value)}
                      disabled={procesandoPago}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                </div>

                {/* Botones de monto rápido */}
                <div className="montos-rapidos">
                  {[saldoPendiente, Math.ceil(saldoPendiente / 2)].filter((v, i, a) => a.indexOf(v) === i && v > 0).map(v => (
                    <button
                      key={v}
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMontoTramo(String(v))}
                      disabled={procesandoPago}
                    >
                      {v === saldoPendiente ? 'Pagar todo' : `Mitad (${formatCOP(v)})`}
                    </button>
                  ))}
                </div>

                {metodoTramo === 'tarjeta' && !procesandoPago && (
                  <div className="alerta alerta-info" style={{ marginTop: '0.75rem' }}>
                    El pago con tarjeta pasa por verificación bancaria (simulado, ~2 s).
                  </div>
                )}

                {mensajePasarela && (
                  <div className="alerta alerta-pasarela" role="status">
                    <div className="spinner spinner-sm" aria-hidden="true" />
                    {mensajePasarela}
                  </div>
                )}

                <div style={{ marginTop: '1.25rem' }}>
                  <button
                    className="btn btn-confirmar btn-lg"
                    onClick={registrarTramo}
                    disabled={procesandoPago || !montoTramo}
                  >
                    {procesandoPago
                      ? 'Procesando...'
                      : Number(montoTramo) >= saldoPendiente
                        ? 'Cobrar y Cerrar Orden'
                        : `Registrar tramo (${formatCOP(Number(montoTramo) || 0)})`}
                  </button>
                </div>
              </>
            )}

            {/* Estado final: saldo en $0 */}
            {estaCerrada && (
              <div className="saldo-cero-banner" role="status">
                <span className="saldo-cero-banner__check" aria-hidden="true">&#10003;</span>
                <div>
                  <strong>Saldo $0 — Orden cerrada.</strong>
                  <span> El registro histórico está bloqueado y no puede modificarse.</span>
                </div>
                {factura && (
                  <button
                    className="btn btn-secundario btn-sm"
                    onClick={() => setMostrarModal(true)}
                    style={{ marginLeft: 'auto' }}
                  >
                    Ver factura
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal de factura */}
      {mostrarModal && factura && (
        <ModalFactura
          factura={factura}
          cliente={cliente}
          tramosRegistrados={tramosRegistrados}
          dianEnviada={dianEnviada}
          onCerrar={() => setMostrarModal(false)}
        />
      )}
    </div>
  );
}

/* ── Etiquetas de estado ─────────────────────────────────────────────────── */
const ETIQUETA_ESTADO_BADGE = {
  en_reparacion:       'En reparación',
  lista_para_facturar: 'Lista para facturar',
  cerrada:             'Cerrada'
};

/* ── Subcomponente: Tarjeta de orden ─────────────────────────────────────── */
function TarjetaOrden({ orden, activa, onClick, cargando }) {
  const facturable = orden.estado === 'lista_para_facturar';
  return (
    <button
      className={`orden-tarjeta${activa ? ' orden-tarjeta--activa' : ''}${facturable ? ' orden-tarjeta--facturable' : ''}`}
      onClick={onClick}
      disabled={cargando}
      aria-pressed={activa}
      aria-label={`Seleccionar orden ${orden.vehiculoPlaca}`}
    >
      <div className="orden-tarjeta__cabecera">
        <span className="orden-tarjeta__placa">{orden.vehiculoPlaca}</span>
        <span className={`estado-badge estado-badge--${orden.estado.replace(/_/g, '-')}`}>
          {ETIQUETA_ESTADO_BADGE[orden.estado] || orden.estado}
        </span>
      </div>
      <div className="orden-tarjeta__vehiculo">{orden.vehiculoMarca}</div>
      <div className="orden-tarjeta__cliente">{orden.cliente?.nombre || '—'}</div>
      <div className="orden-tarjeta__divisor" />
      <div className="orden-tarjeta__pie">
        <span className="orden-tarjeta__pie-etiqueta">Saldo neto</span>
        <span className="orden-tarjeta__pie-valor">{formatCOP(orden.saldoNeto)}</span>
      </div>
      {facturable && <div className="orden-tarjeta__accion">Listo para cobrar</div>}
    </button>
  );
}

/* ── Subcomponente: Modal de Factura ─────────────────────────────────────── */
function ModalFactura({ factura, cliente, tramosRegistrados, dianEnviada, onCerrar }) {
  const subtotalItem = (item) => item.cantidad * item.precioUnitario;
  const esFraccionado = tramosRegistrados.length > 1;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="factura-titulo"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="modal">
        <div className="modal__cabecera">
          <h2 className="modal__titulo" id="factura-titulo">Factura de Venta</h2>
          <button className="btn btn-secundario btn-sm" onClick={onCerrar}>Cerrar</button>
        </div>

        {/* Notificación DIAN */}
        {dianEnviada && (
          <div className="alerta alerta-exito" style={{ marginBottom: '1.5rem' }}>
            <strong>Factura Electrónica enviada al cliente.</strong>{' '}
            CUFE: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {factura.dian?.cufe?.slice(0, 20)}...
            </span>
          </div>
        )}

        {/* Encabezado empresa */}
        <div className="factura-encabezado">
          <div className="factura-encabezado__nombre">TallerPro</div>
          <div className="factura-encabezado__info">
            Taller Mecánico Especializado<br />
            NIT: 900.123.456-7 &nbsp;|&nbsp; Tel: (601) 555-0100
          </div>
          <span className="factura-numero">
            Factura N.° {factura.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Datos */}
        <dl className="factura-datos">
          <dt>Fecha de emisión</dt>
          <dd>{formatFecha(factura.fecha)}</dd>
          <dt>Cliente</dt>
          <dd>{cliente?.nombre || '—'}</dd>
          <dt>Documento</dt>
          <dd>{cliente?.documento || '—'}</dd>
          <dt>Correo</dt>
          <dd>{cliente?.correo || '—'}</dd>
          <dt>Vehículo</dt>
          <dd>{factura.vehiculoMarca}</dd>
          <dt>Placa</dt>
          <dd>{factura.vehiculoPlaca}</dd>
          <dt>Método de pago</dt>
          <dd style={{ textTransform: 'capitalize' }}>{factura.metodoPago}</dd>
          <dt>Estado</dt>
          <dd><span className="estado-badge estado-badge--facturada">Pagada</span></dd>
          {factura.cierreTecnico && (
            <>
              <dt>Mecánico</dt>
              <dd>{factura.cierreTecnico.mecanico}</dd>
            </>
          )}
        </dl>

        {/* Desglose de pagos fraccionados */}
        {esFraccionado && (
          <div className="tramos-lista" style={{ marginBottom: '1.25rem' }}>
            <div className="tramos-lista__titulo">Desglose de pagos</div>
            {tramosRegistrados.map((t, i) => (
              <div key={t.id || i} className="tramos-lista__fila">
                <span className="tramos-lista__num">#{i + 1}</span>
                <span style={{ textTransform: 'capitalize', color: 'var(--c-texto-suave)' }}>{t.metodo}</span>
                <span>{formatFecha(t.fecha)}</span>
                <span style={{ fontWeight: 700, textAlign: 'right' }}>{formatCOP(t.monto)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabla de ítems */}
        <div className="tabla-contenedor" style={{ marginBottom: '1.25rem' }}>
          <table aria-label="Detalle de la factura">
            <thead>
              <tr>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Cant.</th>
                <th style={{ textAlign: 'right' }}>P. Unit.</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {factura.items.map(item => (
                <tr key={item.repuestoId}>
                  <td>{item.nombre}</td>
                  <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                  <td style={{ textAlign: 'right', color: 'var(--c-texto-suave)' }}>
                    {formatCOP(item.precioUnitario)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatCOP(subtotalItem(item))}
                  </td>
                </tr>
              ))}
              <tr className="fila-mano-obra">
                <td>
                  Mano de obra
                  <span style={{ color: 'var(--c-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.85rem' }}>
                    ({factura.horasTrabajo} h)
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>{factura.horasTrabajo}</td>
                <td style={{ textAlign: 'right', color: 'var(--c-texto-suave)' }}>
                  {formatCOP(factura.costoHora)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatCOP(factura.horasTrabajo * factura.costoHora)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumen financiero */}
        <div className="resumen-financiero">
          <div className="resumen-fila">
            <span className="resumen-fila__etiqueta">Subtotal bruto</span>
            <span>{formatCOP(factura.totalBruto)}</span>
          </div>
          {factura.abonosPrevios > 0 && (
            <div className="resumen-fila resumen-fila--descuento">
              <span className="resumen-fila__etiqueta">Abonos / Anticipos</span>
              <span>− {formatCOP(factura.abonosPrevios)}</span>
            </div>
          )}
          <div className="resumen-fila resumen-fila--total">
            <span className="resumen-fila__etiqueta">Total pagado</span>
            <span>{formatCOP(factura.total)}</span>
          </div>
        </div>

        <p className="factura-pie">
          Gracias por su preferencia. Este documento es su comprobante de pago.
        </p>

        <div className="modal__acciones">
          <button className="btn btn-primario" onClick={() => window.print()}>Imprimir</button>
          <button className="btn btn-secundario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default LiquidarOrden;
