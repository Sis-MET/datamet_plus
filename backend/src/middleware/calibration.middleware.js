const { getCalibrationPermissions } = require('../services/calibration.service');

/** Solo el área Calibración y los usuarios de nivel 3 modifican el plan. */
const requireCalibrationEditor = async (req, res, next) => {
  try {
    const { canEdit } = await getCalibrationPermissions(req.user);
    if (canEdit) return next();
    return res.status(403).json({
      success: false,
      message: 'Solo el área de Calibración puede modificar este plan.',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireCalibrationEditor };
