/**
 * helpers/db.js
 * Módulo auxiliar para leer y escribir la base de datos JSON.
 * Separado de server.js para evitar dependencias circulares.
 */

const fs   = require('fs');
const path = require('path');

// Ruta absoluta al archivo de base de datos
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

/**
 * Lee y parsea el archivo db.json.
 * @returns {Object} Contenido completo de la base de datos.
 */
function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Serializa y escribe el objeto en db.json.
 * @param {Object} data - Objeto con el estado completo de la base de datos.
 */
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readDB, writeDB };
