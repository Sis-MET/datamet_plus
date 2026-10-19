const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const env = require('./config/env');

// Routes imports
const indexRoutes = require('./routes/index');

const app = express();

// CORS debe ir PRIMERO para responder preflight OPTIONS antes de cualquier otro middleware
app.use(cors({
  origin: env.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-database-name', 'X-Ivmet-Access']
}));

// Middlewares Globales

// Permite a express entender body en formato JSON. El RIM del formulario web
// llega con dos firmas y hasta 5 fotos, y su entrega con dos firmas: solo esas
// rutas admiten cuerpos grandes.
const jsonGeneral = express.json();
const jsonRim = express.json({ limit: '25mb' });
const jsonEntregaRim = express.json({ limit: '4mb' });
const RUTA_ENTREGA_RIM = /^\/api\/rim\/registros\/\d+\/entrega$/;
app.use((req, res, next) => {
  if (req.method !== 'POST') return jsonGeneral(req, res, next);
  if (req.path === '/api/rim/registros') return jsonRim(req, res, next);
  if (RUTA_ENTREGA_RIM.test(req.path)) return jsonEntregaRim(req, res, next);
  return jsonGeneral(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

const path = require('path');

// Rutas de la API
app.use('/api', indexRoutes);

// Opción 1: Servir la aplicación React compilada (carpeta dist)
// Todos los archivos estáticos de React
app.use(express.static(path.join(__dirname, '../dist')));

// Cualquiera llamada que NO sea a la API, devuelve el Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Manejo de Rutas de la API No Encontradas (404)
app.use('/api/*', notFoundHandler);

// Middleware centralizado de manejo de errores
app.use(errorHandler);

module.exports = app;
