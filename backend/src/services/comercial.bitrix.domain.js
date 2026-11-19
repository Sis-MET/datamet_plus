/**
 * Reglas de la integración con Bitrix24 sin base de datos ni red: qué campo
 * de la negociación es cuál, en qué fase está cada etapa, cómo se normaliza
 * el código de cotización para enlazar facturas, a quién corresponde cada
 * responsable y qué factura se propone desde una negociación.
 *
 * Los campos propios de Bitrix24 (UF_CRM_…) son de este portal. Se buscan por
 * su código conocido y, si cambiara, por su nombre (docs/comercial-
 * analisis-facturacion.md, §6.1).
 */
const { cotizacionesDe, normalizar } = require('./comercial.importacion');

const CAMPOS = Object.freeze({
  cotizacion: { id: 'UF_CRM_1681094866257', nombres: ['COTIZACION'] },
  cotizacionInstalacion: { id: 'UF_CRM_1751396512077', nombres: ['COTIZACION SERVICIO INTERNO INSTALACION'] },
  cotizacionCalibracion: { id: 'UF_CRM_1751396548628', nombres: ['COTIZACION SERVICIO INTERNO CALIBRACION'] },
  regional: { id: 'UF_CRM_1728315917014', nombres: ['REGIONAL'] },
  ciudad: { id: 'UF_CRM_1727904942900', nombres: ['CIUDAD O LOCALIDAD'] },
  numBalanzas: { id: 'UF_CRM_1727888565077', nombres: ['NUM BALANZAS'] },
  numPesas: { id: 'UF_CRM_1727888601631', nombres: ['NUM PESAS'] },
  subArea: { id: 'UF_CRM_1727813705855', nombres: ['SUB AREA'] },
  tiposServicio: { id: 'UF_CRM_1751393545', nombres: ['TIPO DE SERVICIO ST'] },
  tecnico: { id: 'UF_CRM_1769526208280', nombres: ['TECNICO RESPONSABLE'] },
  apoyo: { id: 'UF_CRM_1727813124836', nombres: ['TECNICOS DE APOYO'] },
  notaSalida: { id: 'UF_CRM_1742335643559', nombres: ['NOTA DE SALIDA'] },
  ordenCompra: { id: 'UF_CRM_1615990613944', nombres: ['ORDEN DE COMPRA'] },
  condiciones: { id: 'UF_CRM_1751388612442', nombres: ['CONDICIONES FACTURACION'] },
  mesFacturar: { id: 'UF_CRM_1727886589660', nombres: ['MES A FACTURAR'] },
  facturado: { id: 'UF_CRM_1751485900193', nombres: ['ESTA FACTURADO?', 'ESTA FACTURADO'] },
});

const CAMPO_CODIGO_EMPRESA = Object.freeze({ id: 'UF_CRM_1551906532214', nombres: ['CODIGO CLIENTE'] });

const etiquetaDe = (campo) => normalizar(campo?.listLabel || campo?.formLabel || campo?.title || '').replace(/^¿/, '');

/** Código de cada campo en este portal: el conocido o, si no está, el que se llama igual. */
const resolverCampos = (campos, definiciones = CAMPOS) => {
  const mapa = {};
  const opciones = {};
  for (const [nombre, def] of Object.entries(definiciones)) {
    let codigo = campos?.[def.id] ? def.id : null;
    if (!codigo) {
      const hallado = Object.entries(campos || {}).find(([clave, campo]) => clave.startsWith('UF_')
        && def.nombres.some(n => etiquetaDe(campo).replace(/[¿?]/g, '').trim() === n.replace(/[¿?]/g, '').trim()));
      codigo = hallado ? hallado[0] : null;
    }
    mapa[nombre] = codigo;
    const items = codigo ? campos[codigo]?.items : null;
    if (Array.isArray(items)) opciones[nombre] = Object.fromEntries(items.map(item => [String(item.ID), item.VALUE]));
  }
  return { mapa, opciones };
};

