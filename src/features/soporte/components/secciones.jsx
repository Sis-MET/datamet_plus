import { useMemo, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { SuggestInput } from '../../calibration/components/Dropdown';
import { calcularPruebas, conUnidad, decimalesInstrumento, formatoNumero, rangosInstrumento } from '../domain/calculos';
import { leerPlataforma } from '../domain/plataforma';
import { OPCIONES_AJUSTE, filasVisibles } from '../domain/plantillas';
import { textoOriginal } from '../domain/informe';
import { CampoInforme, CampoValoracion } from './campos';
import { DiagramaCamion, DiagramaPlataforma } from './documento/diagramas';

/** Celda numérica de una tabla de pruebas o rangos. */
function CeldaNumero({ campo, editor, label }) {
  const estado = editor.estadoCampo(campo, 'numero');
  return (
    <input
      value={estado.valor === null || estado.valor === undefined ? '' : String(estado.valor)}
      onChange={(event) => editor.cambiar(campo, event.target.value)}
      disabled={estado.bloqueado}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      title={estado.distinto ? `ServiceMET: ${textoOriginal(estado.original)}` : undefined}
      className={cn('st-input-celda', (estado.distinto || estado.pendiente) && 'st-editado', estado.invalido && 'st-invalido')}
    />
  );
}

/** Vuelve a los datos de ServiceMET todos los campos de una sección. */
function RestaurarSeccion({ campos, editor }) {
  const distintos = campos.filter(campo => editor.estadoCampo(campo).distinto && !editor.estadoCampo(campo).bloqueado);
  if (distintos.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => distintos.forEach(campo => editor.cambiar(campo, editor.estadoCampo(campo).original))}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-info underline-offset-4 hover:underline"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Restaurar {distintos.length} {distintos.length === 1 ? 'dato' : 'datos'} de ServiceMET
    </button>
  );
}

// ─── Campos sueltos ────────────────────────────────────────────────────────

