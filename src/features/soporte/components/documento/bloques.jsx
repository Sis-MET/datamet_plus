/**
 * Bloques del informe impreso. Cada bloque es una cuadrícula de 33 columnas
 * iguales, las columnas A..AG de las plantillas Excel, y cada casilla se
 * ubica con el mismo rango de la plantilla ("A:D", "E:P"…). Así el informe
 * conserva las proporciones del Excel.
 */
import { cn } from '../../../../shared/utils/cn';
import { calcularPruebas, conUnidad, formatoNumero } from '../../domain/calculos';
import { formatoFecha } from '../../domain/informe';
import { filasConDatos } from '../../domain/plantillas';
import { leerPlataforma } from '../../domain/plataforma';
import { DiagramaCamion, DiagramaPlataforma } from './diagramas';
import { Simbolo, Valoracion } from './Simbolo';

// ─── Cuadrícula ────────────────────────────────────────────────────────────

const indiceColumna = (letras) => letras.split('').reduce((n, letra) => n * 26 + (letra.charCodeAt(0) - 64), 0);

/** "E:P" (y fila) → posición en la cuadrícula. */
const ubicar = (rango, fila, filas = 1) => {
  const [desde, hasta = desde] = rango.split(':');
  return {
    gridColumn: `${indiceColumna(desde)} / ${indiceColumna(hasta) + 1}`,
    ...(fila ? { gridRow: `${fila} / span ${filas}` } : {}),
  };
};

/** Casilla. `tipo`: etq (gris), val, barra (azul), verde, gris, dif, borde. */
function C({ r, f, n, tipo = 'val', izq = false, className, children }) {
  return (
    <div className={cn('st-c', `st-${tipo}`, izq && 'st-izq', className)} style={ubicar(r, f, n)}>
      {children}
    </div>
  );
}

function Grid({ className, children, style }) {
  return <div className={cn('st-grid', className)} style={style}>{children}</div>;
}

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';
const textoDe = (valor) => (vacio(valor) ? '-' : String(valor));

/** Valor de un campo de datos: fecha con formato, número o texto. */
const valorCampo = (definicion, valores, contexto) => {
  const valor = valores[definicion.campo];
  if (vacio(valor)) return '-';
  if (definicion.tipo === 'fecha') return formatoFecha(valor);
  if (definicion.tipo === 'numero' && definicion.unidad) return conUnidad(valor, contexto.decimales, contexto.unidad);
  if (definicion.tipo === 'estado') return <Valoracion valor={valor} />;
  // Cero celdas no es un dato: la plantilla lo imprimía como «-».
  if (definicion.tipo === 'entero' && Number(valor) === 0) return '-';
  return String(valor);
};

// ─── Encabezado, datos y rangos ────────────────────────────────────────────

export function EncabezadoInforme({ titulo, numero }) {
  return (
    <div className="st-titulo">
      <span>{titulo}</span>
      <span>{numero}</span>
    </div>
  );
}

function Barra({ titulo, izq = false, r = 'A:AG', f = 1 }) {
  return <C r={r} f={f} tipo="barra" izq={izq}>{titulo}</C>;
}

function BloqueDatos({ bloque, valores, contexto }) {
  return (
    <Grid className="st-datos">
      <Barra titulo={bloque.titulo} izq />
      {bloque.filas.map(([izq, der], index) => {
        const fila = index + 2;
        return [
          <C key={`${izq.campo}-e`} r="A:D" f={fila} tipo="etq" izq>{izq.label}</C>,
          <C key={`${izq.campo}-v`} r="E:P" f={fila}>{valorCampo(izq, valores, contexto)}</C>,
          <C key={`${der.campo}-e`} r="R:V" f={fila} tipo="etq" izq>{der.label}</C>,
          <C key={`${der.campo}-v`} r="W:AG" f={fila}>{valorCampo(der, valores, contexto)}</C>,
        ];
      })}
    </Grid>
  );
}

/** Capacidad, d y e de cada rango; 0 o vacío es «-», como en la plantilla. */
const valorRango = (valor) => (vacio(valor) || Number(valor) === 0 ? '-' : String(valor));

