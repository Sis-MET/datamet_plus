/**
 * Cálculo de un servicio completo a partir de su modelo (calibration.fuente.js)
 * y de los datos de sus patrones (fase 1). Puro: no lee la base.
 *
 * Pasos: densidad del aire con el termohigrómetro corregido por su
 * certificado; ρa1 de cada juego de pesas; repetibilidad y excentricidad;
 * y, por cada punto del ensayo de error, la composición de la carga, la masa
 * de referencia, la indicación, E, U, k y la conformidad.
 */
const { aireDeCalibracion, corregirHumedad, corregirLectura, densidadAire } = require('./aire');
const { MG_POR, componerCarga, piezasSupuestas } = require('./cargas');
const { decimalesDeRango, errorEnPunto } = require('./error');
const { COBERTURA, combinar } = require('./estadistica');
const { componentesIndicacion, excentricidad, repetibilidad, repetibilidadPara } = require('./indicacion');
const { densidadSupuesta, masaReferencia } = require('./referencia');
const { cargaSustitucion } = require('./sustitucion');
const {
  claseSugerida, conformidad, rangoDeCarga, toleranciaDeCarga,
} = require('./tolerancia');
const { incertidumbreEnUso, pesadaMinima } = require('./uso');
const { evaluarUSP } = require('./usp');

const MAGNITUDES = { t: 'T', hr: 'HR', p: 'P' };

/**
 * Reglas de cálculo que elige el laboratorio en la configuración del método,
 * con el valor por omisión de cada una (el de la versión 1, decisiones de la
 * fase 0). Una versión guardada antes de que existiera una regla la calcula
 * igual que antes.
 */
const reglasDe = (config = {}) => ({
  repetibilidad: config.repetibilidad?.regla || 'ENCIERRAN',
  cobertura: { metodo: 'T_STUDENT', probabilidad: COBERTURA, k: 2, ...(config.cobertura || {}) },
  redondeo: { cifras: 2, sentido: 'ARRIBA', ...(config.redondeoU || {}) },
  aire: config.aire?.formula || 'CIPM-2007',
  excentricidad: config.excentricidad?.metodo || 'METODO_3',
  bandaGuarda: config.conformidad?.bandaGuarda ?? 1,
  riesgoUmbral: config.conformidad?.riesgoUmbral ?? 0.05,
  riesgo: config.conformidad?.riesgo || 'DOS_COLAS',
  presentacion: { decimales: 'POR_U', k: 'DOS_DECIMALES', ...(config.presentacion || {}) },
  factorEmp: config.empServicio?.factor ?? 2,
  claseSugerida: config.claseSugerida?.regla || 'TABLA_3',
});

const crearAvisos = () => {
  const lista = [];
  const agregar = (nivel, codigo, mensaje) => {
    if (!lista.some(a => a.codigo === codigo && a.mensaje === mensaje)) lista.push({ nivel, codigo, mensaje });
  };
  return { lista, error: (c, m) => agregar('error', c, m), aviso: (c, m) => agregar('aviso', c, m), info: (c, m) => agregar('info', c, m) };
};

const mediana = (valores) => {
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
};

