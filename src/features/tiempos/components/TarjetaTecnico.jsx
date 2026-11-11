import { memo } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import {
  formatoDiferencia, formatoDuracion, formatoHoras, iniciales, MIN_SERVICIOS_INDICE, variacion,
} from '../domain/tiempos';
import { Mezcla, MiniTendencia, NumeroAnimado, Variacion } from './piezas';

function Dato({ label, value, title }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="truncate text-[11.5px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

/**
 * Tarjeta de un técnico: sus horas totales y cómo cambiaron frente al período
 * anterior, sus medias (por jornada, por servicio y por mes), sus horas mes a
 * mes y en qué tipos de servicio las usó. «Ver servicios» filtra el panel.
 * Memorizada: al ordenar el personal solo cambia de lugar, sin redibujarse.
 */
export const TarjetaTecnico = memo(function TarjetaTecnico({ fila, anterior, etiquetaAnterior, meses, colores, nombreCorto, mismos, activa, onElegir }) {
  const mesesConDatos = Math.max(1, meses);
  const indice = fila.indice;
  return (
    <article
      data-flip={fila.tecnico}
      data-sale=""
      className={cn('tiempos-tarjeta card flex min-w-0 flex-col gap-4 p-4 shadow-card transition-shadow duration-200 hover:shadow-pop', activa && 'ring-2 ring-focus/40')}
      aria-label={`Tiempos de ${fila.tecnico}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn('tiempos-avatar flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-semibold', !fila.identificado && 'opacity-60')}
          aria-hidden="true"
        >
          {fila.identificado ? iniciales(fila.tecnico) : '?'}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className={cn('text-[14.5px] font-semibold leading-snug', fila.identificado ? 'text-fg' : 'italic text-fg-muted')}>{fila.tecnico}</h4>
          <p className="text-[12px] text-fg-muted">
            {fila.servicios === 1 ? '1 servicio' : `${fila.servicios} servicios`} · {fila.dias === 1 ? '1 día' : `${fila.dias} días`}
          </p>
        </div>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-fg-muted">Horas totales</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[26px] font-semibold leading-none text-fg"><NumeroAnimado valor={fila.minutos} formato={formatoHoras} /></p>
            {anterior !== undefined && (
              <Variacion
                // Con pocos servicios medidos en alguno de los dos períodos (por ejemplo, horas sin registrar) no se compara.
                valor={anterior && anterior.medidos >= MIN_SERVICIOS_INDICE && fila.medidos >= MIN_SERVICIOS_INDICE
                  ? variacion(fila.minutos, anterior.minutos) : null}
                etiqueta={etiquetaAnterior}
                sinDatos="Sin comparación"
                detalle={`Se compara desde ${MIN_SERVICIOS_INDICE} servicios medidos en cada período`}
                compacta
              />
            )}
          </div>
        </div>
        <span
          className={cn('flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums', indice === null ? 'bg-fg/[0.05] text-fg-subtle' : 'bg-fg/[0.06] text-fg')}
          title={indice === null
            ? `Se compara con el área desde ${MIN_SERVICIOS_INDICE} servicios medidos`
            : `Tarda ${formatoDiferencia(indice)} frente a la mediana del área en ${mismos}`}
        >
          {indice === null ? 'Pocos datos' : `${formatoDiferencia(indice)} vs. área`}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y border-line py-3">
        <Dato label="Por jornada" value={<NumeroAnimado valor={fila.porJornada} formato={formatoDuracion} />} title="Media de horas de servicio en los días que trabajó" />
        <Dato label="Por servicio" value={<NumeroAnimado valor={fila.promedio} formato={formatoDuracion} />} title={`Media por servicio · mediana ${formatoDuracion(fila.mediana)}`} />
        <Dato label="Por mes" value={<NumeroAnimado valor={fila.minutos / mesesConDatos} formato={formatoHoras} />} title="Media mensual del período" />
      </dl>

      <div className="flex flex-col gap-3">
        <MiniTendencia meses={fila.meses} nombre={fila.tecnico} />
        <Mezcla mezcla={fila.mezcla} colores={colores} nombres={nombreCorto} />
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3">
        {fila.porRevisar > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {fila.porRevisar === 1 ? '1 con horas por revisar' : `${fila.porRevisar} con horas por revisar`}
          </span>
        ) : <span className="text-[12px] text-fg-subtle">Horas completas</span>}
        <button
          type="button"
          onClick={() => onElegir(fila.tecnico)}
          aria-pressed={activa}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-info underline-offset-4 hover:underline"
        >
          {activa ? 'Ver a todos' : 'Ver servicios'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
});