function BloqueRangos({ bloque, valores }) {
  const filas = bloque.filas;
  return (
    <Grid className="st-rangos">
      <Barra titulo={bloque.titulo} r="E:AC" />
      <C r="E:I" f={2} tipo="gris">Rango:</C>
      <C r="J:N" f={2} tipo="gris">Capacidad<br />Máxima:</C>
      <C r="O:S" f={2} tipo="gris">Resolución (d):</C>
      <C r="T:X" f={2} tipo="gris">Escala de<br />Verificación (e):</C>
      <C r="Y:AC" f={2} tipo="gris">Unidades:</C>
      {Array.from({ length: filas }, (_, index) => {
        const i = index + 1;
        const fila = i + 2;
        return [
          <C key={`r${i}`} r="E:I" f={fila} tipo="borde" className="st-rango-n">{i}</C>,
          <C key={`c${i}`} r="J:N" f={fila} tipo="borde">{valorRango(valores[`cap_max${i}`])}</C>,
          <C key={`d${i}`} r="O:S" f={fila} tipo="borde">{valorRango(valores[`d${i}`])}</C>,
          <C key={`e${i}`} r="T:X" f={fila} tipo="borde">{valorRango(valores[`e${i}`])}</C>,
        ];
      })}
      <C r="Y:AC" f={3} n={filas} tipo="borde">{textoDe(valores.unidades)}</C>
    </Grid>
  );
}

function BloqueAlcance({ bloque }) {
  return (
    <Grid className={cn('st-alcance', bloque.compacto && 'st-compacto')}>
      <Barra titulo={bloque.titulo} />
      <C r="A:AG" f={2} izq className="st-parrafo">
        <div>
          {bloque.lineas.map(linea => <p key={linea}>{linea}</p>)}
          {bloque.nota && <p className="st-nota">{bloque.nota}</p>}
        </div>
      </C>
    </Grid>
  );
}

function BloqueLeyenda() {
  const item = (label, clase, rLabel, rIcono) => [
    <C key={`${clase}-l`} r={rLabel} f={1} className="st-leyenda-etq">{label}</C>,
    <C key={`${clase}-i`} r={rIcono} f={1}><Simbolo clase={clase} size="20pt" /></C>,
  ];
  return (
    <Grid className="st-leyenda">
      {item('Bueno:', 'bueno', 'C:F', 'G:H')}
      {item('Regular:', 'regular', 'K:N', 'O:P')}
      {item('Malo:', 'malo', 'S:V', 'W:X')}
      {item('No Aplica:', 'noaplica', 'AA:AD', 'AE:AF')}
    </Grid>
  );
}

function BloqueTexto({ bloque, valores }) {
  if (bloque.opcional && vacio(valores[bloque.campo])) return null;
  return (
    <Grid className="st-texto">
      <Barra titulo={bloque.titulo} />
      <C r="A:AG" f={2} izq className="st-parrafo">{textoDe(valores[bloque.campo])}</C>
    </Grid>
  );
}

// ─── Pruebas metrológicas ──────────────────────────────────────────────────

/**
 * Datos y resultados de un bloque de pruebas con los valores del informe.
 * Solo se imprimen las filas con datos (al menos una).
 */
