import { Download, Layers, Printer } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { ToneBadge } from '../../calibration/components/primitives';
import { fechaHora } from '../domain/informe';

const persona = (p) => (p ? p.nombre || p.usuario : null);

/**
 * Revisiones emitidas del informe, de la vigente a la más antigua, cada una
 * con su copia completa para volver a imprimirla o guardarla en PDF tal como
 * se entregó (NB/ISO/IEC 17025, 7.5.2 y 7.8.8).
 */
export function RevisionesPanel({ informe, cargando, onImprimir, onPdf }) {
  const copias = [...(informe.revisiones || [])].reverse();
  const emitido = informe.estado === 'EMITIDO' || informe.estado === 'EN_REVISION';
  if (!emitido) return null;

  return (
    <section aria-labelledby="st-revisiones" className="rounded-2xl border border-line bg-surface p-4">
      <h3 id="st-revisiones" className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-fg">
        <Layers className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        Revisiones emitidas
      </h3>
      {copias.length === 0 ? (
        <p className="text-[13px] text-fg-muted">
          Este informe se emitió antes de que se guardaran las revisiones. Su copia se guarda al abrir la primera revisión.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {copias.map((copia) => {
            const vigente = copia.revision === informe.revision;
            return (
              <li key={copia.revision} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-fg">
                    Rev. {copia.revision}
                    {vigente && <ToneBadge tone="success">Vigente</ToneBadge>}
                  </p>
                  {copia.numero && copia.numero !== informe.numero && (
                    <p className="mt-0.5 font-mono text-[12.5px] text-fg">N° {copia.numero}</p>
                  )}
                  <p className="mt-0.5 text-[12.5px] text-fg-muted">
                    {copia.revision === 0 ? 'Emitida' : 'Reemitida'} por {persona(copia.emitidoPor) || 'sin dato'} · {fechaHora(copia.emitidoEn)}
                  </p>
                  {copia.motivo && <p className="mt-1 text-[12.5px] text-fg"><span className="font-medium">Motivo:</span> {copia.motivo}</p>}
                  {copia.posterior && (
                    <p className="mt-1 text-[12px] text-fg-subtle">Copia tomada al abrir la primera revisión, con el informe como estaba entonces.</p>
                  )}
                </div>
                <div className="flex flex-none gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onImprimir(copia.revision)}
                    disabled={cargando !== null}
                    isLoading={cargando === copia.revision}
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Imprimir
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPdf(copia.revision)}
                    disabled={cargando !== null}
                    title={`Guardar la Rev. ${copia.revision} en PDF`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