/** Condiciones de inicio y fin corregidas con el certificado del termohigrómetro. */
const ambienteCorregido = (ambiente, termohigrometro, avisos) => {
  const puntos = termohigrometro?.puntos || {};
  const certificado = {};
  // La temperatura va primero: la humedad se corrige con los puntos calibrados
  // a la temperatura medida (ya corregida), si el certificado da varias.
  const corregir = (momento) => Object.entries(MAGNITUDES).reduce((corregidas, [campo, magnitud]) => {
    const lectura = campo === 'hr'
      ? corregirHumedad(momento?.hr ?? null, corregidas.t ?? null, puntos[magnitud] || [])
      : corregirLectura(momento?.[campo] ?? null, puntos[magnitud] || []);
    if (lectura.fuera) avisos.aviso('THB_FUERA_DE_RANGO', `La lectura de ${campo === 't' ? 'temperatura' : campo === 'hr' ? 'humedad' : 'presión'} (${momento[campo]}) está fuera del rango calibrado del termohigrómetro.`);
    if (lectura.U != null) {
      const actual = certificado[campo];
      if (!actual || lectura.U / lectura.k > actual.U / actual.k) certificado[campo] = { U: lectura.U, k: lectura.k };
    }
    return { ...corregidas, [campo]: lectura.valor };
  }, {});
  const resultado = { inicio: corregir(ambiente.inicio), fin: corregir(ambiente.fin), certificado };
  const NOMBRES = { t: 'la temperatura', hr: 'la humedad', p: 'la presión' };
  const faltan = Object.keys(MAGNITUDES).filter(campo => !certificado[campo]).map(campo => NOMBRES[campo]);
  if (faltan.length) {
    const lista = faltan.length > 1 ? `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}` : faltan[0];
    avisos.aviso('THB_SIN_VALORES', `El termohigrómetro${termohigrometro?.codigo ? ` ${termohigrometro.codigo}` : ''} no tiene valores transcritos para ${lista}: sin corrección y con solo la variación inicio-fin como incertidumbre.`);
  }
  return resultado;
};

/** Material habitual de una clase cuando no se conoce: fundición en M, acero inoxidable en E y F. */
const materialPorClase = (clase) => (String(clase || '').startsWith('M') ? 'Fundición gris' : 'Acero inoxidable');

/** Piezas de los juegos en la unidad del instrumento, con su ρa1 y sus valores. */
const piezasDeJuegos = (juegos, unidad, empR111, avisos, densidades, formulaAire) => {
  const mgPor = MG_POR[unidad];
  const piezas = [];
  const sinPiezas = [];
  for (const juego of juegos) {
    const rhoA1 = juego.condiciones?.temperatura != null && juego.condiciones?.humedad != null && juego.condiciones?.presion != null
      ? densidadAire({ t: juego.condiciones.temperatura, hr: juego.condiciones.humedad, p: juego.condiciones.presion }, formulaAire)
      : null;
    const activas = (juego.piezas || []).filter(p => p.activa !== false);
    if (!activas.length) {
      // Sin piezas tampoco hay material: el habitual de la clase (R111 B.7).
      sinPiezas.push({ ...juego, rhoA1, material: juego.material || materialPorClase(juego.clase) });
      continue;
    }
    let sinValores = 0;
    for (const pieza of activas) {
      const valor = juego.valores?.get(`${Number(pieza.nominalMg)}|${pieza.identificacion || ''}`);
      if (!valor) sinValores += 1;
      const supuesta = pieza.densidad == null ? densidadSupuesta(pieza.material || juego.material || materialPorClase(juego.clase), densidades) : null;
      piezas.push({
        // Identifica la pieza en una composición elegida a mano.
        clave: `${juego.codigo}|${Number(pieza.nominalMg)}|${pieza.identificacion || ''}`,
        juego: juego.codigo,
        identificacion: pieza.identificacion || '',
        nominal: Number(pieza.nominalMg) / mgPor,
        correccion: valor ? valor.correccionMg / mgPor : null,
        U: valor ? valor.uMg / mgPor : null,
        k: valor ? valor.k : 2,
        emp: (empR111(juego.clase, Number(pieza.nominalMg)) || 0) / mgPor,
        densidad: pieza.densidad ?? supuesta?.rho ?? null,
        uDensidad: pieza.densidad != null && pieza.densidadU != null ? pieza.densidadU / (pieza.densidadK || 2) : supuesta?.u ?? null,
        material: pieza.material || juego.material,
        clase: juego.clase,
        rhoA1,
      });
    }
    if (sinValores) {
      avisos.aviso('PESAS_SIN_VALORES', `${juego.codigo}: ${sinValores} pieza(s) sin valores de certificado; se usan con su valor nominal y u = emp/√3 (EURAMET 7.1.2-3).`);
    } else if (!juego.verificado) {
      avisos.aviso('PESAS_SIN_VERIFICAR', `${juego.codigo}: los valores de su certificado aún no están verificados.`);
    }
  }
  return { piezas, sinPiezas };
};

