/**
 * Certificado de calibración de balanzas (fase 5): su contenido a partir del
 * registro (modelo corregido + cálculo), con el diseño de la hoja CERT del
 * libro F-VMET-02-7.2 y lo que agrega la NB/ISO/IEC 17025 7.8 y EURAMET
 * cg-18 8 (k por punto, ajuste, antes del ajuste, clase con su origen, datos
 * del cliente marcados, regla de decisión).
 *
 * El contenido son textos ya formateados y las series de los gráficos: el
 * documento solo los dibuja. Así lo que se autoriza y firma se puede guardar
 * congelado y volver a dibujar igual (7.8.8, reemisión).
 *
 * Numeración (fase 0, se mantiene): n.º = negociación + RECA (2 dígitos) +
 * año (2 dígitos, el de la fecha en que se registra el servicio, hoy la de
 * creación del registro en DataMET+); emisión 01, 02…; nombre del PDF =
 * n.º, emisión, razón social, marca, Max, unidad e ID. del instrumento.
 */
const { getPool } = require('../config/db');
const { httpError } = require('./calibration.db');
const { formatNominal } = require('./calibration.patrones');

// ─── Textos del certificado ────────────────────────────────────────────────
// Los de la hoja CERT, salvo los marcados como propuesta de la fase 0
// (sección 7), que debe aprobar el laboratorio.

const TEXTOS = {
  metodo: 'Comparación con pesas patrón, según procedimiento METRICA "P-VMET-02-7.2", elaborado en base a la Guía EURAMET cg-18 v4.0 (2015) y la Guía SIM MWG7/cg-01/v.00 (2009).',
  fechaEmision: 'Corresponde a la fecha de la firma digital en la presente página',
  alcanceNota: '*El alcance de calibración incluye el rango de uso definido por el cliente.',
  leyenda: [
    'Este documento solo puede ser reproducido de manera íntegra, a menos que METRICA Ltda. lo autorice por escrito.',
    'La información expuesta en el presente documento está referida exclusivamente al instrumento objeto de calibración y a las condiciones en las que fueron realizadas las mediciones. El usuario debe considerar que cualquier cambio en el lugar de funcionamiento del instrumento, así como en las condiciones de medición, puede ocasionar deriva y consecuente invalidación de los resultados reportados en este certificado.',
  ],
  pruebasConExcentricidad: 'Se evaluó la repetibilidad de las indicaciones, los errores de indicación (linealidad de la balanza) y el efecto de las cargas excéntricas.',
  pruebasSinExcentricidad: 'Se evaluó la repetibilidad de las indicaciones y los errores de indicación (linealidad).',
  pruebas: [
    'Las indicaciones sin carga se ajustaron a cero cuando fue necesario.',
    'Las cargas se eligieron de acuerdo a las condiciones de uso del cliente.',
    'En las pruebas de linealidad y repetibilidad, las cargas fueron distribuidas simétricamente en la zona de carga.',
  ],
  sustitucion: 'Las cargas mayores que el total de las pesas patrón se formaron por el método de sustitución (EURAMET cg-18 v4.0, 4.3.3).',
  // Propuesta (fase 0, sección 7): reemplaza «nivel de confianza aproximado del 95 %».
  incertidumbre: 'La incertidumbre expandida declarada es la incertidumbre típica combinada multiplicada por el factor de cobertura k indicado para cada punto, que corresponde a una probabilidad de cobertura de aproximadamente 95,45 % (distribución t de Student con los grados efectivos de libertad). Se determinó según EURAMET cg-18 v4.0 y la ISO/IEC Guide 98-3:2008.',
  repetibilidad: 'La desviación estándar corresponde a una sola indicación.',
  reglas: {
    SIMPLE: 'Para la declaración de la conformidad se ha aplicado la Regla de decisión SIMPLE, la cual considera que: 1. La Incertidumbre obtenida es acorde a los requisitos del cliente y 2. Si el error encontrado está dentro del Intervalo de Tolerancia, existe CONFORMIDAD.',
    CONSERVADORA: 'Para la DECLARACIÓN DE LA CONFORMIDAD se ha aplicado la regla de decisión CONSERVADORA, la cual considera que si el ERROR encontrado más la INCERTIDUMBRE EXPANDIDA está dentro del INTERVALO DE TOLERANCIA, existe CONFORMIDAD.',
    NINGUNA: 'No requiere declaración de conformidad.',
  },
  // Propuesta (fase 0, sección 7).
  datosCliente: '(*) Dato proporcionado por el cliente. METRICA Ltda. no es responsable de esta información; la declaración de conformidad depende de ella.',
};

const ORIGEN_CLASE = { PLACA: 'placa', APROBACION: 'aprobación de modelo', DEDUCIDA: 'deducida de Max/e, OIML R76' };

// ─── Formatos ──────────────────────────────────────────────────────────────

/** Número con coma decimal; con `decimales` fijos, sin «-0». */
const coma = (valor, decimales = null) => {
  if (valor == null || !Number.isFinite(Number(valor))) return '';
  const n = Number(valor);
  let texto = decimales == null ? String(Number(n.toPrecision(12))) : n.toFixed(Math.max(0, decimales));
  if (/^-0(\.0+)?$/.test(texto)) texto = texto.slice(1);
  return texto.replace('.', ',');
};

