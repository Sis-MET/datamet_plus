/**
 * Próximos servicios de Soporte técnico. Funciones puras: reciben los
 * servicios de ServiceMET (ya con las correcciones de los informes) y el
 * seguimiento del área, y devuelven el estado de cada equipo.
 *
 * Regla: el próximo servicio de un equipo (Código Métrica) es el que sugirió
 * su último mantenimiento, instalación o verificación. Un servicio posterior
 * de esos tipos lo reemplaza con su propia sugerencia (aunque venga sin
 * fecha); el diagnóstico y el relevamiento no la cambian. El seguimiento del
 * área puede coordinar, reprogramar o descartar esa fecha.
 */
const { decideAlert } = require('./calibration.alerts');
const { diffDays, isDate } = require('./calibration.schedule');
const { enlaceApp } = require('../utils/app-url');

/** Servicios que dejan (o quitan) la fecha del próximo servicio. */
const TIPOS_CON_FECHA = new Set(['MPR', 'MPA', 'MCR', 'INT', 'IBM', 'VFI']);

const ACCIONES = ['CONTACTO', 'COORDINACION', 'REPROGRAMACION', 'DESCARTE', 'REACTIVACION'];
const ACCIONES_CON_FECHA = new Set(['COORDINACION', 'REPROGRAMACION']);

const ETIQUETA_TIPO = {
  MPR: 'Preventivo regular',
  MPA: 'Preventivo avanzado',
  MCR: 'Correctivo',
  DIG: 'Diagnóstico',
  INT: 'Instalación',
  IBM: 'Verificación IBMETRO',
  VFI: 'Verificación interna',
  RVD: 'Relevamiento',
};

/** Tipo de servicio sugerido, como lo escribe ServiceMET. */
const ETIQUETA_SUGERIDO = {
  MPR: 'Preventivo regular',
  MPA: 'Preventivo avanzado',
  MCR: 'Correctivo',
  DIG: 'Diagnóstico',
  AJM: 'Ajuste metrológico',
  CAL: 'Calibración',
  OTRO: 'Otro',
};

const SUGERIDO_DE = new Map([
  ['mnt preventivo regular', 'MPR'],
  ['mantenimiento preventivo regular', 'MPR'],
  ['mnt preventivo avanzado', 'MPA'],
  ['mantenimiento preventivo avanzado', 'MPA'],
  ['mnt correctivo', 'MCR'],
  ['mantenimiento correctivo', 'MCR'],
  ['diagnostico', 'DIG'],
  ['ajustes metrologicos', 'AJM'],
  ['ajuste metrologico', 'AJM'],
  ['calibracion', 'CAL'],
  ['sin recomendacion', null],
]);

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[.\s]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Clave del tipo sugerido: MPR, MPA, MCR, DIG, AJM, CAL, OTRO (texto libre
 * de versiones anteriores) o null (vacío o «Sin recomendación»).
 */
const claveSugerido = (texto) => {
  const valor = normalizar(texto);
  if (!valor) return null;
  return SUGERIDO_DE.has(valor) ? SUGERIDO_DE.get(valor) : 'OTRO';
};

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';
const limpio = (valor) => (vacio(valor) ? null : String(valor).trim());

/**
 * Orden de los servicios de un equipo: por fecha y, en el mismo día, los que
 * dejan fecha al final, con la fecha sugerida más cercana en último lugar
 * (la más prudente). Así el último de la lista es el que manda.
 */
const compararServicios = (a, b) => {
  if (a.fecha !== b.fecha) return String(a.fecha || '').localeCompare(String(b.fecha || ''));
  const cuentaA = TIPOS_CON_FECHA.has(a.tipo) ? 1 : 0;
  const cuentaB = TIPOS_CON_FECHA.has(b.tipo) ? 1 : 0;
  if (cuentaA !== cuentaB) return cuentaA - cuentaB;
  if (Boolean(a.fechaProx) !== Boolean(b.fechaProx)) return a.fechaProx ? 1 : -1;
  if (a.fechaProx && b.fechaProx && a.fechaProx !== b.fechaProx) return b.fechaProx.localeCompare(a.fechaProx);
  return String(a.codigo).localeCompare(String(b.codigo));
};

