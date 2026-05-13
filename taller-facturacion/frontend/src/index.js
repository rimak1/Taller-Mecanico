/**
 * index.js
 * Punto de entrada de la aplicación React.
 * Monta el componente raíz App en el elemento #root del DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