function datosPruebas(esquema, valores, contexto, preferida = 'd') {
  const presentes = new Set(Object.keys(valores));
  const nExc = filasConDatos(esquema.exc, valores, presentes);
  const nRep = filasConDatos(esquema.rep, valores, presentes);
  const nLin = filasConDatos(esquema.lin, valores, presentes);
  const exc = Array.from({ length: nExc }, (_, index) => {
    const i = index + 1;
    const posicion = valores[esquema.exc.posicion(i)];
    return { posicion: vacio(posicion) ? i : posicion, indicacion: valores[esquema.exc.indicacion(i)] };
  });
  const rep = Array.from({ length: nRep }, (_, index) => valores[esquema.rep.indicacion(index + 1)]);
  const lin = Array.from({ length: nLin }, (_, index) => ({
    carga: valores[esquema.lin.carga(index + 1)],
    indicacion: valores[esquema.lin.indicacion(index + 1)],
  }));
  const cargaExc = valores[esquema.exc.carga];
  const cargaRep = valores[esquema.rep.carga];
  const resultados = calcularPruebas(
    {
      excentricidad: exc.map(e => e.indicacion),
      repetibilidad: rep,
      linealidad: lin,
      cargas: { excentricidad: cargaExc, repetibilidad: cargaRep },
    },
    { rangos: contexto.rangos, decimales: contexto.decimales, preferida },
  );
  const lecturas = exc.filter(e => !vacio(e.indicacion)).length;
  const plataforma = esquema.plataforma
    ? leerPlataforma(valores[esquema.plataforma.tipo], valores[esquema.plataforma.puntos], lecturas)
    : null;
  return {
    cargaExc,
    cargaRep,
    exc,
    rep,
    lin,
    retorno: valores[esquema.retorno],
    estabilidad: valores[esquema.estabilidad],
    resultados,
    plataforma: lecturas > 0 ? plataforma : null,
  };
}

const enUnidad = (valor, contexto) => conUnidad(valor, contexto.decimales, contexto.unidad);

/** Resultado en divisiones: «3 d» (enteros) o «1.0 e» (decimales del instrumento). */
const enDiv = (valor, contexto, simbolo = 'd', preferida = 'd') => {
  if (valor === null || valor === undefined) return '-';
  return `${formatoNumero(valor, preferida === 'e' ? contexto.decimales : 0)} ${simbolo}`;
};

const etiquetaCarga = (carga, contexto) => (vacio(carga) ? '-' : `Carga: ${enUnidad(carga, contexto)}`);

/**
 * Retorno a cero y estabilidad. Con diagrama de la plataforma, el diagrama
 * va bajo la excentricidad y estos dos cuadros bajo la repetibilidad y la
 * linealidad.
 */
function RetornoEstabilidad({ retorno, estabilidad, diagrama = null }) {
  if (!diagrama) {
    return (
      <Grid className="st-retorno">
        <C r="G:O" f={1} tipo="verde">Retorno a Cero:</C>
        <C r="S:AA" f={1} tipo="verde">Estabilidad:</C>
        <C r="G:K" f={2} tipo="gris">Estado:</C>
        <C r="L:O" f={2}><Valoracion valor={retorno} /></C>
        <C r="S:W" f={2} tipo="gris">Estado:</C>
        <C r="X:AA" f={2}><Valoracion valor={estabilidad} /></C>
      </Grid>
    );
  }
  return (
    <Grid className="st-retorno st-con-diagrama">
      <div className="st-diagrama-celda" style={ubicar('A:I', 1, 3)}>{diagrama}</div>
      <C r="M:U" f={1} tipo="verde">Retorno a Cero:</C>
      <C r="Y:AG" f={1} tipo="verde">Estabilidad:</C>
      <C r="M:Q" f={2} tipo="gris">Estado:</C>
      <C r="R:U" f={2}><Valoracion valor={retorno} /></C>
      <C r="Y:AC" f={2} tipo="gris">Estado:</C>
      <C r="AD:AG" f={2}><Valoracion valor={estabilidad} /></C>
    </Grid>
  );
}

/** Diagrama de la plataforma de un bloque de pruebas (null si no se registró). */
function diagramaDe(d, contexto) {
  if (!d.plataforma) return null;
  if (d.plataforma.forma === 'camion') {
    return <DiagramaCamion plataforma={d.plataforma} lecturas={d.exc} formato={valor => enUnidad(valor, contexto)} />;
  }
  return <DiagramaPlataforma plataforma={d.plataforma} />;
}

