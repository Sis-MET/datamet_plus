import { useId } from 'react';
import { AlertOctagon, AlertTriangle, Info, Pencil, Plus, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { formatDate } from '../../domain/format';
import {
  ESTADO_PATRON, NIVELES, ORIGENES_ACORDADOS, SECCIONES, VALORES_PATRON, conUnidad, numero, ordenarAvisos,
} from '../../domain/servicios';
import { CLASES_INSTRUMENTO, camposDeSeccion, columnasDeSeccion, etiquetaColumna, opcionesDeColumna } from '../../domain/registro';
import { diferenciasExcentricidad, esquemaExcentricidad } from '../../domain/excentricidad';
import { DiagramaExcentricidad } from '../DiagramaExcentricidad';
import { Dropdown } from '../Dropdown';
import { ToneBadge } from '../primitives';

const ICONOS = { error: AlertOctagon, aviso: AlertTriangle, info: Info };
const NUMERICOS = new Set(['decimal', 'entero']);

/** Valor para decidir qué filas mostrar: número si se puede leer, si no el texto. */
const comoValor = (texto) => {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return null;
  const n = Number(limpio.replace(',', '.'));
  return Number.isFinite(n) ? n : limpio;
};

function Avisos({ avisos }) {
  if (!avisos.length) return null;
  return (
    <ul className="mb-4 flex flex-col gap-1.5">
      {ordenarAvisos(avisos).map((aviso, index) => {
        const Icono = ICONOS[aviso.nivel];
        return (
          <li
            key={`${aviso.codigo}-${index}`}
            className={cn('flex gap-2.5 rounded-xl border px-3 py-2 text-[12.5px] leading-snug', `cal-tone-${NIVELES[aviso.nivel].tone}`)}
            style={{ borderColor: 'color-mix(in srgb, var(--tone) 35%, transparent)', background: 'color-mix(in srgb, var(--tone) 6%, transparent)' }}
          >
            <Icono className="mt-px h-4 w-4 flex-none" style={{ color: 'var(--tone)' }} aria-hidden="true" />
            <span className="text-fg"><span className="sr-only">{NIVELES[aviso.nivel].label}: </span>{aviso.mensaje}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lo que dice ServiceMET bajo un dato corregido, con «Restaurar». */
function Original({ original, editable, onRestaurar }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-fg-muted">
      <span>ServiceMET: <span className="font-medium text-fg">{original || 'vacío'}</span></span>
      {editable && (
        <button type="button" onClick={onRestaurar} className="inline-flex items-center gap-1 font-medium text-info underline-offset-4 hover:underline">
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Restaurar
        </button>
      )}
    </p>
  );
}

/**
 * Un dato de ServiceMET corregible en el lugar: el valor actual (con lo que
 * se escribió y aún no se guarda) y, si difiere, el de ServiceMET.
 */
function Campo({ columna, etiqueta, editor, editable, columnas, compacto = false }) {
  const id = useId();
  const e = editor.estado(columna);
  const opciones = opcionesDeColumna(columna, e.valor);
  const nombre = etiqueta || etiquetaColumna(columna);
  const marca = cn(e.distinto && 'cc-campo-corregido', e.pendiente && 'cc-campo-pendiente');
  let control;
  if (!editable) {
    control = <p className={cn('min-h-[20px] break-words font-medium text-fg tabular-nums', compacto ? 'text-[12.5px]' : 'text-[13px]')}>{e.valor || '—'}</p>;
  } else if (opciones) {
    control = (
      <div className={cn('rounded-xl', marca)}>
        <Dropdown id={id} ariaLabel={nombre} value={e.valor} onChange={texto => editor.cambiar(columna, texto)} options={opciones} size={compacto ? 'sm' : 'md'} />
      </div>
    );
  } else {
    control = (
      <input
        id={id}
        value={e.valor}
        onChange={event => editor.cambiar(columna, event.target.value)}
        aria-label={nombre}
        inputMode={NUMERICOS.has(columnas?.[columna]?.tipo) ? 'decimal' : undefined}
        autoComplete="off"
        // A la altura de las listas desplegables (Dropdown md, h-11) para que la fila quede pareja.
        className={cn('field font-medium tabular-nums', compacto ? 'h-9 rounded-lg px-2.5 text-[13px]' : 'h-11', marca)}
      />
    );
  }
  return (
    <div className="min-w-0">
      {!compacto && <label htmlFor={id} className="mb-1 block text-[12px] text-fg-muted">{nombre}</label>}
      {control}
      {e.distinto && <Original original={e.original} editable={editable} onRestaurar={() => editor.restaurar(columna)} />}
    </div>
  );
}

/** Tabla de datos repetidos (puntos, lecturas, rangos…) editable celda por celda. */
function TablaEditable({ tabla, editor, editable, columnas }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12.5px] font-semibold text-fg">{tabla.titulo}</p>
      {tabla.cabecera && (
        <div className="mb-2 max-w-[220px]">
          <Campo columna={tabla.cabecera} etiqueta="Carga" editor={editor} editable={editable} columnas={columnas} />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-2/60">
            <tr className="text-[11.5px] text-fg-muted">
              <th className="px-2.5 py-2 text-left font-semibold"> </th>
              {tabla.columnas.map(c => <th key={c} className="px-2 py-2 text-left font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map(fila => (
              <tr key={fila.etiqueta} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-2.5 py-2 text-[12px] text-fg-muted">{fila.etiqueta}</td>
                {fila.celdas.map(columna => (
                  <td key={columna} className="min-w-[96px] px-1.5 py-1">
                    <Campo compacto columna={columna} editor={editor} editable={editable} columnas={columnas} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pares etiqueta–valor de solo lectura (lo que DataMET+ interpreta de los datos). */
function Datos({ filas }) {
  const visibles = filas.filter(Boolean);
  if (!visibles.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-2.5 rounded-xl bg-surface-2/50 px-3.5 py-3 sm:grid-cols-2">
      {visibles.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="min-w-0">
          <dt className="text-[11.5px] text-fg-muted">{etiqueta}</dt>
          <dd className="break-words text-[13px] font-medium text-fg">{valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Sin clase en el registro y con emp NB 23001 pedido: la que sugiere la regla
 * del método (R76 Tabla 3, o solo n = Max/e como el libro). El cálculo ya la
 * usa, pero hay que confirmarla.
 */
function ClaseSugerida({ calculo, editor, editable, unidad }) {
  const s = calculo?.clase?.sugerida;
  if (!s || !calculo.clase.requerida || editor.clase?.valor) return null;
  const porN = s.regla === 'POR_N';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-2.5">
      <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[12.5px] text-fg">
        Se sugiere la <strong>clase {s.valor}</strong> {porN ? 'por n = Max/e, como el libro' : 'por la OIML R76 (Tabla 3)'}: e = {numero(s.e)} {unidad} y n = Max/e = {numero(s.n)}
        {porN || s.enTabla ? '' : ' (fuera de la tabla: elegida por n, como el libro)'}. El cálculo ya la usa para el emp NB 23001, pero hay que confirmarla para enviar a revisión.
      </p>
      {editable && (
        <button
          type="button"
          onClick={() => editor.cambiarClase({ valor: s.valor, origen: 'DEDUCIDA' })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[12.5px] font-semibold text-surface hover:opacity-90"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Usar la clase {s.valor}
        </button>
      )}
    </div>
  );
}

/** Clase del instrumento con su origen, en el lugar. */
function Clase({ editor, editable, origenes, calculo, unidad }) {
  const id = useId();
  const clase = editor.clase;
  if (!editable) {
    return (
      <div>
        <p className="mb-1 text-[12px] text-fg-muted">Clase del instrumento</p>
        <p className="text-[13px] font-medium text-fg">{clase?.valor ? `${clase.valor} (${origenes?.[clase.origen] || clase.origen})` : 'No declarada: se usa la que pida el cliente'}</p>
        <ClaseSugerida calculo={calculo} editor={editor} editable={false} unidad={unidad} />
      </div>
    );
  }
  return (
    <>
    <div className={cn('grid gap-3 sm:grid-cols-2', editor.clasePendiente && 'cc-campo-pendiente rounded-xl')}>
      <div>
        <label htmlFor={`${id}-c`} className="mb-1 block text-[12px] text-fg-muted">Clase del instrumento</label>
        <Dropdown
          id={`${id}-c`}
          ariaLabel="Clase del instrumento"
          value={clase?.valor || ''}
          onChange={valor => editor.cambiarClase(valor ? { valor, origen: clase?.origen || null } : null)}
          options={[{ value: '', label: 'No declarada' }, ...CLASES_INSTRUMENTO.map(c => ({ value: c, label: `Clase ${c}` }))]}
        />
      </div>
      <div>
        <label htmlFor={`${id}-o`} className="mb-1 block text-[12px] text-fg-muted">De dónde sale</label>
        <Dropdown
          id={`${id}-o`}
          ariaLabel="Origen de la clase"
          value={clase?.origen || ''}
          onChange={origen => editor.cambiarClase({ valor: clase?.valor, origen: origen || null })}
          options={[{ value: '', label: 'Elegir' }, ...Object.entries(origenes || {}).map(([value, label]) => ({ value, label }))]}
          disabled={!clase?.valor}
        />
      </div>
    </div>
    <ClaseSugerida calculo={calculo} editor={editor} editable unidad={unidad} />
    </>
  );
}

/**
 * Tolerancia que el cliente fija por rango de carga (dato del cliente), en la
 * unidad de la balanza o en divisiones (1 d en todo el rango, como Lab Delta).
 * Se usa cuando no pidió el emp NB 23001 ni un %.
 */
function ToleranciasCliente({ editor, editable, criterio, unidad }) {
  const filas = editor.tolerancias;
  const cambiarFila = (i, campo, valor) => editor.cambiarTolerancias(filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  const quitar = i => editor.cambiarTolerancias(filas.filter((_, j) => j !== i));
  const agregar = () => editor.cambiarTolerancias([...filas, { hasta: '', tolerancia: '', en: 'MASA' }]);
  const leer = texto => Number(String(texto ?? '').trim().replace(',', '.'));
  const toleranciaMal = f => String(f.tolerancia).trim() !== '' && !(leer(f.tolerancia) > 0);
  const hastaMal = f => String(f.hasta).trim() !== '' && !(leer(f.hasta) > 0);
  // Con lo que se está editando, no solo con lo guardado: emp vacío = NB 23001, como en ServiceMET.
  const empTexto = editor.estado('emp');
  const empSin = String(empTexto.valor ?? '').trim().toLowerCase();
  const usaNB = !empTexto.pendiente ? criterio.empNB23001
    : empSin === '' || empSin.startsWith('s') || empSin.includes('nb') ? true
      : empSin === 'no' ? false : criterio.empNB23001;
  const indicar = editor.estado('indicar');
  const porcentaje = indicar.pendiente ? leer(indicar.valor) : criterio.toleranciaCliente;
  let manda = null;
  if (usaNB) manda = 'Hoy se usa el emp NB 23001: estos rangos no cuentan.';
  else if (porcentaje > 0) manda = `Hoy se usa el ${numero(porcentaje)} % de la carga: estos rangos no cuentan.`;
  if (!editable && !filas.length) return null;
  return (
    <div className={cn('rounded-xl bg-surface-2/50 px-3.5 py-3', editor.toleranciasPendientes && 'cc-campo-pendiente')}>
      <p className="text-[12.5px] font-semibold text-fg">Tolerancia del cliente por rango</p>
      <p className="mt-0.5 text-[12px] text-fg-muted">
        Valor (±) que pide el cliente hasta cada carga, en {unidad || 'la unidad de la balanza'} o en divisiones d del rango de la carga (por ejemplo, 1 d en todo el rango:
        una sola fila «en adelante» con ± 1 d). El último rango puede quedar «en adelante». Es un dato del cliente y se marca así en el certificado.
        La regla de decisión (simple o conservadora) se elige arriba.
        {manda ? ` ${manda}` : ''}
      </p>
      {filas.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {filas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-fg-muted">Hasta</span>
              <input
                value={f.hasta}
                onChange={e => cambiarFila(i, 'hasta', e.target.value)}
                disabled={!editable}
                inputMode="decimal"
                placeholder="en adelante"
                aria-label={`Rango ${i + 1}: hasta`}
                className={cn('field h-9 w-28 rounded-lg px-2.5 text-[13px] tabular-nums', hastaMal(f) && 'field-invalid')}
              />
              <span className="text-fg-muted">{unidad}: ±</span>
              <input
                value={f.tolerancia}
                onChange={e => cambiarFila(i, 'tolerancia', e.target.value)}
                disabled={!editable}
                inputMode="decimal"
                aria-label={`Rango ${i + 1}: tolerancia`}
                className={cn('field h-9 w-24 rounded-lg px-2.5 text-[13px] tabular-nums', toleranciaMal(f) && 'field-invalid')}
              />
              <select
                value={f.en === 'D' ? 'D' : 'MASA'}
                onChange={e => cambiarFila(i, 'en', e.target.value)}
                disabled={!editable}
                aria-label={`Rango ${i + 1}: unidad de la tolerancia`}
                className="field h-9 w-20 rounded-lg px-2 text-[13px]"
              >
                <option value="MASA">{unidad || 'masa'}</option>
                <option value="D">d</option>
              </select>
              {editable && (
                <button type="button" onClick={() => quitar(i)} aria-label={`Quitar el rango ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {editable && filas.length < 5 && (
        <button type="button" onClick={agregar} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar rango
        </button>
      )}
    </div>
  );
}

/** Lo que interpreta DataMET+ en cada sección, debajo de los datos. */
function contexto(id, { data, m, unidad, onPuntosAcordados, puedeAcordar, editable, onAnexo, onUsp, editor }) {
  switch (id) {
    case 'servicio':
      return (
        <Datos filas={[
          ['Técnico reconocido', m.servicio.tecnico.usuario ? `${m.servicio.tecnico.nombre} (${m.servicio.tecnico.iniciales || m.servicio.tecnico.usuario})` : 'Sin identificar'],
          ['SECA del libro', m.servicio.seca ? `${m.servicio.seca.libro || '—'} (en ServiceMET: ${m.servicio.seca.original})` : '—'],
          ['Tipo de servicio', m.servicio.tipo || 'No indicado'],
          ['Código en ServiceMET', <span key="c" className="font-mono text-[12px]">{m.servicio.codigo}</span>],
          data.versiones > 1 && ['Versiones', `ServiceMET lo envió ${data.versiones} veces; se usa la última.`],
        ]}
        />
      );
    case 'instrumento':
      return (
        <Datos filas={[
          ['Cliente', m.cliente.razonSocial || m.cliente.nombre],
          ['Planta', [m.cliente.planta, m.cliente.departamento].filter(Boolean).join(' · ')],
          ['Dirección', m.cliente.direccion],
          ['Código Métrica', m.instrumento.codigoMetrica],
        ]}
        />
      );
    case 'patrones': {
      const patrones = [...m.patrones.juegos.map(p => ({ ...p, tipo: 'Pesas' })), ...m.patrones.ambiente.map(p => ({ ...p, tipo: 'Ambiente' }))];
      if (!patrones.length) return null;
      return (
        <ul className="flex flex-col gap-1.5">
          {patrones.map(p => (
            <li key={`${p.tipo}-${p.original}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-2/50 px-3.5 py-2 text-[12.5px]">
              <span className="font-mono font-semibold text-fg">{p.original}</span>
              <span className="text-fg-muted">{p.tipo}</span>
              <ToneBadge tone={ESTADO_PATRON[p.estado]?.tone || 'neutral'}>{ESTADO_PATRON[p.estado]?.label || p.estado}</ToneBadge>
              <span className="text-fg-muted">{p.certificado ? `${p.certificado.numero || 'Sin número'} · ${formatDate(p.certificado.fecha)}` : 'Sin certificado vigente'}</span>
              {p.valores && <ToneBadge tone={VALORES_PATRON[p.valores].tone}>{VALORES_PATRON[p.valores].label}</ToneBadge>}
            </li>
          ))}
        </ul>
      );
    }
    case 'ambiente':
      return (
        <Datos filas={m.lugar.inspeccion.map(item => [item.etiqueta, item.comentario ? `${item.valor || '—'} · ${item.comentario}` : item.valor])} />
      );
    case 'excentricidad': {
      const esquema = esquemaExcentricidad(m.excentricidad.plataforma, m.excentricidad.indicador, m.excentricidad.posiciones.length);
      const dMax = Math.max(0, ...m.instrumento.rangos.map(r => r.d || 0));
      const diferencias = diferenciasExcentricidad(m.excentricidad.posiciones, 2 * dMax);
      if (!esquema || !m.excentricidad.posiciones.length) return null;
      return (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-2/50 px-3.5 py-3">
          <div className="w-[200px]"><DiagramaExcentricidad esquema={esquema} diferencias={diferencias} unidad={unidad} /></div>
          <p className="min-w-[180px] flex-1 text-[12.5px] text-fg-muted">
            Diferencia de cada posición con la del centro. En rojo, las que superan 2·d ({numero(2 * dMax)} {unidad}).
          </p>
        </div>
      );
    }
    case 'errores': {
      const acordado = m.acordado;
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-2/50 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-fg">Puntos acordados del instrumento</p>
            {puedeAcordar && m.instrumento.codigoMetrica && (
              <button type="button" onClick={onPuntosAcordados} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-info underline-offset-4 hover:underline">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
              </button>
            )}
          </div>
          {acordado ? (
            <>
              <p className="text-[12px] text-fg-muted">Origen: {ORIGENES_ACORDADOS[acordado.origen] || acordado.origen}. Son una referencia: el certificado usa lo medido.</p>
              <p className="text-[12.5px] text-fg">Error: {acordado.errores.map(c => conUnidad(c, acordado.unidad)).join(' · ') || '—'}</p>
              {acordado.repetibilidad.length > 0 && <p className="text-[12.5px] text-fg">Repetibilidad: {acordado.repetibilidad.map(c => conUnidad(c, acordado.unidad)).join(' · ')}</p>}
              {acordado.excentricidad && <p className="text-[12.5px] text-fg">Excentricidad: {conUnidad(acordado.excentricidad, acordado.unidad)}</p>}
            </>
          ) : (
            <p className="text-[12.5px] text-fg-muted">Este instrumento no tiene puntos acordados en DataMET+.</p>
          )}
        </div>
      );
    }
    case 'criterio':
      return (
        <div className="flex flex-col gap-3">
        <ToleranciasCliente editor={editor} editable={editable} criterio={m.criterio} unidad={unidad} />
        <label className={cn('flex items-start gap-3 rounded-xl bg-surface-2/50 px-3.5 py-3', editable && 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={data.datos.anexo === true}
            disabled={!editable}
            onChange={event => onAnexo(event.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none accent-fg"
          />
          <span className="text-[12.5px]">
            <span className="block font-semibold text-fg">Agregar el anexo de información adicional (a pedido del cliente)</span>
            <span className="block text-fg-muted">Incertidumbre de una pesada en uso, incertidumbre global y pesada mínima (EURAMET 7.4, 7.5 y G), y las condiciones del instrumento y la instalación que revisó el técnico. Va en una hoja aparte que no forma parte del certificado.</span>
          </span>
        </label>
        {(data.datos.anexo === true || data.datos.usp === true) && (
          <label className={cn('ml-7 flex items-start gap-3 rounded-xl bg-surface-2/50 px-3.5 py-3', editable && data.datos.anexo === true && 'cursor-pointer')}>
            <input
              type="checkbox"
              checked={data.datos.usp === true}
              disabled={!editable || data.datos.anexo !== true}
              onChange={event => onUsp(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-fg"
            />
            <span className="text-[12.5px]">
              <span className="block font-semibold text-fg">Incluir la evaluación USP ⟨41⟩ (balanzas de uso farmacéutico)</span>
              <span className="block text-fg-muted">
                Repetibilidad, exactitud, adecuación de las pesas y peso mínimo de muestra, con los límites de «Método de cálculo».
                {data.datos.anexo !== true && ' Va dentro del anexo: agrégalo para que salga.'}
              </span>
            </span>
          </label>
        )}
        </div>
      );
    default:
      return null;
  }
}

/** Una sección del registro: avisos, datos corregibles en el lugar y lo que DataMET+ interpreta. */
function Seccion({ meta, data, editor, editable, avisos, onPuntosAcordados, puedeAcordar, onAnexo, onUsp }) {
  const m = data.modelo;
  const valores = Object.fromEntries(Object.keys(data.fuente).map(c => [c, comoValor(editor.valor(c))]));
  const campos = camposDeSeccion(meta.id, valores);
  const columnas = columnasDeSeccion(campos);
  const corregidos = columnas.filter(c => editor.estado(c).distinto).length;
  return (
    <section id={`registro-${meta.id}`} aria-labelledby={`titulo-${meta.id}`} className="card scroll-mt-24 p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`titulo-${meta.id}`} className="text-sm font-semibold text-fg">{meta.label}</h3>
        {corregidos > 0 && (
          <span className="cal-badge cal-tone-info" title="Datos distintos de los que subió el técnico desde ServiceMET">
            {corregidos} {corregidos === 1 ? 'dato corregido' : 'datos corregidos'}
          </span>
        )}
      </div>
      <Avisos avisos={avisos} />
      {campos.lista.length > 0 && (
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {campos.lista.map(columna => <Campo key={columna} columna={columna} editor={editor} editable={editable} columnas={data.columnas} />)}
        </div>
      )}
      {campos.clase && <div className="mt-4"><Clase editor={editor} editable={editable} origenes={data.origenesClase} calculo={data.calculo} unidad={m.instrumento.unidad} /></div>}
      {campos.tablas.map(tabla => <TablaEditable key={tabla.titulo} tabla={tabla} editor={editor} editable={editable} columnas={data.columnas} />)}
      {(() => {
        const extra = contexto(meta.id, { data, m, unidad: m.instrumento.unidad, onPuntosAcordados, puedeAcordar, editable, onAnexo, onUsp, editor });
        return extra ? <div className="mt-4">{extra}</div> : null;
      })()}
    </section>
  );
}

/** Índice de secciones con sus avisos, para saltar a cada una. */
export function IndiceSecciones({ porSeccion }) {
  return (
    <nav aria-label="Secciones del registro" className="flex flex-wrap gap-1.5">
      {SECCIONES.map((s) => {
        const avisos = porSeccion.get(s.id) || [];
        const errores = avisos.filter(a => a.nivel === 'error').length;
        const conAviso = avisos.filter(a => a.nivel === 'aviso').length;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`registro-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="cal-filter-chip"
          >
            {s.label}
            {errores > 0 && <span className="ml-1 rounded-full bg-danger/15 px-1.5 text-[11px] font-semibold text-danger">{errores}</span>}
            {!errores && conAviso > 0 && <span className="ml-1 rounded-full bg-warning/15 px-1.5 text-[11px] font-semibold text-warning">{conAviso}</span>}
          </button>
        );
      })}
    </nav>
  );
}

/** Las secciones del registro en el orden de RECA. */
export function SeccionesRegistro({ data, editor, editable, porSeccion, onPuntosAcordados, puedeAcordar, onAnexo, onUsp }) {
  return SECCIONES.map(meta => (
    <Seccion
      key={meta.id}
      meta={meta}
      data={data}
      editor={editor}
      editable={editable}
      avisos={porSeccion.get(meta.id) || []}
      onPuntosAcordados={onPuntosAcordados}
      puedeAcordar={puedeAcordar}
      onAnexo={onAnexo}
      onUsp={onUsp}
    />
  ));
}
