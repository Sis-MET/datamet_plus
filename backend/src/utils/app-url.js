/**
 * Enlace a un apartado de DataMET+ a partir de APP_URL, por ejemplo
 * enlaceApp('https://datamet.lenash.dev/', '/soporte/proximos'). Sin APP_URL
 * devuelve '' y el correo no lleva enlace.
 */
const enlaceApp = (appUrl, ruta = '') => {
  const base = String(appUrl || '').trim().replace(/\/+$/, '');
  return base ? `${base}${ruta}` : '';
};

module.exports = { enlaceApp };
