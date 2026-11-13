import { useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { REGLAS } from '../../domain/servicios';
import { etiquetaColumna, textoNominal } from '../../domain/registro';
import {
  cifras, decimalesDe, fijo, grados, porcentaje, presupuesto, textoComposicion,
} from '../../domain/explicacion';
import { ToneBadge } from '../primitives';

/** Un paso de la explicación, numerado, con las normas que lo respaldan. */
function Paso({ numero, titulo, norma, children }) {
  return (
    <section aria-labelledby={`paso-${numero}`} className="card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-fg text-[13px] font-semibold text-surface" aria-hidden="true">{numero}</span>
        <div className="min-w-0 flex-1">
          <h3 id={`paso-${numero}`} className="text-sm font-semibold text-fg">{titulo}</h3>
          {norma && <p className="text-[11.5px] text-fg-muted">{norma}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-fg">{children}</div>
    </section>
  );
}

/** Una fórmula con sus valores: «E = I − mref = 100,0012 − 100,0003 = 0,0009 g». */
function Formula({ children, resultado }) {
  return (
    <p className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12.5px] text-fg">
      {children}
      {resultado != null && <> = <strong className="font-semibold">{resultado}</strong></>}
    </p>
  );
}

const Nota = ({ children }) => <p className="text-[12.5px] text-fg-muted">{children}</p>;

// «(4,22·10⁻⁷)²» y no «4,22·10⁻⁷²».
const alCuadrado = (valor) => {
  const texto = cifras(valor, 3);
  return texto.includes('·10') ? `(${texto})²` : `${texto}²`;
};

function Aire({ calculo }) {
  const { aire, empuje, conveccion } = calculo;
  const c = aire.condiciones || {};
  const aproximada = aire.formula === 'APROXIMADA';
  return (
    <Paso numero={1} titulo="Densidad del aire y empuje sobre las pesas" norma={`EURAMET cg-18 ${aproximada ? 'A1.1-1 (fórmula aproximada)' : 'A1.1 (CIPM-2007)'}, A3 y 7.1.2`}>
      <p>
        Condiciones del servicio (promedio del inicio y el fin, corregidas con el certificado del termohigrómetro{calculo.termohigrometro ? ` ${calculo.termohigrometro}` : ''}):
        {' '}<strong>t = {fijo(c.t, 1)} °C</strong>, <strong>HR = {fijo(c.hr, 0)} %</strong>, <strong>p = {fijo(c.p, 1)} hPa</strong>.
      </p>
      <Formula resultado={`${fijo(aire.rho, 4)} kg/m³`}>ρa ({aproximada ? 'fórmula aproximada' : 'CIPM-2007'})</Formula>
      <Nota>
        u(ρa) = {cifras(aire.u, 2)} kg/m³, con la incertidumbre del termohigrómetro y la variación entre el inicio y el fin. Como ρa está lejos de
        ρ₀ = 1,2 kg/m³ (la de referencia de la masa convencional), cada pesa «pesa» distinto que en su certificado: se corrige el empuje.
      </Nota>
      {empuje && (
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {empuje.juegos.map(j => (
            <li key={j.juego}>
              <strong>{j.juego}</strong>: {j.rhoA1 != null
                ? `aire de la calibración de las pesas ρa1 = ${cifras(j.rhoA1, 4)} kg/m³ → incertidumbre por 7.1.2-5b (más exacta en altura).`
                : 'sin las condiciones de su calibración → incertidumbre por 7.1.2-5a.'}
            </li>
          ))}
        </ul>
      )}
      {conveccion && (
        <Nota>Convección (7.1.2-13, Anexo F): pesas a ΔT = {fijo(conveccion.deltaT, 0)} K del aire según la estabilización registrada ({conveccion.estabilizacion || 'sin dato'}).</Nota>
      )}
    </Paso>
  );
}

function Repetibilidad({ calculo, unidad }) {
  const ensayos = calculo.repetibilidad.filter(e => e.s != null);
  return (
    <Paso numero={2} titulo="Repetibilidad" norma="EURAMET cg-18 5.1, 6.1-1 y 7.1.1">
      <Formula>s = √( Σ (Iᵢ − Ī)² / (n − 1) ),  ν = n − 1</Formula>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead className="text-left text-fg-muted">
            <tr><th className="py-1 pr-3 font-medium">Carga</th><th className="py-1 pr-3 font-medium">Lecturas</th><th className="py-1 pr-3 font-medium">Media</th><th className="py-1 pr-3 font-medium">s</th><th className="py-1 font-medium">ν</th></tr>
          </thead>
          <tbody>
            {ensayos.map(e => (
              <tr key={e.carga} className="border-t border-line/70">
                <td className="py-1 pr-3">{textoNominal(e.carga)} {unidad}</td>
                <td className="py-1 pr-3">{e.n}</td>
                <td className="py-1 pr-3">{cifras(e.media, 10)} {unidad}</td>
                <td className="py-1 pr-3 font-semibold">{cifras(e.s, 3)} {unidad}</td>
                <td className="py-1">{e.nu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Nota>
        {calculo.reglas?.repetibilidad === 'MAYOR'
          ? 'En cada punto se usa la mayor s de todos los ensayos (regla del método, como el libro).'
          : 'En cada punto se usa la s del ensayo más cercano por encima y por debajo de la carga (la mayor de las dos).'}
        {' '}Con pocas lecturas, ν es chico y eso sube k.
      </Nota>
    </Paso>
  );
}

function Excentricidad({ calculo, unidad }) {
  const ecc = calculo.excentricidad;
  const metodo1 = ecc.metodo === 'METODO_1';
  return (
    <Paso numero={3} titulo="Excentricidad" norma={`EURAMET cg-18 5.3 (método ${metodo1 ? '1' : '3'}), ${metodo1 ? '6.3-1' : '6.3-2'} y 7.1.1-10`}>
      {ecc.diferencias.length ? (
        <>
          <p>
            Carga {textoNominal(ecc.carga)} {unidad} en el centro y en las demás posiciones{metodo1 ? '' : ', volviendo a cero entre una y otra (se resta el retorno)'}; diferencias con el centro:
            {' '}{ecc.diferencias.map(d => cifras(d, 3)).join('; ')} {unidad}.
          </p>
          <Formula resultado={cifras(ecc.uRel, 3)}>
            u_rel = |ΔI_ecc|máx / (2 · L_ecc · √3) = {cifras(ecc.maxima, 3)} / (2 · {textoNominal(ecc.carga)} · √3)
          </Formula>
          <Nota>Se supone que la carga del ensayo de errores quedó a no más de la mitad de la distancia de las posiciones: en cada punto entra como u_rel · I.</Nota>
        </>
      ) : <Nota>Sin ensayo de excentricidad: no se incluye su contribución.</Nota>}
    </Paso>
  );
}

function FilasPresupuesto({ titulo, filas, unidad }) {
  if (!filas.length) return null;
  return (
    <>
      <tr><td colSpan={5} className="pb-1 pt-2.5 text-[12px] font-semibold text-fg-muted">{titulo}</td></tr>
      {filas.map(f => (
        <tr key={`${f.grupo}-${f.fuente}`} className="border-t border-line/70">
          <td className="py-1 pr-3">{f.etiqueta}<span className="block font-mono text-[11px] text-fg-muted">{f.formula} · {f.ecuacion}</span></td>
          <td className="py-1 pr-3 text-right">{cifras(f.u, 3)} {unidad}</td>
          <td className="py-1 pr-3 text-right">{grados(f.nu)}</td>
          <td className="py-1 text-right">{porcentaje(f.aporte)}</td>
          <td className="w-24 py-1 pl-2"><span className="block h-1.5 rounded-full bg-info/70" style={{ width: `${Math.max(2, f.aporte * 100)}%` }} aria-hidden="true" /></td>
        </tr>
      ))}
    </>
  );
}

function Punto({ punto, modelo, unidad, reglas = {}, clase = null }) {
  const cobertura = reglas.cobertura || { metodo: 'T_STUDENT', probabilidad: 0.9545 };
  const redondeo = reglas.redondeo || { cifras: 2, sentido: 'ARRIBA' };
  const banda = reglas.bandaGuarda ?? 1;
  const kFijo = cobertura.metodo === 'FIJO';
  const probabilidad = `${String(Number((cobertura.probabilidad * 100).toPrecision(6))).replace('.', ',')} %`;
  const dec = decimalesDe(punto.rango?.d || 1);
  const masa = punto.masa;
  const p = presupuesto(punto);
  const pres = punto.presentacion;
  const conf = punto.conformidad;
  const regla = conf?.regla || modelo.criterio?.regla;
  const ajustaCero = Math.abs(punto.indicacion - punto.indicacionLeida) > 1e-12;
  return (
    <>
      <Paso numero={4} titulo={`Masa de referencia e indicación · punto ${punto.n}`} norma="EURAMET cg-18 4.2.4, 4.4.1 y 7.1.2">
        <p>Carga {textoNominal(punto.carga)} {unidad}, armada con {textoComposicion(punto)}{punto.piezas.length ? `: ${punto.piezas.map(x => `${textoNominal(x.nominal)}${x.identificacion ? ` ${x.identificacion}` : ''}`).join(' + ')} ${unidad}` : ''}.</p>
        {masa ? (
          <>
            {masa.piezas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] tabular-nums">
                  <thead className="text-left text-fg-muted">
                    <tr><th className="py-1 pr-3 font-medium">Pieza</th><th className="py-1 pr-3 font-medium">δmc (certificado)</th><th className="py-1 pr-3 font-medium">ρ</th><th className="py-1 font-medium">δmB = −mN·(ρa − ρ₀)·(1/ρ − 1/ρc)</th></tr>
                  </thead>
                  <tbody>
                    {masa.piezas.map((x, i) => (
                      <tr key={i} className="border-t border-line/70">
                        <td className="py-1 pr-3">{textoNominal(x.nominal)} {unidad}</td>
                        <td className="py-1 pr-3">{cifras(x.correccion, 3)} {unidad}</td>
                        <td className="py-1 pr-3">{x.densidad != null ? `${textoNominal(x.densidad)} kg/m³` : '—'}</td>
                        <td className="py-1">{cifras(x.correccionB, 3)} {unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Formula resultado={`${fijo(punto.mref, dec + 2)} ${unidad}`}>
              m_ref = m_N + δm_c + δm_B = {textoNominal(masa.mN)} + ({cifras(masa.correccion, 3)}) + ({cifras(masa.empuje, 3)})
            </Formula>
          </>
        ) : punto.sustitucion && (
          <Formula resultado={`${fijo(punto.mref, dec + 2)} ${unidad}`}>
            L_T = {punto.sustitucion.descripcion} {unidad} ({punto.sustitucion.ecuacion}; ServiceMET no registra los ΔI: se toman como cero)
          </Formula>
        )}
        {ajustaCero ? (
          <Formula resultado={`${fijo(punto.indicacion, dec + 1)} ${unidad}`}>I = I_L − (I₀ + I₀ᵢ)/2 = {textoNominal(punto.indicacionLeida)} − cero</Formula>
        ) : (
          <Nota>Indicación leída: I = {textoNominal(punto.indicacion)} {unidad} (rango de Max {textoNominal(punto.rango.max)} {unidad}, d = {textoNominal(punto.rango.d)} {unidad}).</Nota>
        )}
      </Paso>

      <Paso numero={5} titulo="Error y su incertidumbre" norma="EURAMET cg-18 7.1, 7.1.3 y 7.3; GUM 5.1.2 y G.4 (Welch-Satterthwaite)">
        <Formula resultado={`${fijo(punto.error, dec + 2)} ${unidad}`}>
          E = I − m_ref = {fijo(punto.indicacion, dec + 1)} − {fijo(punto.mref, dec + 2)}
        </Formula>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] tabular-nums">
            <thead className="text-left text-fg-muted">
              <tr><th className="py-1 pr-3 font-medium">Componente</th><th className="py-1 pr-3 text-right font-medium">u</th><th className="py-1 pr-3 text-right font-medium">ν</th><th className="py-1 text-right font-medium">Aporte</th><th className="py-1" /></tr>
            </thead>
            <tbody>
              <FilasPresupuesto titulo="De la indicación, u(I)" filas={p.indicacion} unidad={unidad} />
              <FilasPresupuesto titulo="De la masa de referencia, u(m_ref)" filas={p.referencia} unidad={unidad} />
            </tbody>
          </table>
        </div>
        <Formula resultado={`${cifras(punto.u, 3)} ${unidad}`}>u(E) = √( u²(I) + u²(m_ref) ) = √( {alCuadrado(punto.uIndicacion)} + {alCuadrado(punto.uReferencia)} )</Formula>
        {p.mayor && <Nota>Lo que más pesa en este punto: <strong className="text-fg">{p.mayor.etiqueta.toLowerCase()}</strong> ({porcentaje(p.mayor.aporte)} de u²(E)).</Nota>}
        <Formula resultado={grados(punto.nuEff)}>ν_eff = u⁴(E) / Σ( uᵢ⁴ / νᵢ )</Formula>
        <Formula resultado={fijo(punto.k, 2)}>{kFijo ? 'k fijo (configuración del método)' : `k = t(${probabilidad}; ν_eff)`}</Formula>
        <Nota>
          {kFijo
            ? 'El método usa el mismo k en todos los puntos, sin mirar los grados de libertad.'
            : punto.k > 2.005
              ? 'k sale mayor que 2 porque la repetibilidad tiene pocas lecturas y pesa en u(E): se usa la t de Student, no k = 2 fijo.'
              : `Con muchos grados de libertad efectivos, k queda en ${fijo(punto.k, 2)}.`}
        </Nota>
        <Formula resultado={`${cifras(punto.U, 4)} ${unidad}`}>U = k · u(E) = {fijo(punto.k, 2)} · {cifras(punto.u, 3)}</Formula>
        <div className="rounded-xl border border-info/30 bg-info/5 px-3.5 py-2.5">
          <p className="text-[12.5px] text-fg-muted">
            En el certificado: U con {redondeo.cifras === 1 ? 'una cifra significativa' : `${redondeo.cifras === 3 ? 'tres' : 'dos'} cifras significativas`},
            {' '}{redondeo.sentido === 'CERCANO' ? 'redondeada al más cercano' : 'redondeada hacia arriba'}, y el error al mismo decimal (GUM 7.2.6).
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-fg">
            E = {fijo(pres.error, pres.decimales)} {unidad}  ·  U = {fijo(pres.U, pres.decimales)} {unidad}  ·  k = {fijo(pres.k, 2)}
          </p>
        </div>
      </Paso>

      <Paso numero={6} titulo="Conformidad" norma="NB/ISO/IEC 17025 7.8.6; ILAC G8; tolerancia NB 23001 (OIML R76) o la del cliente">
        {conf?.evaluada ? (
          <>
            <p>
              Tolerancia T = ±{cifras(punto.tolerancia, 3)} {unidad} ({modelo.criterio?.empNB23001
                ? `emp en servicio de la NB 23001 para la clase ${clase?.valor || modelo.instrumento.clase?.valor || '—'}${clase?.valor && !clase.registrada ? ' (sugerida, sin confirmar)' : ''}${(reglas.factorEmp ?? 2) !== 2 ? ` (${fijo(reglas.factorEmp, 2)} × el de verificación, regla del método)` : ''}`
                : modelo.criterio?.toleranciaCliente > 0 ? `${fijo(modelo.criterio?.toleranciaCliente, 3)} % pedido por el cliente` : 'tolerancia por rango pedida por el cliente'}),
              regla {REGLAS[regla]?.toLowerCase() || regla}.
            </p>
            <Formula resultado={conf.conforme ? 'conforme' : 'no conforme'}>
              {regla === 'CONSERVADORA'
                ? (banda === 1
                  ? `|E| + U ≤ T  →  ${cifras(Math.abs(punto.error), 3)} + ${cifras(punto.U, 3)} ≤ ${cifras(punto.tolerancia, 3)}`
                  : `|E| + ${fijo(banda, 2)} · U ≤ T  →  ${cifras(Math.abs(punto.error), 3)} + ${cifras(banda * punto.U, 3)} ≤ ${cifras(punto.tolerancia, 3)}`)
                : `|E| ≤ T  →  ${cifras(Math.abs(punto.error), 3)} ≤ ${cifras(punto.tolerancia, 3)}`}
            </Formula>
            <Nota>Probabilidad de que el error real esté fuera de la tolerancia (riesgo de la decisión): {porcentaje(conf.riesgo)}.</Nota>
          </>
        ) : (
          <Nota>
            {modelo.criterio?.empNB23001 && !modelo.instrumento.clase?.valor
              ? 'Se pidió el emp de la NB 23001, pero el instrumento no tiene clase registrada: no se evalúa.'
              : 'El cliente no pidió declaración de conformidad.'}
          </Nota>
        )}
      </Paso>
    </>
  );
}

const REGLA_S = {
  ENCIERRAN: 'La mayor s de los dos ensayos que encierran cada carga (EURAMET 7.1.1).',
  MAYOR: 'La mayor s de todos los ensayos, en todo el rango (como el libro F-VMET-02-7.2).',
};
const conComa = (valor, n = 6) => String(Number(Number(valor).toPrecision(n))).replace('.', ',');

/** Una tabla chica con encabezado, para los datos registrados. */
function Tabla({ cabeza, filas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] tabular-nums">
        <thead className="text-left text-fg-muted">
          <tr>{cabeza.map((c, i) => <th key={`${c}-${i}`} className="py-1 pr-3 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, f) => (
            <tr key={f} className="border-t border-line/70">
              {fila.map((celda, i) => <td key={i} className="py-1 pr-3">{celda}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bloque({ titulo, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-semibold text-fg-muted">{titulo}</p>
      {children}
    </div>
  );
}

/**
 * Las reglas de la configuración del método con que se calcula este
 * certificado (Calibración › Método de cálculo), en palabras.
 */
function ReglasAplicadas({ calculo, modelo }) {
  const r = calculo.reglas || {};
  const cobertura = r.cobertura || { metodo: 'T_STUDENT', probabilidad: 0.9545 };
  const redondeo = r.redondeo || { cifras: 2, sentido: 'ARRIBA' };
  const criterio = modelo.criterio || {};
  const regla = criterio.regla || 'NINGUNA';
  const banda = r.bandaGuarda ?? 1;
  const convMetodo = calculo.metodo?.conveccion;
  const claseTexto = `${calculo.clase?.valor || '—'}${calculo.clase?.valor && !calculo.clase.registrada ? ' (sugerida, sin confirmar)' : ''}`;
  let tolerancia = 'Sin tolerancia: no se declara la conformidad.';
  if (criterio.empNB23001) tolerancia = `emp en servicio de la NB 23001: ${conComa(r.factorEmp ?? 2)} × el de verificación inicial de la OIML R76 (Tabla 6), con la clase ${claseTexto}.`;
  else if (criterio.toleranciaCliente > 0) tolerancia = `${conComa(criterio.toleranciaCliente)} % de la carga, pedido por el cliente.`;
  else if (criterio.toleranciasRango?.length) {
    const tramos = criterio.toleranciasRango
      .map(t => `${t.hasta == null ? 'en adelante' : `hasta ${conComa(t.hasta)} ${modelo.instrumento?.unidad || ''}`}: ± ${conComa(t.tolerancia)} ${t.en === 'D' ? 'd (del rango de la carga)' : modelo.instrumento?.unidad || ''}`);
    tolerancia = `Por rango de carga, pedida por el cliente: ${tramos.join('; ')}.`;
  }
  let decision = '';
  if (regla === 'CONSERVADORA') decision = `: conforme si |E| + ${banda === 1 ? '' : `${conComa(banda)} · `}U ≤ T`;
  else if (regla === 'SIMPLE') decision = ': conforme si |E| ≤ T';
  let conveccion = 'No se incluye.';
  if (calculo.conveccion) conveccion = `Con ΔT = ${fijo(calculo.conveccion.deltaT, 0)} K según la estabilización registrada (EURAMET 7.1.2-13).`;
  else if (convMetodo?.activa) conveccion = `Solo en pesas ${(convMetodo.clases || []).join(', ')}: no aplica a este servicio.`;
  const cifrasU = redondeo.cifras === 1 ? 'Una cifra significativa' : `${redondeo.cifras === 3 ? 'Tres' : 'Dos'} cifras significativas`;
  const filas = [
    ['Desviación estándar en cada carga', REGLA_S[r.repetibilidad] || REGLA_S.ENCIERRAN],
    ['Factor de cobertura k', cobertura.metodo === 'FIJO'
      ? `Fijo: k = ${fijo(cobertura.k, 2)} en todos los puntos.`
      : `t de Student con los grados efectivos de libertad, para ${conComa(cobertura.probabilidad * 100)} % de probabilidad de cobertura (EURAMET 7.3).`],
    ['Redondeo de U', `${cifrasU}, ${redondeo.sentido === 'CERCANO' ? 'al más cercano' : 'hacia arriba'}; el error con los mismos decimales.`],
    ['Densidad del aire', calculo.aire?.formula === 'APROXIMADA' ? 'Fórmula aproximada (EURAMET A1.1-1).' : 'CIPM-2007 (EURAMET A1.1).'],
    ['Empuje del aire', calculo.empuje?.metodo === '5a'
      ? 'Incertidumbre por 7.1.2-5a.'
      : 'Incertidumbre por 7.1.2-5b con la densidad del aire de la calibración de las pesas (ρa1) si se conoce; si no, 7.1.2-5a.'],
    ['Deriva de las pesas', `D = ${conComa(calculo.empuje?.kD ?? 1)} · U del certificado de la pesa (EURAMET 7.1.2-10).`],
    ['Convección', conveccion],
    ['Excentricidad', calculo.excentricidad?.metodo === 'METODO_1'
      ? 'Método 1: diferencia directa con el centro (EURAMET 6.3-1).'
      : 'Método 3: se resta el retorno a cero de cada posición (EURAMET 6.3-2).'],
    ['Tolerancia', tolerancia],
    ['Regla de decisión', `${REGLAS[regla] || regla}, pedida por el cliente${decision}.`],
  ];
  if (calculo.clase?.sugerida) {
    filas.push(['Clase sugerida', calculo.clase.sugerida.regla === 'POR_N' ? 'Por n = Max/e, como el libro.' : 'Por la Tabla 3 de la OIML R76 (e y n = Max/e).']);
  }
  return (
    <section aria-labelledby="reglas-aplicadas" className="card p-4 shadow-card sm:p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 id="reglas-aplicadas" className="text-sm font-semibold text-fg">Reglas del método con que se calcula</h3>
        {calculo.metodo && (
          <ToneBadge tone={calculo.metodo.aprobada ? 'success' : 'warning'}>
            Versión {calculo.metodo.version}{calculo.metodo.aprobada ? '' : ' (sin aprobar)'}
          </ToneBadge>
        )}
      </div>
      <p className="mb-3 text-[12.5px] text-fg-muted">
        Las fija el laboratorio en Calibración › Método de cálculo. Un certificado aprobado, autorizado o emitido conserva la versión con la que se aprobó.
      </p>
      <dl className="grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-[max-content_1fr]">
        {filas.map(([dato, texto]) => (
          <div key={dato} className="contents">
            <dt className="text-fg-muted">{dato}</dt>
            <dd className="text-fg">{texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const vacio = valor => (valor == null || valor === '' ? 'vacío' : String(valor));

/** Lo que se registró en el servicio (ServiceMET con las correcciones del registro). */
function DatosRegistrados({ data, calculo, unidad }) {
  const m = data.modelo;
  const momento = (x = {}) => [
    x.hora || '—',
    x.t != null ? `${conComa(x.t)} °C` : '—',
    x.hr != null ? `${conComa(x.hr)} %` : '—',
    x.p != null ? `${conComa(x.p)} hPa` : '—',
  ];
  const ensayos = (m.repetibilidad?.ensayos || []).map(e => ({ ...e, leidas: (e.lecturas || []).filter(l => l.indicacion != null) })).filter(e => e.leidas.length);
  const lecturasMax = Math.max(0, ...ensayos.map(e => e.leidas.length));
  const posiciones = (m.excentricidad?.posiciones || []).filter(p => p.indicacion != null);
  const puntos = m.errores?.puntos || [];
  const correcciones = data.correcciones || [];
  const origen = data.origenesClase?.[m.instrumento.clase?.origen];
  let clase = 'no declarada';
  if (m.instrumento.clase?.valor) clase = `${m.instrumento.clase.valor}${origen ? ` (${origen.toLowerCase()})` : ''}`;
  else if (calculo.clase?.valor) clase = `${calculo.clase.valor} (sugerida, sin confirmar)`;
  const valores = j => (j.verificado ? 'Verificados' : 'Sin verificar');
  return (
    <section aria-labelledby="datos-registrados" className="card p-4 shadow-card sm:p-5">
      <h3 id="datos-registrados" className="text-sm font-semibold text-fg">Datos registrados</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-fg-muted">
        Los de ServiceMET{correcciones.length ? `, con ${correcciones.length === 1 ? 'la corrección' : `las ${correcciones.length} correcciones`} del registro` : ''}. Son los que entran al cálculo.
      </p>
      <div className="flex flex-col gap-4">
        <Bloque titulo="Instrumento">
          <Tabla
            cabeza={['Rango', 'Max', 'd', 'e']}
            filas={(m.instrumento.rangos || []).map((r, i) => [i + 1, `${textoNominal(r.max)} ${unidad}`, `${textoNominal(r.d)} ${unidad}`, r.e ? `${textoNominal(r.e)} ${unidad}` : '—'])}
          />
          <p className="text-[12.5px] text-fg">Clase: {clase}.</p>
        </Bloque>
        <Bloque titulo="Patrones">
          <Tabla
            cabeza={['Código', 'Clase', 'Certificado vigente', 'Valores del certificado']}
            filas={[
              ...(calculo.juegos || []).map(j => [j.codigo, j.clase || '—', j.certificado || 'Sin certificado vigente', j.piezas ? valores(j) : 'Sin piezas: valor nominal']),
              ...(calculo.termohigrometro ? [[calculo.termohigrometro, 'Termohigrómetro', '—', '—']] : []),
            ]}
          />
        </Bloque>
        <Bloque titulo="Condiciones ambientales">
          <Tabla cabeza={['', 'Hora', 'Temperatura', 'Humedad', 'Presión']} filas={[['Inicio', ...momento(m.ambiente?.inicio)], ['Fin', ...momento(m.ambiente?.fin)]]} />
        </Bloque>
        {ensayos.length > 0 && (
          <Bloque titulo="Repetibilidad (indicaciones)">
            <Tabla
              cabeza={['Carga', ...Array.from({ length: lecturasMax }, (_, i) => `${i + 1}`)]}
              filas={ensayos.map(e => [
                `${textoNominal(e.carga)} ${unidad}`,
                ...Array.from({ length: lecturasMax }, (_, i) => (e.leidas[i] ? textoNominal(e.leidas[i].indicacion) : '')),
              ])}
            />
          </Bloque>
        )}
        {posiciones.length > 0 && (
          <Bloque titulo={`Excentricidad (carga ${textoNominal(m.excentricidad.carga)} ${unidad})`}>
            <Tabla
              cabeza={['Posición', 'Indicación', 'Retorno a cero']}
              filas={posiciones.map(p => [p.posicion, textoNominal(p.indicacion), p.retorno != null ? textoNominal(p.retorno) : '—'])}
            />
          </Bloque>
        )}
        <Bloque titulo="Ensayo de error">
          <Tabla
            cabeza={['Punto', 'Carga', 'Indicación', 'Retorno a cero']}
            filas={puntos.map(p => [p.n, `${textoNominal(p.carga)} ${unidad}`, p.indicacion != null ? textoNominal(p.indicacion) : '—', p.retorno != null ? textoNominal(p.retorno) : '—'])}
          />
        </Bloque>
        {correcciones.length > 0 && (
          <Bloque titulo="Corregido en el registro">
            <ul className="flex flex-col gap-0.5 text-[12.5px]">
              {correcciones.map(c => (
                <li key={c.columna}>
                  {c.tipo === 'composicion' ? `Carga del punto ${c.n}` : etiquetaColumna(c.columna)}:{' '}
                  <span className="text-fg-muted line-through decoration-fg-subtle/60">{vacio(c.original)}</span>
                  {' → '}
                  <span className="font-medium text-fg">{vacio(c.corregido)}</span>
                </li>
              ))}
            </ul>
          </Bloque>
        )}
      </div>
    </section>
  );
}

/** Los resultados de todos los puntos; cada fila abre su detalle (pasos 4 a 6). */
function TodosLosPuntos({ calculo, unidad, elegido, onElegir }) {
  const conformidad = (p) => {
    const c = p.conformidad;
    if (!c?.evaluada) return <span className="text-fg-muted">No aplica</span>;
    return <span className={c.conforme ? 'text-success' : 'font-semibold text-danger'}>{c.conforme ? 'Conforme' : 'No conforme'}</span>;
  };
  return (
    <section aria-labelledby="todos-los-puntos" className="card p-4 shadow-card sm:p-5">
      <h3 id="todos-los-puntos" className="text-sm font-semibold text-fg">Resultados de todos los puntos</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-fg-muted">
        E y U como salen en el certificado; masas e indicaciones en {unidad}. Elige un punto para ver su cálculo completo (pasos 4 a 6).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead className="text-left text-fg-muted">
            <tr>
              {['Punto', 'Carga', 'm_ref', 'I', 'E', 'u(E)', 'ν_eff', 'k', 'U', 'T', 'Conformidad'].map(c => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {calculo.puntos.map((p) => {
              if (!p.calculado) {
                return (
                  <tr key={p.n} className="border-t border-line/70 text-fg-muted">
                    <td className="py-1 pr-3">{p.n}</td>
                    <td className="py-1 pr-3">{textoNominal(p.carga)}</td>
                    <td colSpan={9} className="py-1 pr-3">No se calcula: {(p.motivo || 'sin datos').toLowerCase()}.</td>
                  </tr>
                );
              }
              const dec = decimalesDe(p.rango?.d || 1);
              const pres = p.presentacion;
              return (
                <tr key={p.n} className={cn('border-t border-line/70', p.n === elegido && 'bg-info/10')}>
                  <td className="py-1 pr-3">
                    <button
                      type="button"
                      onClick={() => onElegir(p.n)}
                      aria-label={`Ver el cálculo del punto ${p.n}`}
                      className="font-semibold text-info underline-offset-4 hover:underline"
                    >
                      {p.n}
                    </button>
                  </td>
                  <td className="py-1 pr-3">{textoNominal(p.carga)}</td>
                  <td className="py-1 pr-3">{fijo(p.mref, dec + 2)}</td>
                  <td className="py-1 pr-3">{fijo(p.indicacion, dec + 1)}</td>
                  <td className="py-1 pr-3 font-semibold">{fijo(pres.error, pres.decimales)}</td>
                  <td className="py-1 pr-3">{cifras(p.u, 3)}</td>
                  <td className="py-1 pr-3">{grados(p.nuEff)}</td>
                  <td className="py-1 pr-3">{fijo(p.k, 2)}</td>
                  <td className="py-1 pr-3 font-semibold">{fijo(pres.U, pres.decimales)}</td>
                  <td className="py-1 pr-3">{p.tolerancia > 0 ? cifras(p.tolerancia, 3) : '—'}</td>
                  <td className="py-1 pr-3">{conformidad(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Pestaña «Cómo se calcula»: el cálculo de este certificado con sus datos
 * registrados, las reglas del método con que se calcula y, paso a paso, las
 * ecuaciones de EURAMET con los números del servicio, para cada punto.
 */
export function ComoSeCalcula({ data }) {
  const calculo = data.calculo;
  const modelo = data.modelo;
  const unidad = calculo?.unidad || modelo.instrumento.unidad || '';
  const puntos = (calculo?.puntos || []).filter(x => x.calculado);
  const [n, setN] = useState(puntos[0]?.n ?? null);
  const punto = puntos.find(x => x.n === n) || puntos[0];
  const detalleRef = useRef(null);
  const elegir = (numero) => {
    setN(numero);
    requestAnimationFrame(() => detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const numero = data.certificado?.numero;
  const emision = data.certificado?.emision;

  if (!calculo?.calculado || !punto) {
    const error = calculo?.avisos?.find(a => a.nivel === 'error');
    return (
      <section className="card flex items-start gap-3 p-4 shadow-card sm:p-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
        <p className="text-[13px] text-fg">Aún no se puede calcular{error ? `: ${error.mensaje}` : '.'}</p>
      </section>
    );
  }

  const instrumento = [modelo.instrumento.tipo, modelo.instrumento.marca, modelo.instrumento.modelo].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-fg">
            Cómo se calcula el certificado{numero ? ` N.º ${numero}` : ''}{emision ? ` (emisión ${String(emision).padStart(2, '0')})` : ''}
          </h3>
          {calculo.provisional && <ToneBadge tone="warning">Provisional</ToneBadge>}
        </div>
        <p className="mt-1 text-[12.5px] text-fg">
          {instrumento}
          {modelo.instrumento.serie ? ` · serie ${modelo.instrumento.serie}` : ''}
          {modelo.instrumento.codigoMetrica ? ` · ID ${modelo.instrumento.codigoMetrica}` : ''}
          {modelo.servicio.fecha ? ` · calibrado el ${modelo.servicio.fecha}` : ''}
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
          Con los datos registrados de este servicio, los certificados vigentes de los patrones en la fecha del servicio y las reglas del método de su versión.
          Sigue EURAMET cg-18 v4.0 y la GUM; entre paréntesis va la ecuación de la guía. Los valores intermedios no se redondean: solo se redondea al presentar.
        </p>
        {calculo.provisional && (
          <p className="mt-2 flex items-start gap-2 text-[12.5px] text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
            Provisional: faltan valores verificados de algún patrón; esos se toman por su valor nominal con u = emp/√3.
          </p>
        )}
      </section>

      <ReglasAplicadas calculo={calculo} modelo={modelo} />
      <DatosRegistrados data={data} calculo={calculo} unidad={unidad} />

      <Aire calculo={calculo} />
      <Repetibilidad calculo={calculo} unidad={unidad} />
      <Excentricidad calculo={calculo} unidad={unidad} />

      <TodosLosPuntos calculo={calculo} unidad={unidad} elegido={punto.n} onElegir={elegir} />

      <div ref={detalleRef} className="sticky top-[calc(var(--topbar-height)+8px)] z-10 scroll-mt-24 rounded-2xl border border-line bg-surface/95 px-3 py-2.5 shadow-card backdrop-blur">
        <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Los pasos 4 a 6 se hacen en cada punto del ensayo de errores. Elige uno:</p>
        <div role="group" aria-label="Punto del ensayo" className="flex flex-wrap gap-1.5">
          {puntos.map(x => (
            <button
              key={x.n}
              type="button"
              aria-pressed={x.n === punto.n}
              onClick={() => setN(x.n)}
              className={cn('cal-filter-chip tabular-nums', x.n === punto.n && 'border-fg bg-fg text-surface')}
            >
              {x.n}. {textoNominal(x.carga)} {unidad}
            </button>
          ))}
        </div>
      </div>

      <Punto key={punto.n} punto={punto} modelo={modelo} unidad={unidad} reglas={calculo.reglas} clase={calculo.clase} />
    </div>
  );
}