const decimalesDe = (valor) => {
  const texto = String(Number(Number(valor).toPrecision(12)));
  const exp = texto.match(/e-(\d+)$/);
  if (exp) return Number(exp[1]);
  return texto.includes('.') ? texto.split('.')[1].length : 0;
};

const conUnidad = (texto, unidad) => (texto === '' ? '' : `${texto} ${unidad}`);

/** Fecha en Bolivia (UTC−4) como AAAA-MM-DD. */
const fechaBolivia = (fecha = new Date()) => new Date(fecha.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);

// ─── Número y archivo ──────────────────────────────────────────────────────

/** N.º de certificado: negociación-RECA-año, p. ej. 0051-C01-30-26. null si falta un dato. */
const numeroCertificado = ({ negociacion, reca, anio }) => {
  if (!negociacion || reca == null || !anio) return null;
  return `${negociacion}-${String(reca).padStart(2, '0')}-${String(anio).slice(-2)}`;
};

/**
 * N.º que lleva (o llevará) el certificado de un registro: el mismo cálculo
 * que el contenido del certificado, con el año de creación del registro.
 */
const numeroDelRegistro = ({ modelo, creadoEn = null }) => numeroCertificado({
  negociacion: modelo.servicio.seca?.negociacion,
  reca: modelo.servicio.reca?.numero,
  anio: (creadoEn ? fechaBolivia(new Date(creadoEn)) : fechaBolivia()).slice(0, 4),
});

/** Emisión con dos dígitos: 01, 02… */
const textoEmision = (emision) => String(emision || 1).padStart(2, '0');

/**
 * Nombre del PDF como el libro: «0051-C01-30-26 01 CLIENTE S.A. METTLER
 * TOLEDO 600 g 0051-11-035.pdf», sin los caracteres que Windows no admite.
 */
const nombreArchivo = ({ numero, emision, razonSocial, marca, max, unidad, idInstrumento }) => {
  const partes = [numero, textoEmision(emision), razonSocial, marca === 'N/I' ? 'NI' : marca, max, unidad, idInstrumento];
  const base = [...partes.filter(p => p != null && String(p).trim() !== '').join(' ')]
    .map(c => (c.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(c) ? '-' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim();
  return `${base.slice(0, 215)}.pdf`;
};

// ─── Anexo de información adicional ────────────────────────────────────────

/** Número con n cifras significativas, coma decimal y sin exponente. */
const cifras = (valor, n = 2) => {
  if (valor == null || !Number.isFinite(valor)) return '';
  if (valor === 0) return '0';
  const decimales = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(valor))));
  return coma(Number(valor.toPrecision(n)), Math.min(decimales, 12));
};
const SUPERINDICES = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Coeficiente pequeño en notación científica legible: 2,97 · 10⁻⁶. */
const coeficiente = (valor, n = 3) => {
  if (!Number.isFinite(valor) || valor === 0 || Math.abs(valor) >= 1e-3) return cifras(valor, n);
  const exponente = Math.floor(Math.log10(Math.abs(valor)));
  const mantisa = coma(Number((valor / 10 ** exponente).toPrecision(n)));
  return `${mantisa} · 10${[...String(exponente)].map(c => SUPERINDICES[c]).join('')}`;
};
const porcentaje = (fraccion) => `${coma(Number((fraccion * 100).toPrecision(6)))} %`;

/**
 * Anexo con la incertidumbre en uso, la global y la pesada mínima (EURAMET
 * 7.4, 7.5 y G; se declara que no forma parte del certificado, 8.4).
 * Textos: propuesta, por aprobar.
 */
