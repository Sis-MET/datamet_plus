import { memo, useMemo, useState } from 'react';
import { cn } from '../../../shared/utils/cn';
import { METRICAS_MES as METRICAS, formatoDuracion, formatoHoras } from '../domain/tiempos';
import { columna, escalonar, useAncho, useValoresAnimados } from './graficos';

const ALTO = 248;
const MARGEN = { arriba: 24, derecha: 8, abajo: 28, izquierda: 48 };
const ANCHO_BARRA = 24;
const INTERNO_Y = ALTO - MARGEN.arriba - MARGEN.abajo;

/** Paso «redondo» (1, 2, 5 × 10ⁿ) para unas 4 líneas de referencia. */
const pasoRedondo = (maximo) => {
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const fraccion = crudo / potencia;
  return (fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10) * potencia;
};

const yDe = parte => MARGEN.arriba + INTERNO_Y - parte * INTERNO_Y;

/**
 * Lo único que se mueve: las columnas. Se anima la parte de la escala que
 * ocupa cada una (valor ÷ tope): crece desde cero al aparecer y, al cambiar,
 * va de una a otra sin bajar de golpe aunque cambie la escala. Es el único
 * componente que se vuelve a dibujar en cada cuadro.
 */
function Columnas({ puntos, tope, banda, barra, activo, texto }) {
  const partes = useValoresAnimados(puntos.map(p => (p.valor ?? 0) / tope), { duracion: 520, escalonado: escalonar(puntos.length, 22) });
  const mayor = puntos.reduce((max, p, i) => ((p.valor ?? -1) > (puntos[max]?.valor ?? -1) ? i : max), 0);
  return puntos.map((p, i) => {
    const parte = partes[i] ?? 0;
    const alto = parte * INTERNO_Y;
    if (alto <= 0.5) return null;
    const x = MARGEN.izquierda + banda * i;
    return (
      <g key={p.mes.clave} className="pointer-events-none">
        <path d={columna(x + (banda - barra) / 2, yDe(parte), barra, alto)} className={cn('tiempos-barra', activo === i && 'is-activa')} />
        {i === mayor && p.valor > 0 && activo === null && (
          <text x={x + banda / 2} y={yDe(parte) - 7} textAnchor="middle" className="tiempos-valor">{texto(p.valor)}</text>
        )}
      </g>
    );
  });
}

/** Los mismos datos del gráfico en una tabla (no cambia mientras se anima). */
const TablaDatos = memo(function TablaDatos({ meses }) {
  return (
    <details className="mt-1 text-[12.5px]">
      <summary className="cursor-pointer text-fg-muted hover:text-fg">Ver los datos del gráfico</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Servicios, horas y media por servicio de cada mes</caption>
          <thead className="sticky top-0 bg-surface-2 text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-medium">Mes</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Servicios</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Horas</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Media por servicio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {meses.map(mes => (
              <tr key={mes.clave}>
                <th scope="row" className="px-3 py-1.5 font-normal text-fg">{mes.nombre}</th>
                <td className="px-3 py-1.5 text-right text-fg">{mes.servicios}</td>
                <td className="px-3 py-1.5 text-right text-fg">{formatoHoras(mes.minutos)}</td>
                <td className="px-3 py-1.5 text-right text-fg">{formatoDuracion(mes.promedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
});

/**
 * Columnas por mes de la métrica elegida. La grilla, los ejes y las zonas de
 * puntero se dibujan una vez por cambio; solo las columnas se animan. Cada
 * mes muestra su valor al pasar el puntero o al enfocarlo con el teclado.
 * Memorizado: solo se redibuja si cambian los meses o la métrica.
 */
export const Tendencia = memo(function Tendencia({ meses, metrica }) {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const def = METRICAS[metrica];

  const puntos = useMemo(() => meses.map(mes => ({ mes, valor: def.valor(mes) })), [meses, def]);
  const maximo = Math.max(0, ...puntos.map(p => p.valor ?? 0));
  const paso = maximo > 0 ? pasoRedondo(maximo) : 1;
  const tope = Math.max(paso, Math.ceil(maximo / paso) * paso);
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);

  const internoX = Math.max(0, ancho - MARGEN.izquierda - MARGEN.derecha);
  const banda = puntos.length ? internoX / puntos.length : 0;
  const barra = Math.max(2, Math.min(ANCHO_BARRA, banda * 0.58));
  const y = valor => yDe(valor / tope);
  // Con muchos meses, una etiqueta sí y otra no (o cada tres).
  const cadaCuanto = banda < 26 ? 3 : banda < 40 ? 2 : 1;
  const punto = activo !== null ? puntos[activo] : null;

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={() => setActivo(null)}>
        {ancho > 0 && (
          <svg width={ancho} height={ALTO} role="list" aria-label={`${def.label} por mes`} className="block overflow-visible">
            {/* Al cambiar la escala, las líneas de referencia nuevas aparecen. */}
            {marcas.map(marca => (
              <g key={`${metrica}-${tope}-${marca}`} className="tiempos-marca">
                <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(marca)} y2={y(marca)} className="tiempos-grilla" />
                <text x={MARGEN.izquierda - 8} y={y(marca)} dy="0.32em" textAnchor="end" className="tiempos-eje">{def.eje(Number(marca.toFixed(2)))}</text>
              </g>
            ))}
            {puntos.map((p, i) => {
              const x = MARGEN.izquierda + banda * i;
              return (
                <g
                  key={p.mes.clave}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${p.mes.nombre}: ${p.valor === null ? 'sin servicios medidos' : def.texto(p.valor)}`}
                  onPointerEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className="tiempos-columna outline-none"
                >
                  {/* Zona de puntero: toda la banda, no solo la columna pintada. */}
                  <rect x={x} y={MARGEN.arriba} width={banda} height={INTERNO_Y} fill="transparent" />
                  {activo === i && <rect x={x + 1} y={MARGEN.arriba} width={Math.max(0, banda - 2)} height={INTERNO_Y} rx="8" className="tiempos-foco" />}
                  {i % cadaCuanto === 0 && (
                    <text x={x + banda / 2} y={ALTO - 8} textAnchor="middle" className="tiempos-eje">{p.mes.etiqueta}</text>
                  )}
                </g>
              );
            })}
            <Columnas puntos={puntos} tope={tope} banda={banda} barra={barra} activo={activo} texto={def.texto} />
            <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(0)} y2={y(0)} className="tiempos-base" />
          </svg>
        )}
        {punto && ancho > 0 && (
          <div
            role="presentation"
            className="tiempos-tooltip pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-line bg-surface px-3 py-2 shadow-pop"
            style={{
              left: Math.min(Math.max(MARGEN.izquierda + banda * activo + banda / 2, 80), ancho - 80),
              top: (punto.valor ? y(punto.valor) : y(0)) - 10,
            }}
          >
            <p className="text-[14px] font-semibold tabular-nums text-fg">{punto.valor === null ? 'Sin servicios medidos' : def.texto(punto.valor)}</p>
            <p className="text-[12px] text-fg-muted">
              {punto.mes.nombre} · {punto.mes.servicios === 1 ? '1 servicio' : `${punto.mes.servicios} servicios`}
            </p>
          </div>
        )}
      </div>
      <TablaDatos meses={meses} />
    </div>
  );
});