/** Fase de una etapa para Comercial, por su semántica y su nombre. */
const faseDe = ({ nombre, semantica }) => {
  if (semantica === 'success') return 'GANADA';
  if (semantica === 'failure' || semantica === 'apology') return 'PERDIDA';
  const n = normalizar(nombre);
  if (/PARA FACTURAR|PRE-?FACTURA|ENTREGA Y\/?O FACTURACION|FACTURA Y CIERRE|CON PENDIENTE DE CIERRE/.test(n)) return 'FACTURAR';
  if (/\bFACTURADO\b|PENDIENTE DE PAGO|SALDO PENDIENTE/.test(n)) return 'COBRO';
  return 'PROCESO';
};

/** Semántica de un estado de Bitrix24 (como ServiceMET). */
const semanticaDe = (estado) => {
  const s = String(estado?.SEMANTICS ?? '').toUpperCase();
  if (s === 'S') return 'success';
  if (s === 'F') return 'failure';
  const extra = String(estado?.EXTRA?.SEMANTICS ?? '').toLowerCase();
  return ['success', 'failure', 'apology'].includes(extra) ? extra : 'process';
};

/** «0114-C04-25 1» → «114-C04-25»: sin la revisión ni los ceros del cliente, para enlazar. */
const claveCotizacion = (codigo) => {
  const partes = String(codigo || '').trim().toUpperCase().split(/\s+/)[0].split('-');
  partes[0] = partes[0].replace(/^0+/, '') || '0';
  return partes.join('-');
};

/** Código de cliente de DataMET dentro de una cotización (0114-C04-25 → 0114; 005-0199-1-26 → 0199). */
const clienteDeCotizacion = (codigo) => {
  const c = String(codigo || '').trim().toUpperCase();
  let m = /^(\d{3,4})-[CS]\d+/.exec(c);
  if (m) return m[1].padStart(4, '0');
  m = /^\d{3}-(\d{4})-\d+-\d{2}/.exec(c);
  return m ? m[1] : null;
};

/** Código de cliente desde el «Codigo cliente» de la empresa (0458-11 → 0458). */
const clienteDeEmpresa = (codigo) => {
  const m = /^(\d{1,4})(?:[-\s]|$)/.exec(String(codigo || '').trim());
  return m ? m[1].padStart(4, '0') : null;
};

const REGIONALES = { 'LA PAZ': 'LPZ', 'SANTA CRUZ': 'SCZ' };
const texto = (v, max) => {
  const t = Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).join(' · ') : String(v ?? '').trim();
  return t ? t.slice(0, max) : null;
};
const entero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.round(n) : null;
};
const fechaUtc = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * Fila de COM_BITRIX_NEGOCIACIONES y sus cotizaciones a partir de una
 * negociación de crm.deal.list y los metadatos (embudos, etapas, campos).
 */