const anexoDe = (uso, { unidad, clase }) => {
  const u = (valor) => `${cifras(valor, 2)} ${unidad}`;
  const ecuaciones = uso.rangos.map((r, i) => ({
    rango: uso.rangos.length > 1 ? `Rango ${i + 1} (hasta ${coma(r.max)} ${unidad})` : `Hasta ${coma(r.max)} ${unidad}`,
    U: `U(W) = ${u(r.U0)} + ${coeficiente(r.C)} · R`,
    Ugl: `Ugl(W) = ${u(r.U0)} + ${coeficiente(r.C + Math.abs(uso.a1))} · R`,
  }));
  return {
    aviso: 'Esta información no forma parte del certificado de calibración. Se entrega a pedido del cliente como ayuda para estimar la incertidumbre de sus pesadas (EURAMET cg-18 v4.0, 7.4, 7.5 y Anexo G).',
    supuestos: [
      `Variación de la temperatura en el lugar de uso: ${coma(uso.deltaT)} K.`,
      uso.kT
        ? `Coeficiente de temperatura: ${coeficiente(uso.kT, 2)} /K${uso.origenKT === 'R76' ? ` (límite de la OIML R 76 para la clase ${clase})` : ''}.`
        : 'Coeficiente de temperatura: no considerado (sin clase declarada ni dato del fabricante).',
      'Lecturas con la división d del instrumento, de una sola pesada; efecto completo de la excentricidad; sin deriva del ajuste ni efectos de fluencia.',
      `Factor de cobertura k = ${coma(uso.k)} (probabilidad de cobertura de al menos 95 %).`,
    ],
    ecuaciones,
    explicacion: 'W = R − E(R) ± U(W) cuando la lectura R se corrige con su error; W = R ± Ugl(W) cuando no se corrige (incertidumbre global). R en la unidad del instrumento.',
    tabla: uso.tabla.map(f => ({
      porcentaje: porcentaje(f.fraccion),
      R: `${coma(Number(f.R.toPrecision(8)))} ${unidad}`,
      U: u(f.U),
      Urel: f.R > 0 ? `${cifras((f.U / f.R) * 100, 2)} %` : '—',
      Ugl: u(f.Ugl),
      Uglrel: f.R > 0 ? `${cifras((f.Ugl / f.R) * 100, 2)} %` : '—',
    })),
    pesadaMinima: {
      factores: uso.pesadaMinima.factores.map(f => coma(f)),
      filas: uso.pesadaMinima.filas.map(f => ({
        exactitud: porcentaje(f.exactitud),
        valores: f.valores.map(v => (v == null ? '—' : `${cifras(v, 3)} ${unidad}`)),
      })),
      nota: 'Menor carga neta para la que la incertidumbre global relativa no supera la tolerancia requerida dividida por el factor de seguridad (Anexo G). «—»: no se alcanza en el rango del instrumento.',
    },
    responsabilidad: 'El usuario debe confirmar los supuestos del lugar de uso y definir sus tolerancias y factores de seguridad; METRICA Ltda. no es responsable de esa elección.',
  };
};

const APROBADO = ok => (ok ? 'APROBADO' : 'REPROBADO');

/**
 * Evaluación USP ⟨41⟩ del anexo (como la hoja INCO del libro): repetibilidad,
 * exactitud, adecuación de las pesas y peso mínimo de muestra, con los
 * límites de la configuración del método. Textos propios, sin el de la USP.
 */
const uspDe = (usp, { unidad }) => {
  const c = usp.configuracion;
  const r = usp.repetibilidad;
  // Con n cifras significativas, sin ceros de más («30 g», «0,0058 g»).
  const masa = (valor, n = 3) => `${coma(Number(valor.toPrecision(n)))} ${unidad}`;
  const pct = valor => `${coma(Number((valor * 100).toPrecision(4)))} %`;
  return {
    titulo: 'EVALUACIÓN SEGÚN LA USP ⟨41⟩ (BALANZAS DE USO FARMACÉUTICO)',
    repetibilidad: [
      { dato: 'Carga de evaluación', valor: `${masa(r.carga)} (${pct(c.cargaEvaluacion)} de Max)` },
      { dato: 'Desviación estándar medida (la mayor de los ensayos)', valor: masa(r.sMedida) },
      { dato: `Desviación estándar mínima (${coma(c.sMinimaEnD)} · d)`, valor: masa(r.sMinima) },
      { dato: 'Desviación estándar usada (s)', valor: masa(r.s) },
      { dato: `${coma(c.factorS)} · s / carga`, valor: `${cifras(r.valor * 100, 3)} %` },
      { dato: 'Criterio de aceptación', valor: `≤ ${pct(c.tolerancia)}` },
      { dato: 'Resultado', valor: APROBADO(r.cumple), destacado: true },
      { dato: 'Peso mínimo de muestra por repetibilidad', valor: masa(r.pesoMinimo) },
    ],
    exactitud: {
      rango: `Cargas entre ${masa(usp.exactitud.desde)} (${pct(c.cargaEvaluacion)} de Max) y ${masa(usp.exactitud.hasta)}. Tolerancia: ${pct(c.tolerancia)} de la carga; las pesas son adecuadas si su incertidumbre expandida (k = 2) no supera 1/${coma(c.divisorPesas)} de esa tolerancia.`,
      filas: usp.exactitud.filas.map(f => ({
        carga: `${coma(f.carga)} ${unidad}`,
        error: `${coma(f.presentacion?.error ?? f.error, f.presentacion?.decimales ?? 6)} ${unidad}`,
        limite: `± ${masa(f.limite)}`,
        resultado: APROBADO(f.cumple),
        Upesas: masa(f.Upesas, 2),
        limitePesas: masa(f.limitePesas, 2),
        pesas: APROBADO(f.pesasAdecuadas),
      })),
      vacia: usp.exactitud.filas.length ? null : 'Ningún punto del ensayo de error está en el rango de evaluación.',
    },
    pesoMinimo: {
      factores: usp.pesoMinimo.factores.map(f => coma(f)),
      filas: usp.pesoMinimo.filas.map(f => ({
        exactitud: porcentaje(f.exactitud),
        valores: f.valores.map(v => (v == null ? '—' : masa(v))),
      })),
      nota: `Peso mínimo de muestra = ${coma(c.factorS)} · s · factor de seguridad / exactitud requerida. «—»: supera la capacidad del instrumento.`,
    },
  };
};