/** Fecha sugerida válida: posterior al servicio. Otra cosa no cuenta. */
const fechaSugeridaValida = (servicio) => (
  isDate(servicio.fechaProx) && (!isDate(servicio.fecha) || servicio.fechaProx > servicio.fecha)
    ? servicio.fechaProx
    : null
);

/**
 * Estado de una sugerencia según su seguimiento (en orden de registro).
 * Coordinar y reprogramar cambian la fecha; descartar la saca de los avisos
 * hasta que se reactive.
 */
const aplicarSeguimiento = (fechaSugerida, gestiones = []) => {
  const estado = {
    fecha: fechaSugerida,
    coordinada: false,
    descartada: false,
    ultimoContacto: null,
    ultimaGestion: null,
    ultimoId: null,
  };
  for (const gestion of gestiones) {
    estado.ultimoId = gestion.id;
    estado.ultimaGestion = gestion;
    switch (gestion.accion) {
      case 'CONTACTO':
        estado.ultimoContacto = gestion;
        break;
      case 'COORDINACION':
        estado.fecha = gestion.fechaNueva;
        estado.coordinada = true;
        estado.ultimoContacto = gestion;
        break;
      case 'REPROGRAMACION':
        estado.fecha = gestion.fechaNueva;
        estado.coordinada = false;
        break;
      case 'DESCARTE':
        estado.descartada = true;
        break;
      case 'REACTIVACION':
        estado.descartada = false;
        break;
      default:
        break;
    }
  }
  return estado;
};

/** Situación visible del próximo servicio, con los mismos nombres que calibración. */
const resolverSituacion = ({ fecha, coordinada, descartada }, hoy, alerta) => {
  if (descartada) return 'DESCARTADO';
  if (!isDate(fecha)) return 'SIN_FECHA';
  const dias = diffDays(fecha, hoy);
  if (dias < 0) return 'VENCIDO';
  if (coordinada) return 'COORDINADO';
  if (alerta.frecuencia !== 'NINGUNA' && dias <= alerta.dias) return 'PROXIMO';
  return 'PROGRAMADO';
};

const claveOrigen = (tipo, codigo) => `${tipo}:${codigo}`;

const datosEquipo = (servicio) => ({
  codMetrica: servicio.codMetrica,
  cliente: limpio(servicio.cliente) || 'Sin cliente',
  planta: limpio(servicio.planta),
  ciudad: limpio(servicio.ciudad),
  codPlanta: limpio(servicio.codPlanta),
  instrumento: limpio(servicio.tipoEquipo),
  marca: limpio(servicio.marca),
  modelo: limpio(servicio.modelo),
  serie: limpio(servicio.serie),
  codInt: limpio(servicio.codInt),
  ubicacion: limpio(servicio.ubicacion),
  unidades: servicio.unidades || null,
  rangos: servicio.rangos || [],
  tipoRango: servicio.tipoRango || null,
  capacidadMaxima: servicio.capacidadMaxima ?? null,
});

const resumenServicio = (servicio) => ({
  tipo: servicio.tipo,
  codigo: servicio.codigo,
  numero: servicio.numero || null,
  otst: limpio(servicio.otst),
  fecha: servicio.fecha || null,
  tecnico: limpio(servicio.tecnico),
  estadoInforme: servicio.estadoInforme || 'PENDIENTE',
});

/**
 * Agrupa los servicios por equipo y calcula el próximo servicio de cada uno.
 *
 * @param {object} input
 * @param {Array}  input.servicios   { tipo, codigo, numero, otst, fecha, fechaProx, recomendacion, tecnico, codMetrica, cliente, ... }
 * @param {Array}  input.seguimiento { id, origenTipo, origenCodigo, accion, fechaNueva, nota, usuario, ... } en orden de id.
 * @param {string} input.hoy
 * @param {object} input.ajustes     { alertaDias, alertaFrecuencia, alertaCorreo }
 */