export function SeccionCampos({ seccion, editor }) {
  const anchos = seccion.campos.length === 1 && seccion.campos[0].tipo === 'parrafo';
  return (
    <div className={cn('grid gap-x-4 gap-y-4', anchos ? 'grid-cols-1' : seccion.compacto ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2')}>
      {seccion.campos.map(definicion => (
        <CampoInforme
          key={definicion.campo}
          definicion={definicion}
          editor={editor}
          className={definicion.tipo === 'parrafo' ? 'sm:col-span-2 xl:col-span-3' : undefined}
        />
      ))}
    </div>
  );
}

// ─── Rangos ────────────────────────────────────────────────────────────────

export function SeccionRangos({ seccion, editor }) {
  const unidades = { campo: 'unidades', label: 'Unidades', tipo: 'texto' };
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="st-tabla-edicion min-w-[420px]">
          <thead>
            <tr>
              <th scope="col" className="w-16">Rango</th>
              <th scope="col">Capacidad máxima</th>
              <th scope="col">Resolución (d)</th>
              <th scope="col">Escala de verificación (e)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }, (_, index) => {
              const i = index + 1;
              return (
                <tr key={i}>
                  <td className="text-center text-[13px] text-fg-muted">{i}</td>
                  <td><CeldaNumero campo={`cap_max${i}`} editor={editor} label={`Capacidad máxima del rango ${i}`} /></td>
                  <td><CeldaNumero campo={`d${i}`} editor={editor} label={`Resolución d del rango ${i}`} /></td>
                  <td><CeldaNumero campo={`e${i}`} editor={editor} label={`Escala de verificación e del rango ${i}`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="max-w-[220px]"><CampoInforme definicion={unidades} editor={editor} /></div>
      <RestaurarSeccion campos={seccion.campos.map(c => c.campo)} editor={editor} />
    </div>
  );
}

// ─── Tablas de estado ──────────────────────────────────────────────────────

function AjusteItem({ item, editor }) {
  const estado = editor.estadoCampo(item.ajuste);
  const valor = estado.valor === null || estado.valor === undefined ? '' : String(estado.valor);
  return (
    <SuggestInput
      value={valor}
      onChange={(texto) => editor.cambiar(item.ajuste, texto)}
      suggestions={item.tipoAjuste === 'texto' ? [] : OPCIONES_AJUSTE}
      placeholder={item.ajustePorDefecto || 'Ajuste'}
      disabled={estado.bloqueado}
      maxLength={estado.max}
    />
  );
}

function EstadoItem({ item, editor }) {
  const estado = editor.estadoCampo(item.estado);
  if (item.tipoEstado === 'opciones') {
    return (
      <SuggestInput
        value={estado.valor === null || estado.valor === undefined ? '' : String(estado.valor)}
        onChange={(texto) => editor.cambiar(item.estado, texto)}
        suggestions={item.opcionesEstado || []}
        disabled={estado.bloqueado}
        maxLength={estado.max}
      />
    );
  }
  return (
    <CampoValoracion
      label={`Estado de ${item.label.replace(/:$/, '').toLowerCase()}`}
      value={estado.valor}
      onChange={(valor) => editor.cambiar(item.estado, valor)}
      disabled={estado.bloqueado}
    />
  );
}

export function SeccionChecklist({ seccion, editor }) {
  return (
    <div className="st-checklist flex flex-col gap-3">
      {/* 13 px: el relleno de las filas más el borde de la lista, para que las columnas coincidan. */}
      <div className="st-checklist-encabezado px-[13px] text-xs font-medium text-fg-muted">
        <span>Parámetro</span>
        <span>Estado inicial</span>
        <span>Ajuste</span>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {seccion.items.map(item => {
          const cambiado = [item.estado, item.ajuste].some(campo => editor.estadoCampo(campo).distinto || editor.estadoCampo(campo).pendiente);
          return (
            <li key={item.estado} className={cn('st-checklist-fila px-3 py-2.5', cambiado && 'st-campo-editado')}>
              <span className="text-[13px] font-medium text-fg">{item.label.replace(/:$/, '')}</span>
              <div><EstadoItem item={item} editor={editor} /></div>
              <AjusteItem item={item} editor={editor} />
            </li>
          );
        })}
      </ul>
      <RestaurarSeccion campos={seccion.campos.map(c => c.campo)} editor={editor} />
    </div>
  );
}

// ─── Pruebas metrológicas ──────────────────────────────────────────────────

function TablaPuntos({ titulo, columnas, filas, puedeAgregar, onAgregar, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-3">
      <p className="mb-2 px-1 text-[13px] font-semibold text-fg">{titulo}</p>
      <table className="st-tabla-edicion">
        <thead>
          <tr>{columnas.map(columna => <th key={columna} scope="col">{columna}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {puedeAgregar && (
        <button
          type="button"
          onClick={onAgregar}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar punto
        </button>
      )}
      {filas === 0 && <p className="px-1 text-[12.5px] text-fg-muted">Sin puntos.</p>}
    </div>
  );
}

function Resultado({ etiqueta, valor, divisiones }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[12px] text-fg-muted">{etiqueta}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-fg">
        {valor}
        <span className="ml-2 text-[12.5px] font-medium text-fg-muted">{divisiones}</span>
      </p>
    </div>
  );
}

/** Cuántas filas puede tener la tabla: hasta `max`, mientras exista la columna. */
const maximoFilas = (seccion, presentes) => {
  const nombre = typeof seccion.indicacion === 'function' ? seccion.indicacion : null;
  let n = 0;
  for (let i = 1; i <= seccion.max; i += 1) {
    if (nombre && !presentes.has(nombre(i))) break;
    n = i;
  }
  return n;
};

const LADOS_INDICADOR = ['Frontal', 'Atras', 'Izquierda', 'Derecha'];
const OPCIONES_FORMA = ['Cuadrada', 'Rectangular', 'Circular', 'Triangular', 'Báscula de camión'];
/** Como las guarda ServiceMET: «Circular 5 pts - Ind Frontal»; en camión, «6» o «6F». */
const OPCIONES_PUNTOS = [
  ...['Cuadrada', 'Rectangular 3 pts', 'Rectangular 5 pts', 'Circular 4 pts', 'Circular 5 pts', 'Triangular']
    .flatMap(forma => LADOS_INDICADOR.map(lado => `${forma} - Ind ${lado}`)),
  '4', '6', '8', '6F', '6A', '6I', '6D',
];

/** Forma de la plataforma, posiciones e indicador, con su diagrama. */
function Plataforma({ esquema, editor, lecturas, formato }) {
  if (!esquema.plataforma) return null;
  const { tipo, puntos } = esquema.plataforma;
  const valores = editor.valores;
  const plataforma = leerPlataforma(valores[tipo], puntos ? valores[puntos] : null, lecturas.filter(l => l.indicacion !== null && l.indicacion !== undefined && l.indicacion !== '').length);
  return (
    <div className="grid gap-4 rounded-2xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <CampoInforme definicion={{ campo: tipo, label: 'Forma de la plataforma', tipo: 'opciones', opciones: OPCIONES_FORMA }} editor={editor} />
        {puntos && (
          <CampoInforme definicion={{ campo: puntos, label: 'Posiciones e indicador', tipo: 'opciones', opciones: OPCIONES_PUNTOS }} editor={editor} />
        )}
      </div>
      <div className="flex items-center justify-center rounded-xl bg-white p-2" aria-label="Diagrama de la plataforma">
        {!plataforma && <p className="px-2 text-center text-[12.5px] text-neutral-500">Sin forma de plataforma registrada: el informe no lleva diagrama.</p>}
        {plataforma?.forma === 'camion' && <DiagramaCamion plataforma={plataforma} lecturas={lecturas} formato={formato} />}
        {plataforma && plataforma.forma !== 'camion' && <div className="w-full max-w-[280px]"><DiagramaPlataforma plataforma={plataforma} /></div>}
      </div>
    </div>
  );
}

export function SeccionPruebas({ seccion, editor }) {
  const { esquema, division } = seccion;
  const valores = editor.valores;
  const presentes = editor.columnasEditables;
  const [extra, setExtra] = useState({ exc: 0, rep: 0, lin: 0 });

  const filas = (clave) => Math.min(
    maximoFilas(esquema[clave], presentes),
    filasVisibles(esquema[clave], valores, presentes) + extra[clave],
  );
  const nExc = filas('exc');
  const nRep = filas('rep');
  const nLin = filas('lin');

  const decimales = decimalesInstrumento(valores);
  const unidad = String(valores.unidades ?? '').trim();
  const lecturasExc = Array.from({ length: nExc }, (_, i) => ({
    posicion: valores[esquema.exc.posicion(i + 1)],
    indicacion: valores[esquema.exc.indicacion(i + 1)],
  }));
  const resultados = useMemo(() => calcularPruebas({
    excentricidad: Array.from({ length: nExc }, (_, i) => valores[esquema.exc.indicacion(i + 1)]),
    repetibilidad: Array.from({ length: nRep }, (_, i) => valores[esquema.rep.indicacion(i + 1)]),
    linealidad: Array.from({ length: nLin }, (_, i) => ({
      carga: valores[esquema.lin.carga(i + 1)],
      indicacion: valores[esquema.lin.indicacion(i + 1)],
    })),
    cargas: { excentricidad: valores[esquema.exc.carga], repetibilidad: valores[esquema.rep.carga] },
  }, { rangos: rangosInstrumento(valores), decimales, preferida: division }), [valores, esquema, nExc, nRep, nLin, decimales, division]);

  const u = (valor) => conUnidad(valor, decimales, unidad);
  const div = (resultado) => (resultado.divisiones === null ? ''
    : `${formatoNumero(resultado.divisiones, division === 'e' ? decimales : 0)} ${resultado.simbolo}`);
  const agregar = (clave) => setExtra(actual => ({ ...actual, [clave]: actual[clave] + 1 }));

  return (
    <div className="flex flex-col gap-4">
      <Plataforma esquema={esquema} editor={editor} lecturas={lecturasExc} formato={u} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoInforme definicion={{ campo: esquema.exc.carga, label: 'Carga de excentricidad', tipo: 'numero' }} editor={editor} />
        <CampoInforme definicion={{ campo: esquema.rep.carga, label: 'Carga de repetibilidad', tipo: 'numero' }} editor={editor} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <TablaPuntos
          titulo="Excentricidad"
          columnas={['Posición', `Indicación${unidad ? ` (${unidad})` : ''}`]}
          filas={nExc}
          puedeAgregar={nExc < maximoFilas(esquema.exc, presentes)}
          onAgregar={() => agregar('exc')}
        >
          {Array.from({ length: nExc }, (_, index) => (
            <tr key={index}>
              <td className="w-14 text-center text-[13px] text-fg-muted">{valores[esquema.exc.posicion(index + 1)] ?? index + 1}</td>
              <td><CeldaNumero campo={esquema.exc.indicacion(index + 1)} editor={editor} label={`Excentricidad, posición ${index + 1}`} /></td>
            </tr>
          ))}
        </TablaPuntos>
        <TablaPuntos
          titulo="Repetibilidad"
          columnas={['Lectura', `Indicación${unidad ? ` (${unidad})` : ''}`]}
          filas={nRep}
          puedeAgregar={nRep < maximoFilas(esquema.rep, presentes)}
          onAgregar={() => agregar('rep')}
        >
          {Array.from({ length: nRep }, (_, index) => (
            <tr key={index}>
              <td className="w-14 text-center text-[13px] text-fg-muted">{index + 1}</td>
              <td><CeldaNumero campo={esquema.rep.indicacion(index + 1)} editor={editor} label={`Repetibilidad, lectura ${index + 1}`} /></td>
            </tr>
          ))}
        </TablaPuntos>
        <TablaPuntos
          titulo="Linealidad"
          columnas={['Carga', 'Indicación', 'Error']}
          filas={nLin}
          puedeAgregar={nLin < maximoFilas(esquema.lin, presentes)}
          onAgregar={() => agregar('lin')}
        >
          {Array.from({ length: nLin }, (_, index) => (
            <tr key={index}>
              <td><CeldaNumero campo={esquema.lin.carga(index + 1)} editor={editor} label={`Linealidad, carga ${index + 1}`} /></td>
              <td><CeldaNumero campo={esquema.lin.indicacion(index + 1)} editor={editor} label={`Linealidad, indicación ${index + 1}`} /></td>
              <td className="whitespace-nowrap px-2 text-right text-[13px] tabular-nums text-fg-muted">{u(resultados.linealidad.errores[index])}</td>
            </tr>
          ))}
        </TablaPuntos>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" aria-live="polite">
        <Resultado etiqueta="Excentricidad · diferencia máxima" valor={u(resultados.excentricidad.diferencia)} divisiones={div(resultados.excentricidad)} />
        <Resultado etiqueta="Repetibilidad · diferencia máxima" valor={u(resultados.repetibilidad.diferencia)} divisiones={div(resultados.repetibilidad)} />
        <Resultado etiqueta="Linealidad · error máximo" valor={u(resultados.linealidad.maximo)} divisiones={div(resultados.linealidad)} />
      </div>
      <p className="text-[12px] leading-relaxed text-fg-muted">
        Se calculan solos: diferencia máxima = mayor − menor indicación; error = indicación − carga. En divisiones se usa la
        {division === 'e' ? ' e (o la d si falta la e)' : ' d'} del rango que cubre cada carga.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoInforme definicion={{ campo: esquema.retorno, label: 'Retorno a cero', tipo: 'estado' }} editor={editor} />
        <CampoInforme definicion={{ campo: esquema.estabilidad, label: 'Estabilidad', tipo: 'estado' }} editor={editor} />
      </div>
      <RestaurarSeccion campos={seccion.campos.map(c => c.campo)} editor={editor} />
    </div>
  );
}

export function SeccionEditor({ seccion, editor }) {
  switch (seccion.tipo) {
    case 'rangos': return <SeccionRangos seccion={seccion} editor={editor} />;
    case 'checklist': return <SeccionChecklist seccion={seccion} editor={editor} />;
    case 'pruebas': return <SeccionPruebas seccion={seccion} editor={editor} />;
    default: return <SeccionCampos seccion={seccion} editor={editor} />;
  }
}
