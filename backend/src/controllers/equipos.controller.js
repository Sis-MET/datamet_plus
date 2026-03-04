const equiposService = require('../services/equipos.service');

/**
 * @route GET /api/equipos/search?q=termino&planta=0121-41
 * Busca equipos por cod_metrica, opcionalmente filtrado por planta
 */
const searchEquipos = async (req, res, next) => {
  try {
    const { q = '', planta } = req.query;

    const equipos = await equiposService.searchEquipos(q.trim(), planta?.trim());

    res.status(200).json({
      success: true,
      count: equipos.length,
      data: equipos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/equipos/:codMetrica
 * Obtiene un equipo específico por su cod_metrica exacto
 */
const getEquipoByCode = async (req, res, next) => {
  try {
    const { codMetrica } = req.params;
    const equipo = await equiposService.getEquipoByCode(codMetrica);

    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    }

    res.status(200).json({ success: true, data: equipo });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchEquipos,
  getEquipoByCode
};
