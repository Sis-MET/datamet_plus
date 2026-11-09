import { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { REGLAS } from '../../domain/servicios';
import { textoNominal } from '../../domain/registro';
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
  return (
    <Paso numero={1} titulo="Densidad del aire y empuje sobre las pesas" norma="EURAMET cg-18 A1.1 (CIPM-2007), A3 y 7.1.2">
      <p>
        Condiciones del servicio (promedio del inicio y el fin, corregidas con el certificado del termohigrómetro{calculo.termohigrometro ? ` ${calculo.termohigrometro}` : ''}):
        {' '}<strong>t = {fijo(c.t, 1)} °C</strong>, <strong>HR = {fijo(c.hr, 0)} %</strong>, <strong>p = {fijo(c.p, 1)} hPa</strong>.
      </p>
      <Formula resultado={`${fijo(aire.rho, 4)} kg/m³`}>ρa (CIPM-2007)</Formula>
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
      <Nota>En cada punto se usa la s del ensayo más cercano por encima y por debajo de la carga (la mayor de las dos). Con pocas lecturas, ν es chico y eso sube k.</Nota>
    </Paso>
  );
}

function Excentricidad({ calculo, unidad }) {
  const ecc = calculo.excentricidad;
  return (
    <Paso numero={3} titulo="Excentricidad" norma="EURAMET cg-18 5.3 (método 3), 6.3-2 y 7.1.1-10">
      {ecc.diferencias.length ? (
        <>
          <p>
            Carga {textoNominal(ecc.carga)} {unidad} en el centro y en las demás posiciones, volviendo a cero entre una y otra; diferencias con el centro:
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
      <tr><td colSpan={5} className="pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-fg-muted">{titulo}</td></tr>
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

function Punto({ punto, modelo, unidad }) {
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
        <Formula resultado={fijo(punto.k, 2)}>k = t(95,45 %; ν_eff)</Formula>
        <Nota>
          {punto.k > 2.005
            ? 'k sale mayor que 2 porque la repetibilidad tiene pocas lecturas y pesa en u(E): se usa la t de Student, no k = 2 fijo.'
            : 'Con muchos grados de libertad efectivos, k queda en 2.'}
        </Nota>
        <Formula resultado={`${cifras(punto.U, 4)} ${unidad}`}>U = k · u(E) = {fijo(punto.k, 2)} · {cifras(punto.u, 3)}</Formula>
        <div className="rounded-xl border border-info/30 bg-info/5 px-3.5 py-2.5">
          <p className="text-[12.5px] text-fg-muted">En el certificado: U con dos cifras significativas, redondeada hacia arriba, y el error al mismo decimal (GUM 7.2.6).</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-fg">
            E = {fijo(pres.error, pres.decimales)} {unidad}  ·  U = {fijo(pres.U, pres.decimales)} {unidad}  ·  k = {fijo(pres.k, 2)}
          </p>
        </div>
      </Paso>

      <Paso numero={6} titulo="Conformidad" norma="NB/ISO/IEC 17025 7.8.6; ILAC G8; tolerancia NB 23001 (OIML R76) o la del cliente">
        {conf?.evaluada ? (
          <>
            <p>
              Tolerancia T = ±{cifras(punto.tolerancia, 3)} {unidad} ({modelo.criterio?.empNB23001 ? `emp en servicio de la NB 23001 para la clase ${modelo.instrumento.clase?.valor || '—'}` : `${fijo(modelo.criterio?.toleranciaCliente, 3)} % pedido por el cliente`}),
              regla {REGLAS[regla]?.toLowerCase() || regla}.
            </p>
            <Formula resultado={conf.conforme ? 'conforme' : 'no conforme'}>
              {regla === 'CONSERVADORA'
                ? `|E| + U ≤ T  →  ${cifras(Math.abs(punto.error), 3)} + ${cifras(punto.U, 3)} ≤ ${cifras(punto.tolerancia, 3)}`
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

/**
 * Pestaña «Cómo se calcula»: el cálculo del certificado paso a paso con los
 * números de este servicio, con la ecuación de EURAMET de cada paso.
 */
export function ComoSeCalcula({ data }) {
  const calculo = data.calculo;
  const modelo = data.modelo;
  const unidad = calculo?.unidad || modelo.instrumento.unidad || '';
  const puntos = (calculo?.puntos || []).filter(x => x.calculado);
  const [n, setN] = useState(puntos[0]?.n ?? null);
  const punto = puntos.find(x => x.n === n) || puntos[0];

  if (!calculo?.calculado || !punto) {
    const error = calculo?.avisos?.find(a => a.nivel === 'error');
    return (
      <section className="card flex items-start gap-3 p-4 shadow-card sm:p-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
        <p className="text-[13px] text-fg">Aún no se puede calcular{error ? `: ${error.mensaje}` : '.'}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-fg">Cómo se calcula este certificado</h3>
          {calculo.metodo && (
            <ToneBadge tone={calculo.metodo.aprobada ? 'success' : 'warning'}>
              Método v{calculo.metodo.version}{calculo.metodo.aprobada ? '' : ' (sin aprobar)'}
            </ToneBadge>
          )}
          {calculo.provisional && <ToneBadge tone="warning">Provisional</ToneBadge>}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
          Con los datos guardados del registro y los certificados vigentes de los patrones en la fecha del servicio. Sigue EURAMET cg-18 v4.0 y la GUM;
          entre paréntesis va la ecuación de la guía. Los valores intermedios no se redondean: solo se redondea al presentar.
        </p>
        {calculo.provisional && (
          <p className="mt-2 flex items-start gap-2 text-[12.5px] text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
            Provisional: faltan valores verificados de algún patrón; esos se toman por su valor nominal con u = emp/√3.
          </p>
        )}
      </section>

      <Aire calculo={calculo} />
      <Repetibilidad calculo={calculo} unidad={unidad} />
      <Excentricidad calculo={calculo} unidad={unidad} />

      <div className="sticky top-[calc(var(--topbar-height)+8px)] z-10 rounded-2xl border border-line bg-surface/95 px-3 py-2.5 shadow-card backdrop-blur">
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

      <Punto key={punto.n} punto={punto} modelo={modelo} unidad={unidad} />
    </div>
  );
}
