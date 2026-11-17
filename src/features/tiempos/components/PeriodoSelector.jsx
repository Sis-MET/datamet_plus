import { useRef, useState } from 'react';
import { ArrowRight, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { FloatingDropdown } from '../../../shared/components/ui/FloatingDropdown';
import { cn } from '../../../shared/utils/cn';
import { Button } from '../../../shared/components/ui/Button';
import {
  PERIODOS, etiquetaSeleccion, rangoDeSeleccion, rangoMes, rangoMeses, rangoPeriodo, textoRango,
} from '../domain/tiempos';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** El servidor consulta hasta tres años a la vez (con margen). */
const MAX_DIAS = 1100;

const pad = n => String(n).padStart(2, '0');
const claveMes = (anio, mes) => `${anio}-${pad(mes)}`;
const dias = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** Error del rango libre, o null si se puede aplicar. */
const errorRango = (desde, hasta, hoy) => {
  if (!desde || !hasta) return 'Elige el día final.';
  if (desde > hoy) return 'La fecha inicial es posterior a hoy.';
  if (dias(desde, hasta) > MAX_DIAS) return 'Elige hasta tres años a la vez.';
  return null;
};

/** Días de la grilla de un mes (de lunes a domingo, 6 semanas), con los del mes anterior y siguiente. */
const diasDeLaGrilla = (anio, mes) => {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const desplazamiento = (primero.getUTCDay() + 6) % 7; // lunes = 0
  return Array.from({ length: 42 }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1, 1 + i - desplazamiento));
    return {
      clave: fecha.toISOString().slice(0, 10),
      dia: fecha.getUTCDate(),
      delMes: fecha.getUTCMonth() === mes - 1,
    };
  });
};

/**
 * Calendario de un mes para elegir un rango: el primer clic marca el inicio,
 * el segundo el final (en cualquier orden). Al pasar el ratón se ve el rango
 * que quedaría. Los días posteriores a hoy no se pueden elegir.
 */