/**
 * Condiciones del instrumento y de la instalación que revisó el técnico
 * (ServiceMET), como la hoja INCO del libro. Solo las que tienen dato.
 */
const condicionesDe = (lugar = {}) => {
  const filas = [
    lugar.estabilizacionPesas ? { condicion: 'Estabilización de las pesas', estado: lugar.estabilizacionPesas, observacion: '' } : null,
    lugar.operacionBalanza ? { condicion: 'Operación de la balanza', estado: lugar.operacionBalanza, observacion: '' } : null,
    ...(lugar.inspeccion || [])
      .filter(i => i.valor || i.comentario)
      .map(i => ({ condicion: i.etiqueta, estado: i.valor || '—', observacion: i.comentario || '' })),
  ].filter(Boolean);
  return filas.length ? filas : null;
};

// ─── Contenido ─────────────────────────────────────────────────────────────

/** Patrón en el certificado: «Set de pesas patrón OIML F1; 1 g a 5000 g; Código: F1-101». */
const textoPatron = (juego) => {
  const rango = juego.rangoMg
    ? (juego.rangoMg.min === juego.rangoMg.max ? formatNominal(juego.rangoMg.min) : `${formatNominal(juego.rangoMg.min)} a ${formatNominal(juego.rangoMg.max)}`)
    : null;
  return ['Set de pesas patrón' + (juego.clase ? ` OIML ${juego.clase}` : ''), rango, `Código: ${juego.codigo}`].filter(Boolean).join('; ');
};

/** Pesa del ajuste externo: «2000/F1» → «2000 g (F1)». */
const textoPesasAjuste = (pesas, unidad) => {
  if (!pesas) return null;
  if (pesas.valor == null) return pesas.original;
  return `${coma(pesas.valor)} ${pesas.unidad || unidad}${pesas.clase ? ` (${pesas.clase})` : ''}`;
};

const textoAjuste = (ajuste, unidad) => {
  if (ajuste.realizado === 'SI' || ajuste.realizado === true) {
    if (ajuste.tipo === 'INTERNO') return 'Se realizó ajuste interno antes de la calibración.';
    const pesa = textoPesasAjuste(ajuste.pesas, unidad);
    return `Se realizó ajuste externo${pesa ? ` con pesa patrón de ${pesa}` : ''} antes de la calibración.`;
  }
  if (ajuste.realizado === 'NO' || ajuste.realizado === false) return 'No se realizó ajuste.';
  return null;
};

/** Escalones del emp o la tolerancia para el gráfico: cada valor vale desde la carga anterior. */
const escalones = (puntos) => {
  const serie = [];
  let anterior = 0;
  for (const p of puntos) {
    if (!(p.tolerancia > 0)) continue;
    serie.push({ x: anterior, y: p.tolerancia }, { x: p.carga, y: p.tolerancia });
    anterior = p.carga;
  }
  return serie;
};

/**
 * Contenido del certificado.
 * registro: { modelo, calculo, creadoEn } del registro (getRegistro).
 * emision: { numero?, emision, autorizadoPor, revisiones, reemplaza } (opcionales;
 * en una reemisión el número es el de la primera emisión).
 * Devuelve { contenido, archivo, bloqueos, avisos }: los bloqueos impiden
 * autorizarlo; los avisos conviene revisarlos.
 */
