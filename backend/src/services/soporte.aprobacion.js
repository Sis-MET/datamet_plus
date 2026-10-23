const { createHash } = require('node:crypto');
const { normalizeArea } = require('./calibration.db');
const { httpError } = require('./soporte.validation');
const { copiaFotos } = require('./soporte.revisiones');

// La aprobación es una atribución del cargo del personal de Soporte Técnico.
// El acceso administrativo de Sistemas no concede esta atribución.
const puedeAprobar = ({ area, cargo } = {}) => normalizeArea(area) === 'soporte tecnico'
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';

const bloqueada = (informe) => ['PENDIENTE', 'APROBADO'].includes(informe?.validacion_estado);

const exigirEditable = (informe) => {
  if (informe?.estado !== 'EMITIDO' && bloqueada(informe)) {
    throw httpError(409, 'Retire la validación antes de modificar datos o fotos. Después deberá enviarlos nuevamente al jefe de área.');
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
    throw httpError(409, 'El jefe de área debe aprobar el informe antes de emitirlo.');
  }
  exigirHuella(informe, actual);
};

module.exports = { bloqueada, exigirAprobado, exigirEditable, exigirHuella, huella, puedeAprobar };