/**
 * Composición elegida a mano para un punto (decisión 4: quien elabora el
 * registro puede cambiar la que propone la regla). `claves` son las de las
 * piezas («juego|nominal en mg|marca»). Si ya no sirve (piezas que no están
 * en los juegos del servicio, repetidas, o que no suman la carga, p. ej.
 * porque se corrigió la carga) avisa y devuelve null: se usa la regla.
 */
const composicionElegida = (claves, punto, piezas, avisos) => {
  if (!Array.isArray(claves) || !claves.length) return null;
  const porClave = new Map(piezas.map(p => [p.clave, p]));
  const elegidas = claves.map(c => porClave.get(c));
  const tolerancia = Math.max(1e-12, Math.abs(punto.carga) * 1e-9);
  const suma = elegidas.reduce((total, p) => total + (p?.nominal || 0), 0);
  let motivo = null;
  if (elegidas.some(p => !p)) motivo = 'usa piezas que no están en los juegos del servicio';
  else if (new Set(claves).size !== claves.length) motivo = 'repite una pieza';
  else if (Math.abs(suma - punto.carga) > tolerancia) motivo = `suma ${Number(suma.toPrecision(10))}, no ${punto.carga}`;
  if (motivo) {
    avisos.aviso('COMPOSICION_INVALIDA', `Punto ${punto.n}: la composición elegida ${motivo}; se arma con la regla automática.`);
    return null;
  }
  return elegidas;
};

/**
 * Carga de sustitución cuando la carga supera lo que suman las pesas:
 * L = (n − 1)·mref + mref,k (4.3.3-5b), con mref todas las pesas y mref,k el
 * resto armado con piezas; sin resto, L = n·mref (4.3.3-5a). ServiceMET no
 * registra las diferencias ΔIj: se toman como cero, pero su u(Ij) cuenta en
 * cada indicación de la carga patrón (7.1.2-15a/b, «incluso si ΔIj = 0»).
 * Si el resto no se forma con piezas (1 057,6 kg con 500 kg en pesas), es el
 * material de sustitución: L = n·mref + ΣΔI (4.3.3-5a) con n las veces que se
 * pone la carga patrón (la más cercana, al menos 2) y ΣΔI = carga − n·nominal,
 * tal como la declara el técnico; hasta un 25 % de la carga patrón por paso.
 */
const referenciaSustitucion = ({ carga, piezas, opcionesReferencia, componentesEn }) => {
  const total = piezas.reduce((suma, p) => suma + p.nominal, 0);
  const tolerancia = Math.max(1e-12, Math.abs(carga) * 1e-9);
  if (!(total > 0) || carga <= total + tolerancia) return null;
  let veces = Math.floor((carga + tolerancia) / total); // copias completas de la carga patrón
  let resto = carga - veces * total;
  const completa = masaReferencia(piezas, opcionesReferencia);
  let parcial = null;
  let sumaDiferencias = null;
  if (resto > tolerancia) {
    const elegidas = componerCarga(resto, piezas);
    if (elegidas) {
      parcial = { piezas: elegidas, referencia: masaReferencia(elegidas, opcionesReferencia) };
    } else {
      veces = Math.max(2, Math.round(carga / total));
      sumaDiferencias = carga - veces * total;
      resto = 0;
      // El material de sustitución se arma parecido a la carga patrón: si las
      // diferencias superan un 25 % de ella por paso, no es una sustitución.
      if (Math.abs(sumaDiferencias) > 0.25 * total * (veces - 1)) return null;
    }
  }
  // n − 1 diferencias, en las indicaciones j·mref (j = 1 … n − 1).
  const pasos = parcial ? veces : veces - 1;
  const componentesPasos = Array.from({ length: pasos }, (_, j) => combinar(componentesEn((j + 1) * total)));
  const nuRepetibilidad = Math.min(...Array.from({ length: pasos }, (_, j) => componentesEn((j + 1) * total))
    .flat().filter(c => c.fuente === 'repetibilidad' && c.u > 0).map(c => c.nu), Infinity);
  const resultado = cargaSustitucion({
    mref: completa.mref,
    uMref: completa.u,
    // La suma de las diferencias va en la primera; solo cuenta su total.
    diferencias: componentesPasos.map((_, j) => (j === 0 && sumaDiferencias != null ? sumaDiferencias : 0)),
    uIndicaciones: componentesPasos,
    parcial: parcial ? { mref: parcial.referencia.mref, u: parcial.referencia.u } : null,
  });
  const uPatron = parcial ? veces * completa.u + parcial.referencia.u : resultado.n * completa.u;
  const uPasos = Math.sqrt(2 * componentesPasos.reduce((suma, u) => suma + u * u, 0));
  const texto = valor => String(Number(valor.toPrecision(10))).replace('.', ',');
  let descripcion = `${veces} × ${texto(total)} en pesas`;
  if (parcial) descripcion += ` + ${texto(resto)} en pesas`;
  if (sumaDiferencias != null) descripcion += ` ${sumaDiferencias < 0 ? '−' : '+'} ${texto(Math.abs(sumaDiferencias))} de diferencias de indicación (ΣΔI)`;
  return {
    n: resultado.n,
    ecuacion: resultado.ecuacion,
    sumaDiferencias,
    descripcion,
    piezas: [...piezas, ...(parcial ? parcial.piezas : [])],
    referencia: {
      mref: resultado.valor,
      u: resultado.u,
      componentes: [
        { fuente: 'sustitucionPatron', u: uPatron, nu: Infinity, ecuacion: resultado.ecuacion },
        { fuente: 'sustitucionIndicaciones', u: uPasos, nu: nuRepetibilidad, ecuacion: resultado.ecuacion },
      ].filter(c => c.u > 0),
    },
  };
};