const contenidoCertificado = ({ modelo: m, calculo, creadoEn = null, anexo: conAnexo = false, usp: conUsp = false, textos = null }, emision = {}) => {
  // Los textos de la versión del método con la que se calculó (fase 6).
  const T = textos || TEXTOS;
  const avisos = [];
  const bloqueos = [];
  const unidad = m.instrumento.unidad || '';
  const rangos = m.instrumento.rangos || [];
  const dMin = Math.min(...rangos.map(r => r.d).filter(d => d > 0), Infinity);
  const decInstrumento = Number.isFinite(dMin) ? decimalesDe(dMin) : 0;

  const anio = (creadoEn ? fechaBolivia(new Date(creadoEn)) : fechaBolivia()).slice(0, 4);
  const numero = emision.numero || numeroCertificado({ negociacion: m.servicio.seca?.negociacion, reca: m.servicio.reca?.numero, anio });
  if (!numero) bloqueos.push('Falta el SECA o el n.º de RECA para numerar el certificado.');

  // Cliente e instrumento.
  const razonSocial = m.cliente.razonSocial || m.cliente.nombre || '';
  const max = rangos.map(r => coma(r.max)).join('/');
  const d = rangos.map(r => coma(r.d)).join('/');
  const eDistinto = rangos.some(r => r.e > 0 && r.d > 0 && Math.abs(r.e - r.d) > 1e-12);
  const e = eDistinto ? rangos.map(r => coma(r.e || r.d)).join('/') : null;
  const usaClase = m.criterio.empNB23001 === true && m.instrumento.clase?.valor;
  const claseCliente = usaClase && m.instrumento.clase.origen === 'CLIENTE';
  // Sin clase en el registro el cálculo usa la sugerida: se ve en la vista previa y bloquea la emisión.
  const claseSugerida = m.criterio.empNB23001 === true && !usaClase ? calculo?.clase?.sugerida?.valor || null : null;
  if (m.criterio.empNB23001 === true && !usaClase) {
    bloqueos.push(`Falta confirmar la clase del instrumento${claseSugerida ? ` (se sugiere ${claseSugerida})` : ''}.`);
  }
  const clase = usaClase
    ? `${m.instrumento.clase.valor}${claseCliente ? ' *' : ORIGEN_CLASE[m.instrumento.clase.origen] ? ` (${ORIGEN_CLASE[m.instrumento.clase.origen]})` : ''}`
    : claseSugerida ? `${claseSugerida} (sugerida, sin confirmar)` : null;

  // Datos de la calibración.
  const condiciones = calculo?.aire?.condiciones
    || (() => {
      const media = (campo) => {
        const valores = [m.ambiente.inicio?.[campo], m.ambiente.fin?.[campo]].filter(v => v != null);
        return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
      };
      return { t: media('t'), hr: media('hr'), p: media('p') };
    })();
  const juegos = (calculo?.juegos || []).length
    ? calculo.juegos
    : m.patrones.juegos.map(j => ({ codigo: j.codigo, clase: null, rangoMg: null }));
  for (const juego of juegos) if (!juego.rangoMg) avisos.push(`${juego.codigo}: registre sus piezas para indicar su alcance en «Patrones de calibración».`);
  const trazabilidad = m.patrones.juegos.map((juego) => {
    if (!juego.certificado?.numero) {
      bloqueos.push(`${juego.codigo}: sin certificado vigente en la fecha de la calibración (trazabilidad).`);
      return `${juego.codigo}: SIN CERTIFICADO VIGENTE`;
    }
    return `${juego.codigo}: Trazable a ${juego.certificado.numero}; ${juego.certificado.fecha}`;
  });
  const cargas = m.errores.puntos.map(p => p.carga).filter(c => c > 0);
  const mayorMax = Math.max(...rangos.map(r => r.max), 0);
  const menor = cargas.length ? Math.min(...cargas) : null;
  const mayor = cargas.length ? Math.max(...cargas) : null;
  // Hasta Max si el ensayo llegó a Max; si no, hasta Max′ (EURAMET 4.2).
  const alcance = menor == null ? 'EN TODO EL RANGO DE PESADA'
    : `Min': ${coma(menor)} ${unidad} hasta ${mayor >= mayorMax * 0.98 ? `Max: ${coma(mayorMax)}` : `Max': ${coma(mayor)}`} ${unidad}`;
  const registroTexto = `SECA ${m.servicio.seca?.libro || m.servicio.seca?.original || '—'}  N° ${m.servicio.reca?.numero ?? m.servicio.reca?.original ?? '—'}; STICKER N° ${m.servicio.sticker || '—'}`;
  const elaborado = m.servicio.tecnico?.original || m.servicio.tecnico?.nombre || '';
  if (!m.servicio.tecnico?.usuario) avisos.push('El técnico que elaboró el servicio no está identificado («Elaborado por»).');

  // Excentricidad.
  const ecc = calculo?.excentricidad;
  const posiciones = (m.excentricidad.posiciones || []).filter(p => p.indicacion != null);
  const excentricidad = posiciones.length > 1 && ecc ? {
    carga: conUnidad(coma(ecc.carga), unidad),
    filas: posiciones.slice(1).map((p, i) => ({ posicion: String(p.posicion), diferencia: conUnidad(coma(ecc.diferencias[i], decInstrumento), unidad) })),
    plataforma: m.excentricidad.plataforma || null,
    esquema: m.excentricidad.indicador || null,
    lecturas: posiciones.length,
  } : null;

  // Repetibilidad.
  const ensayos = m.repetibilidad.ensayos || [];
  const repetibilidad = ensayos.length ? {
    filas: ensayos.map((ensayo, i) => {
      const lecturas = ensayo.lecturas.map(l => l.indicacion).filter(v => v != null);
      const s = calculo?.repetibilidad?.[i]?.s;
      const media = calculo?.repetibilidad?.[i]?.media;
      return {
        carga: conUnidad(coma(ensayo.carga), unidad),
        n: lecturas.length,
        media: conUnidad(coma(media, decInstrumento + 1), unidad),
        s: conUnidad(coma(s, decInstrumento + 1), unidad),
        difMax: conUnidad(coma(lecturas.length ? Math.max(...lecturas) - Math.min(...lecturas) : null, decInstrumento), unidad),
      };
    }),
    repeticiones: Math.max(...ensayos.map(e => e.lecturas.length)),
    serie: ensayos.map((ensayo, i) => ({ x: ensayo.carga, y: calculo?.repetibilidad?.[i]?.s ?? null })).filter(p => p.y != null),
    // Escala mínima del gráfico (d): con s = 0 el eje no queda de 0 a 1.
    escalaMinima: Number.isFinite(dMin) ? dMin : null,
  } : null;

  // Errores de indicación.
  const regla = m.criterio.regla || 'NINGUNA';
  const porcentajeCliente = !m.criterio.empNB23001 && m.criterio.toleranciaCliente > 0;
  // Tolerancia absoluta por rango que da el cliente (se usa sin emp NB 23001 ni %).
  const rangosCliente = !m.criterio.empNB23001 && !porcentajeCliente && (m.criterio.toleranciasRango || []).length > 0;
  const toleranciaCliente = porcentajeCliente || rangosCliente;
  const encabezadoTolerancia = m.criterio.empNB23001 ? 'EMP (NB 23001)'
    : porcentajeCliente ? `TOLERANCIA DEL CLIENTE ${coma(m.criterio.toleranciaCliente)} % *`
      : rangosCliente ? 'TOLERANCIA DEL CLIENTE *' : 'EMP DEL CLIENTE';
  const calculados = (calculo?.puntos || []).filter(p => p.calculado);
  const sinCalcular = (calculo?.puntos || []).filter(p => !p.calculado);
  if (!calculo?.calculado) bloqueos.push('El servicio no se puede calcular.');
  else if (calculo.provisional) bloqueos.push('El cálculo es provisional: faltan valores verificados de los patrones.');
  if (sinCalcular.length) avisos.push(`Puntos sin calcular, que no salen en el certificado: ${sinCalcular.map(p => p.n).join(', ')}.`);
  const aplica = regla !== 'NINGUNA';
  const umbralRiesgo = calculo?.reglas?.riesgoUmbral ?? 0.05;
  const errores = {
    encabezadoTolerancia,
    filas: calculados.map((p) => {
      const dec = p.presentacion.decimales;
      const c = p.conformidad;
      const decLectura = Math.max(dec, decInstrumento) + 1;
      return {
        carga: conUnidad(coma(p.carga), unidad),
        indicacion: conUnidad(coma(p.indicacion, decLectura), unidad),
        mref: conUnidad(coma(p.mref, decLectura), unidad),
        error: conUnidad(coma(p.presentacion.error, dec), unidad),
        U: conUnidad(coma(p.presentacion.U, dec), unidad),
        k: coma(p.k, 2),
        // El emp o la tolerancia con los decimales del instrumento (o los suyos, si tiene más).
        tolerancia: aplica && p.tolerancia > 0
          ? conUnidad(coma(p.tolerancia, Math.min(6, Math.max(decInstrumento, decimalesDe(p.tolerancia)))), unidad)
          : 'NO APLICA',
        conformidad: aplica && c?.evaluada ? (c.conforme ? 'CONFORME' : 'NO CONFORME') : 'NO APLICA',
        // Bajo el umbral del método (5 % por omisión) se escribe «< umbral».
        riesgo: aplica && c?.evaluada ? (c.riesgo < umbralRiesgo ? `< ${coma(umbralRiesgo * 100, 2)}` : coma(c.riesgo * 100, 2)) : 'NO APLICA',
      };
    }),
  };
  if (aplica && calculados.some(p => !p.conformidad?.evaluada)) {
    avisos.push('Hay puntos sin tolerancia: la conformidad sale como «NO APLICA».');
  }

  // Antes del ajuste (as found): las precargas, si hubo ajuste (7.8.4.1 d).
  const huboAjuste = m.ajuste.realizado === 'SI' || m.ajuste.realizado === true;
  const antes = huboAjuste ? (m.precarga || []).filter(p => p.carga != null && p.indicacion != null) : [];
  const antesDelAjuste = antes.length ? antes.map(p => ({
    carga: conUnidad(coma(p.carga), unidad),
    indicacion: conUnidad(coma(p.indicacion, decInstrumento), unidad),
    error: conUnidad(coma(p.indicacion - p.carga, decInstrumento), unidad),
  })) : null;

  const graficoErrores = {
    asLeft: calculados.map(p => ({ x: p.carga, y: p.presentacion.error, U: p.presentacion.U })),
    asFound: antes.map(p => ({ x: p.carga, y: p.indicacion - p.carga })),
    emp: aplica ? escalones(calculados) : [],
  };

  // Para el modelo sugerido: resumen, ambiente al inicio y al fin y patrones en tabla.
  const evaluados = calculados.filter(p => aplica && p.conformidad?.evaluada);
  const noConformes = evaluados.filter(p => !p.conformidad.conforme).length;
  const mayorError = calculados.reduce((max, p) => (!max || Math.abs(p.presentacion.error) > Math.abs(max.presentacion.error) ? p : max), null);
  const mayorU = calculados.reduce((max, p) => (!max || p.presentacion.U > max.presentacion.U ? p : max), null);
  const resumen = {
    puntos: calculados.length,
    evaluados: evaluados.length,
    noConformes,
    conformidad: !aplica || !evaluados.length ? 'SIN DECLARACIÓN' : noConformes ? 'NO CONFORME' : 'CONFORME',
    regla,
    errorMax: mayorError ? `${conUnidad(coma(mayorError.presentacion.error, mayorError.presentacion.decimales), unidad)} (en ${conUnidad(coma(mayorError.carga), unidad)})` : null,
    UMax: mayorU ? `${conUnidad(coma(mayorU.presentacion.U, mayorU.presentacion.decimales), unidad)} (en ${conUnidad(coma(mayorU.carga), unidad)})` : null,
  };
  const momento = (lectura) => ({
    hora: lectura?.hora || '—',
    t: coma(lectura?.t, 1) || '—',
    hr: coma(lectura?.hr, 1) || '—',
    p: coma(lectura?.p, 1) || '—',
  });
  const ambiente = { inicio: momento(m.ambiente.inicio), fin: momento(m.ambiente.fin), termohigrometro: calculo?.termohigrometro || null };
  const patronesDetalle = juegos.map((juego) => {
    const servicio = m.patrones.juegos.find(j => j.codigo === juego.codigo);
    return {
      codigo: juego.codigo,
      clase: juego.clase ? `OIML ${juego.clase}` : '—',
      alcance: juego.rangoMg
        ? (juego.rangoMg.min === juego.rangoMg.max ? formatNominal(juego.rangoMg.min) : `${formatNominal(juego.rangoMg.min)} a ${formatNominal(juego.rangoMg.max)}`)
        : '—',
      certificado: servicio?.certificado?.numero || 'SIN CERTIFICADO VIGENTE',
      fecha: servicio?.certificado?.fecha || '—',
    };
  });

  // Notas.
  const usaSustitucion = calculados.some(p => p.sustitucion);
  const pruebas = [
    excentricidad ? T.pruebasConExcentricidad : T.pruebasSinExcentricidad,
    ...T.pruebas,
    ...(usaSustitucion ? [T.sustitucion] : []),
    T.incertidumbre,
  ];

  const contenido = {
    version: 1,
    // Versión de la configuración del método con la que se calculó (fase 6).
    metodo: calculo.configuracion ?? null,
    numero,
    emision: textoEmision(emision.emision),
    cliente: { razonSocial, direccion: m.cliente.direccion || '' },
    instrumento: {
      tipo: (m.instrumento.tipo || '').toUpperCase(),
      marca: m.instrumento.marca || 'N/I',
      modelo: m.instrumento.modelo || '',
      serie: m.instrumento.serie || '',
      codigoInterno: m.instrumento.codigoInterno || '',
      idInstrumento: m.instrumento.codigoMetrica || '',
      max,
      d,
      e,
      unidad,
      clase,
    },
    calibracion: {
      lugar: m.instrumento.ubicacion || m.cliente.planta || '',
      fecha: m.servicio.fecha || '',
      fechaEmision: T.fechaEmision,
      condiciones: `Temperatura: ${coma(condiciones.t, 1)} °C; Humedad: ${coma(condiciones.hr, 1)} %; Presión Atmosférica: ${coma(condiciones.p, 1)} hPa`,
      patrones: juegos.map(textoPatron),
      trazabilidad,
      alcance,
      alcanceNota: T.alcanceNota,
      registro: registroTexto,
      ajuste: textoAjuste(m.ajuste, unidad),
      metodo: T.metodo,
    },
    elaboradoPor: elaborado,
    autorizadoPor: emision.autorizadoPor || null,
    leyenda: T.leyenda,
    excentricidad,
    repetibilidad: repetibilidad ? { ...repetibilidad, nota: T.repetibilidad } : null,
    errores,
    antesDelAjuste,
    graficoErrores,
    notas: {
      pruebas,
      regla: T.reglas[regla] || T.reglas.NINGUNA,
      datosCliente: toleranciaCliente || claseCliente ? T.datosCliente : null,
      observaciones: m.cierre.observaciones || 'Ninguna.',
      revisiones: emision.revisiones || [],
    },
    // Reemisión: a qué emisión reemplaza (va al pie de cada hoja).
    reemplaza: emision.reemplaza || null,
    // Datos que usa el modelo sugerido de certificado.
    resumen,
    ambiente,
    patronesDetalle,
    normas: 'EURAMET cg-18 v4.0 (2015); Guía SIM MWG7/cg-01/v.00 (2009); OIML R 76-1:2006; OIML R 111-1:2004; ISO/IEC Guide 98-3:2008',
    // Información adicional (anexo que no forma parte del certificado), a pedido del cliente.
    anexo: conAnexo && calculo?.enUso ? {
      // La clase con la que se calculó el KT (la registrada o, mientras no se confirma, la sugerida).
      ...anexoDe(calculo.enUso, { unidad, clase: usaClase ? m.instrumento.clase.valor : (m.instrumento.clase?.valor || calculo.clase?.valor || null) }),
      // USP ⟨41⟩, si el cliente la pidió; y las condiciones que revisó el técnico.
      usp: conUsp && calculo.usp ? uspDe(calculo.usp, { unidad }) : null,
      condiciones: condicionesDe(m.lugar),
    } : null,
  };
  if (conAnexo && conUsp && !calculo?.usp) avisos.push('Se pidió la evaluación USP ⟨41⟩, pero sin repetibilidad o sin rangos no se puede calcular.');
  return {
    contenido,
    archivo: numero ? nombreArchivo({
      numero, emision: emision.emision, razonSocial, marca: contenido.instrumento.marca, max: rangos[0] ? coma(rangos[0].max) : '', unidad, idInstrumento: contenido.instrumento.idInstrumento,
    }) : null,
    bloqueos,
    avisos,
  };
};

