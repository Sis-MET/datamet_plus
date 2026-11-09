import { useMemo, useState } from 'react';
import { Sigma } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { agruparPiezas, sumaPiezas, textoNominal } from '../../domain/registro';
import { CalculoServicio } from '../CalculoServicio';

/**
 * Elegir a mano las piezas de la carga de un punto, ahí mismo bajo su
 * presupuesto (decisión 4): la suma tiene que dar exactamente la carga.
 */
function ComposicionEnLinea({ punto, disponibles, unidad, onGuardar, onCerrar }) {
  const [claves, setClaves] = useState(() => punto.piezas.map(p => p.clave).filter(Boolean));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const grupos = useMemo(() => agruparPiezas(disponibles), [disponibles]);
  const suma = sumaPiezas(disponibles, claves);
  const diferencia = punto.carga - suma;
  const exacta = Math.abs(diferencia) <= Math.max(1e-12, Math.abs(punto.carga) * 1e-9);
  const alternar = (clave) => setClaves(actuales => (actuales.includes(clave) ? actuales.filter(c => c !== clave) : [...actuales, clave]));

  const guardar = async (nuevas) => {
    setSaving(true);
    try {
      await onGuardar({ composiciones: { [punto.n]: nuevas }, motivo: motivo.trim() || null });
      onCerrar();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la composición.');
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-info/30 bg-surface px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-fg">Piezas de la carga de {textoNominal(punto.carga)} {unidad}</p>
        <p className={cn('text-[12.5px] font-semibold tabular-nums', exacta ? 'text-success' : 'text-warning')}>
          Suma {textoNominal(suma)} {unidad}{!exacta && ` · ${diferencia > 0 ? 'faltan' : 'sobran'} ${textoNominal(Math.abs(diferencia))} ${unidad}`}
        </p>
      </div>
      {grupos.map(grupo => (
        <div key={grupo.juego} className="mt-2.5">
          <p className="mb-1 text-[11.5px] font-medium text-fg-muted">{grupo.juego}</p>
          <div className="flex flex-wrap gap-1.5">
            {grupo.piezas.map((pieza) => {
              const activa = claves.includes(pieza.clave);
              return (
                <button
                  key={pieza.clave}
                  type="button"
                  aria-pressed={activa}
                  disabled={saving}
                  onClick={() => alternar(pieza.clave)}
                  className={cn('h-8 rounded-lg border px-2.5 text-[12.5px] tabular-nums transition-colors',
                    activa ? 'border-info bg-info/10 font-semibold text-fg' : 'border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg')}
                >
                  {textoNominal(pieza.nominal)} {unidad}{pieza.identificacion ? ` ${pieza.identificacion}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <input
        value={motivo}
        maxLength={500}
        onChange={event => setMotivo(event.target.value)}
        disabled={saving}
        aria-label="Motivo de la composición"
        placeholder="Motivo (opcional): p. ej. el técnico usó la pesa marcada *"
        className="field mt-3 h-9 rounded-lg text-[13px]"
      />
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCerrar} disabled={saving}>Cancelar</Button>
        {punto.composicion === 'ELEGIDA' && <Button size="sm" variant="secondary" onClick={() => guardar(null)} disabled={saving}>Volver a la regla</Button>}
        <Button size="sm" onClick={() => guardar(claves)} disabled={saving || !exacta || !claves.length} isLoading={saving}>Guardar piezas</Button>
      </div>
    </div>
  );
}

/** Pestaña «Resultados»: el cálculo con su presupuesto y la elección de piezas por punto. */
export function ResultadosRegistro({ data, editable, onGuardar, onComoSeCalcula }) {
  const calculo = data.calculo;
  return (
    <section aria-label="Resultados del cálculo" className="card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">Resultados del cálculo</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">
            Calculados con el motor de DataMET+ (EURAMET cg-18 v4.0) con los datos guardados
            {calculo?.metodo ? ` y la versión ${calculo.metodo.version} del método${calculo.metodo.aprobada ? '' : ' (sin aprobar)'}` : ''}.
            Toca un punto para ver su presupuesto de incertidumbre{editable ? ' y, si hace falta, elegir otras piezas para su carga' : ''}.
          </p>
        </div>
        {onComoSeCalcula && (
          <Button size="sm" variant="secondary" onClick={onComoSeCalcula}>
            <Sigma className="h-4 w-4" aria-hidden="true" /> Cómo se calcula
          </Button>
        )}
      </div>
      <CalculoServicio
        data={calculo}
        renderComposicion={editable ? (punto, cerrar) => (
          <ComposicionEnLinea punto={punto} disponibles={calculo.piezasDisponibles} unidad={calculo.unidad} onGuardar={onGuardar} onCerrar={cerrar} />
        ) : null}
      />
    </section>
  );
}
