/**
 * «Cómo se calcula»: lo que la pestaña del registro necesita para explicar el
 * cálculo con los números del servicio (EURAMET cg-18 v4.0, GUM). Solo da
 * formato y ordena lo que ya calculó el motor; no calcula nada nuevo.
 */

// Componentes del presupuesto (EURAMET cg-18 7.1.1 y 7.1.2) y cómo se obtienen.
export const FUENTES_INCERTIDUMBRE = {
  redondeoCero: { label: 'Redondeo en cero', formula: 'd₀ / √12' },
  redondeoCarga: { label: 'Redondeo con carga', formula: 'd_I / √12' },
  repetibilidad: { label: 'Repetibilidad', formula: 's' },
  excentricidad: { label: 'Excentricidad', formula: 'u_rel(ecc) · I' },
  certificado: { label: 'Certificado de las pesas', formula: 'Σ U/k (o emp/√3)' },
  empuje: { label: 'Empuje del aire', formula: 'm_N · u_rel(δm_B)' },
  deriva: { label: 'Deriva de las pesas', formula: 'Σ D/√3, D = k_D·U' },
  conveccion: { label: 'Convección', formula: 'Δm_conv / √3' },
  sustitucionPatron: { label: 'Carga patrón (sustitución)', formula: 'Σ u(m_ref), suma lineal' },
  sustitucionIndicaciones: { label: 'Indicaciones de la sustitución', formula: '√(2·Σu²(I_j)); Método 2: √(Σu²(I_s,j) + k²·u²(I_ref))' },
};

const SUPERINDICES = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Número con n cifras significativas y coma; muy chico o muy grande, con potencia de 10. */
export const cifras = (valor, n = 3) => {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  const v = Number(valor);
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs < 1e-4 || abs >= 1e7) {
    const [mantisa, exponente] = v.toExponential(n - 1).split('e');
    return `${mantisa.replace('.', ',')}·10${String(Number(exponente)).split('').map(c => SUPERINDICES[c]).join('')}`;
  }
  return String(Number(v.toPrecision(n))).replace('.', ',');
};

/** Número con decimales fijos y coma, sin «-0». */
export const fijo = (valor, decimales) => {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  const texto = Number(valor).toFixed(Math.max(0, decimales));
  return (/^-0(\.0+)?$/.test(texto) ? texto.slice(1) : texto).replace('.', ',');
};

/** Decimales de la división d (0,01 → 2). */
export const decimalesDe = (d) => {
  const texto = String(Number(Number(d).toPrecision(12)));
  const exp = texto.match(/e-(\d+)$/);
  if (exp) return Number(exp[1]);
  return texto.includes('.') ? texto.split('.')[1].length : 0;
};

export const grados = nu => (!Number.isFinite(nu) ? '∞' : nu > 9999 ? 'más de 9 999' : String(Math.floor(nu)));

export const porcentaje = (fraccion) => {
  if (!(fraccion >= 0)) return '—';
  const p = fraccion * 100;
  return `${p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1).replace('.', ',') : p > 0 ? '< 1' : '0'} %`;
};

/**
 * Presupuesto de un punto en dos grupos (indicación y masa de referencia),
 * con el aporte de cada componente a u²(E) y la que más pesa.
 */
export const presupuesto = (punto) => {
  const componentes = (punto?.componentes || []).filter(c => c.u > 0);
  const total = componentes.reduce((suma, c) => suma + c.u * c.u, 0);
  const filas = componentes.map(c => ({
    ...c,
    etiqueta: FUENTES_INCERTIDUMBRE[c.fuente]?.label || c.fuente,
    formula: FUENTES_INCERTIDUMBRE[c.fuente]?.formula || '',
    aporte: total > 0 ? (c.u * c.u) / total : 0,
  }));
  const mayor = filas.reduce((a, b) => (b.aporte > (a?.aporte ?? -1) ? b : a), null);
  return {
    indicacion: filas.filter(f => f.grupo === 'indicacion'),
    referencia: filas.filter(f => f.grupo === 'referencia'),
    mayor,
    // Grados finitos: solo la repetibilidad (tipo A) suma al denominador de νeff.
    tipoA: filas.filter(f => Number.isFinite(f.nu)),
  };
};

/** Cómo se trató la carga del punto, en palabras. */
export const textoComposicion = (punto) => ({
  ELEGIDA: 'piezas elegidas a mano en el registro',
  SUSTITUCION: 'carga de sustitución',
  SUPUESTA: 'piezas supuestas (el juego no tiene piezas registradas)',
  REGLA: 'la combinación con menos piezas de los juegos llevados',
}[punto?.composicion] || '');
