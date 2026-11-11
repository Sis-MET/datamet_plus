import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowUpRight, CalendarClock, ClipboardList, Clock3, Download, Loader2, Lock, Timer, UserRound, UsersRound, X,
} from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { safeStorage } from '../../../shared/utils/storage';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, Segmented, ToneBadge } from '../../calibration/components/primitives';
import {
  METRICAS_MES, MIN_SERVICIOS_INDICE, ORDENES_PERSONAL, PERIODOS, PROBLEMAS, SIN_TECNICO, aCsv, analizar, formatoDuracion,
  comparacion, formatoHoras, formatoPorcentaje, hoyLocal, ordenarPersonal, periodoAnterior, rangoPeriodo, tecnicosDe, variacion,
} from '../domain/tiempos';
import { coloresDe } from './graficos';
import { useFlip } from './flip';
import { NumeroAnimado, Variacion } from './piezas';
import { TarjetaTecnico } from './TarjetaTecnico';
import { Tendencia } from './Tendencia';
import '../tiempos.css';

/** Lo que cambia entre las dos áreas: nombres, de dónde salen las horas y qué se abre. */
const AREAS = {
  soporte: {
    descripcion: 'Cuánto dura cada servicio de Soporte técnico, de la hora de inicio a la hora final que registró el técnico en ServiceMET.',
    origen: 'Las horas no se corrigen en DataMET+: si alguna está mal, se corrige en ServiceMET y se vuelve a subir el servicio.',
    orden: 'OTST',
    grupo: 'Tipo de servicio',
    grupos: 'Horas por tipo de servicio',
    todos: 'Todos los servicios',
    mismos: 'los mismos tipos de servicio',
    abrir: 'Abrir informe',
  },
  calibracion: {
    descripcion: 'Cuánto dura cada calibración, de la hora de inicio del servicio a la de las condiciones ambientales finales, que se toman al terminar.',
    origen: 'Si la hora final está mal, se corrige en el registro del servicio (Certificados › Registros) y aquí vale la corregida.',
    orden: 'SECA',
    grupo: 'Capacidad máxima',
    grupos: 'Horas por capacidad máxima',
    todos: 'Todas las capacidades',
    mismos: 'los mismos rangos de capacidad',
    abrir: 'Abrir registro',
  },
};

const POR_PAGINA = 10;
const formatoEntero = v => String(Math.round(v));
const fechaCorta = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const leerPeriodo = (clave) => {
  const valor = safeStorage.getItem(clave);
  return PERIODOS.some(p => p.value === valor) && valor !== 'otro' ? valor : 'anio';
};

/** Trae los servicios de un período; conserva lo anterior mientras llega lo nuevo. */
function useServicios(cargar, rango, intento) {
  const [estado, setEstado] = useState({ clave: null, data: null, error: null });
  const clave = rango ? `${rango.desde}|${rango.hasta}|${intento}` : null;
  useEffect(() => {
    if (!clave) return undefined;
    let activo = true;
    const [desde, hasta] = clave.split('|');
    cargar({ desde, hasta })
      .then(data => activo && setEstado({ clave, data, error: null }))
      .catch(error => activo && setEstado(actual => ({ ...actual, clave, error })));
    return () => {
      activo = false;
    };
  }, [cargar, clave]);
  return { ...estado, cargando: Boolean(clave) && estado.clave !== clave };
}

/** Indicador del encabezado: ícono, etiqueta, valor, cambio frente al período anterior y contexto. */
function Indicador({ icono, label, value, cambio, subeEsBueno = true, etiqueta, detalle, sinDatos, detalleSinDatos }) {
  const Icono = icono;
  return (
    <div className="card flex min-w-0 flex-col gap-3 p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="tiempos-chip flex h-8 w-8 flex-none items-center justify-center rounded-lg" aria-hidden="true">
          <Icono className="h-4 w-4" />
        </span>
        <p className="truncate text-[13px] font-medium text-fg">{label}</p>
      </div>
      <p className="text-[28px] font-semibold leading-none text-fg">{value}</p>
      <div className="flex flex-col gap-1">
        {cambio !== undefined && <Variacion valor={cambio} etiqueta={etiqueta} subeEsBueno={subeEsBueno} sinDatos={sinDatos} detalle={detalleSinDatos} />}
        {detalle && <p className="text-[12px] leading-snug text-fg-muted">{detalle}</p>}
      </div>
    </div>
  );
}

