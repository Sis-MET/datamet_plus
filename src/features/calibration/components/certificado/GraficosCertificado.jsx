import { escalaBonita, marcasDe } from '../../domain/certificado';

// Colores de los gráficos de la hoja CERT (Excel).
const NARANJA = '#ed7d31';
const ROJO = '#ff0000';
const VERDE = '#00b050';
const AZUL = '#4472c4';
const GRILLA = '#d9d9d9';
const TEXTO = '#595959';

const linea = (puntos, x, y) => puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(2)} ${y(p.y).toFixed(2)}`).join(' ');

/** Ejes con grilla horizontal y marcas en x e y. */
function Ejes({ area, ex, ey, x, y, etiquetaX, etiquetaY }) {
  return (
    <g fontSize="11" fill={TEXTO}>
      {marcasDe(ey).map(m => (
        <g key={`y${m.valor}`}>
          <line x1={area.x} x2={area.x + area.ancho} y1={y(m.valor)} y2={y(m.valor)} stroke={GRILLA} strokeWidth="0.8" />
          <text x={area.x - 6} y={y(m.valor)} dy="0.35em" textAnchor="end">{m.texto}</text>
        </g>
      ))}
      {marcasDe(ex).map(m => (
        <g key={`x${m.valor}`}>
          <line x1={x(m.valor)} x2={x(m.valor)} y1={area.y} y2={area.y + area.alto} stroke={GRILLA} strokeWidth="0.8" />
          <text x={x(m.valor)} y={area.y + area.alto + 15} textAnchor="middle">{m.texto}</text>
        </g>
      ))}
      {etiquetaX && <text x={area.x + area.ancho / 2} y={area.y + area.alto + 33} textAnchor="middle" fontWeight="700" fill="#000" fontSize="12">{etiquetaX}</text>}
      {etiquetaY && (
        <text transform={`translate(${area.x - 44} ${area.y + area.alto / 2}) rotate(-90)`} textAnchor="middle" fontWeight="700" fill="#000" fontSize="12">{etiquetaY}</text>
      )}
    </g>
  );
}

/** Desviación estándar de la repetibilidad en función de la carga. */
export function GraficoDesviacion({ serie, escalaMinima = null }) {
  const ancho = 400;
  const alto = 165;
  const area = { x: 52, y: 22, ancho: 330, alto: 112 };
  const ex = escalaBonita(0, Math.max(...serie.map(p => p.x), 0), 5);
  const ey = escalaBonita(0, Math.max(...serie.map(p => p.y), escalaMinima || 0), 5);
  const x = (v) => area.x + ((v - ex.min) / (ex.max - ex.min)) * area.ancho;
  const y = (v) => area.y + area.alto - ((v - ey.min) / (ey.max - ey.min)) * area.alto;
  const puntos = [...serie].sort((a, b) => a.x - b.x);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="cc-grafico" role="img" aria-label="Gráfico de la desviación estándar">
      <text x={area.x + area.ancho / 2} y="13" textAnchor="middle" fontSize="13" fontWeight="700" fill={TEXTO}>Desviación estándar</text>
      <Ejes area={area} ex={ex} ey={ey} x={x} y={y} />
      <path d={linea(puntos, x, y)} fill="none" stroke={NARANJA} strokeWidth="1.6" />
      {puntos.map(p => (
        <path key={p.x} d={`M${x(p.x) - 3.5} ${y(p.y) - 3.5}l7 7m0 -7l-7 7`} stroke={NARANJA} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

/**
 * Errores de indicación: emp o tolerancia en escalones (±), los errores
 * después del ajuste (AS LEFT) y, si hubo ajuste, los de antes (AS FOUND).
 */
export function GraficoErrores({ asLeft, asFound, emp }) {
  const ancho = 680;
  const alto = 228;
  const area = { x: 70, y: 32, ancho: 590, alto: 150 };
  const xs = [...asLeft, ...asFound, ...emp].map(p => p.x);
  const ys = [...asLeft, ...asFound, ...emp].map(p => Math.abs(p.y));
  const limite = Math.max(...ys, 0) * 1.15 || 1;
  const ex = escalaBonita(0, Math.max(...xs, 0), 6);
  const ey = escalaBonita(-limite, limite, 8);
  const x = (v) => area.x + ((v - ex.min) / (ex.max - ex.min)) * area.ancho;
  const y = (v) => area.y + area.alto - ((v - ey.min) / (ey.max - ey.min)) * area.alto;
  const desdeCero = (serie) => (serie.length ? [{ x: 0, y: 0 }, ...[...serie].sort((a, b) => a.x - b.x)] : []);
  const leyenda = [
    { texto: 'EMP (-)', color: ROJO, guion: null },
    { texto: 'EMP (+)', color: ROJO, guion: null },
    { texto: 'AS LEFT', color: VERDE, guion: '7 4' },
    ...(asFound.length ? [{ texto: 'AS FOUND', color: AZUL, guion: '7 4' }] : []),
  ].filter(item => emp.length || !item.texto.startsWith('EMP'));
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="cc-grafico" role="img" aria-label="Gráfico de los errores de indicación">
      <g fontSize="13" fill={TEXTO}>
        {leyenda.map((item, i) => {
          const x0 = 80 + i * 150;
          return (
            <g key={item.texto}>
              <line x1={x0} x2={x0 + 34} y1="13" y2="13" stroke={item.color} strokeWidth="2.2" strokeDasharray={item.guion || undefined} />
              <text x={x0 + 40} y="13" dy="0.35em">{item.texto}</text>
            </g>
          );
        })}
      </g>
      <Ejes area={area} ex={ex} ey={ey} x={x} y={y} etiquetaX="Carga aplicada" etiquetaY="Error" />
      {emp.length > 0 && (
        <>
          <path d={linea(emp, x, y)} fill="none" stroke={ROJO} strokeWidth="1.8" />
          <path d={linea(emp.map(p => ({ x: p.x, y: -p.y })), x, y)} fill="none" stroke={ROJO} strokeWidth="1.8" />
        </>
      )}
      {asFound.length > 0 && <path d={linea(desdeCero(asFound), x, y)} fill="none" stroke={AZUL} strokeWidth="1.8" strokeDasharray="7 4" />}
      <path d={linea(desdeCero(asLeft), x, y)} fill="none" stroke={VERDE} strokeWidth="1.8" strokeDasharray="7 4" />
    </svg>
  );
}
