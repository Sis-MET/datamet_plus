import { cn } from '../../../shared/utils/cn';
import { NOMBRE_FORMA, NOMBRE_LADO, posicionIndicador, posicionesPlataforma } from '../domain/excentricidad';

const LADO = 200;
const coma = (valor) => String(Number(valor.toPrecision(6))).replace('.', ',');

/** Contorno de la plataforma en un cuadro de LADO unidades (como ServiceMET). */
function Forma({ forma }) {
  const comun = { className: 'fill-surface-2 stroke-line-strong', strokeWidth: 1.5 };
  switch (forma) {
    case 'cuadrada':
      return <rect x={LADO * 0.15} y={LADO * 0.15} width={LADO * 0.7} height={LADO * 0.7} rx={5} {...comun} />;
    case 'rectangular':
      return <rect x={LADO * 0.12} y={LADO * 0.25} width={LADO * 0.76} height={LADO * 0.5} rx={5} {...comun} />;
    case 'circular':
      return <circle cx={LADO * 0.5} cy={LADO * 0.5} r={LADO * 0.4} {...comun} />;
    case 'triangular':
      return <path d={`M${LADO * 0.5} ${LADO * 0.1}L${LADO * 0.9} ${LADO * 0.9}L${LADO * 0.1} ${LADO * 0.9}Z`} strokeLinejoin="round" {...comun} />;
    default:
      return null;
  }
}

/**
 * Plataforma de la prueba de excentricidad con cada posición numerada y su
 * diferencia con la del centro; en rojo las que superan el límite (2·d).
 * esquema: de esquemaExcentricidad; diferencias: de diferenciasExcentricidad.
 */
export function DiagramaExcentricidad({ esquema, diferencias, unidad }) {
  const posiciones = posicionesPlataforma(esquema.forma, esquema.puntos);
  const indicador = esquema.indicador ? posicionIndicador(esquema.forma, esquema.indicador) : null;
  const radio = esquema.forma === 'rectangular' && esquema.puntos === 5 ? 12 : 13;
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${LADO} ${LADO}`}
        className="h-auto w-full max-w-[220px]"
        role="img"
        aria-label={`${NOMBRE_FORMA[esquema.forma]} con ${esquema.puntos} posiciones${esquema.indicador ? `, indicador ${NOMBRE_LADO[esquema.indicador]}` : ''}`}
      >
        <Forma forma={esquema.forma} />
        {indicador && (
          <g>
            <rect x={indicador[0] * LADO - 17} y={indicador[1] * LADO - 8} width={34} height={16} rx={4} className="fill-fg-muted" />
            <text x={indicador[0] * LADO} y={indicador[1] * LADO} dy="0.35em" textAnchor="middle" fontSize="9" fontWeight="700" className="fill-surface">IND</text>
          </g>
        )}
        {posiciones.map(([x, y], index) => {
          const fila = diferencias[index];
          const excede = Boolean(fila?.excede);
          return (
            <g key={index}>
              <circle cx={x * LADO} cy={y * LADO} r={radio} className={excede ? 'fill-danger' : 'fill-info'} />
              <text x={x * LADO} y={y * LADO} dy="0.36em" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{index + 1}</text>
              {fila && (
                <text
                  x={x * LADO}
                  y={y * LADO + radio + 11}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={excede ? 700 : 500}
                  className={cn(excede ? 'fill-danger' : 'fill-fg-muted')}
                >
                  {fila.referencia ? 'ref.' : `${fila.diferencia > 0 ? '+' : ''}${coma(fila.diferencia)}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-center text-[11.5px] leading-snug text-fg-muted">
        {NOMBRE_FORMA[esquema.forma]} · {esquema.puntos} posiciones
        {esquema.indicador ? ` · indicador ${NOMBRE_LADO[esquema.indicador]}` : ''}
        <span className="block">Diferencia con el centro ({unidad})</span>
      </figcaption>
    </figure>
  );
}