function Tarjeta({ titulo, descripcion, accion, children, className, id }) {
  return (
    <section id={id} className={cn('card flex min-w-0 flex-col shadow-card', className)} aria-label={titulo}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-fg">{titulo}</h3>
          {descripcion && <p className="mt-0.5 text-[12.5px] text-fg-muted">{descripcion}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

/**
 * Horas de cada grupo, en el orden fijo de los grupos, con su parte del total. Cada grupo
 * lleva su nombre y su valor escritos (algunos colores son claros) y al
 * pulsarlo se filtra el panel por él.
 */
const HorasPorGrupo = memo(function HorasPorGrupo({ filas, colores, grupo, onGrupo }) {
  const total = filas.reduce((suma, fila) => suma + fila.minutos, 0);
  const maximo = Math.max(1, ...filas.map(fila => fila.minutos));
  return (
    <ul className="flex flex-col gap-1 px-2 pb-3">
      {filas.map(fila => (
        <li key={fila.id}>
          <button
            type="button"
            onClick={() => onGrupo(grupo === fila.id ? '' : fila.id)}
            aria-pressed={grupo === fila.id}
            title={grupo === fila.id ? 'Ver todos los grupos' : `Ver solo ${fila.nombre}`}
            className={cn('w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-fg/[0.035]', grupo === fila.id && 'bg-info/5 ring-1 ring-info/25', grupo && grupo !== fila.id && 'opacity-55')}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: colores.get(fila.id) }} aria-hidden="true" />
                <span className="truncate text-[13px] font-medium text-fg">{fila.nombre}</span>
              </span>
              <span className="flex-none text-[13px] font-semibold tabular-nums text-fg">
                <NumeroAnimado valor={fila.minutos} formato={formatoHoras} />
                <span className="ml-1.5 text-[12px] font-normal text-fg-muted">{total ? Math.round((fila.minutos / total) * 100) : 0} %</span>
              </span>
            </span>
            <span className="mt-1.5 block h-2 rounded-full bg-fg/[0.06]">
              <span className="tiempos-escala block h-full w-full rounded-full" style={{ transform: `scaleX(${fila.minutos / maximo})`, background: colores.get(fila.id) }} />
            </span>
            <span className="mt-1 block text-[11.5px] text-fg-muted">
              {fila.servicios === 1 ? '1 servicio' : `${fila.servicios} servicios`} · media {formatoDuracion(fila.promedio)}
              {fila.porRevisar > 0 && <span className="text-warning"> · {fila.porRevisar} por revisar</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
});

/** Los servicios del período, del más reciente al más antiguo; «Por revisar» muestra los que no se pudieron medir. */
const ListaServicios = memo(function ListaServicios({ servicios, nombreGrupo, textos, onAbrir }) {
  const [filtro, setFiltro] = useState('todos');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const porRevisar = servicios.filter(s => s.problema).length;
  const vista = filtro === 'revisar' && porRevisar ? servicios.filter(s => s.problema) : servicios;
  const lista = useMemo(() => [...vista]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.inicio || '').localeCompare(String(a.inicio || ''))),
  [vista]);

  return (
    <Tarjeta
      titulo="Servicios del período"
      descripcion={textos.origen}
      accion={(
        <Segmented
          label="Qué servicios ver"
          value={porRevisar ? filtro : 'todos'}
          onChange={(valor) => {
            setFiltro(valor);
            setMostrar(POR_PAGINA);
          }}
          options={[
            { value: 'todos', label: 'Todos', count: servicios.length },
            { value: 'revisar', label: 'Horas por revisar', count: porRevisar, alert: porRevisar > 0 },
          ]}
          className="cal-tabs"
        />
      )}
    >
      <ul className="stagger-in divide-y divide-line border-t border-line">
        {lista.slice(0, mostrar).map(s => (
          <li key={s.codigo} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
            <div className="w-[92px] flex-none text-[12.5px] tabular-nums text-fg-muted">{fechaCorta(s.fecha)}</div>
            <div className="min-w-[200px] flex-1">
              <p className="truncate text-[13px] font-medium text-fg">
                {s.cliente || 'Sin cliente'}
                {s.equipo && <span className="font-normal text-fg-muted"> · {s.equipo}</span>}
              </p>
              <p className="truncate text-[12px] text-fg-muted">
                {[nombreGrupo(s.grupo), s.orden && `${textos.orden} ${s.orden}`, s.tecnico || SIN_TECNICO].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-none items-center gap-3">
              <span className="text-[12.5px] tabular-nums text-fg-muted">{s.inicio || '--:--'} – {s.fin || '--:--'}</span>
              {s.problema ? (
                <ToneBadge tone="warning">
                  <span title={PROBLEMAS[s.problema]}>{s.problema === 'SIN_HORAS' ? 'Sin horas' : s.problema === 'FIN_ANTES' ? 'Fin antes del inicio' : 'Más de 12 h'}</span>
                </ToneBadge>
              ) : (
                <span className="w-[84px] text-right text-[13px] font-semibold tabular-nums text-fg">{formatoDuracion(s.minutos)}</span>
              )}
              {onAbrir && (
                <Button size="sm" variant="ghost" onClick={() => onAbrir(s)} aria-label={`${textos.abrir} de ${s.cliente || s.codigo} del ${fechaCorta(s.fecha)}`}>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{textos.abrir}</span>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {lista.length > mostrar && (
        <div className="border-t border-line px-4 py-2.5 text-center">
          <Button size="sm" variant="secondary" onClick={() => setMostrar(n => n + POR_PAGINA * 5)}>
            Mostrar más ({lista.length - mostrar} restantes)
          </Button>
        </div>
      )}
    </Tarjeta>
  );
});

/**
 * Tiempos de servicio del personal (KPI). Lo usan Soporte técnico y
 * Calibración: `area` elige los textos, `cargar({ desde, hasta })` trae los
 * servicios de un período y `onAbrir(servicio)` abre su informe o registro.
 * Cada indicador se compara con el período anterior equivalente. El período,
 * el técnico y el grupo filtran todo lo que hay debajo.
 */
export function TiemposPanel({ area, cargar, onAbrir }) {
  const textos = AREAS[area];
  const clavePeriodo = `datamet_tiempos_${area}_periodo`;
  const [periodo, setPeriodo] = useState(() => leerPeriodo(clavePeriodo));
  const [otro, setOtro] = useState(() => rangoPeriodo('anio', hoyLocal()));
  const [tecnico, setTecnico] = useState('');
  const [grupo, setGrupo] = useState('');
  const [metrica, setMetrica] = useState('horas');
  const [orden, setOrden] = useState('horas');
  const [intento, setIntento] = useState(0);
  const listaRef = useRef(null);

  const rango = periodo === 'otro' ? otro : rangoPeriodo(periodo, hoyLocal());
  const rangoValido = Boolean(rango.desde && rango.hasta && rango.desde <= rango.hasta);
  const anterior = rangoValido ? periodoAnterior(periodo, rango) : null;
  const actual = useServicios(cargar, rangoValido ? rango : null, intento);
  const previo = useServicios(cargar, anterior, intento);

  const { data, error, cargando } = actual;
  const grupos = useMemo(() => data?.grupos || [], [data]);
  const colores = useMemo(() => coloresDe(grupos), [grupos]);
  const nombres = useMemo(() => new Map(grupos.map(g => [g.id, g])), [grupos]);
  const nombreGrupo = useCallback(id => nombres.get(id)?.nombre || id, [nombres]);
  const nombreCorto = useCallback(id => nombres.get(id)?.corto || nombres.get(id)?.nombre || id, [nombres]);
  // El informe o registro se abre con la función vigente de la página, sin redibujar la lista.
  const abrirRef = useRef(onAbrir);
  useEffect(() => {
    abrirRef.current = onAbrir;
  });
  const abrirServicio = useCallback(servicio => abrirRef.current?.(servicio), []);

  // Un técnico elegido que no tiene servicios en el período nuevo deja de filtrar.
  const tecnicos = useMemo(() => tecnicosDe(data?.servicios), [data]);
  const tecnicoActivo = tecnicos.includes(tecnico) ? tecnico : '';
  const analisis = useMemo(() => (data
    ? analizar(data.servicios, { grupos, grupo, tecnico: tecnicoActivo, desde: data.desde, hasta: data.hasta })
    : null), [data, grupos, grupo, tecnicoActivo]);
  // Ordenar solo reacomoda las mismas filas: las tarjetas no se redibujan.
  const personal = useMemo(() => (analisis ? ordenarPersonal(analisis.porTecnico, orden) : []), [analisis, orden]);
  // El período anterior con los mismos filtros. Solo se compara si DataMET ya
  // tenía servicios en todo ese período y suficientes (comparacion).
  const previoAnalisis = useMemo(() => (previo.data && !previo.error
    ? analizar(previo.data.servicios, { grupos, grupo, tecnico: tecnicoActivo, desde: previo.data.desde, hasta: previo.data.hasta })
    : null), [previo.data, previo.error, grupos, grupo, tecnicoActivo]);
  const { comparar, motivo } = comparacion({
    primerServicio: data?.primerServicio, anterior, resumenAnterior: previoAnalisis?.resumen,
  });
  const comparado = comparar ? previoAnalisis : null;
  const anteriorDe = useMemo(() => new Map((comparado?.porTecnico || []).map(fila => [fila.tecnico, fila])), [comparado]);
  const resumen = analisis?.resumen;
  const antes = comparado?.resumen;
  const cambio = (clave) => (comparado ? variacion(resumen[clave], antes[clave]) : null);
  const sinDatos = motivo === 'SIN_HISTORIA' ? 'Sin historial para comparar' : 'Pocos datos para comparar';
  const detalleSinDatos = motivo === 'SIN_HISTORIA' && data?.primerServicio
    ? `DataMET tiene servicios desde el ${fechaCorta(data.primerServicio)}: el período anterior no está completo.`
    : 'El período anterior tiene muy pocos servicios medidos.';

  const cambiarPeriodo = (valor) => {
    if (valor === 'otro') setOtro(rango);
    else safeStorage.setItem(clavePeriodo, valor);
    setPeriodo(valor);
  };

  // Al filtrar u ordenar (FLIP): las tarjetas que sobran se desvanecen, las
  // que siguen se deslizan a su lugar nuevo y las nuevas aparecen.
  const claveFlip = `${data?.desde}|${data?.hasta}|${personal.map(fila => fila.tecnico).join('|')}`;
  const { raizRef, salir } = useFlip(claveFlip);
  /** Técnicos que quedan con otro filtro de técnico o de grupo. */
  const quedanCon = useCallback(({ tecnico: t = tecnicoActivo, grupo: g = grupo }) => new Set((data?.servicios || [])
    .filter(s => (!g || s.grupo === g) && (!t || (s.tecnico || SIN_TECNICO) === t))
    .map(s => s.tecnico || SIN_TECNICO)), [data, grupo, tecnicoActivo]);
  const filtrarTecnico = useCallback(valor => salir(quedanCon({ tecnico: valor }), () => setTecnico(valor)), [quedanCon, salir]);
  const filtrarGrupo = useCallback(valor => salir(quedanCon({ grupo: valor }), () => setGrupo(valor)), [quedanCon, salir]);
  const cambiarOrden = useCallback(valor => setOrden(valor), []);

  const elegirTecnico = useCallback((nombre) => {
    const nuevo = tecnicoActivo === nombre ? '' : nombre;
    filtrarTecnico(nuevo);
    // Después de la transición, a la lista de sus servicios.
    if (nuevo) setTimeout(() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
  }, [filtrarTecnico, tecnicoActivo]);

  const exportar = () => {
    const csv = aCsv(analisis.servicios, { orden: textos.orden, grupo: textos.grupo, nombreGrupo });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `tiempos-${area}-${data.desde}-a-${data.hasta}${tecnicoActivo ? `-${tecnicoActivo.replace(/\s+/g, '-')}` : ''}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtrosActivos = Boolean(tecnicoActivo || grupo);
  const mesesDelPeriodo = analisis?.porMes.length || 1;
  const etiquetaAnterior = anterior?.etiqueta;

  return (
    <div ref={raizRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h2 className="text-xl font-semibold text-fg">Tiempos de servicio</h2>
          <p className="mt-1 text-[13px] text-fg-muted">{textos.descripcion}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Dropdown ariaLabel="Período" value={periodo} onChange={cambiarPeriodo} options={PERIODOS} className="w-full sm:w-48" />
          {periodo === 'otro' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Desde"
                value={otro.desde}
                max={otro.hasta || undefined}
                onChange={event => setOtro(prev => ({ ...prev, desde: event.target.value }))}
                className="field h-10 w-[150px] font-medium tabular-nums"
              />
              <span className="text-[13px] text-fg-muted">a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={otro.hasta}
                min={otro.desde || undefined}
                onChange={event => setOtro(prev => ({ ...prev, hasta: event.target.value }))}
                className="field h-10 w-[150px] font-medium tabular-nums"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filtros: una fila sobre todo lo que filtran. */}
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          ariaLabel="Técnico"
          value={tecnicoActivo}
          onChange={filtrarTecnico}
          options={[{ value: '', label: 'Todo el personal' }, ...tecnicos.map(t => ({ value: t, label: t }))]}
          className="w-full sm:w-56"
          disabled={!analisis}
        />
        <Dropdown
          ariaLabel={textos.grupo}
          value={grupo}
          onChange={filtrarGrupo}
          options={[{ value: '', label: textos.todos }, ...grupos.map(g => ({ value: g.id, label: g.nombre }))]}
          className="w-full sm:w-64"
          disabled={!analisis}
        />
        {filtrosActivos && (
          <button
            type="button"
            onClick={() => { setTecnico(''); setGrupo(''); }}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Quitar filtros
          </button>
        )}
        <div className="flex items-center gap-2 sm:ml-auto">
          {(cargando || previo.cargando) && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-label="Cargando" />}
          <Button variant="secondary" onClick={exportar} disabled={!analisis || !analisis.servicios.length}>
            <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
          </Button>
        </div>
      </div>

      {!rangoValido && (
        <p className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-[13px] text-fg" role="alert">
          <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
          Elija una fecha inicial anterior a la final.
        </p>
      )}

      {error?.status === 403 && (
        <div className="animate-rise"><EmptyState icon={Lock} title="Sin acceso a los tiempos del personal">{error.message}</EmptyState></div>
      )}

      {error && error.status !== 403 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudieron cargar los tiempos.</span> <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => setIntento(n => n + 1)}>Reintentar</Button>
        </div>
      )}

      {!data && !error && rangoValido && (
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Cargando los tiempos">
          <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
        </div>
      )}

      {analisis && resumen.servicios === 0 && (
        <div className="animate-rise">
          <EmptyState icon={Timer} title={filtrosActivos ? 'Ningún servicio coincide con los filtros' : 'No hay servicios en este período'}>
            {filtrosActivos ? 'Quite el filtro de técnico o de grupo para ver otros servicios.' : 'Elija otro período: los servicios aparecen aquí cuando el técnico los sube desde ServiceMET.'}
          </EmptyState>
        </div>
      )}

      {analisis && resumen.servicios > 0 && (
        // Al cambiar de período se conserva lo anterior, atenuado, hasta que llega lo nuevo.
        <div className={cn('flex flex-col gap-4 transition-opacity', cargando && 'opacity-60')} aria-busy={cargando}>
          <div className="stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              icono={Clock3}
              label="Horas de servicio"
              value={<NumeroAnimado valor={resumen.minutos} formato={formatoHoras} />}
              cambio={cambio('minutos')}
              etiqueta={etiquetaAnterior}
              sinDatos={sinDatos}
              detalleSinDatos={detalleSinDatos}
              detalle={`Media mensual ${formatoHoras(resumen.minutos / mesesDelPeriodo)}`}
            />
            <Indicador
              icono={ClipboardList}
              label="Servicios"
              value={<NumeroAnimado valor={resumen.servicios} formato={formatoEntero} />}
              cambio={cambio('servicios')}
              etiqueta={etiquetaAnterior}
              sinDatos={sinDatos}
              detalleSinDatos={detalleSinDatos}
              detalle={resumen.porRevisar
                ? `${formatoPorcentaje(resumen.cobertura)} con horas válidas · ${resumen.porRevisar} por revisar`
                : 'Todos con horas válidas'}
            />
            <Indicador
              icono={CalendarClock}
              label="Media por jornada"
              value={<NumeroAnimado valor={resumen.porJornada} formato={formatoDuracion} />}
              cambio={cambio('porJornada')}
              etiqueta={etiquetaAnterior}
              sinDatos={sinDatos}
              detalleSinDatos={detalleSinDatos}
              detalle={`Horas de servicio por día trabajado · ${resumen.jornadas} jornadas`}
            />
            <Indicador
              icono={Timer}
              label="Media por servicio"
              value={<NumeroAnimado valor={resumen.promedio} formato={formatoDuracion} />}
              cambio={cambio('promedio')}
              subeEsBueno={false}
              etiqueta={etiquetaAnterior}
              sinDatos={sinDatos}
              detalleSinDatos={detalleSinDatos}
              detalle={`Mediana ${formatoDuracion(resumen.mediana)} · ${resumen.visitas} visitas`}
            />
          </div>

          <div className="stagger-in grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Tarjeta
              titulo={METRICAS_MES[metrica].label === 'Horas' ? 'Horas por mes' : `${METRICAS_MES[metrica].label} por mes`}
              accion={(
                <Segmented
                  label="Qué graficar"
                  value={metrica}
                  onChange={setMetrica}
                  options={Object.entries(METRICAS_MES).map(([value, def]) => ({ value, label: def.label }))}
                  className="cal-tabs"
                />
              )}
            >
              <div className="px-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-[30px] font-semibold leading-tight text-fg">
                    {metrica === 'horas' ? <NumeroAnimado key="horas" valor={resumen.minutos} formato={formatoHoras} />
                      : metrica === 'servicios' ? <NumeroAnimado key="servicios" valor={resumen.servicios} formato={formatoEntero} />
                        : <NumeroAnimado key="promedio" valor={resumen.promedio} formato={formatoDuracion} />}
                  </p>
                  <Variacion
                    valor={cambio(metrica === 'horas' ? 'minutos' : metrica)}
                    etiqueta={etiquetaAnterior}
                    subeEsBueno={metrica !== 'promedio'}
                    sinDatos={sinDatos}
                    detalle={detalleSinDatos}
                  />
                </div>
              </div>
              <div className="px-4 pb-3 pt-2">
                <Tendencia meses={analisis.porMes} metrica={metrica} />
              </div>
            </Tarjeta>
            <Tarjeta titulo={textos.grupos} descripcion="Pulse un grupo para ver solo ese.">
              <HorasPorGrupo filas={analisis.porGrupo} colores={colores} grupo={grupo} onGrupo={filtrarGrupo} />
            </Tarjeta>
          </div>

          <section aria-label="Personal" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                  <UsersRound className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                  Personal
                  <span className="cal-count">{personal.length}</span>
                </h3>
                <p className="mt-0.5 text-[12.5px] text-fg-muted">
                  {tecnicoActivo ? (
                    <span className="tiempos-aparece inline-flex items-center gap-1.5 text-fg">
                      <UserRound className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
                      Mostrando solo a <strong className="font-semibold">{tecnicoActivo}</strong>; «vs. área» compara con todo el personal del período.
                    </span>
                  ) : (
                    <>«vs. área»: cuánto más (+) o menos (−) tarda que la mediana del área en {textos.mismos}, desde {MIN_SERVICIOS_INDICE} servicios medidos.</>
                  )}
                </p>
              </div>
              <Segmented label="Ordenar el personal por" value={orden} onChange={cambiarOrden} options={ORDENES_PERSONAL} className="cal-tabs" />
            </div>
            <div className="stagger-in grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
              {personal.map(fila => (
                <TarjetaTecnico
                  key={fila.tecnico}
                  fila={fila}
                  anterior={comparado ? (anteriorDe.get(fila.tecnico) || null) : undefined}
                  etiquetaAnterior={etiquetaAnterior}
                  meses={mesesDelPeriodo}
                  colores={colores}
                  nombreCorto={nombreCorto}
                  mismos={textos.mismos}
                  activa={tecnicoActivo === fila.tecnico}
                  onElegir={elegirTecnico}
                />
              ))}
            </div>
          </section>

          <div ref={listaRef} data-flip="__lista" className="scroll-mt-[calc(var(--topbar-height)+16px)]">
            <ListaServicios
              key={`${data.desde}|${data.hasta}|${tecnicoActivo}|${grupo}`}
              servicios={analisis.servicios}
              nombreGrupo={nombreGrupo}
              textos={textos}
              onAbrir={abrirServicio}
            />
          </div>
        </div>
      )}
    </div>
  );
}