const construirEquipos = ({ servicios = [], seguimiento = [], hoy, ajustes }) => {
  const alerta = { dias: ajustes.alertaDias, frecuencia: ajustes.alertaFrecuencia, correo: ajustes.alertaCorreo };

  const gestionesPorOrigen = new Map();
  for (const gestion of [...seguimiento].sort((a, b) => a.id - b.id)) {
    const clave = claveOrigen(gestion.origenTipo, gestion.origenCodigo);
    if (!gestionesPorOrigen.has(clave)) gestionesPorOrigen.set(clave, []);
    gestionesPorOrigen.get(clave).push(gestion);
  }

  const porEquipo = new Map();
  for (const servicio of servicios) {
    const cod = limpio(servicio.codMetrica);
    if (!cod) continue;
    const clave = cod.toUpperCase();
    if (!porEquipo.has(clave)) porEquipo.set(clave, []);
    porEquipo.get(clave).push({ ...servicio, codMetrica: cod });
  }

  const equipos = [];
  for (const [clave, lista] of porEquipo) {
    const ordenados = [...lista].sort(compararServicios);
    const ultimo = ordenados[ordenados.length - 1];
    const conFecha = ordenados.filter(servicio => TIPOS_CON_FECHA.has(servicio.tipo));
    // Manda el último servicio que deja fecha; sin ninguno, el último de todos.
    const origen = conFecha[conFecha.length - 1] || ultimo;

    const historial = ordenados.map((servicio, index) => {
      const fechaProx = fechaSugeridaValida(servicio);
      let estado = null;
      let atendidaPor = null;
      if (servicio === origen) estado = 'VIGENTE';
      else if (TIPOS_CON_FECHA.has(servicio.tipo) || fechaProx) {
        const siguiente = ordenados.slice(index + 1).find(otro => TIPOS_CON_FECHA.has(otro.tipo) && otro.fecha > servicio.fecha);
        if (siguiente) {
          estado = 'ATENDIDA';
          atendidaPor = resumenServicio(siguiente);
        } else {
          estado = 'REEMPLAZADA';
        }
      }
      return {
        ...resumenServicio(servicio),
        fechaProx,
        tipoSugerido: claveSugerido(servicio.recomendacion),
        recomendacion: limpio(servicio.recomendacion),
        sugerencia: estado,
        atendidaPor,
      };
    });

    const base = { id: clave, ...datosEquipo(ultimo) };
    const fechaSugerida = fechaSugeridaValida(origen);
    const gestiones = gestionesPorOrigen.get(claveOrigen(origen.tipo, origen.codigo)) || [];
    const estado = aplicarSeguimiento(fechaSugerida, gestiones);

    let proximo = null;
    if (isDate(estado.fecha) || estado.descartada) {
      const situacion = resolverSituacion(estado, hoy, alerta);
      proximo = {
        id: claveOrigen(origen.tipo, origen.codigo),
        equipoId: base.id,
        codMetrica: base.codMetrica,
        cliente: base.cliente,
        planta: base.planta,
        ciudad: base.ciudad,
        instrumento: base.instrumento,
        marca: base.marca,
        modelo: base.modelo,
        serie: base.serie,
        unidades: base.unidades,
        rangos: base.rangos,
        tipoRango: base.tipoRango,
        capacidadMaxima: base.capacidadMaxima,
        origen: resumenServicio(origen),
        tipoSugerido: claveSugerido(origen.recomendacion),
        recomendacion: limpio(origen.recomendacion),
        fechaSugerida,
        fecha: estado.fecha,
        reprogramada: Boolean(estado.fecha && estado.fecha !== fechaSugerida),
        coordinada: estado.coordinada,
        descartada: estado.descartada,
        situacion,
        diasRestantes: isDate(estado.fecha) ? diffDays(estado.fecha, hoy) : null,
        ultimoContacto: estado.ultimoContacto ? publicarGestion(estado.ultimoContacto) : null,
        ultimaGestion: estado.ultimaGestion ? publicarGestion(estado.ultimaGestion) : null,
        ultimoSeguimientoId: estado.ultimoId,
        alerta,
      };
    }

    equipos.push({
      ...base,
      origen: resumenServicio(origen),
      ultimoServicio: resumenServicio(ultimo),
      servicios: historial,
      proximo,
      ultimoSeguimientoId: estado.ultimoId,
    });
  }

  return equipos.sort((a, b) => (
    a.cliente.localeCompare(b.cliente, 'es') || a.codMetrica.localeCompare(b.codMetrica, 'es', { numeric: true })
  ));
};

