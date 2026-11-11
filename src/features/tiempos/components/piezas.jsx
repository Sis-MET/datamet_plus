import { useLayoutEffect, useRef, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { prefersReducedMotion } from '../../../shared/utils/motion';
import { cn } from '../../../shared/utils/cn';
import { formatoHoras, formatoVariacion } from '../domain/tiempos';
import { animar, columna, escalonar, useAncho, useValoresAnimados } from './graficos';

/**
 * Un número que cuenta hasta su valor al aparecer y al cambiar. El conteo
 * escribe el texto directo en la página en cada cuadro (sin pasar por React),
 * así decenas de cifras se mueven a la vez sin trabarse. Los lectores de
 * pantalla reciben solo el valor final. `formato` debe ser estable (una
 * función del módulo, no una flecha nueva en cada render).
 */
export function NumeroAnimado({ valor, formato }) {
  const ref = useRef(null);
  const actualRef = useRef(0);
  const [reducido] = useState(prefersReducedMotion);

  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo || valor === null || valor === undefined) return undefined;
    const escribir = (v) => {
      actualRef.current = v;
      nodo.textContent = formato(v);
    };
    if (reducido || actualRef.current === valor) {
      escribir(valor);
      return undefined;
    }
    // Primer cuadro ya pintado con el valor de partida: nada parpadea.
    nodo.textContent = formato(actualRef.current);
    return animar({ desde: [actualRef.current], hacia: [valor], duracion: 480, alCuadro: ([v]) => escribir(v) });
  }, [valor, formato, reducido]);

  if (valor === null || valor === undefined) return formato(null);
  return (
    <>
      <span ref={ref} aria-hidden="true" className="tabular-nums" />
      <span className="sr-only">{formato(valor)}</span>
    </>
  );
}

/**
 * Cambio frente al período anterior: flecha, porcentaje y con qué se compara.
 * El color dice si el cambio es bueno (`subeEsBueno`) y nunca va solo: la
 * flecha y el texto dicen lo mismo.
 */
export function Variacion({ valor, etiqueta, subeEsBueno = true, compacta = false, sinDatos = 'Sin datos para comparar', detalle }) {
  if (valor === null || valor === undefined) {
    return <span className="tiempos-aparece text-[11.5px] text-fg-subtle" title={detalle || etiqueta}>{sinDatos}</span>;
  }
  const sube = valor >= 0.005;
  const baja = valor <= -0.005;
  const bueno = sube ? subeEsBueno : baja ? !subeEsBueno : null;
  const Icono = sube ? TrendingUp : baja ? TrendingDown : Minus;
  return (
    <span className="tiempos-aparece inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums transition-colors',
          bueno === true && 'bg-success/10 text-success',
          bueno === false && 'bg-danger/10 text-danger',
          bueno === null && 'bg-fg/[0.06] text-fg-muted',
        )}
      >
        <Icono className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">{sube ? 'Subió' : baja ? 'Bajó' : 'Sin cambio,'}</span>
        {formatoVariacion(valor)}
      </span>
      {!compacta && etiqueta && <span className="text-[11.5px] text-fg-muted">{etiqueta}</span>}
    </span>
  );
}

/** Horas por mes en miniatura: crecen al aparecer y al cambiar; el último mes resaltado. */
export function MiniTendencia({ meses, nombre }) {
  const [ref, ancho] = useAncho();
  const alturas = useValoresAnimados(meses.map(m => m.minutos), { duracion: 480, escalonado: escalonar(meses.length, 15, 160) });
  const alto = 40;
  const maximo = Math.max(0, ...meses.map(m => m.minutos));
  const banda = meses.length ? ancho / meses.length : 0;
  const barra = Math.max(2, Math.min(14, banda - 3));
  return (
    <div ref={ref} className="h-10" role="img" aria-label={`Horas por mes de ${nombre}: ${meses.map(m => `${m.etiqueta} ${formatoHoras(m.minutos)}`).join(', ')}`}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} aria-hidden="true" className="block">
          <line x1="0" x2={ancho} y1={alto - 0.5} y2={alto - 0.5} className="tiempos-grilla" />
          {meses.map((mes, i) => {
            const h = maximo ? ((alturas[i] ?? 0) / maximo) * (alto - 2) : 0;
            if (h <= 0.3) return null;
            return (
              <path
                key={mes.clave}
                d={columna(banda * i + (banda - barra) / 2, alto - h, barra, h, 2)}
                className={cn('tiempos-sparkline', i === meses.length - 1 && 'is-ultimo')}
              >
                <title>{`${mes.nombre}: ${formatoHoras(mes.minutos)}`}</title>
              </path>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * En qué tipos de servicio (o rangos) se fueron las horas: una barra fina
 * dividida en partes, con los nombres y porcentajes debajo. Las partes crecen
 * al aparecer y cambian de ancho con suavidad al filtrar.
 */
export function Mezcla({ mezcla, colores, nombres, maximo = 3 }) {
  if (!mezcla.length) return null;
  const visibles = [...mezcla].sort((a, b) => b.minutos - a.minutos).slice(0, maximo);
  const resto = mezcla.length - visibles.length;
  return (
    <div>
      <div
        className="tiempos-crece-x tiempos-mezcla flex h-2 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Horas por grupo: ${mezcla.map(m => `${nombres(m.id)} ${Math.round(m.parte * 100)} %`).join(', ')}`}
      >
        {mezcla.map(m => (
          <span
            key={m.id}
            className="tiempos-ancho h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${m.parte * 100}%`, background: colores.get(m.id) }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-muted">
        {visibles.map(m => (
          <li key={m.id} className="tiempos-aparece flex items-center gap-1.5">
            <span className="h-2 w-2 flex-none rounded-sm" style={{ background: colores.get(m.id) }} aria-hidden="true" />
            <span className="text-fg">{nombres(m.id)}</span>
            <span className="tabular-nums">{Math.round(m.parte * 100)} %</span>
          </li>
        ))}
        {resto > 0 && <li>+{resto} más</li>}
      </ul>
    </div>
  );
}
