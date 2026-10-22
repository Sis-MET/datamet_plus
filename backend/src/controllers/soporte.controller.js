const informes = require('../services/soporte.informes');
const proximos = require('../services/soporte.proximos');
const { leerClave, leerEquipo, parse } = require('../services/soporte.validation');
const { recordFailure } = require('../services/system.failures');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

/** Responde { success, data }; los errores conocidos salen con su código. */
const handle = (action, status = 200) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409, 503].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    // Tablas de los próximos servicios ausentes: falta aplicar la migración 009.
    if (/Invalid object name 'dbo\.ST_(PROXIMOS|AVISOS)_/i.test(error.message || '')) {
      recordFailure({ origen: 'SERVIDOR', error: Object.assign(error, { statusCode: 503 }), req });
      return res.status(503).json({
        success: false,
        message: 'Falta la migración 009 (próximos servicios de Soporte técnico) en la base de datos.',
      });
    }
    return next(error);
  }
};

const clave = (req) => leerClave(req.params.tipo, req.params.codigo);

module.exports = {
  listInformes: handle(req => informes.listInformes(parse('filtros', req.query), req.user)),
  listGrupos: handle((req) => {
    const filtros = parse('filtros', req.query);
    if (!filtros.por) throw Object.assign(new Error('Indique cómo agrupar: otst o tecnico.'), { statusCode: 400 });
    return informes.listGrupos(filtros, req.user);
  }),
  getFiltros: handle(() => informes.getFiltros()),
  redaccion: handle(req => informes.sugerirRedaccion(parse('redaccion', req.body), req.user)),
  getInforme: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.getInforme(tipo, codigo, req.user);
  }),
  guardarCambios: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.guardarCambios(tipo, codigo, parse('cambios', req.body), req.user);
  }),
  emitir: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.emitirInforme(tipo, codigo, parse('emision', req.body), req.user);
  }),
  agregarFoto: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.agregarFoto(tipo, codigo, parse('foto', req.body), req.user);
  }, 201),
  editarFoto: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.editarFoto(tipo, codigo, readId(req.params.fotoId), parse('fotoEdicion', req.body), req.user);
  }),
  quitarFoto: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.quitarFoto(tipo, codigo, readId(req.params.fotoId), parse('fotoQuitar', req.body), req.user);
  }),
  ordenarFotos: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.ordenarFotos(tipo, codigo, parse('fotosOrden', req.body), req.user);
  }),

  // Próximos servicios y su seguimiento.
  proximosPlan: handle(req => proximos.getPlan({ anio: parse('proximosPlan', req.query).anio, user: req.user })),
  proximosResumen: handle(() => proximos.getAlertSummary()),
  proximosEquipo: handle(req => proximos.getEquipo(leerEquipo(req.params.codMetrica), req.user)),
  registrarSeguimiento: handle(req => proximos.registrarSeguimiento(parse('seguimiento', req.body), req.user), 201),

  // Avisos por correo.
  avisos: handle(req => proximos.getAlertSettings(req.user)),
  avisosPersonal: handle(() => proximos.getPersonal()),
  avisosAjustes: handle(req => proximos.updateAjustes(parse('avisosAjustes', req.body), req.user)),
  crearContacto: handle(req => proximos.createContacto(parse('avisosContacto', req.body), req.user), 201),
  editarContacto: handle(req => proximos.updateContacto(readId(req.params.id), parse('avisosContacto', req.body), req.user)),
  quitarContacto: handle(req => proximos.deleteContacto(readId(req.params.id), req.user)),
  avisosPrueba: handle(req => proximos.sendTestEmail(parse('avisosPrueba', req.body).email, req.user)),
  avisosEjecutar: handle(req => proximos.runAlertsManual(req.user)),
};
