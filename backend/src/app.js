const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Routes imports
const indexRoutes = require('./routes/index');

const app = express();

// Middlewares Globales
app.use(cors({
  origin: '*', // En producción debes cambiar esto a la URL específica de tu frontend en Azure
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
