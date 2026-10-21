/**
 * Los 8 servicios de Soporte técnico y la tabla de ServiceMET de cada uno.
 * El orden es el de la lista de la aplicación.
 */
const TIPOS = Object.freeze({
  MPR: { tabla: 'DATA_SERVICIOS_DATOS_MPR_STIL', etiqueta: 'Mantenimiento preventivo regular' },
  MPA: { tabla: 'DATA_SERVICIOS_DATOS_MPA_STAC', etiqueta: 'Mantenimiento preventivo avanzado' },
  MCR: { tabla: 'DATA_SERVICIOS_DATOS_MCR', etiqueta: 'Mantenimiento correctivo' },
  DIG: { tabla: 'DATA_SERVICIOS_DATOS_DIG', etiqueta: 'Diagnóstico' },
  INT: { tabla: 'DATA_SERVICIOS_DATOS_INT', etiqueta: 'Instalación' },
  IBM: { tabla: 'DATA_SERVICIOS_DATOS_IBM', etiqueta: 'Verificación con IBMETRO' },
  VFI: { tabla: 'DATA_SERVICIOS_DATOS_VFI', etiqueta: 'Verificaciones internas' },
  RVD: { tabla: 'DATA_SERVICIOS_DATOS_RVD', etiqueta: 'Relevamiento de datos' },
});

const CLAVES_TIPO = Object.keys(TIPOS);

/** Estados del informe en la lista: sin tocar, en edición o emitido. */
const ESTADOS = ['PENDIENTE', 'BORRADOR', 'EMITIDO'];

/**
 * Número del informe, como en las plantillas Excel: la OTST y los 3 últimos
 * dígitos del código Métrica ("26-0285-51-S01" + "0285-51-002" →
 * "26-0285-51-S01-002").
 */
const numeroInforme = (otst, codMetrica) => {
  const ot = String(otst ?? '').trim();
  const cod = String(codMetrica ?? '').trim();
  if (!ot) return cod || null;
  if (!cod) return ot;
  return `${ot}-${cod.length >= 3 ? cod.slice(-3) : cod}`;
};

module.exports = { CLAVES_TIPO, ESTADOS, TIPOS, numeroInforme };
