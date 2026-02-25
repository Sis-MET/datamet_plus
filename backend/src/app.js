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

// Rutas de la API
app.use('/api', indexRoutes);

// Manejo de Rutas No Encontradas (404)
app.use(notFoundHandler);

// Middleware centralizado de manejo de errores
app.use(errorHandler);

module.exports = app;
