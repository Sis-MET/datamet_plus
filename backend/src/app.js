const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const env = require('./config/env');

// Routes imports
const indexRoutes = require('./routes/index');

const app = express();

// Caddy atiende el HTTPS y reenvía desde 127.0.0.1: solo a él se le cree la
// IP del cliente (X-Forwarded-For). Las conexiones directas al puerto usan su
// propia IP. La usa el freno de intentos de inicio de sesión.
app.set('trust proxy', 'loopback');

// CORS debe ir PRIMERO para responder preflight OPTIONS antes de cualquier otro middleware
app.use(cors({
  origin: env.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-database-name', 'X-Ivmet-Access']
}));

// Middlewares Globales

// Permite a express entender body en formato JSON. El RIM del formulario web
// llega con dos firmas y hasta 5 fotos, su entrega con dos firmas y cada foto
// de un informe de soporte por separado: solo esas rutas admiten cuerpos
// grandes.
const jsonGeneral = express.json();
const jsonRim = express.json({ limit: '25mb' });
const jsonEntregaRim = express.json({ limit: '4mb' });
const jsonFotoSoporte = express.json({ limit: '6mb' });
const RUTA_ENTREGA_RIM = /^\/api\/rim\/registros\/\d+\/entrega$/;
const RUTA_FOTO_SOPORTE = /^\/api\/soporte\/informes\/[^/]+\/[^/]+\/fotos$/;
app.use((req, res, next) => {
  if (req.method !== 'POST') return jsonGeneral(req, res, next);
  if (req.path === '/api/rim/registros') return jsonRim(req, res, next);
  if (RUTA_ENTREGA_RIM.test(req.path)) return jsonEntregaRim(req, res, next);
  if (RUTA_FOTO_SOPORTE.test(req.path)) return jsonFotoSoporte(req, res, next);
  return jsonGeneral(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

const path = require('path');

// Rutas de la API
app.use('/api', indexRoutes);

// Ruta de la API inexistente: 404 en JSON, antes de servir el frontend.
app.use('/api', notFoundHandler);

// Servir la aplicación React compilada (carpeta dist)
app.use(express.static(path.join(__dirname, '../dist')));

// Cualquier otra ruta devuelve el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Middleware centralizado de manejo de errores
app.use(errorHandler);

module.exports = app;