function BloquePruebas({ bloque, valores, contexto }) {
  const preferida = bloque.division || 'd';
  const d = datosPruebas(bloque.esquema, valores, contexto, preferida);
  const { resultados } = d;
  // La linealidad empieza en la fila de «Posición / Cantidad»: tiene una fila más.
  const n = Math.max(d.exc.length, d.rep.length, d.lin.length - 1, 1);
  const primera = 5; // fila de la primera lectura de excentricidad y repetibilidad
  const resumen = primera + n;
  const celdas = [];
  for (let i = 0; i < n; i += 1) {
    const fila = primera + i;
    const e = d.exc[i];
    const r = d.rep[i];
    if (e) {
      celdas.push(<C key={`ep${i}`} r="A:D" f={fila}>{textoDe(e.posicion)}</C>);
      celdas.push(<C key={`ei${i}`} r="F:I" f={fila}>{enUnidad(e.indicacion, contexto)}</C>);
    }
    if (i < d.rep.length) {
      celdas.push(<C key={`rc${i}`} r="M:P" f={fila}>{i + 1}</C>);
      celdas.push(<C key={`ri${i}`} r="R:U" f={fila}>{enUnidad(r, contexto)}</C>);
    }
  }
  d.lin.forEach((punto, i) => {
    const fila = primera - 1 + i;
    celdas.push(<C key={`lc${i}`} r="Y:AA" f={fila}>{enUnidad(punto.carga, contexto)}</C>);
    celdas.push(<C key={`li${i}`} r="AB:AD" f={fila}>{enUnidad(punto.indicacion, contexto)}</C>);
    celdas.push(<C key={`le${i}`} r="AE:AG" f={fila}>{enUnidad(resultados.linealidad.errores[i], contexto)}</C>);
  });

  return (
    <div className="st-pruebas-bloque">
      <Grid className="st-pruebas">
        <Barra titulo={bloque.titulo} />
        <C r="A:I" f={2} tipo="gris">Excentricidad</C>
        <C r="M:U" f={2} tipo="gris">Repetibilidad</C>
        <C r="Y:AG" f={2} tipo="gris">Linealidad</C>
        <C r="A:I" f={3} tipo="verde">{etiquetaCarga(d.cargaExc, contexto)}</C>
        <C r="M:U" f={3} tipo="verde">{etiquetaCarga(d.cargaRep, contexto)}</C>
        <C r="Y:AA" f={3} tipo="verde">Carga</C>
        <C r="AB:AD" f={3} tipo="verde">Indicación</C>
        <C r="AE:AG" f={3} tipo="verde">Error</C>
        <C r="A:D" f={4} tipo="gris">Posición</C>
        <C r="F:I" f={4} tipo="gris">Indicación</C>
        <C r="M:P" f={4} tipo="gris">Cantidad</C>
        <C r="R:U" f={4} tipo="gris">Indicación</C>
        {celdas}
        <C r="A:D" f={resumen} n={2} tipo="dif">Diferencia<br />Máxima</C>
        <C r="F:I" f={resumen} tipo="dif">{enUnidad(resultados.excentricidad.diferencia, contexto)}</C>
        <C r="F:I" f={resumen + 1} tipo="dif">{enDiv(resultados.excentricidad.divisiones, contexto, resultados.excentricidad.simbolo, preferida)}</C>
        <C r="M:P" f={resumen} n={2} tipo="dif">Diferencia<br />Máxima</C>
        <C r="R:U" f={resumen} tipo="dif">{enUnidad(resultados.repetibilidad.diferencia, contexto)}</C>
        <C r="R:U" f={resumen + 1} tipo="dif">{enDiv(resultados.repetibilidad.divisiones, contexto, resultados.repetibilidad.simbolo, preferida)}</C>
        <C r="Y:AB" f={resumen} n={2} tipo="dif">Error Máximo:</C>
        <C r="AD:AG" f={resumen} tipo="dif">{enUnidad(resultados.linealidad.maximo, contexto)}</C>
        <C r="AD:AG" f={resumen + 1} tipo="dif">{enDiv(resultados.linealidad.divisiones, contexto, resultados.linealidad.simbolo, preferida)}</C>
      </Grid>
      <RetornoEstabilidad retorno={d.retorno} estabilidad={d.estabilidad} diagrama={diagramaDe(d, contexto)} />
    </div>
  );
}

// ─── Pruebas del preventivo avanzado (IMPA) ────────────────────────────────

