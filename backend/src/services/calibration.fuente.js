/**
 * Servicios de calibración que sube ServiceMET (fase 2 de los certificados de
 * calibración de balanzas).
 *
 * DATA_SERVICIOS_DATOS_CALIBRACION trae una fila ancha (~425 columnas) por
 * balanza. Aquí se convierte en un modelo estructurado, sin los límites del
 * libro de Excel (hasta 60 puntos, 6 posiciones, 3 rangos), y se anotan los
 * problemas de calidad de los datos. La fila original no se toca: es la
 * observación original (NB/ISO/IEC 17025, 7.5).
 *
 * Funciones puras: lo que hace falta de la base (usuarios y patrones del
 * gestor de equipos) llega en `contexto`.
 */

const REEMPLAZO = '\uFFFD';

// ─── Textos ────────────────────────────────────────────────────────────────

/** Texto sin espacios de más; '' → null. */
const texto = (valor) => {
  if (valor == null) return null;
  const limpio = String(valor).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio || null;
};

/** Texto comparable: sin tildes, en mayúsculas. Conserva el carácter de reemplazo (U+FFFD). */
const clave = (valor) => (texto(valor) || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** El carácter de reemplazo (U+FFFD) vale por una letra cualquiera (la que se perdió al subir el dato). */
const coincide = (danado, correcto) => {
  if (danado === correcto) return true;
  if (!danado.includes(REEMPLAZO)) return false;
  const patron = escaparRegex(danado).replace(new RegExp(REEMPLAZO, 'g'), '.');
  return new RegExp(`^${patron}$`).test(correcto);
};

const tieneDanos = (valor) => typeof valor === 'string' && valor.includes(REEMPLAZO);

/**
 * Valor de un diccionario a partir del texto libre de ServiceMET.
 * Devuelve { codigo, reparado } o { codigo: null, original } si no lo reconoce.
 */
const segun = (valor, diccionario) => {
  const buscado = clave(valor);
  if (!buscado) return { codigo: null, original: null };
  for (const [codigo, variantes] of Object.entries(diccionario)) {
    for (const variante of variantes) {
      const conocida = clave(variante);
      if (coincide(buscado, conocida)) return { codigo, reparado: buscado !== conocida };
    }
  }
  return { codigo: null, original: texto(valor) };
};

// Diccionarios de los textos libres que hoy envía ServiceMET.
const SI_NO = { SI: ['Sí'], NO: ['No'] };
const EMP = { SI: ['Sí', 'NB 23001'], NO: ['No'] };
const REGLA = { NINGUNA: ['Ninguna'], SIMPLE: ['Simple'], CONSERVADORA: ['Conservadora', 'Conservada'] };
const METODO = {
  EVALUANDO_CEROS: ['Ascenso evaluando ceros', 'Ascenso evaluando a ceros'],
  CONTINUO: ['Ascenso continuo por pasos', 'Ascenso continúo por pasos', 'Ascenso contínuo por pasos'],
  SIN_METODO: ['Sin metodo de carga', 'Sin método'],
};
const METODO_CARGA = {
  NINGUNO: ['Sin método de carga', 'Sin método', 'Método 0'],
  METODO_1: ['Método 1'],
  METODO_2: ['Método 2'],
};
const TIPO_AJUSTE = { EXTERNO: ['Externo'], INTERNO: ['Interno'], NO_APLICA: ['No aplica'] };
const PLATAFORMA = { RECTANGULAR: ['Rectangular'], CIRCULAR: ['Circular'], CUADRADA: ['Cuadrada'], TRIANGULAR: ['Triangular'] };
const DEPARTAMENTO = {
  'LA PAZ': ['La Paz'], 'SANTA CRUZ': ['Santa Cruz'], COCHABAMBA: ['Cochabamba'], 'POTOSÍ': ['Potosí'],
  ORURO: ['Oruro'], TARIJA: ['Tarija'], BENI: ['Beni'], PANDO: ['Pando'], CHUQUISACA: ['Chuquisaca'],
};
const UNIDADES = ['mg', 'g', 'kg', 't'];
const CLASES_PESAS = ['E1', 'E2', 'F1', 'F2', 'M1', 'M1-2', 'M2', 'M2-3', 'M3'];

// Condiciones del lugar que revisa el técnico (columna, etiqueta).
const INSPECCION = [
  ['vibracion', 'Vibración'], ['polvo', 'Polvo'], ['temp', 'Temperatura'], ['humedad', 'Humedad'],
  ['mesada', 'Mesada o base'], ['iluminacion', 'Iluminación'], ['limp_foza', 'Limpieza de la fosa'],
  ['estado_drenaje', 'Drenaje'], ['limp_general', 'Limpieza general'], ['golpes_terminal', 'Golpes en el terminal'],
  ['nivelacion', 'Nivelación'], ['limp_recepto', 'Limpieza del receptor'], ['golpes_receptor', 'Golpes en el receptor'],
  ['encendido', 'Encendido'],
];

// Cuántos de cada bloque guarda la tabla de ServiceMET.
const LIMITES = { rangos: 3, precargas: 6, posiciones: 6, repetibilidades: 3, lecturas: 10, puntos: 60, juegos: 5, ambiente: [6, 7] };

// ─── Números, fechas y horas ───────────────────────────────────────────────

/** Número o null; acepta coma decimal en los textos. */
const numero = (valor) => {
  if (valor == null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const fecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  const match = String(valor).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const hora = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return `${String(valor.getUTCHours()).padStart(2, '0')}:${String(valor.getUTCMinutes()).padStart(2, '0')}`;
  }
  const match = String(valor).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

// ─── Identificación del servicio ───────────────────────────────────────────

// Formatos que ha tenido el SECA en ServiceMET.
const FORMATOS_SECA = [
  { patron: /^(\d{4})-(\d{2})-C(\d{2})-(\d{2})$/, campos: ['cliente', 'planta', 'numero', 'anio'] }, // 0090-11-C08-26
  { patron: /^(\d{2})-(\d{4})-(\d{2})-C(\d{2})$/, campos: ['anio', 'cliente', 'planta', 'numero'] }, // 25-0095-32-C08
  { patron: /^(\d{4})-C(\d{2})-(\d{2})$/, campos: ['cliente', 'numero', 'anio'] }, //                 3001-C01-25
];

/**
 * SECA de ServiceMET → negociación y SECA del libro, que son los que van al
 * número de certificado (reglas de la fase 0: «0051-C01», «0051-C01-26»).
 */
const leerSeca = (valor) => {
  const original = texto(valor);
  if (!original) return null;
  for (const { patron, campos } of FORMATOS_SECA) {
    const match = original.toUpperCase().match(patron);
    if (!match) continue;
    const partes = Object.fromEntries(campos.map((campo, i) => [campo, match[i + 1]]));
    const negociacion = `${partes.cliente}-C${partes.numero}`;
    return {
      original,
      cliente: partes.cliente,
      planta: partes.planta || null,
      negociacion,
      anio: partes.anio,
      libro: `${negociacion}-${partes.anio}`,
    };
  }
  return { original, cliente: null, planta: null, negociacion: null, anio: null, libro: null };
};

/**
 * Código Métrica con su forma de ServiceMET: cliente con 4 dígitos, planta
 * con 2 e instrumento con 3 («174-31-3» → «0174-31-003»). null si no lo es.
 */
const normalizarCodigo = (valor) => {
  const match = (texto(valor) || '').match(/^(\d{1,4})-(\d{1,2})-(\d{1,3})$/);
  return match ? `${match[1].padStart(4, '0')}-${match[2].padStart(2, '0')}-${match[3].padStart(3, '0')}` : null;
};

/** N.º de RECA: el número y su forma con dos dígitos («5» → «05»). */
const leerReca = (valor) => {
  const original = texto(valor);
  if (!original) return null;
  const valido = /^\d{1,4}$/.test(original);
  return { original, numero: valido ? Number(original) : null, texto: valido ? String(Number(original)).padStart(2, '0') : null };
};

// ─── Técnico ───────────────────────────────────────────────────────────────

const GENERICOS = new Set(['USUARIO', 'USUARIO SIN DATOS', 'CARGANDO...', 'CARGANDO', 'SIN DATOS']);
const TITULOS = new Set(['ING', 'LIC', 'TEC', 'TS', 'PAS', 'SR', 'SRA', 'ARQ', 'DR', 'DRA', 'MSC', 'PHD']);

const palabras = (valor) => clave(valor).replace(/[.,;:]/g, ' ').split(' ')
  .filter(palabra => palabra.length > 1 && !TITULOS.has(palabra));

/** Distancia de edición (para «Glavez» por «Galvez»). */
const distancia = (a, b) => {
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previa[0];
    previa[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const actual = previa[j];
      previa[j] = Math.min(previa[j] + 1, previa[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (a[i - 1] === b[j - 1] && i > 1 && j > 1 && a[i - 2] === b[j - 1] && a[i - 1] === b[j - 2]) {
        previa[j] = Math.min(previa[j], diagonal);
      }
      diagonal = actual;
    }
  }
  return previa[b.length];
};

/** 'exacta' | 'aproximada' | null */
const compararPalabra = (escrita, correcta) => {
  if (coincide(escrita, correcta)) return 'exacta';
  // Transposición o una letra de más o de menos, en nombres de 5 letras o más.
  if (correcta.length >= 5 && distancia(escrita.replace(new RegExp(REEMPLAZO, 'g'), '?'), correcta) <= 2
    && Math.abs(escrita.length - correcta.length) <= 1) return 'aproximada';
  return null;
};

/**
 * Técnico que hizo el servicio, a partir del nombre escrito en ServiceMET
 * («Ing. Jorge Ortuño R.», «JORGE ORTUNO», «T.S. Antonio Glavez»).
 */
const identificarTecnico = (valor, usuarios = []) => {
  const original = texto(valor);
  if (!original || GENERICOS.has(clave(original))) return { original, usuario: null, motivo: 'GENERICO' };
  const escritas = palabras(original);
  const candidatos = [];
  for (const usuario of usuarios) {
    const requeridas = [...palabras(usuario.nombre1), ...palabras(usuario.apellido1)];
    if (requeridas.length < 2) continue;
    let aproximada = false;
    const todas = requeridas.every((requerida) => {
      const resultados = escritas.map(escrita => compararPalabra(escrita, requerida)).filter(Boolean);
      if (resultados.includes('exacta')) return true;
      if (resultados.includes('aproximada')) {
        aproximada = true;
        return true;
      }
      return false;
    });
    if (todas) candidatos.push({ usuario, aproximada });
  }
  if (candidatos.length !== 1) return { original, usuario: null, motivo: candidatos.length ? 'AMBIGUO' : 'DESCONOCIDO' };
  const [{ usuario, aproximada }] = candidatos;
  return {
    original,
    usuario: usuario.usuario,
    iniciales: texto(usuario.inicial),
    nombre: [usuario.nombre1, usuario.apellido1, usuario.apellido2].map(texto).filter(Boolean).join(' '),
    aproximada,
  };
};

// ─── Patrones ──────────────────────────────────────────────────────────────

/** «E2-104 (g)» → «E2-104»; el sufijo dice qué parte del juego se usó. */
const codigoPatron = (valor) => {
  const original = texto(valor);
  if (!original) return null;
  const match = original.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return { original, codigo: clave(match ? match[1] : original), parte: match ? texto(match[2]) : null };
};

/**
 * Certificado del patrón que regía en la fecha del servicio, con el estado de
 * sus valores (fase 1). `certificados`: [{ id, numero, fecha, vence, anulado,
 * revisadoPor, transcrito }].
 */
const certificadoEn = (certificados = [], dia) => certificados
  .filter(cert => !cert.anulado && cert.fecha && cert.fecha <= dia && (!cert.vence || cert.vence >= dia))
  .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : b.fecha.localeCompare(a.fecha)))[0] || null;

// ─── Avisos ────────────────────────────────────────────────────────────────

// nivel: 'error' impide calcular; 'aviso' se debe revisar; 'info' se corrigió
// solo o es una nota.
const crearAvisos = () => {
  const lista = [];
  const agregar = (nivel, seccion, codigo, mensaje) => lista.push({ nivel, seccion, codigo, mensaje });
  return { lista, error: (...a) => agregar('error', ...a), aviso: (...a) => agregar('aviso', ...a), info: (...a) => agregar('info', ...a) };
};

const reparar = (avisos, seccion, campo, resultado) => {
  if (resultado.reparado) avisos.info(seccion, 'TEXTO_REPARADO', `${campo}: se reconoció un texto con caracteres dañados.`);
  if (resultado.codigo == null && resultado.original) {
    avisos.aviso(seccion, 'VALOR_DESCONOCIDO', `${campo}: «${resultado.original}» no es un valor conocido.`);
  }
  return resultado.codigo;
};

// ─── Bloques ───────────────────────────────────────────────────────────────

const decimalesDe = (valor) => {
  const [, parte = ''] = String(valor).split('.');
  return parte.replace(/0+$/, '').length;
};

const leerRangos = (fila, avisos) => {
  const rangos = [];
  for (let i = 1; i <= LIMITES.rangos; i += 1) {
    const max = numero(fila[`cap_max${i}`]);
    if (!max || max <= 0) continue;
    const rango = {
      columna: i,
      max,
      d: numero(fila[`d${i}`]),
      e: numero(fila[`e${i}`]),
      decimales: numero(fila[`dec${i}`]),
    };
    if (!(rango.d > 0)) avisos.error('instrumento', 'RANGO_SIN_D', `Rango ${i}: falta la división d.`);
    if (rango.e != null && rango.e > 0 && rango.d > 0 && rango.e < rango.d) {
      avisos.aviso('instrumento', 'E_MENOR_QUE_D', `Rango ${i}: e (${rango.e}) es menor que d (${rango.d}).`);
    }
    if (rango.d > 0 && rango.decimales != null && decimalesDe(rango.d) > rango.decimales) {
      avisos.aviso('instrumento', 'DECIMALES', `Rango ${i}: d = ${rango.d} tiene más decimales que los declarados (${rango.decimales}).`);
    }
    rangos.push(rango);
  }
  if (!rangos.length) avisos.error('instrumento', 'SIN_RANGOS', 'No hay capacidad máxima (cap_max1).');
  // ServiceMET pone primero el rango mayor (Max total); el modelo los ordena de
  // menor a mayor, como la OIML R76 y EURAMET (Max1 < Max2, d1 < d2).
  rangos.sort((a, b) => a.max - b.max);
  for (let i = 1; i < rangos.length; i += 1) {
    const [menor, mayor] = [rangos[i - 1], rangos[i]];
    if (menor.max === mayor.max) {
      avisos.aviso('instrumento', 'RANGOS_IGUALES', `Dos rangos con la misma capacidad máxima (${mayor.max}).`);
    } else if (menor.d > 0 && mayor.d > 0 && menor.d > mayor.d) {
      avisos.aviso('instrumento', 'RANGOS_INCOHERENTES', `El rango de ${menor.max} tiene d = ${menor.d}, mayor que el de ${mayor.max} (d = ${mayor.d}).`);
    }
  }
  return rangos;
};

const leerPatrones = (fila, dia, contexto, avisos) => {
  const juegos = [];
  const ambiente = [];
  for (let i = 1; i <= LIMITES.ambiente[1]; i += 1) {
    const codigo = codigoPatron(fila[`equipo${i}`]);
    if (!codigo) continue;
    const esAmbiente = LIMITES.ambiente.includes(i);
    const seccion = esAmbiente ? 'ambiente' : 'patrones';
    const patron = {
      posicion: i,
      original: codigo.original,
      codigo: codigo.codigo,
      parte: codigo.parte,
      // ServiceMET guarda en certificadoN la fecha de emisión, no el número.
      fechaCertificado: fecha(fila[`certificado${i}`]),
      ente: texto(fila[`ente_calibrador${i}`]),
      estadoEnApp: texto(fila[`estado${i}`]),
      cantidad: numero(fila[`cantidad${i}`]),
      equipoId: null,
      estado: 'NO_EXISTE',
      certificado: null,
      valores: null,
    };
    if (codigo.parte) avisos.info(seccion, 'PATRON_CON_PARTE', `${codigo.original}: se usa ${codigo.codigo} (parte «${codigo.parte}»).`);

    const equipo = contexto.patrones?.get(codigo.codigo);
    if (!equipo) {
      avisos.aviso(seccion, 'PATRON_NO_EXISTE', `${codigo.original} no está en el gestor de equipos de DataMET+.`);
    } else {
      patron.equipoId = equipo.id;
      const cert = dia ? certificadoEn(equipo.certificados, dia) : null;
      if (!cert) {
        patron.estado = 'SIN_CERTIFICADO';
        avisos.aviso(seccion, 'PATRON_SIN_CERTIFICADO', `${codigo.codigo} no tenía certificado vigente el ${dia || 'día del servicio'}.`);
      } else {
        patron.estado = 'VIGENTE';
        patron.certificado = { id: cert.id, numero: cert.numero, fecha: cert.fecha, vence: cert.vence };
        patron.valores = !cert.transcrito ? 'SIN_VALORES' : cert.revisadoPor ? 'VERIFICADOS' : 'SIN_VERIFICAR';
        if (patron.valores === 'SIN_VALORES') {
          avisos.aviso(seccion, 'PATRON_SIN_VALORES', `${codigo.codigo}: faltan los valores de su certificado${cert.numero ? ` ${cert.numero}` : ''} en «Piezas y valores».`);
        } else if (patron.valores === 'SIN_VERIFICAR') {
          avisos.aviso(seccion, 'PATRON_SIN_VERIFICAR', `${codigo.codigo}: los valores de su certificado aún no están verificados.`);
        }
        if (patron.fechaCertificado && patron.fechaCertificado !== cert.fecha) {
          avisos.info(seccion, 'PATRON_FECHA_DISTINTA',
            `${codigo.codigo}: ServiceMET indica un certificado del ${patron.fechaCertificado}; en DataMET+ regía el del ${cert.fecha}.`);
        }
      }
      if (equipo.estado && equipo.estado !== 'ACTIVO') {
        avisos.aviso(seccion, 'PATRON_DADO_DE_BAJA', `${codigo.codigo} está dado de baja en el gestor de equipos.`);
      }
    }
    (esAmbiente ? ambiente : juegos).push(patron);
  }
  if (!juegos.length) avisos.error('patrones', 'SIN_PESAS', 'No se indicó ningún juego de pesas patrón.');
  if (!ambiente.length) avisos.aviso('ambiente', 'SIN_TERMOHIGROMETRO', 'No se indicó el termohigrómetro.');
  return { juegos, ambiente };
};

const RANGOS_AMBIENTE = [
  ['t', 'temperatura', -10, 50, '°C'],
  ['hr', 'humedad relativa', 0, 100, '%'],
  ['p', 'presión', 300, 1200, 'hPa'],
];

const leerAmbiente = (fila, avisos) => {
  const momento = (sufijo, nombre) => {
    const lectura = {
      hora: hora(fila[`hora${sufijo}`]),
      t: numero(fila[`ti${sufijo}`]),
      hr: numero(fila[`hri${sufijo}`]),
      p: numero(fila[`patmi${sufijo}`]),
    };
    for (const [campo, etiqueta, min, max, unidad] of RANGOS_AMBIENTE) {
      const valor = lectura[campo];
      if (valor == null) avisos.aviso('ambiente', 'AMBIENTE_FALTA', `Falta la ${etiqueta} ${nombre}.`);
      else if (valor < min || valor > max) {
        avisos.aviso('ambiente', 'AMBIENTE_FUERA_DE_RANGO', `La ${etiqueta} ${nombre} (${valor} ${unidad}) está fuera de ${min} a ${max} ${unidad}.`);
      }
    }
    return lectura;
  };
  return { inicio: momento('', 'al inicio'), fin: momento('_fin', 'al final') };
};

const leerPrecargas = (fila) => {
  const precargas = [];
  for (let i = 1; i <= LIMITES.precargas; i += 1) {
    const carga = numero(fila[`precarga${i}`]);
    const indicacion = numero(fila[`p_indicador${i}`]);
    if (!carga && !indicacion) continue;
    precargas.push({ carga, indicacion });
  }
  return precargas;
};

const leerAjuste = (fila, avisos) => {
  const realizado = reparar(avisos, 'ajuste', 'Ajuste', segun(fila.ajuste, SI_NO));
  const tipo = reparar(avisos, 'ajuste', 'Tipo de ajuste', segun(fila.tipo, TIPO_AJUSTE));
  const pesasTexto = texto(fila.cargas_pesas);
  let pesas = null;
  if (pesasTexto && clave(pesasTexto) !== 'NO APLICA') {
    const match = pesasTexto.match(/^([\d.,]+)\s*(mg|g|kg)?\s*\/?\s*(E1|E2|F1|F2|M1|M2|M3)?$/i);
    pesas = match
      ? { original: pesasTexto, valor: numero(match[1]), unidad: match[2]?.toLowerCase() || null, clase: match[3]?.toUpperCase() || null }
      : { original: pesasTexto, valor: null, unidad: null, clase: null };
  }
  if (realizado === 'SI' && tipo === 'EXTERNO' && !pesas) {
    avisos.aviso('ajuste', 'AJUSTE_SIN_PESAS', 'Ajuste externo sin las pesas usadas.');
  }
  return { realizado: realizado == null ? null : realizado === 'SI', tipo, pesas };
};

const mediana = (valores) => {
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
};

const leerExcentricidad = (fila, rangos, avisos) => {
  const plataforma = reparar(avisos, 'excentricidad', 'Plataforma', segun(fila.tipo_plataforma, PLATAFORMA));
  const indicadorTexto = texto(fila.puntos_ind);
  const posicionesDeclaradas = numero((indicadorTexto || '').match(/(\d+)/)?.[1]);
  const posiciones = [];
  for (let i = 1; i <= LIMITES.posiciones; i += 1) {
    const indicacion = numero(fila[`indicacion${i}`]);
    if (indicacion == null) continue;
    posiciones.push({ posicion: numero(fila[`posicion${i}`]) ?? i, indicacion, retorno: numero(fila[`retorno${i}`]) });
  }
  const carga = numero(fila.carga);
  if (!posiciones.length) {
    avisos.error('excentricidad', 'SIN_EXCENTRICIDAD', 'No hay lecturas de excentricidad.');
  } else {
    if (posicionesDeclaradas && posiciones.length !== posicionesDeclaradas) {
      avisos.aviso('excentricidad', 'POSICIONES_DISTINTAS', `Se indicó «${indicadorTexto}» pero hay ${posiciones.length} lecturas.`);
    }
    // La columna «carga» es entera: si la carga tenía decimales, se perdieron.
    const d = Math.max(0, ...rangos.map(r => r.d || 0));
    const centro = mediana(posiciones.map(p => p.indicacion));
    if (carga != null && Math.abs(centro - carga) > Math.max(20 * d, 0.01 * Math.abs(centro))) {
      avisos.aviso('excentricidad', 'CARGA_EXCENTRICIDAD', `La carga de excentricidad (${carga}) no coincide con sus indicaciones (≈ ${centro}): ServiceMET la guarda sin decimales.`);
    }
  }
  return {
    plataforma,
    indicador: indicadorTexto,
    posicionesDeclaradas,
    carga,
    posiciones,
    comentario: texto(fila.excentricidad_comentario),
  };
};

const leerRepetibilidad = (fila, avisos) => {
  const ensayos = [];
  for (let k = 1; k <= LIMITES.repetibilidades; k += 1) {
    const carga = numero(fila[`repetibilidad${k}`]);
    const lecturas = [];
    for (let j = 1; j <= LIMITES.lecturas; j += 1) {
      const indicacion = numero(fila[`indicacion${k}_${j}`]);
      if (indicacion == null) continue;
      lecturas.push({ indicacion, retorno: numero(fila[`retorno${k}_${j}`]) });
    }
    if (!carga && !lecturas.length) continue;
    if (lecturas.length < 2) {
      avisos.aviso('repetibilidad', 'POCAS_LECTURAS', `Repetibilidad con ${carga ?? '¿?'}: ${lecturas.length} lectura(s).`);
    }
    ensayos.push({ carga, lecturas });
  }
  if (!ensayos.length) avisos.error('repetibilidad', 'SIN_REPETIBILIDAD', 'No hay ensayo de repetibilidad.');
  return { ensayos, comentario: texto(fila.repetibilidad_comentario) };
};

/** metodo_carga: método de sustitución, o los marcadores de la validación de pesas. */
const leerMetodoCarga = (valor, avisos) => {
  const original = texto(valor);
  if (!original) return { metodo: null, cargasValidadas: null, validacion: null };
  const validadas = original.match(/^cargas_validadas:(\d+)$/i);
  if (validadas) return { metodo: 'NINGUNO', cargasValidadas: Number(validadas[1]), validacion: 'VALIDADAS' };
  if (/^validacion_pesas_pendiente$/i.test(original)) {
    avisos.aviso('errores', 'VALIDACION_PENDIENTE', 'ServiceMET marcó la validación de las cargas como pendiente.');
    return { metodo: 'NINGUNO', cargasValidadas: null, validacion: 'PENDIENTE' };
  }
  return { metodo: reparar(avisos, 'errores', 'Método de carga', segun(original, METODO_CARGA)), cargasValidadas: null, validacion: null };
};

const leerErrores = (fila, rangos, avisos) => {
  const metodo = reparar(avisos, 'errores', 'Método', segun(fila.metodo, METODO));
  const carga = leerMetodoCarga(fila.metodo_carga, avisos);
  const puntos = [];
  for (let i = 1; i <= LIMITES.puntos; i += 1) {
    const cargaPunto = numero(fila[`lin${i}`]);
    const indicacion = numero(fila[`ind${i}`]);
    // Relleno de ServiceMET: carga e indicación en cero o vacías.
    if (!cargaPunto && !indicacion) continue;
    puntos.push({ n: i, carga: cargaPunto, indicacion, retorno: numero(fila[`retorno_lin${i}`]) });
  }
  const sinIndicacion = puntos.filter(p => p.indicacion == null);
  if (sinIndicacion.length) {
    avisos.aviso('errores', 'PUNTO_SIN_INDICACION',
      `${sinIndicacion.length === 1 ? 'El punto' : 'Los puntos'} ${sinIndicacion.map(p => `${p.n} (${p.carga})`).join(', ')} no ${sinIndicacion.length === 1 ? 'tiene' : 'tienen'} indicación`
      + `${carga.metodo === 'METODO_1' || carga.metodo === 'METODO_2' ? ' (puede ser una carga de sustitución)' : ''}.`);
  }
  const conIndicacion = puntos.filter(p => p.indicacion != null);
  if (conIndicacion.length < 2) avisos.error('errores', 'SIN_ERRORES', 'Faltan puntos del ensayo de error de indicación.');
  const max = Math.max(0, ...rangos.map(r => r.max));
  const pasados = puntos.filter(p => max > 0 && p.carga > max * 1.0001);
  if (pasados.length) {
    avisos.aviso('errores', 'CARGA_MAYOR_QUE_MAX', `Cargas mayores que Max (${max}): ${pasados.map(p => p.carga).join(', ')}.`);
  }
  return {
    metodo,
    metodoCarga: carga.metodo,
    cargasValidadas: carga.cargasValidadas,
    validacionPesas: carga.validacion,
    puntos,
    comentario: texto(fila.linealidad_comentario),
  };
};

// ─── Modelo ────────────────────────────────────────────────────────────────

/**
 * Fila de DATA_SERVICIOS_DATOS_CALIBRACION → { modelo, avisos }.
 * contexto: { usuarios: [DATA_USERS sin contraseña], patrones: Map(código → { id, codigo, estado, certificados }) }.
 */
const modeloDeFila = (fila, contexto = {}) => {
  const avisos = crearAvisos();
  const dia = fecha(fila.fecha_servicio);
  if (!dia) avisos.error('servicio', 'SIN_FECHA', 'Falta la fecha del servicio.');

  const seca = leerSeca(fila.seca);
  if (!seca) avisos.error('servicio', 'SIN_SECA', 'Falta el SECA.');
  else if (!seca.negociacion) avisos.aviso('servicio', 'SECA_DESCONOCIDO', `El SECA «${seca.original}» no tiene un formato conocido.`);
  const reca = leerReca(fila.n_reca);
  if (!reca) avisos.error('servicio', 'SIN_RECA', 'Falta el n.º de RECA.');
  else if (reca.numero == null) avisos.aviso('servicio', 'RECA_INVALIDO', `El n.º de RECA «${reca.original}» no es un número.`);

  const tecnico = identificarTecnico(fila.personal, contexto.usuarios);
  if (!tecnico.usuario) {
    avisos.aviso('servicio', 'TECNICO_SIN_IDENTIFICAR', tecnico.motivo === 'GENERICO'
      ? `ServiceMET no identificó al técnico («${tecnico.original || 'vacío'}»).`
      : `No se reconoce al técnico «${tecnico.original}»${tecnico.motivo === 'AMBIGUO' ? ' (coincide con varios usuarios)' : ''}.`);
  } else if (tecnico.aproximada) {
    avisos.info('servicio', 'TECNICO_APROXIMADO', `«${tecnico.original}» se reconoció como ${tecnico.nombre}.`);
  }

  const codMetrica = texto(fila.cod_metrica);
  if (codMetrica && /^\d{4}-\d{2}-\d{9,}$/.test(codMetrica)) {
    avisos.aviso('instrumento', 'CODIGO_PROVISIONAL', `El código Métrica ${codMetrica} es provisional (lo generó el teléfono).`);
  }
  const tipoServicio = texto(fila.tipo_servicio);
  if (!tipoServicio) avisos.info('servicio', 'SIN_TIPO_SERVICIO', 'ServiceMET no indicó el tipo de servicio (CAL.B o CAL.BL).');

  const unidad = UNIDADES.includes(texto(fila.unidades)) ? texto(fila.unidades) : null;
  if (!unidad) avisos.error('instrumento', 'SIN_UNIDAD', `Unidad «${texto(fila.unidades) || 'vacía'}» no reconocida.`);
  const rangos = leerRangos(fila, avisos);
  const departamento = segun(fila.dep_planta, DEPARTAMENTO);

  for (const campo of ['personal', 'ubicacion', 'observaciones', 'planta', 'cliente', 'razon_social']) {
    if (tieneDanos(fila[campo])) {
      avisos.info('servicio', 'TEXTO_DANADO', `«${campo}» trae caracteres dañados: ${texto(fila[campo])}.`);
    }
  }

  const modelo = {
    servicio: {
      codigo: texto(fila.codigo_registro),
      tipo: tipoServicio,
      seca,
      reca,
      sticker: texto(fila.sticker),
      fecha: dia,
      horaInicio: hora(fila.hora_inicio) || hora(fila.hora),
      horaFin: hora(fila.hora_fin),
      tecnico,
      categoria: texto(fila.categoria_balanza)?.toUpperCase() || null,
      sesion: texto(fila.session_id),
      estado: texto(fila.estado_servicio_bal),
    },
    cliente: {
      nombre: texto(fila.cliente),
      razonSocial: texto(fila.razon_social),
      planta: texto(fila.planta),
      codigoPlanta: texto(fila.cod_planta),
      direccion: texto(fila.dir_planta),
      departamento: departamento.codigo || texto(fila.dep_planta),
    },
    instrumento: {
      tipo: texto(fila.tipo_equipo),
      marca: texto(fila.marca),
      modelo: texto(fila.modelo),
      serie: texto(fila.serie),
      codigoInterno: texto(fila.cod_int),
      codigoMetrica: codMetrica,
      ubicacion: texto(fila.ubicacion),
      unidad,
      rangos,
      multirango: rangos.length > 1,
      // ServiceMET no envía la clase: se usa la que pida el cliente (decisión 4).
      clase: { valor: null, origen: 'NO_DECLARADA' },
      celdas: numero(fila.n_celdas),
    },
    patrones: leerPatrones(fila, dia, contexto, avisos),
    lugar: {
      estabilizacionPesas: texto(fila.tiempo_estab),
      operacionBalanza: texto(fila.t_ope_balanza),
      inspeccion: INSPECCION.map(([columna, etiqueta]) => ({
        clave: columna,
        etiqueta,
        valor: texto(fila[columna]),
        foto: texto(fila[`${columna}_foto`]),
        comentario: texto(fila[`${columna}_comentario`]),
      })),
    },
    ambiente: leerAmbiente(fila, avisos),
    precarga: leerPrecargas(fila),
    ajuste: leerAjuste(fila, avisos),
    excentricidad: leerExcentricidad(fila, rangos, avisos),
    repetibilidad: leerRepetibilidad(fila, avisos),
    errores: leerErrores(fila, rangos, avisos),
    criterio: {
      empNB23001: (() => {
        const emp = reparar(avisos, 'criterio', 'emp', segun(fila.emp, EMP));
        return emp == null ? null : emp === 'SI';
      })(),
      toleranciaCliente: numero(fila.indicar),
      factorSeguridad: numero(fila.factor),
      regla: reparar(avisos, 'criterio', 'Regla de decisión', segun(fila.regla_aceptacion, REGLA)),
    },
    cierre: {
      mantenimientoSoporte: (() => { const v = segun(fila.mant_soporte, SI_NO).codigo; return v == null ? null : v === 'SI'; })(),
      ventaPesas: (() => { const v = segun(fila.venta_pesas, SI_NO).codigo; return v == null ? null : v === 'SI'; })(),
      reemplazo: (() => { const v = segun(fila.reemplazo, SI_NO).codigo; return v == null ? null : v === 'SI'; })(),
      observaciones: texto(fila.observaciones),
    },
    origen: { fila: numero(fila.n) },
  };

  if (modelo.criterio.regla == null) avisos.aviso('criterio', 'SIN_REGLA', 'No se indicó la regla de decisión.');
  if (modelo.ajuste.realizado === true && !modelo.precarga.length) {
    avisos.aviso('ajuste', 'AJUSTE_SIN_PRECARGA', 'Hubo ajuste pero no hay lecturas antes del ajuste (precarga).');
  }

  return { modelo, avisos: avisos.lista };
};

module.exports = {
  CLASES_PESAS,
  LIMITES,
  certificadoEn,
  clave,
  codigoPatron,
  identificarTecnico,
  leerReca,
  leerSeca,
  modeloDeFila,
  normalizarCodigo,
  segun,
  texto,
};
