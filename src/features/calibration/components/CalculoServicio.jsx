import { Fragment, useState } from 'react';
import { AlertTriangle, ChevronRight, Info, Layers } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { ToneBadge } from './primitives';

// Componentes del presupuesto (EURAMET cg-18 7.1.1 y 7.1.2).
const FUENTES = {
  redondeoCero: 'Redondeo en cero',
  redondeoCarga: 'Redondeo con carga',
  repetibilidad: 'Repetibilidad',
  excentricidad: 'Excentricidad',
  certificado: 'Certificado de las pesas',
  empuje: 'Empuje del aire',
  deriva: 'Deriva de las pesas',
  conveccion: 'Convección',
  sustitucionPatron: 'Carga patrón (sustitución)',
  sustitucionIndicaciones: 'Indicaciones de la sustitución',
};

const coma = (texto) => texto.replace('.', ',');
const fijo = (valor, decimales) => (valor == null ? '—' : coma(Number(valor).toFixed(Math.max(0, decimales))));
const cientifico = (valor) => (valor == null ? '—' : coma(Number(valor).toExponential(2)));
const grados = (nu) => (!Number.isFinite(nu) ? '∞' : nu > 9999 ? '> 9 999' : String(Math.floor(nu)));

function Presupuesto({ punto, unidad, onElegirPiezas }) {
  return (
    <div className="bg-surface-2/40 px-3 py-3">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.04em] text-fg-muted">
            <th className="px-2 py-1 text-left font-semibold">Componente</th>
            <th className="px-2 py-1 text-right font-semibold">u ({unidad})</th>
            <th className="px-2 py-1 text-right font-semibold">ν</th>
            <th className="px-2 py-1 text-right font-semibold">Aporte</th>
            <th className="px-2 py-1 text-left font-semibold">EURAMET</th>
          </tr>
        </thead>
        <tbody>
          {punto.componentes.map(c => (
            <tr key={`${c.grupo}-${c.fuente}`} className="border-t border-line/70">
              <td className="px-2 py-1">{FUENTES[c.fuente] || c.fuente}</td>
              <td className="px-2 py-1 text-right tabular-nums">{cientifico(c.u)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{grados(c.nu)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{Math.round(((c.u * c.u) / (punto.u * punto.u)) * 100)} %</td>
              <td className="px-2 py-1 font-mono text-[11.5px] text-fg-muted">{c.ecuacion}</td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="px-2 py-1">u(E)</td>
            <td className="px-2 py-1 text-right tabular-nums">{cientifico(punto.u)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{grados(punto.nuEff)}</td>
            <td className="px-2 py-1 text-right">k = {fijo(punto.k, 2)}</td>
            <td className="px-2 py-1 text-fg-muted">U = k·u(E)</td>
          </tr>
        </tbody>
      </table>
      {punto.sustitucion && (
        <p className="mt-2 text-[12px] text-fg-muted">
          Carga de sustitución: {punto.sustitucion.descripcion} {unidad} ({punto.sustitucion.ecuacion}). ServiceMET no registra las diferencias ΔI: se toman como cero y su incertidumbre se incluye.
        </p>
      )}
      {!punto.sustitucion && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[12px] text-fg-muted">
            Carga: {punto.piezas.map(p => `${coma(String(p.nominal))}${p.identificacion ? ` ${p.identificacion}` : ''}`).join(' + ')} {unidad}
            {punto.supuestas ? ' (piezas supuestas: el juego no tiene sus piezas registradas)' : ` · ${[...new Set(punto.piezas.map(p => p.juego))].join(', ')}`}
            {punto.composicion === 'ELEGIDA' ? ' · elegidas a mano' : punto.composicion === 'REGLA' ? ' · regla: menos piezas' : ''}
          </p>
          {onElegirPiezas && punto.composicion !== 'SUPUESTA' && (
            <button
              type="button"
              onClick={() => onElegirPiezas(punto)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Elegir piezas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Conformidad({ conformidad }) {
  if (!conformidad?.evaluada) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="flex flex-col items-end gap-0.5">
      <ToneBadge tone={conformidad.conforme ? 'success' : 'danger'}>{conformidad.conforme ? 'Conforme' : 'No conforme'}</ToneBadge>
      <span className="text-[11px] text-fg-subtle">riesgo {fijo(conformidad.riesgo * 100, 2)} %</span>
    </span>
  );
}

/**
 * Resultado del cálculo de un servicio con el motor (fase 3): error, U y k
 * por punto, conformidad y el presupuesto de incertidumbre desplegable.
 * `data` es el cálculo que devuelve el registro. Con `onElegirPiezas`, cada
 * punto permite elegir a mano las piezas de su carga.
 */
export function CalculoServicio({ data, onElegirPiezas = null }) {
  const [abierto, setAbierto] = useState(null);

  if (!data) return <p className="text-[13px] text-fg-muted">Sin cálculo.</p>;

  const unidad = data.unidad || '';
  const errores = data.avisos.filter(a => a.nivel === 'error');
  const otros = data.avisos.filter(a => a.nivel !== 'error');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.calculado
          ? <ToneBadge tone={data.provisional ? 'warning' : 'success'}>{data.provisional ? 'Cálculo provisional' : 'Cálculo completo'}</ToneBadge>
          : <ToneBadge tone="danger">No se puede calcular</ToneBadge>}
        {data.aire && (
          <span className="text-[12.5px] text-fg-muted">
            ρa = {fijo(data.aire.rho, 4)} ± {fijo(data.aire.u, 4)} kg/m³ (CIPM-2007, u típica)
            {data.termohigrometro ? ` · termohigrómetro ${data.termohigrometro}` : ''}
          </span>
        )}
        <span className="text-[12px] text-fg-subtle">Configuración del método v{data.configuracion || 1}</span>
      </div>

      {(errores.length > 0 || otros.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {[...errores, ...otros].map(aviso => (
            <li key={`${aviso.codigo}-${aviso.mensaje}`} className="flex gap-2 text-[12.5px] leading-snug">
              {aviso.nivel === 'info'
                ? <Info className="mt-px h-4 w-4 flex-none text-info" aria-hidden="true" />
                : <AlertTriangle className={cn('mt-px h-4 w-4 flex-none', aviso.nivel === 'error' ? 'text-danger' : 'text-warning')} aria-hidden="true" />}
              <span className="text-fg">{aviso.mensaje}</span>
            </li>
          ))}
        </ul>
      )}

      {data.puntos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2/60">
              <tr className="text-[11.5px] uppercase tracking-[0.04em] text-fg-muted">
                <th className="px-3 py-2 text-right font-semibold">N.º</th>
                <th className="px-3 py-2 text-right font-semibold">Carga</th>
                <th className="px-3 py-2 text-right font-semibold">Indicación</th>
                <th className="px-3 py-2 text-right font-semibold">mref</th>
                <th className="px-3 py-2 text-right font-semibold">Error</th>
                <th className="px-3 py-2 text-right font-semibold">U</th>
                <th className="px-3 py-2 text-right font-semibold">k</th>
                <th className="px-3 py-2 text-right font-semibold">Tolerancia</th>
                <th className="px-3 py-2 text-right font-semibold">Conformidad</th>
              </tr>
            </thead>
            <tbody>
              {data.puntos.map((punto) => {
                const decimales = punto.calculado ? punto.presentacion.decimales : 0;
                const expandido = abierto === punto.n;
                return (
                  <Fragment key={punto.n}>
                    <tr
                      className={cn('border-t border-line align-top', punto.calculado && 'cursor-pointer hover:bg-fg/[0.025]')}
                      onClick={() => punto.calculado && setAbierto(expandido ? null : punto.n)}
                    >
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {punto.calculado && <ChevronRight className={cn('h-3.5 w-3.5 text-fg-subtle transition-transform', expandido && 'rotate-90')} aria-hidden="true" />}
                          {punto.n}
                          {punto.composicion === 'ELEGIDA' && <Layers className="h-3 w-3 text-info" aria-label="Piezas elegidas a mano" />}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{coma(String(punto.carga))} {unidad}</td>
                      {punto.calculado ? (
                        <>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fijo(punto.indicacion, decimales + 1)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fijo(punto.mref, decimales + 1)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fijo(punto.presentacion.error, decimales)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fijo(punto.presentacion.U, decimales)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fijo(punto.k, 2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{punto.tolerancia ? fijo(punto.tolerancia, decimales) : '—'}</td>
                          <td className="px-3 py-1.5 text-right"><Conformidad conformidad={punto.conformidad} /></td>
                        </>
                      ) : (
                        <td colSpan={7} className="px-3 py-1.5 text-[12.5px] text-fg-muted">{punto.motivo}</td>
                      )}
                    </tr>
                    {expandido && (
                      <tr className="border-t border-line">
                        <td colSpan={9} className="p-0">
                          <Presupuesto punto={punto} unidad={unidad} onElegirPiezas={data.piezasDisponibles?.length ? onElegirPiezas : null} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.puntos.some(p => p.calculado) && (
        <p className="text-[12px] text-fg-muted">
          Toque un punto para ver su presupuesto de incertidumbre. U con dos cifras significativas redondeadas hacia arriba; el error, al mismo decimal.
        </p>
      )}
    </div>
  );
}