/**
 * Certificado de un registro. Autorizado o emitido (o una emisión pedida):
 * el contenido congelado de esa emisión. Si no: la vista previa con los datos
 * actuales, como borrador de la emisión siguiente.
 */
const getCertificado = async (codigo, user, { emision: pedida = null } = {}) => {
  // Diferidos: esos módulos cargan este.
  const { getRegistro } = require('./calibration.registros');
  const emisionService = require('./calibration.emision');
  const registro = await getRegistro(codigo, user);
  const request = () => getPool().request();
  const emisiones = registro.registro ? await emisionService.leerEmisiones(request, registro.registro.id) : [];

  let congelada = null;
  if (pedida != null) {
    congelada = emisiones.find(e => e.emision === pedida && e.estado !== 'ANULADO');
    if (!congelada) throw httpError(404, `El certificado no tiene la emisión ${textoEmision(pedida)}.`);
  } else if (registro.estado === 'AUTORIZADO') {
    congelada = emisiones.find(e => e.estado === 'AUTORIZADO');
  } else if (registro.estado === 'EMITIDO') {
    congelada = emisiones.find(e => e.estado === 'EMITIDO');
  }
  if (congelada) {
    return {
      codigo,
      estado: registro.estado,
      borrador: false,
      contenido: await emisionService.leerContenido(request, congelada.id),
      archivo: congelada.archivo,
      marca: emisionService.marcaPdf(congelada.huella),
      emision: emisionService.publica(congelada),
      bloqueos: [],
      avisos: [],
    };
  }

  const siguiente = emisionService.siguienteEmision(emisiones, registro.registro?.revisionMotivo);
  const { textos } = await require('./calibration.metodo').configuracionDe(registro.calculo.configuracion);
  const { contenido, archivo, bloqueos, avisos } = contenidoCertificado({
    modelo: registro.modelo,
    calculo: registro.calculo,
    creadoEn: registro.registro?.creadoEn || null,
    anexo: registro.datos?.anexo === true,
    usp: registro.datos?.usp === true,
    textos,
  }, siguiente);
  if (registro.estado !== 'APROBADO') avisos.unshift('El registro aún no está aprobado: es un borrador.');
  return { codigo, estado: registro.estado, borrador: true, contenido, archivo, marca: null, emision: null, bloqueos, avisos };
};

