const calibrationService = require('../services/calibration.service');
const equipmentService = require('../services/calibration.equipment');
const complianceService = require('../services/calibration.compliance');
const servicemetService = require('../services/calibration.servicemet');
const patronesService = require('../services/calibration.patrones');
const serviciosService = require('../services/calibration.servicios');
const puntosService = require('../services/calibration.puntos');
const calculoService = require('../services/calibration.calculo');
const registrosService = require('../services/calibration.registros');
const aprobadoresService = require('../services/calibration.aprobadores');
const certificadoService = require('../services/calibration.certificado');
const emisionService = require('../services/calibration.emision');
const metodoService = require('../services/calibration.metodo');
const emitidosService = require('../services/calibration.emitidos');
const { parse } = require('../services/calibration.validation');
const { recordFailure } = require('../services/system.failures');

const readId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { statusCode: 400 });
  }
  return id;
};

/** Código de un servicio de ServiceMET (codigo_registro). */
const readCodigo = (value) => {
  const codigo = String(value ?? '').trim();
  if (!/^[\w\- .]{3,100}$/.test(codigo)) {
    throw Object.assign(new Error('Código de servicio inválido.'), { statusCode: 400 });
  }
  return codigo;
};

/** Parámetros de la URL sin los vacíos. */
const queryParams = (query) => Object.fromEntries(Object.entries(query || {}).filter(([, value]) => value !== '' && value != null));

