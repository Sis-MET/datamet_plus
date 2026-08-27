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

app.use(express.json()); // Permite a express entender body en formato JSON
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
