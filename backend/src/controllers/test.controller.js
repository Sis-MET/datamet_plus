const testService = require('../services/test.service');

/**
 * @route GET /api/test
 */
const getTests = async (req, res, next) => {
  try {
    const data = await testService.getTestDataFromDb();
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getTests:', error);
    next(error);
  }
};

/**
 * @route POST /api/test
 */
const createTest = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;

    // Validación básica
    if (!nombre) {
      return res.status(400).json({ success: false, message: 'El campo "nombre" es requerido' });
    }

    const insertedData = await testService.insertTestDataToDb(nombre, descripcion || 'Sin descripción');

    res.status(201).json({
      success: true,
      message: 'Datos creados exitosamente (simulado)',
      data: insertedData,
      // req.user existe gracias a nuestro middleware auth.middleware.js (protect)
      usuarioQueLoCreo: req.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTests,
  createTest
};
