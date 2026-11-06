import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { agruparPiezas, sumaPiezas, textoNominal } from '../domain/registro';
import { CancelButton, Modal, ModalSection, PrimaryButton } from './primitives';

const BOTON = 'flex h-10 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2 disabled:opacity-50';

/**
 * Elegir a mano las piezas de la carga de un punto del ensayo de error
 * (decisión 4): la regla propone la de menos piezas; quien elabora el
 * registro puede usar otras. Solo se guarda si la suma es exactamente la
 * carga. «Volver a la regla» quita la elección.
 */
export function ComposicionModal({ punto, disponibles, unidad, elegida, onClose, onGuardar }) {
  const [claves, setClaves] = useState(() => punto.piezas.map(p => p.clave).filter(Boolean));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const grupos = useMemo(() => agruparPiezas(disponibles), [disponibles]);
  const suma = sumaPiezas(disponibles, claves);
  const diferencia = punto.carga - suma;
  const exacta = Math.abs(diferencia) <= Math.max(1e-12, Math.abs(punto.carga) * 1e-9);

  const alternar = (clave) => setClaves(actuales => (actuales.includes(clave) ? actuales.filter(c => c !== clave) : [...actuales, clave]));

  const guardar = async (close, nuevas) => {
    setSaving(true);
    try {
      await onGuardar({ composiciones: { [punto.n]: nuevas }, motivo: motivo.trim() || null });
      setSaving(false);
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la composición.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      busy={saving}
      title={`Piezas de la carga · punto ${punto.n}`}
      subtitle={`Carga ${textoNominal(punto.carga)} ${unidad}. La regla propone la combinación con menos piezas; aquí se puede elegir otra.`}
      footer={(close) => (
        <div className="flex w-full flex-wrap items-center gap-2">
          {elegida && (
            <button type="button" className={BOTON} disabled={saving} onClick={() => guardar(close, null)}>Volver a la regla</button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <CancelButton onClick={close} disabled={saving} />
            <PrimaryButton onClick={() => guardar(close, claves)} busy={saving} disabled={!exacta || !claves.length}>Guardar piezas</PrimaryButton>
          </div>
        </div>
      )}
    >
      <div className="divide-y divide-line">
        <div className="px-5 py-4 sm:px-6">
          <p className={cn('text-[13.5px] font-semibold tabular-nums', exacta ? 'text-success' : 'text-warning')}>
            Suma: {textoNominal(suma)} {unidad}
            {!exacta && ` · ${diferencia > 0 ? 'faltan' : 'sobran'} ${textoNominal(Math.abs(diferencia))} ${unidad}`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">{claves.length} {claves.length === 1 ? 'pieza elegida' : 'piezas elegidas'}. Toca una pieza para agregarla o quitarla.</p>
        </div>
        {grupos.map(grupo => (
          <ModalSection key={grupo.juego} title={grupo.juego}>
            <div className="flex flex-wrap gap-1.5">
              {grupo.piezas.map(pieza => {
                const activa = claves.includes(pieza.clave);
                return (
                  <button
                    key={pieza.clave}
                    type="button"
                    aria-pressed={activa}
                    disabled={saving}
                    onClick={() => alternar(pieza.clave)}
                    className={cn(
                      'h-9 rounded-lg border px-2.5 text-[13px] tabular-nums transition-colors',
                      activa ? 'border-info bg-info/10 font-semibold text-fg' : 'border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    {textoNominal(pieza.nominal)} {unidad}{pieza.identificacion ? ` ${pieza.identificacion}` : ''}
                  </button>
                );
              })}
            </div>
          </ModalSection>
        ))}
        <ModalSection title="Motivo" description="Opcional; queda en el historial del registro.">
          <input
            value={motivo}
            maxLength={500}
            onChange={event => setMotivo(event.target.value)}
            disabled={saving}
            aria-label="Motivo de la composición"
            className="field h-11"
            placeholder="Ej.: el técnico usó la pesa de 500 g marcada *"
          />
        </ModalSection>
      </div>
    </Modal>
  );
}