const unidadEntre = (contexto) => (contexto.unidad ? ` (${contexto.unidad})` : '');

/** «Ida 1» si el técnico lo registró; si no, el número de fila. */
const etiquetaPosicion = (posicion, index) => (vacio(posicion) || Number(posicion) === index + 1 ? index + 1 : posicion);

function BloqueExcentricidadAvanzado({ bloque, valores, contexto }) {
  const d = datosPruebas(bloque.esquema, valores, contexto, 'e');
  const filas = d.exc.length;
  // El diagrama ocupa al menos 9 filas de alto a la derecha de la tabla.
  const altoDiagrama = Math.max(filas + 1, 9);
  const resumen = 3 + altoDiagrama + 1;
  const { simbolo } = d.resultados.excentricidad;
  return (
    <Grid className="st-avanzado">
      <Barra titulo={bloque.titulo} />
      <C r="B:D" f={3} tipo="verde">Posición</C>
      <C r="E:J" f={3} tipo="verde">Lecturas</C>
      {d.exc.map((lectura, index) => [
        <C key={`p${index}`} r="B:D" f={4 + index} tipo="borde">{etiquetaPosicion(lectura.posicion, index)}</C>,
        <C key={`l${index}`} r="E:J" f={4 + index} tipo="borde">{enUnidad(lectura.indicacion, contexto)}</C>,
      ])}
      {d.plataforma && (
        <div className="st-diagrama-celda" style={ubicar('L:AF', 3, altoDiagrama)}>{diagramaDe(d, contexto)}</div>
      )}
      <C r="I:O" f={resumen} n={2} tipo="dif">Diferencia Maxima{unidadEntre(contexto)}</C>
      <C r="Q:U" f={resumen} n={2} tipo="dif">{enUnidad(d.resultados.excentricidad.diferencia, contexto)}</C>
      <C r="I:O" f={resumen + 2} n={2} tipo="dif">Diferencia Maxima ({simbolo})</C>
      <C r="Q:U" f={resumen + 2} n={2} tipo="dif">{enDiv(d.resultados.excentricidad.divisiones, contexto, simbolo, 'e')}</C>
    </Grid>
  );
}

function BloqueRepetibilidadAvanzado({ bloque, valores, contexto }) {
  const d = datosPruebas(bloque.esquema, valores, contexto, 'e');
  const { simbolo } = d.resultados.repetibilidad;
  return (
    <Grid className="st-avanzado">
      <Barra titulo={bloque.titulo} />
      <C r="B:D" f={3} tipo="verde">Cantidad</C>
      <C r="E:J" f={3} tipo="verde">Lecturas</C>
      {d.rep.map((valor, index) => [
        <C key={`c${index}`} r="B:D" f={4 + index} tipo="borde">{index + 1}</C>,
        <C key={`l${index}`} r="E:J" f={4 + index} tipo="borde">{enUnidad(valor, contexto)}</C>,
      ])}
      <C r="O:U" f={4} n={2} tipo="dif">Diferencia Maxima{unidadEntre(contexto)}</C>
      <C r="W:AA" f={4} n={2} tipo="dif">{enUnidad(d.resultados.repetibilidad.diferencia, contexto)}</C>
      <C r="O:U" f={6} n={2} tipo="dif">Diferencia Maxima ({simbolo})</C>
      <C r="W:AA" f={6} n={2} tipo="dif">{enDiv(d.resultados.repetibilidad.divisiones, contexto, simbolo, 'e')}</C>
    </Grid>
  );
}