/** Envuelve cada acción: responde { success, data } y traduce errores conocidos. */
const handle = (action) => async (req, res, next) => {
  try {
    const data = await action(req);
    res.status(200).json({ success: true, data });
  } catch (error) {
    if ([400, 403, 404, 409, 503].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    // Tabla o columna ausente: falta aplicar una migración del módulo.
    if (/Invalid (object|column) name '(dbo\.CAL_|CAL_|registro_ref|revisado_|revision_obs|revision_motivo|corregido_)/i.test(error.message || '')) {
      recordFailure({ origen: 'SERVIDOR', error: Object.assign(error, { statusCode: 503 }), req });
      return res.status(503).json({
        success: false,
        message: 'Faltan migraciones del módulo de calibración en la base de datos. Ejecuta "pnpm migrate" en backend.',
      });
    }
    return next(error);
  }
};

module.exports = {
  getPlan: handle(req => calibrationService.getPlan({ anio: req.query.anio, user: req.user })),
  getAlertSummary: handle(() => calibrationService.getAlertSummary()),
  getPersonal: handle(() => calibrationService.getPersonal()),
  previewDates: handle(req => calibrationService.previewDates(parse('vistaPrevia', req.body))),

  updateEquipo: handle(req => calibrationService.updateEquipoConfig(
    readId(req.params.id),
    parse('equipoConfig', req.body),
    req.user
  )),
  updateEquipos: handle(req => calibrationService.updateEquiposMasivo(parse('equiposMasivo', req.body), req.user)),

  // Gestión de los equipos de DATA_EQUIPOS_CAL.
  getEquipoHistorial: handle(req => equipmentService.getEquipoHistorial(readId(req.params.id), req.user)),
  createEquipo: handle(req => equipmentService.createEquipo(parse('equipoAlta', req.body), req.user)),
  updateEquipoDatos: handle(req => equipmentService.updateEquipoDatos(
    readId(req.params.id),
    parse('equipoDatos', req.body),
    req.user
  )),
  registrarCertificado: handle(req => equipmentService.registrarCertificado(
    readId(req.params.id),
    parse('certificado', req.body),
    req.user
  )),
  corregirCertificado: handle(req => equipmentService.corregirCertificado(
    readId(req.params.id),
    parse('certificadoCorreccion', req.body),
    req.user
  )),
  revisarCertificado: handle(req => equipmentService.revisarCertificado(
    readId(req.params.id),
    parse('certificadoRevision', req.body),
    req.user
  )),
  anularCertificado: handle(req => equipmentService.anularCertificado(
    readId(req.params.id),
    parse('anulacion', req.body),
    req.user
  )),
  cambiarEstadoEquipo: handle(req => equipmentService.cambiarEstado(
    readId(req.params.id),
    parse('estadoEquipo', req.body),
    req.user
  )),

  // Patrones: tipo, clase, piezas y valores del certificado vigente (migración 016).
  // Servicios de calibración que subió ServiceMET (fase 2).
  listServicios: handle(async (req) => {
    const [lista, persona] = await Promise.all([
      serviciosService.listarServicios(parse('serviciosFiltro', queryParams(req.query))),
      aprobadoresService.personaCalibracion(req.user),
    ]);
    return { ...lista, permisos: { configurarAprobadores: persona.jefe } };
  }),
  getServicio: handle(req => serviciosService.getServicio(readCodigo(req.params.codigo))),
  // Vista previa del cálculo (motor, fase 3): no guarda nada.
  getCalculoServicio: handle(req => calculoService.calcularVistaPrevia(readCodigo(req.params.codigo))),
  // Registro de calibración de un servicio (fase 4): correcciones, envío y revisión.
  getRegistro: handle(req => registrosService.getRegistro(readCodigo(req.params.codigo), req.user)),
  guardarRegistro: handle(req => registrosService.guardarRegistro(readCodigo(req.params.codigo), parse('registroGuardar', req.body), req.user)),
  enviarRegistro: handle(req => registrosService.enviarRegistro(readCodigo(req.params.codigo), req.user)),
  retirarRegistro: handle(req => registrosService.retirarRegistro(readCodigo(req.params.codigo), req.user)),
  revisarRegistro: handle(req => registrosService.revisarRegistro(readCodigo(req.params.codigo), parse('registroRevision', req.body), req.user)),
  reabrirRegistro: handle(req => registrosService.reabrirRegistro(readCodigo(req.params.codigo), parse('registroReapertura', req.body), req.user)),
  getCertificado: handle(req => certificadoService.getCertificado(readCodigo(req.params.codigo), req.user, {
    emision: req.query.emision ? readId(req.query.emision) : null,
  })),
  vistaPreviaCertificado: handle(req => certificadoService.previsualizar(readCodigo(req.params.codigo), parse('registroVistaPrevia', req.body))),
  autorizarCertificado: handle(req => emisionService.autorizar(readCodigo(req.params.codigo), req.user)),
  anularAutorizacion: handle(req => emisionService.anularAutorizacion(readCodigo(req.params.codigo), parse('certificadoMotivo', req.body), req.user)),
  subirFirmado: handle(req => emisionService.subirFirmado(
    readCodigo(req.params.codigo),
    req.body,
    { fechaFirma: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fechaFirma || '')) ? req.query.fechaFirma : null },
    req.user,
  )),
  abrirRevisionCertificado: handle(req => emisionService.abrirRevision(readCodigo(req.params.codigo), parse('certificadoMotivo', req.body), req.user)),
  abrirCertificadoPdf: async (req, res, next) => {
    try {
      const pdf = await emisionService.abrirPdf(readCodigo(req.params.codigo), readId(req.params.emision), req.user);
      res.set({
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="certificado.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.nombre).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      });
      res.send(pdf.contenido);
    } catch (error) {
      if ([400, 403, 404, 409, 503].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message });
      return next(error);
    }
  },
  getAprobadores: handle(req => aprobadoresService.obtener(req.user)),
  // Configuración del método por versiones (fase 6).
  getMetodo: handle(req => metodoService.getMetodo(req.user)),
  // Libro de certificados emitidos (solo lectura).
  listEmitidos: handle(() => emitidosService.listarEmitidos()),
  crearBorradorMetodo: handle(req => metodoService.crearBorrador(req.user, parse('metodoBorrador', req.body))),
  guardarBorradorMetodo: handle(req => metodoService.guardarBorrador(req.user, parse('metodoGuardar', req.body))),
  descartarBorradorMetodo: handle(req => metodoService.descartarBorrador(req.user, parse('metodoDescarte', req.body))),
  aprobarMetodo: handle(req => metodoService.aprobar(req.user, parse('metodoAprobacion', req.body))),
  saveAprobadores: handle(req => aprobadoresService.guardar(parse('aprobadores', req.body), req.user)),
  getPuntosAcordados: handle(req => puntosService.getPuntos(req.params.codMetrica)),
  savePuntosAcordados: handle(req => puntosService.savePuntos(req.params.codMetrica, parse('puntosAcordados', req.body), req.user)),

  getPatron: handle(req => patronesService.getPatron(readId(req.params.id), req.user)),
  savePatron: handle(req => patronesService.savePatron(
    readId(req.params.id),
    parse('patron', req.body),
    req.user
  )),

  createActividad: handle(req => calibrationService.createActividad(parse('actividad', req.body), req.user)),
  updateActividad: handle(req => calibrationService.updateActividad(
    readId(req.params.id),
    parse('actividad', req.body),
    req.user
  )),
  deleteActividad: handle(req => calibrationService.deleteActividad(readId(req.params.id), req.user)),
  getActividadHistorial: handle(req => calibrationService.getActividadHistorial(readId(req.params.id))),

  saveEvento: handle(req => calibrationService.saveEvento(parse('evento', req.body), req.user)),
  resetEvento: handle(req => calibrationService.resetEvento(parse('eventoRestablecer', req.body), req.user)),
  revisarEvento: handle(req => calibrationService.revisarEvento(parse('eventoClave', req.body), req.user)),
  getEventoHistorial: handle(req => calibrationService.getEventoHistorial(parse('eventoClave', req.query))),

  getAlertSettings: handle(() => calibrationService.getAlertSettings()),
  updateAjustes: handle(req => calibrationService.updateAjustes(parse('ajustes', req.body), req.user)),
  createContacto: handle(req => calibrationService.createContacto(parse('contacto', req.body))),
  updateContacto: handle(req => calibrationService.updateContacto(readId(req.params.id), parse('contacto', req.body))),
  deleteContacto: handle(req => calibrationService.deleteContacto(readId(req.params.id))),
  sendTestEmail: handle(req => calibrationService.sendTestEmail(parse('prueba', req.body).email)),
  runAlerts: handle(() => calibrationService.runAlerts()),

  // Cumplimiento NB/ISO/IEC 17025 (7.5, 7.11 y 8.4), evaluado con los datos actuales.
  getCompliance: handle(req => complianceService.getCompliance({ version: String(req.query.version || '').slice(0, 20) || null })),

  // Versiones de ServiceMET: Sistemas las registra y valida; el jefe de Calibración las aprueba.
  listServicemet: handle(req => servicemetService.listVersiones(req.user)),
  getServicemet: handle(req => servicemetService.getVersion(readId(req.params.id), req.user)),
  createServicemet: handle(req => servicemetService.createVersion(parse('servicemetVersion', req.body), req.user)),
  updateServicemet: handle(req => servicemetService.updateVersion(
    readId(req.params.id),
    parse('servicemetVersion', req.body),
    req.user
  )),
  validarServicemet: handle(req => servicemetService.validarVersion(
    readId(req.params.id),
    parse('servicemetValidacion', req.body),
    req.user
  )),
  decidirServicemet: handle(req => servicemetService.decidirVersion(
    readId(req.params.id),
    parse('servicemetDecision', req.body),
    req.user
  )),
  ponerServicemetEnUso: handle(req => servicemetService.ponerEnUso(
    readId(req.params.id),
    parse('servicemetPuesta', req.body),
    req.user
  )),
};
