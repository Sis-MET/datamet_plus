/**
 * Diagramas de la prueba de excentricidad: la plataforma con las posiciones
 * donde se cargó (como la dibuja ServiceMET) y el puente de una báscula de
 * camión con la ida, la vuelta y la lectura de cada posición.
 */
import { NOMBRE_LADO, lecturasCamion, posicionIndicador, posicionesPlataforma } from '../../domain/plataforma';

const AZUL = '#205C97';
const VERDE = '#3B7C21';
const BORDE = '#8A949E';
const FONDO = '#F2F4F6';
const IDA = '#0F9F93';
const VUELTA = '#E67E22';

const NOMBRE_FORMA = {
  cuadrada: 'Plataforma cuadrada',
  rectangular: 'Plataforma rectangular',
  circular: 'Plataforma circular',
  triangular: 'Plataforma triangular',
};

/** Forma de la plataforma en un cuadro de `lado` unidades. */
function Forma({ forma, lado }) {
  const comun = { fill: FONDO, stroke: BORDE, strokeWidth: 1.6 };
  switch (forma) {
    case 'cuadrada':
      return <rect x={lado * 0.15} y={lado * 0.15} width={lado * 0.7} height={lado * 0.7} rx={3} {...comun} />;
    case 'rectangular':
      return <rect x={lado * 0.12} y={lado * 0.25} width={lado * 0.76} height={lado * 0.5} rx={3} {...comun} />;
    case 'circular':
      return <ellipse cx={lado * 0.5} cy={lado * 0.5} rx={lado * 0.4} ry={lado * 0.4} {...comun} />;
    case 'triangular':
      return <path d={`M${lado * 0.5} ${lado * 0.1}L${lado * 0.9} ${lado * 0.9}L${lado * 0.1} ${lado * 0.9}Z`} {...comun} strokeLinejoin="round" />;
    default:
      return null;
  }
}

/**
 * Plataforma con sus posiciones numeradas y el indicador, y al lado la
 * forma, la cantidad de posiciones y dónde está el indicador.
 */
export function DiagramaPlataforma({ plataforma }) {
  const lado = 120;
  const posiciones = posicionesPlataforma(plataforma.forma, plataforma.puntos);
  const indicador = plataforma.indicador ? posicionIndicador(plataforma.forma, plataforma.indicador) : null;
  const radio = plataforma.forma === 'rectangular' && plataforma.puntos === 5 ? 8 : 9;
  return (
    <svg viewBox="0 0 232 120" className="st-diagrama" role="img" aria-label={`${NOMBRE_FORMA[plataforma.forma]} con ${plataforma.puntos} posiciones`}>
      <Forma forma={plataforma.forma} lado={lado} />
      {posiciones.map(([x, y], index) => (
        <g key={index}>
          <circle cx={x * lado} cy={y * lado} r={radio} fill={AZUL} />
          <text x={x * lado} y={y * lado} dy="0.36em" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{index + 1}</text>
        </g>
      ))}
      {indicador && (
        <g>
          <rect x={indicador[0] * lado - 13} y={indicador[1] * lado - 6} width={26} height={12} rx={2.5} fill={VERDE} />
          <text x={indicador[0] * lado} y={indicador[1] * lado} dy="0.35em" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">IND</text>
        </g>
      )}
      <text x={126} y={46} fontSize="11.5" fontWeight="700" fill="#000">{NOMBRE_FORMA[plataforma.forma]}</text>
      <text x={126} y={63} fontSize="10.5" fill="#333">{plataforma.puntos} posiciones</text>
      {plataforma.indicador && <text x={126} y={79} fontSize="10.5" fill="#333">Indicador {NOMBRE_LADO[plataforma.indicador]}</text>}
    </svg>
  );
}

function Flecha({ x1, x2, y, color }) {
  const derecha = x2 > x1;
  const punta = derecha ? `M${x2} ${y}l-8 -5v10z` : `M${x2} ${y}l8 -5v10z`;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 + (derecha ? -6 : 6)} y2={y} stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d={punta} fill={color} opacity="0.75" />
    </g>
  );
}

