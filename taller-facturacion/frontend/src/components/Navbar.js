/**
 * components/Navbar.js
 * Barra de navegación principal con selector de rol integrado.
 *
 * Props:
 *   activePage    {string}   — Página activa
 *   onNavigate    {Function} — Cambiar de página
 *   rol           {string}   — Rol activo: "cajero" | "mecanico"
 *   onCambiarRol  {Function} — Cambiar rol activo
 */

import React from 'react';

/* Definición de páginas por rol */
const PAGINAS_CAJERO = [
  { id: 'liquidar',  etiqueta: 'Liquidar Orden'      },
  { id: 'repuestos', etiqueta: 'Gestión de Repuestos' }
];

const PAGINAS_MECANICO = [
  { id: 'mecanico',  etiqueta: 'Órdenes en Reparación' },
  { id: 'repuestos', etiqueta: 'Gestión de Repuestos'   }
];

function Navbar({ activePage, onNavigate, rol, onCambiarRol }) {
  const enlaces = rol === 'mecanico' ? PAGINAS_MECANICO : PAGINAS_CAJERO;

  return (
    <nav className="navbar" role="navigation" aria-label="Navegación principal">

      {/* Marca */}
      <div className="navbar__marca">
        <span className="navbar__nombre">TallerPro</span>
        <span className="navbar__subtitulo">Sistema de Facturación</span>
      </div>

      {/* Navegación central */}
      <ul className="navbar__nav" role="menubar">
        {enlaces.map(({ id, etiqueta }) => (
          <li key={id} role="none">
            <button
              role="menuitem"
              className={`navbar__link${activePage === id ? ' navbar__link--activo' : ''}`}
              onClick={() => onNavigate(id)}
              aria-current={activePage === id ? 'page' : undefined}
            >
              {etiqueta}
            </button>
          </li>
        ))}
      </ul>

      {/* Selector de rol */}
      <div className="navbar__rol" aria-label="Selector de rol">
        <span className="navbar__rol-etiqueta">Rol</span>
        <div className="navbar__rol-selector" role="group" aria-label="Cambiar rol">
          <button
            className={`navbar__rol-btn${rol === 'cajero' ? ' navbar__rol-btn--activo' : ''}`}
            onClick={() => onCambiarRol('cajero')}
            aria-pressed={rol === 'cajero'}
          >
            Cajero
          </button>
          <button
            className={`navbar__rol-btn${rol === 'mecanico' ? ' navbar__rol-btn--activo' : ''}`}
            onClick={() => onCambiarRol('mecanico')}
            aria-pressed={rol === 'mecanico'}
          >
            Mecánico
          </button>
        </div>
      </div>

    </nav>
  );
}

export default Navbar;
