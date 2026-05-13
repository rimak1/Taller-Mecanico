/**
 * App.js
 * Componente raíz. Gestiona el rol activo y la navegación entre páginas.
 *
 * Roles disponibles:
 *   "mecanico" — Ve órdenes en reparación y confirma cierre técnico.
 *   "cajero"   — Liquida y cobra órdenes con cierre técnico confirmado.
 *
 * Páginas:
 *   "liquidar"  — Vista del Cajero (Pantalla 1)
 *   "repuestos" — CRUD de inventario (accesible para ambos roles)
 *   "mecanico"  — Vista del Mecánico (Pantalla exclusiva del rol mecánico)
 */

import React, { useState } from 'react';
import Navbar           from './components/Navbar';
import LiquidarOrden    from './components/LiquidarOrden';
import GestionRepuestos from './components/GestionRepuestos';
import VistaMecanico    from './components/VistaMecanico';

function App() {
  // Rol activo: "cajero" | "mecanico"
  const [rol,          setRol]          = useState('cajero');
  // Página activa
  const [paginaActiva, setPaginaActiva] = useState('liquidar');

  /**
   * Cambia el rol y redirige a la página por defecto del nuevo rol.
   * @param {string} nuevoRol
   */
  const cambiarRol = (nuevoRol) => {
    setRol(nuevoRol);
    // Cada rol tiene su página de inicio natural
    setPaginaActiva(nuevoRol === 'mecanico' ? 'mecanico' : 'liquidar');
  };

  const renderizarPagina = () => {
    switch (paginaActiva) {
      case 'liquidar':
        return <LiquidarOrden rol={rol} />;
      case 'repuestos':
        return <GestionRepuestos />;
      case 'mecanico':
        return <VistaMecanico />;
      default:
        return <LiquidarOrden rol={rol} />;
    }
  };

  return (
    <div className="app">
      <Navbar
        activePage={paginaActiva}
        onNavigate={setPaginaActiva}
        rol={rol}
        onCambiarRol={cambiarRol}
      />
      <main className="main-content" role="main">
        {renderizarPagina()}
      </main>
    </div>
  );
}

export default App;