/** Gestión lista para la interfaz. */
function publicarGestion(gestion) {
  return {
    id: gestion.id,
    accion: gestion.accion,
    origenTipo: gestion.origenTipo,
    origenCodigo: gestion.origenCodigo,
    fechaSugerida: gestion.fechaSugerida || null,
    fechaNueva: gestion.fechaNueva || null,
    nota: gestion.nota,
    usuario: gestion.usuario,
    usuarioNombre: gestion.usuarioNombre || null,
    registradoEn: gestion.registradoEn || null,
  };
}

/** Próximos servicios que requieren atención: vencidos, por llegar o coordinados dentro del aviso. */
const alertasActivas = (equipos) => equipos
  .map(equipo => equipo.proximo)
  .filter(proximo => proximo
    && proximo.alerta.frecuencia !== 'NINGUNA'
    && ['VENCIDO', 'PROXIMO', 'COORDINADO'].includes(proximo.situacion)
    && (proximo.situacion !== 'COORDINADO' || proximo.diasRestantes <= proximo.alerta.dias))
  .sort((a, b) => (
    Number(b.situacion === 'VENCIDO') - Number(a.situacion === 'VENCIDO') || a.fecha.localeCompare(b.fecha)
  ));

/**
 * Marcas de la línea de tiempo de un año: los servicios realizados y el
 * próximo servicio de cada equipo. Solo lo propio de cada marca: los datos
 * del equipo se toman de la lista de equipos por `equipoId`.
 */
const eventosDelAnio = (equipos, anio) => {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const enAnio = (fecha) => isDate(fecha) && fecha >= desde && fecha <= hasta;
  const eventos = [];
  for (const equipo of equipos) {
    for (const servicio of equipo.servicios) {
      if (!enAnio(servicio.fecha)) continue;
      eventos.push({
        id: `S:${servicio.tipo}:${servicio.codigo}`,
        clase: 'SERVICIO',
        equipoId: equipo.id,
        fecha: servicio.fecha,
        tipo: servicio.tipo,
        situacion: 'REALIZADO',
        codigo: servicio.codigo,
        numero: servicio.numero,
        otst: servicio.otst,
        tecnico: servicio.tecnico,
        estadoInforme: servicio.estadoInforme,
      });
    }
    const { proximo } = equipo;
    if (proximo && enAnio(proximo.fecha)) {
      eventos.push({
        id: `P:${proximo.id}`,
        clase: 'PROXIMO',
        equipoId: equipo.id,
        fecha: proximo.fecha,
        tipo: proximo.origen.tipo,
        situacion: proximo.situacion,
        tipoSugerido: proximo.tipoSugerido,
        fechaSugerida: proximo.fechaSugerida,
        coordinada: proximo.coordinada,
        reprogramada: proximo.reprogramada,
        diasRestantes: proximo.diasRestantes,
      });
    }
  }
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
};

/** Totales para el encabezado y el contador de la barra lateral. */
const resumen = (equipos, alertas) => {
  const proximos = equipos.map(equipo => equipo.proximo).filter(Boolean);
  const cuenta = (situacion) => proximos.filter(proximo => proximo.situacion === situacion).length;
  return {
    equipos: equipos.length,
    conFecha: proximos.filter(proximo => !proximo.descartada).length,
    sinFecha: equipos.length - proximos.length,
    vencidos: cuenta('VENCIDO'),
    proximos: cuenta('PROXIMO'),
    coordinados: cuenta('COORDINADO'),
    programados: cuenta('PROGRAMADO'),
    descartados: cuenta('DESCARTADO'),
    atencion: alertas.length,
  };
};

/**
 * Valida una gestión contra el estado actual del próximo servicio. Devuelve
 * null si se puede registrar o el mensaje que explica por qué no.
 */
