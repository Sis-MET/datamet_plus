const clientesService = require('../services/clientes.service');

/**
 * @route GET /api/clientes/search?q=termino
 * Busca clientes por nombre
 */
const searchClientes = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({ success: false, message: 'Parámetro de búsqueda "q" es requerido (mínimo 1 carácter)' });
    }

    const clientes = await clientesService.searchClientes(q.trim());

    res.status(200).json({
      success: true,
      count: clientes.length,
      data: clientes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/clientes
 * Obtiene todos los clientes
 */
const getAllClientes = async (req, res, next) => {
  try {
    const clientes = await clientesService.getAllClientes();

    res.status(200).json({
      success: true,
      count: clientes.length,
      data: clientes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/clientes/:codigoCliente/plantas
 * Obtiene las plantas asociadas a un cliente por su codigo_cliente
 */
const getPlantasByCliente = async (req, res, next) => {
  try {
    const { codigoCliente } = req.params;

    if (!codigoCliente || codigoCliente.trim().length < 1) {
      return res.status(400).json({ success: false, message: 'El parámetro codigoCliente es requerido' });
    }

    const plantas = await clientesService.getPlantasByCliente(codigoCliente.trim());

    res.status(200).json({
      success: true,
      count: plantas.length,
      data: plantas
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchClientes,
  getAllClientes,
  getPlantasByCliente
};