function BloqueLinealidadAvanzado({ bloque, valores, contexto }) {
  const d = datosPruebas(bloque.esquema, valores, contexto, 'e');
  const { simbolo } = d.resultados.linealidad;
  return (
    <Grid className="st-avanzado">
      <Barra titulo={bloque.titulo} />
      <C r="B:D" f={3} tipo="verde">Cantidad</C>
      <C r="E:J" f={3} tipo="verde">Carga</C>
      <C r="K:P" f={3} tipo="verde">Indicación</C>
      <C r="Q:T" f={3} tipo="verde">Error</C>
      {d.lin.map((punto, index) => [
        <C key={`c${index}`} r="B:D" f={4 + index} tipo="borde">{index + 1}</C>,
        <C key={`g${index}`} r="E:J" f={4 + index} tipo="borde">{enUnidad(punto.carga, contexto)}</C>,
        <C key={`i${index}`} r="K:P" f={4 + index} tipo="borde">{enUnidad(punto.indicacion, contexto)}</C>,
        <C key={`e${index}`} r="Q:T" f={4 + index} tipo="borde">{enUnidad(d.resultados.linealidad.errores[index], contexto)}</C>,
      ])}
      <C r="V:Z" f={4} n={2} tipo="dif">Error Maxima{unidadEntre(contexto)}</C>
      <C r="AB:AF" f={4} n={2} tipo="dif">{enUnidad(d.resultados.linealidad.maximo, contexto)}</C>
      <C r="V:Z" f={6} n={2} tipo="dif">Error Maxima ({simbolo})</C>
      <C r="AB:AF" f={6} n={2} tipo="dif">{enDiv(d.resultados.linealidad.divisiones, contexto, simbolo, 'e')}</C>
    </Grid>
  );
}

function BloqueRetorno({ bloque, valores }) {
  return <RetornoEstabilidad retorno={valores[bloque.esquema.retorno]} estabilidad={valores[bloque.esquema.estabilidad]} />;
}

// ─── Tablas de estado ──────────────────────────────────────────────────────

/**
 * Ajuste de una fila. «No aplica» sale con su símbolo ⊘ (el de la leyenda)
 * para que se vea que se evaluó; sin dato, una raya. En Instalación, sin
 * comentario vale «No aplica», como en la plantilla INST.
 */
const ajusteDe = (item, valores) => {
  const valor = valores[item.ajuste];
  return vacio(valor) ? (item.ajustePorDefecto ?? null) : valor;
};

function BloqueChecklist({ bloque, valores }) {
  const filas = [];
  for (let i = 0; i < bloque.items.length; i += 2) filas.push([bloque.items[i], bloque.items[i + 1]]);
  const [param, estado, ajuste] = bloque.columnas;
  return (
    <Grid className="st-checklist">
      <Barra titulo={bloque.titulo} />
      <C r="A:F" f={2} tipo="gris">{param}</C>
      <C r="G:K" f={2} tipo="gris">{estado}</C>
      <C r="L:P" f={2} tipo="gris">{ajuste}</C>
      {filas.some(([, der]) => der) && (
        <>
          <C r="R:W" f={2} tipo="gris">{param}</C>
          <C r="X:AB" f={2} tipo="gris">{estado}</C>
          <C r="AC:AG" f={2} tipo="gris">{ajuste}</C>
        </>
      )}
      {filas.map(([izq, der], index) => {
        const fila = index + 3;
        return [
          <C key={`${izq.estado}-l`} r="A:F" f={fila} tipo="etq" izq>{izq.label}</C>,
          <C key={`${izq.estado}-e`} r="G:K" f={fila}><Valoracion valor={valores[izq.estado]} /></C>,
          <C key={`${izq.estado}-a`} r="L:P" f={fila}><Valoracion valor={ajusteDe(izq, valores)} /></C>,
          der && <C key={`${der.estado}-l`} r="R:W" f={fila} tipo="etq" izq>{der.label}</C>,
          der && <C key={`${der.estado}-e`} r="X:AB" f={fila}><Valoracion valor={valores[der.estado]} /></C>,
          der && <C key={`${der.estado}-a`} r="AC:AG" f={fila}><Valoracion valor={ajusteDe(der, valores)} /></C>,
        ];
      })}
    </Grid>
  );
}

const COLUMNAS_3 = [['A:F', 'G:J'], ['K:P', 'Q:U'], ['V:AA', 'AB:AG']];