/**
 * Calcula un servicio.
 * modelo: de modeloDeFila. datos: {
 *   juegos: [{ codigo, clase, material, piezas, valores: Map(clave → {correccionMg, uMg, k}),
 *              verificado, condiciones: {temperatura, humedad, presion} }],
 *   termohigrometro: { codigo, puntos: { T: [...], HR: [...], P: [...] } } | null,
 *   empR111: (clase, nominalMg) → emp en mg,
 *   claseInstrumento: 'I'|'II'|'III'|'IIII'|null,
 *   configuracion,
 *   composiciones: { [n]: [clave de pieza] } elegidas a mano (opcional),
 * }
 */
const calcularServicio = (modelo, datos) => {
  const avisos = crearAvisos();
  const config = datos.configuracion;
  const reglas = reglasDe(config);
  const unidad = modelo.instrumento.unidad;
  const rangos = [...(modelo.instrumento.rangos || [])].sort((a, b) => a.max - b.max);
  if (!unidad || !MG_POR[unidad]) avisos.error('SIN_UNIDAD', 'Sin la unidad del instrumento no se puede calcular.');
  if (!rangos.length || !(rangos[0].d > 0)) avisos.error('SIN_RANGOS', 'Sin la división d del instrumento no se puede calcular.');
  if (avisos.lista.some(a => a.nivel === 'error')) return { calculado: false, avisos: avisos.lista, puntos: [] };

  // Aire.
  let aire = null;
  try {
    const ambiente = ambienteCorregido(modelo.ambiente, datos.termohigrometro, avisos);
    aire = aireDeCalibracion({ ...ambiente, formula: reglas.aire });
    // Condiciones imposibles (p. ej. presión de pocos hPa) no dan un aire válido.
    const { t, hr, p } = aire.condiciones;
    if (!(p > 300 && p < 1200) || !(t > -10 && t < 50) || !(hr >= 0 && hr <= 100) || !(aire.rho > 0.3 && aire.rho < 1.5)) {
      throw new Error(`Condiciones ambientales fuera de rango (t = ${t} °C, HR = ${hr} %, p = ${p} hPa).`);
    }
  } catch (err) {
    avisos.error('SIN_AIRE', `${err.message} Sin una densidad del aire válida el empuje no se puede corregir.`);
    return { calculado: false, avisos: avisos.lista, puntos: [] };
  }

  // Repetibilidad.
  const ensayos = modelo.repetibilidad.ensayos.map((ensayo) => {
    const r = repetibilidad(ensayo.lecturas.map(l => l.indicacion));
    return { carga: ensayo.carga, n: r.n, media: r.media, s: r.s, nu: r.nu };
  });
  if (!ensayos.some(e => e.s != null)) avisos.error('SIN_REPETIBILIDAD', 'Hace falta un ensayo de repetibilidad con al menos 2 lecturas.');

  // Excentricidad (método 3 por omisión). La carga de ServiceMET no tiene
  // decimales: si no coincide con las indicaciones se toma la mediana de ellas.
  const posiciones = modelo.excentricidad.posiciones || [];
  let cargaEcc = modelo.excentricidad.carga;
  if (posiciones.length) {
    const centro = mediana(posiciones.map(p => p.indicacion));
    const dMax = Math.max(...rangos.map(r => r.d));
    if (!(cargaEcc > 0) || Math.abs(centro - cargaEcc) > Math.max(20 * dMax, 0.01 * Math.abs(centro))) cargaEcc = centro;
  }
  const ecc = excentricidad({ posiciones, carga: cargaEcc, metodo: reglas.excentricidad });
  if (!posiciones.length) avisos.aviso('SIN_EXCENTRICIDAD', 'Sin ensayo de excentricidad: no se incluye su contribución.');

  // Patrones.
  const { piezas, sinPiezas } = piezasDeJuegos(datos.juegos || [], unidad, datos.empR111, avisos, config.densidades, reglas.aire);
  if (sinPiezas.length) {
    avisos.aviso('PIEZAS_SUPUESTAS', `${sinPiezas.map(j => j.codigo).join(', ')} sin piezas registradas: cada carga se arma con la serie 5-2-2-1 de su clase, con valores nominales.`);
  }
  if (!piezas.length && !sinPiezas.length) avisos.error('SIN_PESAS', 'Sin juegos de pesas no se puede calcular la masa de referencia.');

  // Convección: ΔT pesas–aire por el tiempo de estabilización (configuración).
  const conveccion = config.conveccion?.activa ? (() => {
    const texto = String(modelo.lugar?.estabilizacionPesas || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    const deltaT = config.conveccion.deltaTPorEstabilizacion?.[texto] ?? config.conveccion.deltaTSinDato ?? 0;
    return { deltaT, estabilizacion: modelo.lugar?.estabilizacionPesas || null };
  })() : null;
  const usaConveccion = conveccion && conveccion.deltaT > 0 && [...piezas, ...sinPiezas].some(p => (config.conveccion.clases || []).includes(p.clase));
  if (usaConveccion) {
    avisos.info('CONVECCION', `Convección en pesas ${config.conveccion.clases.join(', ')} con ΔT = ${conveccion.deltaT} K (estabilización: ${conveccion.estabilizacion || 'sin dato'}; EURAMET 7.1.2-13, Anexo F).`);
  }
  const opcionesMasa = {
    unidad, aire, empuje: config.empuje, kD: config.kD, conveccion: Boolean(usaConveccion), deltaT: usaConveccion ? conveccion.deltaT : 0,
    clasesConveccion: config.conveccion?.clases, densidades: config.densidades,
  };

  const metodoCeros = modelo.errores.metodo === 'EVALUANDO_CEROS';
  const claseRegistrada = datos.claseInstrumento || modelo.instrumento.clase?.valor || null;
  // Sin clase registrada y con emp NB 23001 pedido: la que sugiere la regla
  // del método, para que el ingeniero vea los resultados y la confirme.
  const sugerida = !claseRegistrada && modelo.criterio.empNB23001 ? claseSugerida(rangos, MG_POR[unidad] / 1000, reglas.claseSugerida) : null;
  const claseInstrumento = claseRegistrada || sugerida?.valor || null;
  if (sugerida) {
    const eTexto = `${Number(sugerida.e.toPrecision(10))} ${unidad}`.replace('.', ',');
    const porQue = sugerida.regla === 'POR_N'
      ? `sugerida por n = Max/e = ${sugerida.n} (e = ${eTexto}), como el libro`
      : `sugerida por la OIML R76 (Tabla 3) con e = ${eTexto} y n = Max/e = ${sugerida.n}${sugerida.enTabla ? '' : ' (fuera de la Tabla 3: elegida por n, como el libro)'}`;
    avisos.aviso('CLASE_SUGERIDA', `Sin clase registrada: el emp NB 23001 se calcula con la clase ${sugerida.valor}, ${porQue}. Confírmala o corrígela en «Clase del instrumento» antes de enviar a revisión.`);
  }
  const toleranciaEn = toleranciaDeCarga({ criterio: modelo.criterio, rangos, clase: claseInstrumento, factorEmp: reglas.factorEmp });
  const puntos = [];
  let retornoAnterior = 0;
  for (const punto of modelo.errores.puntos) {
    const base = { n: punto.n, carga: punto.carga, indicacionLeida: punto.indicacion };
    if (punto.indicacion == null) {
      avisos.aviso('PUNTO_SIN_INDICACION', `El punto ${punto.n} (${punto.carga}) no tiene indicación: no se calcula.`);
      puntos.push({ ...base, calculado: false, motivo: 'Sin indicación' });
      continue;
    }
    // I = IL − (I0 + I0i)/2 con ceros evaluados (4.4.1-1b); si no, I = IL.
    const I = metodoCeros ? punto.indicacion - (retornoAnterior + (punto.retorno ?? retornoAnterior)) / 2 : punto.indicacion;
    retornoAnterior = punto.retorno ?? retornoAnterior;

    const elegida = composicionElegida(datos.composiciones?.[punto.n], punto, piezas, avisos);
    let elegidas = elegida || componerCarga(punto.carga, piezas);
    let supuestas = false;
    let sustitucion = null;
    // Carga mayor que todas las pesas: sustitución (4.3.3; decisión 8).
    if (!elegidas && !sinPiezas.length) {
      sustitucion = referenciaSustitucion({
        carga: punto.carga,
        piezas,
        opcionesReferencia: opcionesMasa,
        componentesEn: (indicacionPaso) => {
          const rangoPaso = rangoDeCarga(rangos, indicacionPaso);
          const sPaso = repetibilidadPara(indicacionPaso, ensayos, reglas.repetibilidad);
          return componentesIndicacion(indicacionPaso, { d0: rangos[0].d, dI: rangoPaso.d, s: sPaso?.s, nuS: sPaso?.nu, uRelEcc: ecc.uRel });
        },
      });
      if (sustitucion) {
        elegidas = sustitucion.piezas;
        avisos.info('SUSTITUCION', sustitucion.sumaDiferencias == null
          ? `Punto ${punto.n}: carga de sustitución (${sustitucion.descripcion}, ${sustitucion.ecuacion}); ServiceMET no registra las diferencias ΔI, se toman como cero.`
          : `Punto ${punto.n}: carga de sustitución (${sustitucion.descripcion}, ${sustitucion.ecuacion}); ServiceMET no registra las diferencias ΔI: su suma sale de la carga declarada.`);
      }
    }
    if (!elegidas && sinPiezas.length) {
      const juego = sinPiezas[0];
      elegidas = (piezasSupuestas(punto.carga) || []).map(p => {
        const densidad = densidadSupuesta(juego.material, config.densidades) || { rho: 8000, u: 0 };
        const nominalMg = p.nominal * MG_POR[unidad];
        return {
          ...p,
          juego: juego.codigo,
          correccion: null,
          U: null,
          emp: (datos.empR111(juego.clase, nominalMg) || 0) / MG_POR[unidad],
          densidad: densidad.rho,
          uDensidad: densidad.u,
          clase: juego.clase,
          rhoA1: juego.rhoA1,
        };
      });
      supuestas = elegidas.length > 0;
      if (!supuestas) elegidas = null;
    }
    if (!elegidas) {
      avisos.aviso('CARGA_NO_COMPUESTA', `La carga ${punto.carga} del punto ${punto.n} no se puede formar con las piezas de los juegos elegidos.`);
      puntos.push({ ...base, calculado: false, motivo: 'La carga no se forma con las piezas' });
      continue;
    }
    if (elegidas.some(p => !(p.emp > 0) && p.correccion == null)) {
      avisos.aviso('PESA_SIN_EMP', `En el punto ${punto.n} hay piezas sin certificado ni emp de la R111 (valor nominal fuera de la Tabla 1): su u queda en cero.`);
    }

    const referencia = sustitucion ? sustitucion.referencia : masaReferencia(elegidas, opcionesMasa);
    const rango = rangoDeCarga(rangos, punto.carga);
    const s = repetibilidadPara(I, ensayos, reglas.repetibilidad);
    const componentesI = componentesIndicacion(I, { d0: rangos[0].d, dI: rango.d, s: s?.s, nuS: s?.nu, uRelEcc: ecc.uRel });
    const resultado = errorEnPunto({
      indicacion: I,
      componentesI,
      referencia,
      opciones: { cobertura: reglas.cobertura, redondeo: reglas.redondeo, presentacion: reglas.presentacion, decimalesRango: decimalesDeRango(rango) },
    });

    // emp NB 23001, % de la carga o la tabla del cliente (en masa o en d).
    const tolerancia = toleranciaEn(punto.carga);
    const conforme = conformidad({
      error: resultado.error,
      U: resultado.U,
      k: resultado.k,
      tolerancia,
      regla: modelo.criterio.regla,
      bandaGuarda: reglas.bandaGuarda,
      metodoRiesgo: reglas.riesgo,
      presentado: resultado.presentacion,
    });

    // Avisos de RECA (configurables).
    const lim = config.avisos;
    if (Math.abs(resultado.error) > lim.lecturaVsCargaEnD * rango.d) {
      avisos.aviso('LECTURA_LEJOS_DE_CARGA', `Punto ${punto.n}: el error (${resultado.error.toPrecision(3)}) supera ${lim.lecturaVsCargaEnD}·d.`);
    }
    if (resultado.U > lim.uEnD * rango.d) {
      avisos.info('U_MAYOR_QUE_3D', `Punto ${punto.n}: U (${resultado.presentacion.U}) es mayor que ${lim.uEnD}·d.`);
    }

    puntos.push({
      ...base,
      calculado: true,
      indicacion: I,
      rango: { max: rango.max, d: rango.d, e: rango.e },
      piezas: elegidas.map(p => ({ clave: p.clave || null, juego: p.juego, nominal: p.nominal, identificacion: p.identificacion, supuesta: Boolean(p.supuesta || supuestas) })),
      supuestas,
      composicion: elegida ? 'ELEGIDA' : sustitucion ? 'SUSTITUCION' : supuestas ? 'SUPUESTA' : 'REGLA',
      sustitucion: sustitucion ? { n: sustitucion.n, descripcion: sustitucion.descripcion, ecuacion: sustitucion.ecuacion } : null,
      // Desglose de mref = mN + δmc + δmB, para explicar el cálculo (sin sustitución).
      masa: sustitucion ? null : {
        mN: referencia.mN,
        correccion: referencia.deltaMc,
        empuje: referencia.deltaMb,
        piezas: (referencia.piezas || []).map(p => ({
          nominal: p.nominal, correccion: p.correccion, correccionB: p.correccionB, densidad: p.densidad?.rho ?? null,
        })),
      },
      ...resultado,
      tolerancia,
      conformidad: conforme,
    });
  }

  if (modelo.criterio.empNB23001 && !claseInstrumento) {
    avisos.aviso('SIN_CLASE', 'Se pidió el emp NB 23001 pero el instrumento no tiene clase registrada ni pedida por el cliente: no se evalúa la conformidad.');
  }
  if (ecc.maxima > config.avisos.excentricidadEnD * Math.max(...rangos.map(r => r.d))) {
    avisos.info('EXCENTRICIDAD_MAYOR_QUE_2D', `La diferencia máxima de excentricidad (${ecc.maxima.toPrecision(3)}) supera ${config.avisos.excentricidadEnD}·d.`);
  }

  const calculados = puntos.filter(p => p.calculado);

  // Información adicional: incertidumbre en uso, global y pesada mínima (7.4, 7.5, G).
  let enUso = null;
  if (calculados.length && config.enUso) {
    const resultado = incertidumbreEnUso({
      rangos,
      d0: rangos[0].d,
      puntos: calculados.map(p => ({ I: p.indicacion, E: p.error, u: p.u })),
      s: Math.max(0, ...ensayos.map(e => e.s || 0)),
      eccMaxima: ecc.maxima,
      eccCarga: cargaEcc,
      clase: claseInstrumento,
      configuracion: config.enUso,
    });
    const maxTotal = rangos[rangos.length - 1].max;
    const tabla = (config.enUso.fracciones || []).map((fraccion) => {
      const R = fraccion * maxTotal;
      const r = resultado.rangos.find(x => R <= x.max * (1 + 1e-9)) || resultado.rangos[resultado.rangos.length - 1];
      return { fraccion, R, U: r.U(R), Ugl: r.Ugl(R) };
    });
    // Pesada mínima en el rango menor, donde se pesan las cantidades pequeñas (G-9).
    const menor = resultado.rangos[0];
    const alfaGl = menor.U0;
    const betaGl = menor.C + Math.abs(resultado.a1);
    const pm = config.pesadaMinima || { exactitudes: [], factores: [] };
    enUso = {
      k: resultado.k,
      deltaT: resultado.deltaT,
      kT: resultado.kT,
      origenKT: resultado.origenKT,
      a1: resultado.a1,
      terminos: resultado.terminos,
      rangos: resultado.rangos.map(r => ({ max: r.max, d: r.d, U0: r.U0, C: r.C, alfa: r.alfa, beta: r.beta })),
      tabla,
      pesadaMinima: {
        alfaGl,
        betaGl,
        exactitudes: pm.exactitudes,
        factores: pm.factores,
        filas: pm.exactitudes.map(exactitud => ({
          exactitud,
          valores: pm.factores.map((factor) => {
            const valor = pesadaMinima({ alfaGl, betaGl, exactitud, factor });
            return valor != null && valor <= maxTotal ? valor : null;
          }),
        })),
      },
    };
  }

  // Evaluación USP ⟨41⟩ (información adicional, a pedido del cliente).
  const usp = calculados.length && config.usp ? evaluarUSP({
    rangos,
    ensayos,
    puntos: calculados,
    configuracion: config.usp,
    pesadaMinima: config.pesadaMinima,
  }) : null;

  return {
    calculado: calculados.length > 0,
    provisional: avisos.lista.some(a => ['PESAS_SIN_VALORES', 'PESAS_SIN_VERIFICAR', 'PIEZAS_SUPUESTAS', 'THB_SIN_VALORES'].includes(a.codigo)),
    unidad,
    configuracion: config.version,
    // Reglas de cálculo con las que se calculó (configuración del método).
    reglas,
    conveccion: usaConveccion ? conveccion : null,
    // Clase con la que se calculó el emp NB 23001: la registrada o la sugerida.
    clase: {
      valor: claseInstrumento,
      registrada: Boolean(claseRegistrada),
      requerida: modelo.criterio.empNB23001 === true,
      sugerida: sugerida || null,
    },
    aire: { rho: aire.rho, u: aire.u, formula: aire.formula, condiciones: aire.condiciones },
    // Cómo se trató el empuje: 5b con la densidad del aire de la calibración de
    // cada juego (ρa1) si se conoce; si no, 5a.
    empuje: {
      metodo: config.empuje,
      kD: config.kD,
      juegos: [...new Map([...piezas, ...sinPiezas].map(p => [p.juego ?? p.codigo, p.rhoA1 ?? null])).entries()]
        .map(([juego, rhoA1]) => ({ juego, rhoA1 })),
    },
    repetibilidad: ensayos,
    excentricidad: { carga: cargaEcc, diferencias: ecc.diferencias, maxima: ecc.maxima, uRel: ecc.uRel, metodo: reglas.excentricidad },
    // Piezas registradas de los juegos, para elegir a mano la composición de una carga.
    piezasDisponibles: piezas.map(p => ({ clave: p.clave, juego: p.juego, nominal: p.nominal, identificacion: p.identificacion })),
    puntos,
    enUso,
    usp,
    avisos: avisos.lista,
  };
};

module.exports = { calcularServicio, reglasDe };