const mapNegociacion = (deal, { embudos, etapas, campos }) => {
  const { mapa, opciones } = campos;
  const valor = (nombre) => (mapa[nombre] ? deal[mapa[nombre]] : undefined);
  const opcion = (nombre, v) => {
    const lista = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && x !== '' && x !== false);
    return lista.map(x => opciones[nombre]?.[String(x)] ?? String(x)).filter(x => normalizar(x) !== 'NO APLICA');
  };
  const embudoId = Number(deal.CATEGORY_ID || 0);
  const etapa = etapas.get(String(deal.STAGE_ID)) || { nombre: String(deal.STAGE_ID), semantica: 'process' };
  const empresaId = entero(deal.COMPANY_ID) || null;
  const regional = opcion('regional', valor('regional'))[0];
  const facturado = valor('facturado');

  const cotizaciones = [];
  for (const campo of ['cotizacion', 'cotizacionCalibracion', 'cotizacionInstalacion']) {
    for (const codigo of cotizacionesDe(valor(campo))) {
      const clave = claveCotizacion(codigo);
      if (!cotizaciones.some(c => c.clave === clave)) cotizaciones.push({ codigo, clave, campo });
    }
  }
  // Muchas de Calibración no llenan el campo y escriben la cotización en el
  // título («Calibración 0114-C04-26 1»). Solo si los campos no traen ninguna.
  if (!cotizaciones.length) {
    for (const codigo of cotizacionesDe(deal.TITLE)) {
      const clave = claveCotizacion(codigo);
      if (!cotizaciones.some(c => c.clave === clave)) cotizaciones.push({ codigo, clave, campo: 'titulo' });
    }
  }

  return {
    fila: {
      deal_id: Number(deal.ID),
      embudo_id: embudoId,
      embudo: embudos.get(embudoId) || null,
      etapa_id: String(deal.STAGE_ID).slice(0, 50),
      etapa: etapa.nombre ? String(etapa.nombre).slice(0, 100) : null,
      etapa_fase: faseDe(etapa),
      titulo: texto(deal.TITLE, 255),
      monto: Number.isFinite(Number(deal.OPPORTUNITY)) ? Math.round(Number(deal.OPPORTUNITY) * 100) / 100 : null,
      moneda: texto(deal.CURRENCY_ID, 3),
      responsable_id: entero(deal.ASSIGNED_BY_ID),
      empresa_id: empresaId,
      cotizacion: texto(valor('cotizacion'), 400),
      regional: regional ? REGIONALES[normalizar(regional)] || null : null,
      ciudad: texto(valor('ciudad'), 120),
      num_balanzas: entero(valor('numBalanzas')),
      num_pesas: entero(valor('numPesas')),
      sub_area: texto(opcion('subArea', valor('subArea'))[0], 10),
      tipos_servicio: texto(opcion('tiposServicio', valor('tiposServicio')), 400),
      tecnico: texto(opcion('tecnico', valor('tecnico'))[0], 120),
      apoyo: texto(opcion('apoyo', valor('apoyo')), 400),
      nota_salida: texto(valor('notaSalida'), 200),
      orden_compra: texto(valor('ordenCompra'), 200),
      condiciones: texto(valor('condiciones'), 400),
      mes_facturar: texto(valor('mesFacturar'), 60),
      facturado: facturado === undefined || facturado === null || facturado === '' ? null : ['1', 'Y', 'true', true, 1].includes(facturado),
      creada: fechaUtc(deal.DATE_CREATE),
      modificada: fechaUtc(deal.DATE_MODIFY),
      cierre: deal.CLOSEDATE ? String(deal.CLOSEDATE).slice(0, 10) : null,
    },
    cotizaciones,
  };
};

/**
 * Enlaces negociación ↔ factura. La referencia «Negociación de Bitrix24» de
 * la factura manda; si no, la cotización. Si una cotización está en varias
 * negociaciones, se descartan las perdidas (duplicadas o reemplazadas)
 * mientras quede alguna que no lo esté.
 */
const enlazar = ({ cotizaciones, referencias, fases }) => {
  const porClave = new Map();
  for (const c of cotizaciones) porClave.set(c.clave, [...(porClave.get(c.clave) || []), c.dealId]);
  const enlaces = new Map();
  const poner = (dealId, facturaId, por) => {
    const k = `${dealId}:${facturaId}`;
    if (!enlaces.has(k) || por === 'REFERENCIA') enlaces.set(k, { dealId, facturaId, por });
  };
  for (const ref of referencias) {
    if (ref.tipo === 'BITRIX') {
      const id = Number(ref.valor);
      if (Number.isInteger(id) && id > 0) poner(id, ref.facturaId, 'REFERENCIA');
      continue;
    }
    if (!String(ref.tipo).startsWith('COTIZACION')) continue;
    for (const codigo of cotizacionesDe(ref.valor)) {
      const candidatos = [...new Set(porClave.get(claveCotizacion(codigo)) || [])];
      const vivas = candidatos.filter(id => fases.get(id) !== 'PERDIDA');
      for (const dealId of (vivas.length ? vivas : candidatos)) poner(dealId, ref.facturaId, 'COTIZACION');
    }
  }
  return [...enlaces.values()];
};

