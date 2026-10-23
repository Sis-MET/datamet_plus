const { createHash } = require('node:crypto');
const { normalizeArea } = require('./calibration.db');
const { httpError } = require('./soporte.validation');
const { copiaFotos } = require('./soporte.revisiones');

// El jefe de Soporte puede aprobar y delegar en personal de su área.
// El acceso administrativo de Sistemas no concede esta atribución.
const esJefeArea = ({ area, cargo } = {}) => normalizeArea(area) === 'soporte tecnico'
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';
const puedeAprobar = ({ area, cargo, autorizado = false } = {}) => normalizeArea(area) === 'soporte tecnico'
  && (esJefeArea({ area, cargo }) || autorizado === true);

const bloqueada = (informe) => ['PENDIENTE', 'APROBADO'].includes(informe?.validacion_estado);

const exigirEditable = (informe) => {
  if (informe?.estado !== 'EMITIDO' && bloqueada(informe)) {
    throw httpError(409, 'Retire la validación antes de modificar datos o fotos. Después deberá enviarlos nuevamente a revisión.');
  }
};

const ordenar = (valor) => {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.keys(valor).sort().map(k => [k, ordenar(valor[k])]));
  return valor;
};

// Incluye la fuente para detectar reposiciones en ServiceMET, incluso cuando
// no cambió la versión de ST_INFORMES. Las imágenes son inmutables por id.
const huella = ({ fuente, datos, fotos }) => createHash('sha256')
  .update(JSON.stringify(ordenar({ fuente, datos, fotos: copiaFotos(fotos) }))).digest('hex');

const exigirHuella = (informe, actual) => {
  if (!informe?.validacion_huella || informe.validacion_huella !== huella(actual)) {
    throw httpError(409, 'Los datos o las fotos cambiaron desde el envío. Retire la validación y envíe el informe nuevamente.');
  }
};

const exigirAprobado = (informe, actual) => {
  if (informe?.validacion_estado !== 'APROBADO') {
    throw httpError(409, 'Un aprobador autorizado debe aprobar el informe antes de emitirlo.');
  }
  exigirHuella(informe, actual);
};

module.exports = { bloqueada, esJefeArea, exigirAprobado, exigirEditable, exigirHuella, huella, puedeAprobar };
