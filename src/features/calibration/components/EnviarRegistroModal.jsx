import { useState } from 'react';
import { AlertOctagon, AlertTriangle, BadgeCheck, ChevronRight } from 'lucide-react';
import { ETIQUETAS_SECCION, avisosParaEnvio } from '../domain/registro';
import { CancelButton, Modal, PrimaryButton } from './primitives';

/**
 * Confirmación del envío a revisión con los avisos del servicio; cada aviso
 * lleva a su sección para corregirlo. Se puede enviar con avisos; sin un
 * cálculo o, con el emp NB 23001, sin la clase confirmada, no.
 */
export function EnviarRegistroModal({ titulo, avisos, calculo, onIr, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { revisar, notas } = avisosParaEnvio(avisos, calculo);
  const calculado = Boolean(calculo?.calculado);
  // Con emp NB 23001 pedido, la clase tiene que estar confirmada en el registro.
  const faltaClase = Boolean(calculo?.clase?.requerida && !calculo.clase.registrada);
  const sugerida = calculo?.clase?.sugerida?.valor;
  const bloqueado = !calculado || faltaClase;

  const confirmar = async (close) => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (failure) {
      setError(failure.message || 'No se pudo enviar.');
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title="Enviar a revisión"
      subtitle={titulo}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => confirmar(close)} busy={busy} busyLabel="Enviando" disabled={bloqueado}>
              Enviar a revisión
            </PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-3 px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        {!calculado && (
          <p className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/[0.06] px-3 py-2.5 text-fg">
            <AlertOctagon className="mt-0.5 h-4 w-4 flex-none text-danger" aria-hidden="true" />
            No se puede enviar: el servicio no se puede calcular. Corrige los errores marcados.
          </p>
        )}
        {calculado && faltaClase && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/[0.06] px-3 py-2.5 text-fg">
            <AlertOctagon className="mt-0.5 h-4 w-4 flex-none text-danger" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              No se puede enviar: el cliente pidió el emp NB 23001 y falta confirmar la clase del instrumento{sugerida ? ` (se sugiere la clase ${sugerida})` : ''}.
              {' '}
              <button type="button" onClick={() => onIr('instrumento')} className="font-semibold text-info underline-offset-4 hover:underline">Ir a la clase</button>
            </p>
          </div>
        )}
        {revisar.length > 0 ? (
          <section aria-label="Revisión antes de enviar" className="rounded-2xl border border-warning/30 bg-warning/5 p-3">
            <p className="mb-2 flex items-center gap-2 font-semibold text-fg">
              <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
              Revisa antes de enviar ({revisar.length})
            </p>
            <ul className="divide-y divide-line/60">
              {revisar.map((aviso, index) => (
                <li key={`${aviso.codigo}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onIr(aviso.seccion)}
                    disabled={busy}
                    className="flex w-full items-start gap-2 py-1.5 text-left text-[12.5px] text-fg transition-colors hover:text-info"
                  >
                    {aviso.nivel === 'error'
                      ? <AlertOctagon className="mt-0.5 h-3.5 w-3.5 flex-none text-danger" aria-hidden="true" />
                      : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      {aviso.mensaje}
                      <span className="block text-[11.5px] text-fg-subtle">{ETIQUETAS_SECCION[aviso.seccion] || 'Servicio'}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-none text-fg-subtle" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px]">{bloqueado ? 'Cada aviso lleva a la sección para corregirlo.' : 'Puedes enviarlo igual; cada aviso lleva a la sección para corregirlo.'}</p>
          </section>
        ) : (
          <p className="flex items-center gap-2 text-fg">
            <BadgeCheck className="h-4 w-4 flex-none text-success" aria-hidden="true" />
            El servicio no tiene errores ni avisos.
          </p>
        )}
        {notas > 0 && <p className="text-[12px]">Además hay {notas} {notas === 1 ? 'nota' : 'notas'} informativas en el detalle.</p>}
        {calculado && calculo.provisional && (
          <p className="rounded-xl border border-warning/35 bg-warning/[0.06] px-3 py-2.5 text-fg">
            {faltaClase
              ? 'El cálculo es provisional (faltan valores verificados de los patrones): tampoco se podrá aprobar hasta completarlos.'
              : 'El cálculo es provisional (faltan valores verificados de los patrones): se puede enviar, pero no aprobar hasta completarlos.'}
          </p>
        )}
        <p>
          Al enviarlo se guarda una huella de los datos: si después cambian en ServiceMET o en las correcciones, habrá que
          retirarlo y enviarlo de nuevo. Mientras esté en revisión no se puede corregir.
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