function CalendarioRango({ desde, hasta, hoy, onCambiar }) {
  const referencia = hasta || desde || hoy;
  const [vista, setVista] = useState({ anio: Number(referencia.slice(0, 4)), mes: Number(referencia.slice(5, 7)) });
  const [encima, setEncima] = useState(null);
  const eligiendoFin = Boolean(desde && !hasta);
  const finVisible = eligiendoFin && encima ? encima : hasta;
  const [inicio, fin] = desde && finVisible && finVisible < desde ? [finVisible, desde] : [desde, finVisible];
  const mesHoy = claveMes(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)));
  const puedeAvanzar = claveMes(vista.anio, vista.mes) < mesHoy;

  const mover = (paso) => setVista(({ anio, mes }) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 + paso, 1));
    return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 };
  });

  const elegirDia = (clave) => {
    if (!desde || hasta) onCambiar({ desde: clave, hasta: '' });
    else if (clave < desde) onCambiar({ desde: clave, hasta: desde });
    else onCambiar({ desde, hasta: clave });
  };

  return (
    <div onMouseLeave={() => setEncima(null)}>
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => mover(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-[13.5px] font-semibold capitalize text-fg" aria-live="polite">{MESES_LARGOS[vista.mes - 1]} {vista.anio}</span>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={!puedeAvanzar}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={`${MESES_LARGOS[vista.mes - 1]} de ${vista.anio}`}>
        {DIAS_SEMANA.map(nombre => (
          <span key={nombre} className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-[0.04em] text-fg-subtle">{nombre}</span>
        ))}
        {diasDeLaGrilla(vista.anio, vista.mes).map(({ clave, dia, delMes }) => {
          const futuro = clave > hoy;
          const esInicio = clave === inicio;
          const esFin = clave === fin;
          const dentro = inicio && fin && clave > inicio && clave < fin;
          const extremo = esInicio || esFin;
          return (
            <div
              key={clave}
              className={cn(
                'relative flex h-9 items-center justify-center',
                dentro && 'bg-accent/[0.12]',
                esInicio && fin && fin !== inicio && 'rounded-l-xl bg-accent/[0.12]',
                esFin && inicio && fin !== inicio && 'rounded-r-xl bg-accent/[0.12]'
              )}
            >
              <button
                type="button"
                disabled={futuro}
                onClick={() => elegirDia(clave)}
                onMouseEnter={() => setEncima(clave)}
                aria-pressed={Boolean(extremo || dentro)}
                aria-label={`${dia} de ${MESES_LARGOS[Number(clave.slice(5, 7)) - 1]} de ${clave.slice(0, 4)}`}
                className={cn(
                  'relative z-[1] h-9 w-9 rounded-xl text-[13px] font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25',
                  extremo ? 'bg-accent font-semibold text-accent-fg shadow-[0_6px_14px_-8px_rgb(var(--c-accent)/0.9)]' : 'hover:bg-fg/[0.07]',
                  !extremo && (delMes ? 'text-fg' : 'text-fg-subtle'),
                  clave === hoy && !extremo && 'ring-1 ring-inset ring-brand'
                )}
              >
                {dia}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Período de los tiempos de servicio: atajos que siguen a la fecha de hoy
 * («Este año»), un mes cualquiera, varios meses (Mayús + clic) o un rango de
 * fechas en el calendario. `seleccion` es { tipo, desde?, hasta? }.
 */
export function PeriodoSelector({ seleccion, onCambiar, hoy, primerServicio, className }) {
  const anchorRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const rango = rangoDeSeleccion(seleccion, hoy);
  const anioHoy = Number(hoy.slice(0, 4));
  const mesHoy = Number(hoy.slice(5, 7));
  const anioMinimo = Math.max(anioHoy - 3, primerServicio ? Number(primerServicio.slice(0, 4)) : anioHoy - 3);
  const [anio, setAnio] = useState(Number(rango.hasta.slice(0, 4)));
  const [libre, setLibre] = useState(rango);
  const [pestana, setPestana] = useState('mes');
  const [ancho, setAncho] = useState(620);

  const abrir = () => {
    const actual = rangoDeSeleccion(seleccion, hoy);
    setAnio(Number(actual.hasta.slice(0, 4)));
    setLibre(actual);
    setPestana(seleccion.tipo === 'otro' ? 'rango' : 'mes');
    setAncho(Math.min(620, window.innerWidth - 16));
    setAbierto(true);
  };

  const elegir = (nueva) => {
    onCambiar(nueva);
    setAbierto(false);
  };

  // Meses que abarca la selección actual (para pintarlos en la grilla).
  const mesDesde = rango.desde.slice(0, 7);
  const mesHasta = rango.hasta.slice(0, 7);
  const mesAncla = seleccion.tipo === 'mes-elegido' || seleccion.tipo === 'meses' ? mesDesde : null;
  const mesPrimerServicio = primerServicio ? primerServicio.slice(0, 7) : null;

  const elegirMes = (mes, extender) => {
    const clave = claveMes(anio, mes);
    if (extender && mesAncla && mesAncla !== clave) {
      const { desde, hasta } = rangoMeses(mesAncla, clave, hoy);
      if (dias(desde, hasta) <= MAX_DIAS) {
        elegir({ tipo: 'meses', desde, hasta });
        return;
      }
    }
    elegir({ tipo: 'mes-elegido', ...rangoMes(clave, hoy) });
  };

  const error = errorRango(libre.desde, libre.hasta, hoy);
  const etiqueta = etiquetaSeleccion(seleccion, hoy);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={seleccion.tipo === 'otro' ? `Período: ${etiqueta}` : `Período: ${etiqueta}, ${textoRango(rango.desde, rango.hasta)}`}
        className={cn('field flex h-10 cursor-pointer items-center gap-2.5 text-left font-medium', className)}
      >
        <CalendarRange className="h-4 w-4 flex-none text-fg-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-fg">{etiqueta}</span>
          {seleccion.tipo !== 'otro' && (
            <span className="ml-2 hidden text-[12.5px] font-normal tabular-nums text-fg-muted lg:inline">{textoRango(rango.desde, rango.hasta)}</span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 flex-none text-fg-subtle transition-transform duration-150', abierto && 'rotate-180')} aria-hidden="true" />
      </button>

      <FloatingDropdown
        open={abierto}
        anchorRef={anchorRef}
        onClose={() => setAbierto(false)}
        width={ancho}
        maxHeight={640}
        align="end"
        ariaLabel="Elegir período"
        className="glass overflow-y-auto rounded-2xl border p-2"
      >
        <div className="grid gap-2 sm:grid-cols-[176px_minmax(0,1fr)]">
          {/* Atajos */}
          <div className="flex flex-col gap-0.5 sm:border-r sm:border-line sm:pr-2">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-subtle">Rápidos</p>
            {PERIODOS.map((periodo) => {
              const activo = seleccion.tipo === periodo.value;
              const r = rangoPeriodo(periodo.value, hoy);
              return (
                <button
                  key={periodo.value}
                  type="button"
                  onClick={() => elegir({ tipo: periodo.value })}
                  className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors', activo ? 'bg-accent text-accent-fg' : 'hover:bg-fg/[0.06]')}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{periodo.label}</span>
                    <span className={cn('block truncate text-[11.5px] tabular-nums', activo ? 'text-accent-fg/80' : 'text-fg-muted')}>{textoRango(r.desde, r.hasta)}</span>
                  </span>
                  {activo && <Check className="h-4 w-4 flex-none" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-col gap-3 p-1">
            {/* Mes o rango: dos pestañas para no apilar todo. */}
            <div className="flex rounded-xl bg-fg/[0.06] p-0.5" role="tablist" aria-label="Elegir por">
              {[['mes', 'Por mes'], ['rango', 'Rango de fechas']].map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  aria-selected={pestana === valor}
                  onClick={() => setPestana(valor)}
                  className={cn(
                    'h-8 flex-1 rounded-[10px] text-[12.5px] font-semibold transition-colors',
                    pestana === valor ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>

            {pestana === 'mes' ? (
              <div>
                <div className="flex items-center justify-between gap-2 px-1.5 pb-2">
                  <button
                    type="button"
                    onClick={() => setAnio(a => a - 1)}
                    disabled={anio <= anioMinimo}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                    aria-label="Año anterior"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-[14px] font-semibold tabular-nums text-fg" aria-live="polite">{anio}</span>
                  <button
                    type="button"
                    onClick={() => setAnio(a => a + 1)}
                    disabled={anio >= anioHoy}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                    aria-label="Año siguiente"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MESES_CORTOS.map((nombre, i) => {
                    const mes = i + 1;
                    const clave = claveMes(anio, mes);
                    const futuro = anio > anioHoy || (anio === anioHoy && mes > mesHoy);
                    const dentro = clave >= mesDesde && clave <= mesHasta;
                    const extremo = clave === mesDesde || clave === mesHasta;
                    const sinDatos = mesPrimerServicio && clave < mesPrimerServicio;
                    return (
                      <button
                        key={clave}
                        type="button"
                        disabled={futuro}
                        onClick={(event) => elegirMes(mes, event.shiftKey)}
                        aria-pressed={dentro}
                        title={sinDatos ? 'DataMET aún no tenía servicios en este mes' : undefined}
                        className={cn(
                          'relative h-10 rounded-xl text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                          extremo && 'bg-accent text-accent-fg shadow-[0_6px_14px_-8px_rgb(var(--c-accent)/0.8)]',
                          dentro && !extremo && 'bg-accent/[0.12] text-fg',
                          !dentro && 'text-fg hover:bg-fg/[0.06]',
                          !dentro && sinDatos && 'text-fg-subtle',
                          clave === hoy.slice(0, 7) && !dentro && 'ring-1 ring-inset ring-brand'
                        )}
                      >
                        {nombre}
                      </button>
                    );
                  })}
                </div>
                <p className="px-1.5 pt-2.5 text-[11.5px] leading-snug text-fg-muted">
                  Un clic elige un mes. <span className="font-medium text-fg">Mayús + clic</span> extiende la selección a varios meses.
                </p>
              </div>
            ) : (
              <div>
                <CalendarioRango desde={libre.desde} hasta={libre.hasta} hoy={hoy} onCambiar={setLibre} />
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] tabular-nums">
                    <span className={cn('rounded-lg px-2 py-1 font-semibold', libre.desde ? 'bg-accent/10 text-fg' : 'bg-fg/[0.05] text-fg-subtle')}>
                      {libre.desde ? textoRango(libre.desde, libre.desde) : 'Inicio'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 flex-none text-fg-subtle" aria-hidden="true" />
                    <span className={cn('rounded-lg px-2 py-1 font-semibold', libre.hasta ? 'bg-accent/10 text-fg' : 'bg-fg/[0.05] text-fg-subtle')}>
                      {libre.hasta ? textoRango(libre.hasta, libre.hasta) : 'Fin'}
                    </span>
                    {libre.desde && libre.hasta && (
                      <span className="text-fg-muted">· {dias(libre.desde, libre.hasta) + 1} días</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={Boolean(error)}
                    onClick={() => elegir({ tipo: 'otro', desde: libre.desde, hasta: libre.hasta })}
                  >
                    Aplicar
                  </Button>
                </div>
                <p className={cn('px-0.5 pt-1.5 text-[11.5px]', error && libre.desde && libre.hasta ? 'text-warning' : 'text-fg-muted')} role="status">
                  {error && libre.desde && libre.hasta ? error : libre.desde && !libre.hasta ? 'Ahora elige el día final.' : 'Un clic marca el inicio y otro el final.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </FloatingDropdown>
    </>
  );
}
