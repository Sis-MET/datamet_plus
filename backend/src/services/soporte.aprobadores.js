/** Aprobadores de informes de Soporte Técnico (migración 013). */
const { crearAprobadores } = require('./aprobadores');

const { obtener, guardar } = crearAprobadores({
  prefijo: 'ST',
  area: 'soporte tecnico',
  mensajes: {
    soloJefe: 'Solo el jefe de área de Soporte Técnico puede configurar aprobadores.',
    sinMigracion: 'Falta inicializar la configuración de aprobadores (migración 013).',
    cambio: 'La configuración cambió. Recárguela antes de guardar.',
    elegibles: 'Seleccione solo personal activo de Soporte Técnico. El jefe de área ya tiene autorización por su cargo.',
  },
});

module.exports = { obtener, guardar };
