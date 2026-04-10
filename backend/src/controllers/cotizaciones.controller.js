const cotizacionesService = require('../services/cotizaciones.service');

/**
 * @route GET /api/cotizaciones/search?q=termino
 * Busca cotizaciones por código o nombre de cliente.
 * Retorna cod_cotizacion, cod_contacto, codigo_planta, nombre_cliente, nombre_planta.
 */
const searchCotizaciones = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro "q" requerido (mínimo 2 caracteres)',
      });
    }

    const cotizaciones = await cotizacionesService.searchCotizaciones(q.trim());

    res.status(200).json({
      success: true,
      count: cotizaciones.length,
      data: cotizaciones,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchCotizaciones,
};
