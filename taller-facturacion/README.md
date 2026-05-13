# 🔧 TallerPro — Sistema de Liquidación, Cobro y Facturación de Órdenes de Trabajo

Sistema MVP para la gestión de órdenes de trabajo de un taller mecánico. Permite buscar órdenes por placa, liquidar el saldo neto, registrar el pago y generar la factura imprimible. Incluye módulo CRUD para el inventario de repuestos.

---

## 🛠️ Stack Tecnológico

| Capa       | Tecnología                          |
|------------|-------------------------------------|
| Frontend   | React 18, Axios, CSS Variables      |
| Backend    | Node.js, Express 4, UUID            |
| Persistencia | JSON file (db.json) — sin BD externa |
| Dev tools  | Nodemon                             |

---

## ✅ Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior

Verificar versiones:
```bash
node -v
npm -v
```

---

## 🚀 Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/taller-facturacion.git
cd taller-facturacion
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

### 4. Iniciar el backend (puerto 3001)

```bash
# Desde la carpeta backend/
npm run dev
```

Salida esperada:
```
✅ Servidor del taller corriendo en http://localhost:3001
📂 Base de datos: .../backend/data/db.json
```

### 5. Iniciar el frontend (puerto 3000)

```bash
# Desde la carpeta frontend/ (en otra terminal)
npm start
```

La aplicación se abrirá automáticamente en `http://localhost:3000`.

---

## 🧪 Datos de Prueba

El archivo `backend/data/db.json` incluye datos semilla listos para probar:

### Órdenes pendientes de cobro

| Placa     | Vehículo       | Cliente        | Saldo Neto  |
|-----------|----------------|----------------|-------------|
| `ABC-123` | Toyota Corolla | Carlos Mendoza | $232.000    |
| `XYZ-789` | Honda Civic    | Ana García     | $133.000    |

### Flujo de prueba

1. Abrir la app en `http://localhost:3000`
2. En **"Liquidar Orden"**, ingresar la placa `ABC-123` y hacer clic en **Buscar**
3. Revisar el desglose de ítems, mano de obra y saldo neto
4. Ingresar el monto (mínimo `232000`) y seleccionar método de pago
5. Hacer clic en **"Cobrar e Imprimir Factura"**
6. Se abre el modal con la factura — usar el botón **Imprimir** para imprimirla

---

## 📡 Documentación de la API

Base URL: `http://localhost:3001/api`

### Repuestos

| Método | Endpoint              | Descripción                        |
|--------|-----------------------|------------------------------------|
| GET    | `/repuestos`          | Listar todos los repuestos         |
| GET    | `/repuestos/:id`      | Obtener un repuesto por ID         |
| POST   | `/repuestos`          | Crear nuevo repuesto               |
| PUT    | `/repuestos/:id`      | Actualizar repuesto                |
| DELETE | `/repuestos/:id`      | Eliminar repuesto                  |

**Body POST/PUT:**
```json
{
  "nombre": "Filtro de aceite",
  "precio": 25000,
  "cantidadEnBodega": 20
}
```

### Órdenes de Trabajo

| Método | Endpoint                    | Descripción                          |
|--------|-----------------------------|--------------------------------------|
| GET    | `/ordenes`                  | Listar todas las órdenes             |
| GET    | `/ordenes/buscar?placa=XXX` | Buscar órdenes por placa             |
| POST   | `/ordenes/:id/cobrar`       | **Transacción principal de cobro**   |

**Body POST `/cobrar`:**
```json
{
  "monto": 232000,
  "metodo": "efectivo"
}
```

**Respuesta exitosa:**
```json
{
  "mensaje": "Orden cobrada y facturada exitosamente",
  "factura": { ... },
  "pago": { ... },
  "orden": { ... }
}
```

### Clientes

| Método | Endpoint          | Descripción                  |
|--------|-------------------|------------------------------|
| GET    | `/clientes`       | Listar todos los clientes    |
| GET    | `/clientes/:id`   | Obtener un cliente por ID    |

### Facturas

| Método | Endpoint          | Descripción                        |
|--------|-------------------|------------------------------------|
| GET    | `/facturas`       | Listar todas las facturas          |
| GET    | `/facturas/:id`   | Obtener factura con detalles       |

---

## 🌿 Estrategia de Ramas Git

```
main          ← Código listo para producción (solo merges desde dev)
└── dev       ← Rama de integración (base para features)
    ├── feature/seed-data          ← Datos semilla y estructura db.json
    ├── feature/crud-repuestos     ← CRUD completo de repuestos
    └── feature/transaccion-cobro  ← Flujo de cobro y facturación
```

### Reglas de Pull Request

- Todo PR debe apuntar a la rama `dev`, **nunca directamente a `main`**.
- El título del PR debe ser descriptivo (máx. 70 caracteres).
- La descripción debe incluir: qué se hizo, cómo se probó y si hay dependencias.
- Requiere al menos **1 revisión aprobada** antes de hacer merge.
- El merge a `main` solo lo realiza el líder técnico del proyecto.

---

## 📁 Estructura del Proyecto

```
taller-facturacion/
├── backend/
│   ├── package.json          # Dependencias y scripts del servidor
│   ├── server.js             # Servidor Express + helpers readDB/writeDB
│   ├── data/
│   │   └── db.json           # Base de datos JSON (repuestos, clientes, órdenes, facturas)
│   └── routes/
│       ├── repuestos.js      # CRUD de repuestos
│       ├── ordenes.js        # Búsqueda y transacción de cobro
│       ├── clientes.js       # Consulta de clientes
│       └── facturas.js       # Consulta de facturas
├── frontend/
│   ├── package.json          # Dependencias React
│   ├── public/
│   │   └── index.html        # HTML base
│   └── src/
│       ├── index.js          # Punto de entrada React
│       ├── App.js            # Componente raíz + navegación
│       ├── App.css           # Estilos globales (variables CSS, componentes)
│       ├── components/
│       │   ├── Navbar.js         # Barra de navegación
│       │   ├── LiquidarOrden.js  # Pantalla principal de cobro
│       │   └── GestionRepuestos.js # CRUD de inventario
│       └── services/
│           └── api.js        # Capa de servicio Axios
└── README.md
```

---

## 🗺️ Trazabilidad Académica — Clases de Dominio

| Clase de Dominio | Archivo de Código                          | Descripción                                      |
|------------------|--------------------------------------------|--------------------------------------------------|
| `Repuesto`       | `routes/repuestos.js`, `GestionRepuestos.js` | Entidad de inventario con precio y stock       |
| `Cliente`        | `routes/clientes.js`, `db.json`            | Propietario del vehículo                         |
| `OrdenDeTrabajo` | `routes/ordenes.js`, `LiquidarOrden.js`    | Agrupa ítems, mano de obra y estado de cobro     |
| `ItemOrden`      | `db.json` (campo `items`)                  | Línea de detalle: repuesto + cantidad + precio   |
| `Pago`           | `routes/ordenes.js` (cobrar)               | Registro del pago recibido                       |
| `Factura`        | `routes/facturas.js`, `ModalFactura`       | Documento de venta generado tras el cobro        |

---

## 📝 Notas de Desarrollo

- Los precios están en **pesos colombianos (COP)** y se formatean con `Intl.NumberFormat`.
- La "base de datos" es el archivo `db.json` — para producción real se reemplazaría por PostgreSQL o MongoDB.
- El inventario se descuenta automáticamente al cobrar una orden.
- La factura es imprimible directamente desde el navegador (`window.print()`).