const validarGestion = ({ accion, fecha }, { estado, origen, hoy }) => {
  if (!ACCIONES.includes(accion)) return 'Acción de seguimiento desconocida.';
  if (accion === 'REACTIVACION') return estado.descartada ? null : 'Este próximo servicio no está descartado.';
  if (estado.descartada) return 'El próximo servicio está descartado: reactívelo antes de registrar otra gestión.';
  if (ACCIONES_CON_FECHA.has(accion)) {
    if (!isDate(fecha)) return 'Indique la fecha.';
    if (isDate(origen.fecha) && fecha <= origen.fecha) return 'La fecha debe ser posterior al último servicio.';
    if (accion === 'COORDINACION' && fecha < hoy) return 'La visita coordinada no puede quedar en el pasado.';
    if (accion === 'REPROGRAMACION' && fecha === estado.fecha) return 'La nueva fecha es igual a la vigente.';
    return null;
  }
  // Contacto y descarte: requieren una fecha sobre la cual se gestiona.
  return isDate(estado.fecha) ? null : 'Este equipo no tiene fecha de próximo servicio: prográmela primero.';
};

// ─── Correos ───────────────────────────────────────────────────────────────

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Avisos de hoy por destinatario. Todos los destinatarios activos reciben
 * todo; la frecuencia se cuenta por próximo servicio, fecha y correo.
 * @returns {Array<{ contacto, email, items: Array<{ proximo, motivo }> }>}
 */
const armarResumenes = ({ alertas, contactos, historial, hoy }) => {
  const activos = contactos.filter(contacto => contacto.activo && normalizeEmail(contacto.email));
  const porClave = new Map();
  for (const envio of historial) {
    const clave = `${claveOrigen(envio.origenTipo, envio.origenCodigo)}|${envio.fechaAviso}|${normalizeEmail(envio.email)}`;
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave).push(envio);
  }

  const resumenes = new Map();
  for (const proximo of alertas) {
    for (const contacto of activos) {
      const email = normalizeEmail(contacto.email);
      const motivo = decideAlert(proximo, porClave.get(`${proximo.id}|${proximo.fecha}|${email}`) || [], hoy);
      if (!motivo) continue;
      if (!resumenes.has(email)) resumenes.set(email, { contacto, email, items: [] });
      resumenes.get(email).items.push({ proximo, motivo });
    }
  }

  const orden = { VENCIDO: 0, HOY: 1, PREVIO: 2 };
  return [...resumenes.values()].map(resumenItem => ({
    ...resumenItem,
    items: resumenItem.items.sort((a, b) => (
      orden[a.motivo] - orden[b.motivo] || a.proximo.fecha.localeCompare(b.proximo.fecha)
    )),
  }));
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatoFecha = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const cuandoTexto = ({ proximo, motivo }) => {
  if (motivo === 'HOY') return 'Es hoy';
  if (motivo === 'VENCIDO') {
    const atraso = Math.abs(proximo.diasRestantes);
    return `Vencido hace ${atraso} ${atraso === 1 ? 'día' : 'días'}`;
  }
  return proximo.diasRestantes === 1 ? 'Mañana' : `En ${proximo.diasRestantes} días`;
};

const tituloEquipo = (proximo) => [proximo.codMetrica, proximo.instrumento, proximo.marca].filter(Boolean).join(' · ');
const tipoTexto = (proximo) => (proximo.tipoSugerido && proximo.tipoSugerido !== 'OTRO'
  ? ETIQUETA_SUGERIDO[proximo.tipoSugerido]
  : `Sugerido por ${ETIQUETA_TIPO[proximo.origen.tipo] || proximo.origen.tipo}`);

/**
 * Correo resumen para un destinatario: un bloque por cliente con sus equipos
 * (los de una misma planta se atienden en la misma visita). La OTST del
 * servicio anterior va como referencia de cada equipo.
 */
