import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../../../shared/utils/cn';
import { AREAS, AREA_COLOR, bs, bsCorto, mesCorto } from '../../domain/comercial';

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesLargo = (mes) => {
  const [a, m] = String(mes).split('-').map(Number);
  return `${MESES_LARGOS[m - 1] || mes} ${a}`;
};

/** Tope «limpio» del eje (1, 2, 2,5 o 5 × 10ⁿ por paso) y sus marcas. */
const ejeLimpio = (maximo, pasos = 4) => {
  if (!(maximo > 0)) return { tope: 1, marcas: [0] };
  const crudo = maximo / pasos;
  const base = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map(f => f * base).find(p => p >= crudo);
  const tope = paso * Math.ceil(maximo / paso);
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
};

/** Ancho real del contenedor, para dibujar el SVG a su tamaño y no escalado. */
const useAncho = () => {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setAncho(Math.round(el.getBoundingClientRect().width));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
};

/** Leyenda de las áreas: un cuadrado (como la marca) y el nombre. */
export function LeyendaAreas({ areas }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-muted" aria-label="Áreas">
      {areas.map(a => (
        <li key={a} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: AREA_COLOR[a] }} aria-hidden="true" />
          {AREAS[a] || a}
        </li>
      ))}
    </ul>
  );
}

const ALTO = 240;
const M = { izq: 64, der: 8, arriba: 18, abajo: 26 };

/**
 * Facturación por mes, columnas apiladas por área (de abajo arriba ST, CAL,
 * VENT; siempre en ese orden y color). Columnas de hasta 24 px con el extremo
 * redondeado, 2 px de superficie entre áreas, el total solo en el mes más
 * alto y el detalle de cada mes al pasar o con el teclado.
 */