/**
 * Persona de DATA_USERS sugerida para cada responsable de Bitrix24: la que
 * figura como responsable en las facturas de sus negociaciones (solo las de
 * un único responsable), si suma al menos 2 y el 60 % de esas facturas.
 */
const sugerirUsuarios = ({ enlaces, responsables, personas }) => {
  const votos = new Map();
  const vistas = new Set();
  for (const { dealId, facturaId } of enlaces) {
    const bitrixId = responsables.get(dealId);
    if (!bitrixId || vistas.has(`${bitrixId}:${facturaId}`)) continue;
    vistas.add(`${bitrixId}:${facturaId}`);
    const lista = (personas.get(facturaId) || []).filter(p => p.rol === 'RESPONSABLE');
    if (lista.length !== 1 || !lista[0].usuarioId) continue;
    const conteo = votos.get(bitrixId) || new Map();
    conteo.set(lista[0].usuarioId, (conteo.get(lista[0].usuarioId) || 0) + 1);
    votos.set(bitrixId, conteo);
  }
  const sugerencias = new Map();
  for (const [bitrixId, conteo] of votos) {
    const total = [...conteo.values()].reduce((a, b) => a + b, 0);
    const [usuarioId, n] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 2 && n / total >= 0.6) sugerencias.set(bitrixId, { usuarioId, motivo: `Responsable en ${n} de ${total} facturas de sus negociaciones` });
  }
  return sugerencias;
};

// Tipo de servicio de Soporte técnico en Bitrix24 → categoría (según la sub área).
const SERVICIOS_ST = {
  DIAGNOSTICO: { STIL: 'ST-STIL-DIAG', STAC: 'ST-STAC-DIAG' },
  'MANT. CORRECTIVO': { STIL: 'ST-STIL-MCR', STAC: 'ST-STIL-MCR' },
  'MANT. PREVENTIVO REGULAR': { STIL: 'ST-STIL-MPR', STAC: 'ST-STAC-MPR' },
  'MANT. PREVENTIVO AVANZADO': { STIL: 'ST-STAC-MPA', STAC: 'ST-STAC-MPA' },
  'AJUSTE METROLOGICO EN LINEALIDAD': { STIL: 'ST-STIL-AJML', STAC: 'ST-STAC-AJML' },
  INSTALACION: { STIL: 'ST-STIL-INST', STAC: 'ST-STAC-INST' },
  'INSTALACION POR VENTA': { STIL: 'VENT-APORTE-INST-ST', STAC: 'VENT-APORTE-INST-ST' },
  'COMPRA DE SERVICIO DE GRUA': { STIL: 'ST-GRUAS', STAC: 'ST-GRUAS' },
  'ALQUILER DE BALANZA O PESAS': { STIL: 'VENT-ALQUILER', STAC: 'VENT-ALQUILER' },
};

/** Líneas que se proponen desde el embudo, la sub área y el tipo de servicio. */
const lineasPropuestas = (neg, categoriasPorCodigo) => {
  const embudo = normalizar(neg.embudo);
  const codigos = [];
  const cantidades = {};
  if (/CALIBRACION|EJECUCION DE CAL/.test(embudo)) {
    codigos.push('CAL-BLZ');
    cantidades['CAL-BLZ'] = neg.num_balanzas;
    if (neg.num_pesas) {
      codigos.push('CAL-PSP');
      cantidades['CAL-PSP'] = neg.num_pesas;
    }
  } else if (/SOPORTE|EJECUCION DE ST/.test(embudo)) {
    const sub = normalizar(neg.sub_area) === 'STAC' ? 'STAC' : 'STIL';
    for (const tipo of String(neg.tipos_servicio || '').split(' · ').map(normalizar).filter(Boolean)) {
      const codigo = SERVICIOS_ST[tipo]?.[sub];
      if (codigo && !codigos.includes(codigo)) codigos.push(codigo);
    }
    if (codigos[0]) cantidades[codigos[0]] = neg.num_balanzas;
  }
  const lineas = codigos.map(codigo => categoriasPorCodigo.get(codigo)).filter(Boolean).map(categoria => ({
    categoriaId: categoria.id,
    categoria: categoria.nombre,
    monto: null,
    cantidad: cantidades[categoria.codigo] ?? null,
    regional: neg.regional || null,
  }));
  if (lineas.length === 1 && neg.monto > 0) lineas[0].monto = neg.monto;
  return lineas;
};