const renderizarCorreo = ({ nombre, items, appUrl }) => {
  // El enlace abre la pestaña Próximos servicios de Soporte técnico.
  const destino = enlaceApp(appUrl, '/soporte/proximos');
  const vencidos = items.filter(item => item.motivo === 'VENCIDO').length;
  const proximos = items.length - vencidos;
  const partes = [];
  if (vencidos) partes.push(`${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`);
  if (proximos) partes.push(`${proximos} ${proximos === 1 ? 'próximo' : 'próximos'}`);
  const subject = `Próximos servicios: ${partes.join(' y ')}`;

  // Clientes en el orden de su equipo más urgente.
  const porCliente = new Map();
  for (const item of items) {
    const cliente = item.proximo.cliente;
    if (!porCliente.has(cliente)) porCliente.set(cliente, []);
    porCliente.get(cliente).push(item);
  }
  const equiposTexto = (lista) => `${lista.length} ${lista.length === 1 ? 'equipo' : 'equipos'}`;
  const referencia = (proximo) => (proximo.origen?.otst ? `Servicio anterior: OTST ${proximo.origen.otst}` : null);

  const fila = (item) => {
    const { proximo } = item;
    const urgente = item.motivo !== 'PREVIO';
    const detalle = [tipoTexto(proximo), proximo.planta, referencia(proximo)].filter(Boolean).join(' · ');
    return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e4e4de;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#181816;">${escapeHtml(tituloEquipo(proximo))}</div>
            <div style="font-size:12px;color:#5c5c56;margin-top:2px;">${escapeHtml(detalle)}</div>
          </td>
          <td style="padding:10px 0 10px 16px;border-bottom:1px solid #e4e4de;vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="font-size:13px;font-weight:600;color:${urgente ? '#be1e1e' : '#b45309'};">${escapeHtml(cuandoTexto(item))}</div>
            <div style="font-size:12px;color:#5c5c56;margin-top:2px;">${escapeHtml(formatoFecha(proximo.fecha))}</div>
          </td>
        </tr>`;
  };

  const bloques = [...porCliente.entries()].map(([cliente, lista]) => `
      <tr><td colspan="2" style="padding:18px 0 4px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#5c5c56;">${escapeHtml(cliente)} · ${escapeHtml(equiposTexto(lista))}</td></tr>
      ${lista.map(fila).join('')}`).join('');

  const enlace = destino
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(destino)}" style="display:inline-block;background:#f9e300;color:#161614;font-weight:600;text-decoration:none;padding:10px 16px;border-radius:10px;">Abrir los próximos servicios</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f6f6f3;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4de;border-radius:16px;">
        <tr><td style="height:6px;background:#f9e300;border-radius:16px 16px 0 0;"></td></tr>
        <tr><td style="padding:24px 24px 8px;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;color:#181816;">Hola${nombre ? ` ${escapeHtml(nombre)}` : ''}, hay ${escapeHtml(partes.join(' y '))} en los servicios de soporte técnico</h1>
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bloques}</table>
          ${enlace}
          <p style="margin:24px 0 0;font-size:12px;color:#707069;">Recibes este aviso según la configuración de «Avisos» del apartado Soporte técnico de DataMET+.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Próximos servicios de soporte técnico: ${partes.join(' y ')}`,
    ...[...porCliente.entries()].flatMap(([cliente, lista]) => [
      '',
      `${cliente} (${equiposTexto(lista)})`,
      ...lista.map(item => `- ${tituloEquipo(item.proximo)} (${[tipoTexto(item.proximo), referencia(item.proximo)].filter(Boolean).join(', ')}) — ${cuandoTexto(item)} (${formatoFecha(item.proximo.fecha)})`),
    ]),
    ...(destino ? ['', destino] : []),
  ].join('\n');

  return { subject, html, text };
};

module.exports = {
  ACCIONES,
  ACCIONES_CON_FECHA,
  ETIQUETA_SUGERIDO,
  ETIQUETA_TIPO,
  TIPOS_CON_FECHA,
  aplicarSeguimiento,
  alertasActivas,
  armarResumenes,
  claveOrigen,
  claveSugerido,
  construirEquipos,
  eventosDelAnio,
  normalizeEmail,
  publicarGestion,
  renderizarCorreo,
  resolverSituacion,
  resumen,
  validarGestion,
};