export function ColumnasPorMes({ meses, areas }) {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const cruzaGestion = new Set(meses.map(m => m.mes.slice(0, 4))).size > 1;
  const maximo = Math.max(0, ...meses.map(m => m.total));
  const { tope, marcas } = ejeLimpio(maximo);
  const anchoPlot = Math.max(0, ancho - M.izq - M.der);
  const banda = meses.length ? anchoPlot / meses.length : 0;
  const grosor = Math.max(4, Math.min(24, banda * 0.56));
  const y = (v) => M.arriba + (ALTO - M.arriba - M.abajo) * (1 - v / tope);
  const base = y(0);
  const iMax = meses.findIndex(m => m.total === maximo && maximo > 0);
  // Con muchos meses, una etiqueta cada dos (o tres) para que no choquen.
  const cadaCuanto = banda < 34 ? (banda < 22 ? 3 : 2) : 1;

  const m = activo !== null && activo < meses.length ? meses[activo] : null;
  const xCentro = (i) => M.izq + banda * i + banda / 2;

  return (
    <div ref={ref} className="relative">
      {ancho > 0 && (
        <svg width={ancho} height={ALTO} role="group" aria-label={`Facturación por mes: de ${mesLargo(meses[0]?.mes)} a ${mesLargo(meses.at(-1)?.mes)}, máximo ${bs(maximo)}.`}
          className="block overflow-visible" onPointerLeave={() => setActivo(null)}>
          {marcas.map(v => (
            <g key={v}>
              <line x1={M.izq} x2={ancho - M.der} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'rgb(var(--c-line-strong))' : 'rgb(var(--c-line))'} strokeWidth="1" />
              <text x={M.izq - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[11px] tabular-nums">{v === 0 ? '0' : bsCorto(v).replace('Bs ', '')}</text>
            </g>
          ))}
          {meses.map((mes, i) => {
            const x = xCentro(i) - grosor / 2;
            let acumulado = 0;
            const presentes = areas.filter(a => (mes.areas[a] || 0) > 0);
            return (
              <g key={mes.mes}>
                {presentes.map((a, j) => {
                  const v = mes.areas[a];
                  const y0 = y(acumulado);
                  acumulado += v;
                  const y1 = y(acumulado);
                  const esUltimo = j === presentes.length - 1;
                  // 2 px de superficie arriba de cada área que tiene otra encima.
                  const alto = Math.max(0, y0 - y1 - (esUltimo ? 0 : 2));
                  if (alto <= 0) return null;
                  const r = esUltimo ? Math.min(4, alto, grosor / 2) : 0;
                  const top = y0 - alto;
                  const d = `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + grosor - r} Q${x + grosor},${top} ${x + grosor},${top + r} V${y0} Z`;
                  return <path key={a} d={d} fill={AREA_COLOR[a]} opacity={activo === null || activo === i ? 1 : 0.45} />;
                })}
                {i === iMax && (
                  <text x={xCentro(i)} y={y(mes.total) - 6} textAnchor="middle" className="fill-fg text-[11px] font-semibold tabular-nums">{bsCorto(mes.total)}</text>
                )}
                {i % cadaCuanto === 0 && (
                  <text x={xCentro(i)} y={ALTO - 8} textAnchor="middle" className="fill-fg-subtle text-[11px]">{mesCorto(mes.mes, cruzaGestion)}</text>
                )}
                {/* Toda la banda es el blanco del puntero y del teclado. */}
                <rect
                  x={M.izq + banda * i} y={M.arriba} width={banda} height={base - M.arriba} fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${mesLargo(mes.mes)}: ${bs(mes.total)} en ${mes.facturas} ${mes.facturas === 1 ? 'factura' : 'facturas'}${areas.map(a => `; ${AREAS[a]} ${bs(mes.areas[a] || 0)}`).join('')}`}
                  onPointerEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className="cursor-default outline-none"
                />
                {activo === i && (
                  <rect x={M.izq + banda * i + 1} y={M.arriba - 2} width={Math.max(0, banda - 2)} height={base - M.arriba + 2} rx="6"
                    fill="rgb(var(--c-fg) / 0.04)" pointerEvents="none" />
                )}
              </g>
            );
          })}
        </svg>
      )}
      {m && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-max min-w-[11rem] -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-card"
          style={{ left: Math.min(Math.max(xCentro(activo), 96), Math.max(96, ancho - 96)), top: 0 }}
        >
          <p className="font-semibold text-fg">{mesLargo(m.mes)}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {[...areas].reverse().map(a => (
              <li key={a} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: AREA_COLOR[a] }} aria-hidden="true" />
                <span className="font-semibold tabular-nums text-fg">{bs(m.areas[a] || 0)}</span>
                <span className="text-fg-muted">{AREAS[a]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 border-t border-line pt-1 text-fg-muted">
            <span className="font-semibold tabular-nums text-fg">{bs(m.total)}</span> en {m.facturas} {m.facturas === 1 ? 'factura' : 'facturas'}
          </p>
        </div>
      )}
    </div>
  );
}

/** Tabla de la facturación por mes: los mismos números del gráfico. */
export function TablaPorMes({ meses, areas }) {
  const cruzaGestion = new Set(meses.map(m => m.mes.slice(0, 4))).size > 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[13px]">
        <caption className="sr-only">Facturación por mes y área</caption>
        <thead className="text-xs text-fg-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3 font-medium">Mes</th>
            {areas.map(a => <th key={a} scope="col" className="px-3 py-2 text-right font-medium">{AREAS[a]}</th>)}
            <th scope="col" className="py-2 pl-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {meses.map(m => (
            <tr key={m.mes}>
              <th scope="row" className="py-1.5 pr-3 font-normal text-fg">{mesCorto(m.mes, cruzaGestion)}</th>
              {areas.map(a => <td key={a} className="px-3 py-1.5 text-right text-fg-muted">{m.areas[a] ? bs(m.areas[a]) : '—'}</td>)}
              <td className="py-1.5 pl-3 text-right font-semibold text-fg">{bs(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Barras ordenadas de mayor a menor, una por fila, con el nombre y el valor
 * escritos (el color nunca es el único dato). Barras de 10 px con el extremo
 * redondeado y la base recta. `color` por fila, o el gris neutro.
 */
export function Barras({ items, total, etiqueta, escala }) {
  // `escala`: el máximo compartido cuando varias listas se comparan entre sí.
  const maximo = escala ?? Math.max(0, ...items.map(i => i.monto));
  return (
    <ul className="flex flex-col gap-2.5" aria-label={etiqueta}>
      {items.map(item => {
        const pct = total > 0 ? (item.monto / total) * 100 : 0;
        return (
          <li key={item.clave}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-fg" title={item.nombre}>
                {item.nombre}
                {item.detalle && <span className="ml-1.5 text-[12px] text-fg-subtle">{item.detalle}</span>}
              </span>
              <span className="flex-none tabular-nums">
                <span className="font-semibold text-fg">{bs(item.monto)}</span>
                <span className="ml-1.5 text-[12px] text-fg-subtle">{pct > 0 && pct < 1 ? '< 1' : Math.round(pct)} %</span>
              </span>
            </div>
            <div className="mt-1 h-2.5" aria-hidden="true">
              <div
                className={cn('h-full rounded-r-[4px]', !item.color && 'bg-fg-subtle')}
                style={{ width: `${maximo > 0 ? Math.max(0.5, (item.monto / maximo) * 100) : 0}%`, background: item.color || undefined }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