/**
 * Propuesta de factura desde una negociación: cliente, monto, referencias,
 * personas y líneas, con avisos de lo que falta revisar. La pantalla la usa
 * para llenar «Nueva factura»; nada se registra sin confirmarlo.
 */
const propuestaFactura = (neg, { cliente, categoriasPorCodigo, responsable, buscarPersona, facturas = [] }) => {
  const referencias = [];
  const cotizaciones = neg.cotizaciones || [];
  for (const c of cotizaciones) {
    referencias.push({ tipo: c.campo === 'cotizacionCalibracion' ? 'COTIZACION_CAL' : 'COTIZACION', valor: c.codigo });
  }
  for (const ns of String(neg.nota_salida || '').toUpperCase().match(/NS-\d{3,5}-\d{4}/g) || []) {
    if (!referencias.some(r => r.valor === ns)) referencias.push({ tipo: 'NOTA_SALIDA', valor: ns });
  }
  referencias.push({ tipo: 'BITRIX', valor: String(neg.deal_id) });

  const personas = [];
  if (responsable?.usuarioId) personas.push({ rol: 'RESPONSABLE', usuarioId: responsable.usuarioId, nombre: responsable.nombre, porcentaje: null });
  const st = /SOPORTE|EJECUCION DE ST/.test(normalizar(neg.embudo));
  if (st && neg.tecnico) {
    const p = buscarPersona(neg.tecnico);
    personas.push({ rol: 'EJECUTO_ST', usuarioId: p?.id ?? null, nombre: p?.nombre || neg.tecnico, porcentaje: null });
  }
  if (st && neg.apoyo) {
    for (const nombre of neg.apoyo.split(' · ')) {
      const p = buscarPersona(nombre);
      const final = p?.nombre || nombre;
      if (!personas.some(x => x.rol === 'APOYO_ST' && x.nombre === final)) personas.push({ rol: 'APOYO_ST', usuarioId: p?.id ?? null, nombre: final, porcentaje: null });
    }
  }

  const lineas = lineasPropuestas(neg, categoriasPorCodigo);
  // Con su código, la pantalla quita el aviso cuando ya se resolvió en el formulario.
  const avisos = [];
  const avisar = (codigo, texto) => avisos.push({ codigo, texto });
  for (const f of facturas) avisar('facturada', `Ya tiene la factura N.º ${f.numero} de ${f.gestion}.`);
  if (!cliente) avisar('cliente', 'No se encontró el cliente en DataMET: elígelo antes de registrar.');
  if (!responsable?.usuarioId) avisar('responsable', 'El responsable de Bitrix24 todavía no tiene su persona en DataMET (pestaña Bitrix24 › Responsables).');
  if (lineas.length > 1) avisar('repartir', 'Reparte el monto de la negociación entre las líneas.');
  if (!lineas.length) avisar('categorias', 'Elige las categorías: la negociación no dice qué se factura.');

  return {
    dealId: neg.deal_id,
    cliente: cliente ? { codigo: cliente.codigo, razonSocial: cliente.razonSocial, nit: cliente.nit } : null,
    razonSocial: cliente?.razonSocial || neg.empresa || '',
    nit: cliente?.nit || neg.empresa_nit || '',
    monto: neg.monto,
    lineas,
    referencias,
    personas,
    avisos,
  };
};

module.exports = {
  CAMPOS,
  CAMPO_CODIGO_EMPRESA,
  SERVICIOS_ST,
  claveCotizacion,
  clienteDeCotizacion,
  clienteDeEmpresa,
  enlazar,
  faseDe,
  lineasPropuestas,
  mapNegociacion,
  propuestaFactura,
  resolverCampos,
  semanticaDe,
  sugerirUsuarios,
};