/** Caseta de control a un lado del puente (si se registró dónde está). */
function Caseta({ lado, puente }) {
  const ancho = 30;
  const alto = 20;
  const centro = {
    frente: [puente.x + puente.w / 2, puente.y + puente.h + 16],
    atras: [puente.x + puente.w / 2, puente.y - 16],
    izquierda: [puente.x - 24, puente.y + puente.h / 2],
    derecha: [puente.x + puente.w + 24, puente.y + puente.h / 2],
  }[lado];
  if (!centro) return null;
  const [cx, cy] = centro;
  return (
    <g>
      <rect x={cx - ancho / 2} y={cy - alto / 2} width={ancho} height={alto} rx={2} fill="#FFC000" />
      <path d={`M${cx - ancho / 2 - 3} ${cy - alto / 2}L${cx} ${cy - alto / 2 - 7}L${cx + ancho / 2 + 3} ${cy - alto / 2}Z`} fill="#E0A800" />
      <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">CASETA</text>
    </g>
  );
}

/**
 * Puente de una báscula de camión: la ida por el carril de arriba y la
 * vuelta por el de abajo, cada posición con su lectura, y la caseta si se
 * conoce su lugar.
 */
export function DiagramaCamion({ plataforma, lecturas, formato }) {
  const { ida, vuelta } = lecturasCamion(lecturas, plataforma.puntos);
  const columnas = Math.max(ida.length, vuelta.length, 1);
  const conCaseta = Boolean(plataforma.caseta);
  const puente = { x: conCaseta && plataforma.caseta === 'izquierda' ? 64 : 34, y: conCaseta && plataforma.caseta === 'atras' ? 52 : 28, w: 330, h: 96 };
  if (conCaseta && plataforma.caseta === 'derecha') puente.w = 318;
  const ancho = 400;
  const alto = puente.y + puente.h + (conCaseta && plataforma.caseta === 'frente' ? 52 : 26);
  const xDe = (i) => puente.x + 28 + ((puente.w - 56) * (i + 0.5)) / columnas;
  const yIda = puente.y + puente.h * 0.29;
  const yVuelta = puente.y + puente.h * 0.71;

  const punto = (lectura, i, carril) => {
    if (!lectura) return null;
    const x = xDe(i);
    const y = carril === 'ida' ? yIda : yVuelta;
    const color = carril === 'ida' ? IDA : VUELTA;
    // Lecturas fuera del puente: las de ida arriba y las de vuelta abajo.
    const yTexto = carril === 'ida' ? puente.y - 9 : puente.y + puente.h + 19;
    return (
      <g key={`${carril}${i}`}>
        <circle cx={x} cy={y} r={12.5} fill={color} stroke="#fff" strokeWidth="1.5" />
        <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#fff">{lectura.numero}</text>
        <text x={x} y={yTexto} textAnchor="middle" fontSize="13" fontWeight="700" fill="#000">{formato(lectura.valor)}</text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="st-diagrama"
      role="img"
      aria-label={`Puente de pesaje con ${plataforma.puntos} posiciones de ida y vuelta`}
    >
      <rect x={puente.x} y={puente.y} width={puente.w} height={puente.h} rx={6} fill={FONDO} stroke={BORDE} strokeWidth="1.6" />
      <line
        x1={puente.x + 10}
        x2={puente.x + puente.w - 10}
        y1={puente.y + puente.h / 2}
        y2={puente.y + puente.h / 2}
        stroke={BORDE}
        strokeWidth="1"
        strokeDasharray="7 6"
      />
      <Flecha x1={puente.x + 14} x2={puente.x + puente.w - 14} y={yIda} color={IDA} />
      <Flecha x1={puente.x + puente.w - 14} x2={puente.x + 14} y={yVuelta} color={VUELTA} />
      <text x={puente.x + 7} y={puente.y + 12} fontSize="9.5" fontWeight="700" fill={IDA}>IDA →</text>
      <text x={puente.x + puente.w - 7} y={puente.y + puente.h - 6} textAnchor="end" fontSize="9.5" fontWeight="700" fill={VUELTA}>← VUELTA</text>
      {ida.map((lectura, i) => punto(lectura, i, 'ida'))}
      {vuelta.map((lectura, i) => punto(lectura, i, 'vuelta'))}
      {conCaseta && <Caseta lado={plataforma.caseta} puente={puente} />}
    </svg>
  );
}