function BloqueChecklist3({ bloque, valores }) {
  return (
    <Grid className="st-checklist3">
      <Barra titulo={bloque.titulo} />
      {bloque.columnas.map((columna, c) => [
        <C key={`h${c}p`} r={COLUMNAS_3[c][0]} f={2} tipo="gris">Parámetro:</C>,
        <C key={`h${c}e`} r={COLUMNAS_3[c][1]} f={2}>Estado</C>,
        ...columna.flatMap((definicion, index) => [
          <C key={`${definicion.campo}-l`} r={COLUMNAS_3[c][0]} f={index + 3} tipo="etq" izq>{definicion.label}</C>,
          <C key={`${definicion.campo}-v`} r={COLUMNAS_3[c][1]} f={index + 3}><Valoracion valor={valores[definicion.campo]} /></C>,
        ]),
      ])}
    </Grid>
  );
}

// ─── Cierre ────────────────────────────────────────────────────────────────

function BloqueAdicionales({ bloque, valores, contexto }) {
  const celdas = bloque.campos.length === 3
    // IREL: pesada mínima, pesada máxima y tipo de servicio.
    ? [['A:D', 'E:H'], ['I:L', 'M:Q'], ['R:Y', 'Z:AG']]
    : [['A:H', 'I:P'], ['R:Y', 'Z:AG']];
  return (
    <Grid className="st-adicionales">
      <Barra titulo={bloque.titulo} />
      {bloque.campos.map((definicion, index) => [
        <C key={`${definicion.campo}-l`} r={celdas[index][0]} f={2} tipo="etq" izq>{definicion.label}</C>,
        <C key={`${definicion.campo}-v`} r={celdas[index][1]} f={2}>{valorCampo(definicion, valores, contexto)}</C>,
      ])}
    </Grid>
  );
}

const CELDAS_CONCLUSION = [['B:F', 'G:J'], ['M:Q', 'R:U'], ['X:AB', 'AC:AF']];

function BloqueConclusion({ bloque, valores, contexto }) {
  // Segunda fila (estado final, personal de apoyo): solo si tiene datos.
  const extras = (bloque.extras || []).some(definicion => !vacio(valores[definicion.campo])) ? bloque.extras : [];
  return (
    <Grid className="st-conclusion">
      <Barra titulo={bloque.titulo} />
      {bloque.campos.map((definicion, index) => [
        <C key={`${definicion.campo}-l`} r={CELDAS_CONCLUSION[index][0]} f={2} tipo="gris">{definicion.label}</C>,
        <C key={`${definicion.campo}-v`} r={CELDAS_CONCLUSION[index][1]} f={2}><Valoracion valor={valores[definicion.campo]} /></C>,
      ])}
      {extras.map((definicion, index) => [
        <C key={`${definicion.campo}-l`} r={CELDAS_CONCLUSION[index][0]} f={3} tipo="gris">{definicion.label}</C>,
        <C key={`${definicion.campo}-v`} r={CELDAS_CONCLUSION[index][1]} f={3}>{valorCampo(definicion, valores, contexto)}</C>,
      ])}
    </Grid>
  );
}

function BloqueTecnico({ bloque, valores }) {
  return (
    <Grid className="st-tecnico">
      <C r="A:P" f={1} tipo="barra">{bloque.etiqueta}</C>
      <C r="Q:AG" f={1}>{textoDe(valores[bloque.campo])}</C>
    </Grid>
  );
}

const BLOQUES = {
  datos: BloqueDatos,
  rangos: BloqueRangos,
  alcance: BloqueAlcance,
  leyenda: BloqueLeyenda,
  texto: BloqueTexto,
  pruebas: BloquePruebas,
  excentricidadAvanzado: BloqueExcentricidadAvanzado,
  repetibilidadAvanzado: BloqueRepetibilidadAvanzado,
  linealidadAvanzado: BloqueLinealidadAvanzado,
  retornoEstabilidad: BloqueRetorno,
  checklist: BloqueChecklist,
  checklist3: BloqueChecklist3,
  adicionales: BloqueAdicionales,
  conclusion: BloqueConclusion,
  tecnico: BloqueTecnico,
};

export function Bloque({ bloque, valores, contexto }) {
  const Componente = BLOQUES[bloque.tipo];
  return Componente ? <Componente bloque={bloque} valores={valores} contexto={contexto} /> : null;
}