/**
 * Vista previa del certificado con cambios que aún no se guardan (la página
 * del registro la pide mientras se corrige): aplica las correcciones, la
 * clase y las composiciones como al guardar, recalcula y arma el contenido.
 * No escribe nada. Devuelve también el cálculo y los avisos de los datos.
 */
const previsualizar = async (codigo, cambios) => {
  const r = require('./calibration.registros');
  const emisionService = require('./calibration.emision');
  const request = () => getPool().request();
  const [fila, columnas, registro] = await Promise.all([
    r.filaVigente(codigo), r.columnasCalibracion(), r.leerRegistro(request, codigo),
  ]);
  const fuente = r.normalizarFuente(fila, columnas);
  const actuales = r.datosDe(registro?.datos);
  const correcciones = r.planCorrecciones({ fuente, columnas, actuales: actuales.columnas, entrantes: cambios.columnas || {} });
  const clase = r.planClase(actuales.clase, cambios.clase);
  const unidad = String(correcciones.columnas.unidades ?? fuente.unidades ?? '').trim();
  const composiciones = r.planComposiciones(actuales.composiciones, cambios.composiciones, unidad);
  const anexo = r.planAnexo(actuales.anexo, cambios.anexo);
  const usp = r.planUsp(actuales.usp, cambios.usp);
  const tolerancias = r.planTolerancias(actuales.tolerancias, cambios.tolerancias, unidad);
  const datos = {
    columnas: correcciones.columnas, clase: clase.clase, composiciones: composiciones.composiciones,
    anexo: anexo.anexo, usp: usp.usp, tolerancias: tolerancias.tolerancias,
  };
  const { modelo, avisos: avisosDatos } = await r.modeloCorregido(fila, datos);
  const calculo = await r.calcularModelo(modelo, datos, { version: r.versionDe(registro) });
  const emisiones = registro ? await emisionService.leerEmisiones(request, registro.id) : [];
  const siguiente = emisionService.siguienteEmision(emisiones, registro?.revision_motivo || null);
  const { textos } = await require('./calibration.metodo').configuracionDe(calculo.configuracion);
  const { contenido, archivo, bloqueos, avisos } = contenidoCertificado({
    modelo, calculo, creadoEn: registro?.creado_en ? `${registro.creado_en}Z` : null, anexo: datos.anexo, usp: datos.usp, textos,
  }, siguiente);
  return { codigo, borrador: true, contenido, archivo, bloqueos, avisos, calculo, avisosDatos, modelo };
};

module.exports = {
  TEXTOS,
  coma,
  contenidoCertificado,
  getCertificado,
  previsualizar,
  nombreArchivo,
  numeroCertificado,
  numeroDelRegistro,
  textoEmision,
};
