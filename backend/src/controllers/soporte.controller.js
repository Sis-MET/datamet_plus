const informes = require('../services/soporte.informes');
const proximos = require('../services/soporte.proximos');
const documentos = require('../services/soporte.documentos');
const aprobadores = require('../services/soporte.aprobadores');
const { leerClave, leerEquipo, leerRevision, parse } = require('../services/soporte.validation');
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
    // Tablas o columnas ausentes: indicar la migración del proceso afectado.
    const faltante = /Invalid column name 'numero'|CK_ST_INFORMES_HISTORIAL_ACCION/i.test(error.message || '') ? '015 (cambio de OTST)'
      : /Invalid object name 'dbo\.ST_APROBADORES/i.test(error.message || '') ? '013 (aprobadores de soporte)'
      : /Invalid object name 'dbo\.ST_INFORMES_DOCUMENTOS/i.test(error.message || '') ? '012 (archivo PDF de soporte)'
      : /Invalid column name 'validacion_/i.test(error.message || '') ? '011 (validación de informes)'
      : /Invalid object name 'dbo\.ST_(PROXIMOS|AVISOS)_/i.test(error.message || '') ? '009 (próximos servicios)'
      : /Invalid (object|column) name '(dbo\.ST_INFORMES_REVISIONES|revision_motivo|revision_abierta_)/i.test(error.message || '') ? '010 (reemisión de informes)'
        : null;
    if (faltante) {
      recordFailure({ origen: 'SERVIDOR', error: Object.assign(error, { statusCode: 503 }), req });
      return res.status(503).json({
        success: false,
        message: `Falta la migración ${faltante} de Soporte técnico en la base de datos.`,
      });
    }
    return next(error);
  }
};

const clave = (req) => leerClave(req.params.tipo, req.params.codigo);

module.exports = {
  permisos: handle(req => informes.permisos(req.user)),
  aprobadores: handle(req => aprobadores.obtener(req.user)),
  guardarAprobadores: handle(req => aprobadores.guardar(parse('aprobadores', req.body), req.user)),
  carpetas: handle(req => documentos.carpetas(req.query.carpeta, req.user)),
  documentos: handle(req => {
    const { tipo, codigo } = clave(req);
    return documentos.listar(tipo, codigo, req.user);
  }),
  guardarDocumento: handle(req => {
    const { tipo, codigo } = clave(req);
    return documentos.guardar(tipo, codigo, req.query, req.body, req.user);
  }, 201),
  abrirDocumento: async (req, res, next) => {
    try {
      const pdf = await documentos.abrir(req.params.id, req.user);
      res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="informe.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.nombre).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}` });
      res.send(pdf.contenido);
    } catch (error) {
      if ([400, 403, 404, 409, 503].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message });
      next(error);
    }
  },
  listInformes: handle(req => informes.listInformes(parse('filtros', req.query), req.user)),
  listGrupos: handle((req) => {
    const filtros = parse('filtros', req.query);
    if (!filtros.por) throw Object.assign(new Error('Indique cómo agrupar: otst o tecnico.'), { statusCode: 400 });
    return informes.listGrupos(filtros, req.user);
  }),
  getFiltros: handle(req => informes.getFiltros(req.user)),
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
  enviarValidacion: handle(req => {
    const { tipo, codigo } = clave(req);
    return informes.enviarValidacion(tipo, codigo, parse('enviarValidacion', req.body), req.user);
  }),
  resolverValidacion: handle(req => {
    const { tipo, codigo } = clave(req);
    return informes.resolverValidacion(tipo, codigo, parse('resolverValidacion', req.body), req.user);
  }),
  retirarValidacion: handle(req => {
    const { tipo, codigo } = clave(req);
    return informes.retirarValidacion(tipo, codigo, parse('retirarValidacion', req.body), req.user);
  }),
  // Reemisión: abrir una revisión, reemitirla o cancelarla, y ver una revisión emitida.
  abrirRevision: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.abrirRevision(tipo, codigo, parse('abrirRevision', req.body), req.user);
  }),
  cambiarOtst: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.cambiarOtst(tipo, codigo, parse('cambioOtst', req.body), req.user);
  }),
  reemitir: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.reemitirInforme(tipo, codigo, parse('reemision', req.body), req.user);
  }),
  cancelarRevision: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.cancelarRevision(tipo, codigo, parse('cancelarRevision', req.body), req.user);
  }),
  getRevision: handle((req) => {
    const { tipo, codigo } = clave(req);
    return informes.getRevision(tipo, codigo, leerRevision(req.params.revision));
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
