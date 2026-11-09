import { ExternalLink } from 'lucide-react';
import { Button } from '../../../../shared/components/ui/Button';
import { ACCIONES_REGISTRO, ESTADOS_EMISION, aTexto, etiquetaColumna } from '../../domain/registro';
import { ToneBadge } from '../primitives';
import { abrirFirmado } from '../certificado/descargar';

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Pestaña «Historial»: las emisiones del certificado y cada acción del registro (7.5.2). */
export function HistorialRegistro({ data, onVerEmision }) {
  return (
    <div className="flex flex-col gap-4">
      {data.emisiones.length > 0 && (
        <section aria-label="Emisiones del certificado" className="card p-4 shadow-card sm:p-5">
          <h3 className="text-sm font-semibold text-fg">Emisiones del certificado</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">Cada emisión conserva su contenido congelado y, una vez firmada, su PDF archivado.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {[...data.emisiones].reverse().map((e) => {
              const meta = ESTADOS_EMISION[e.estado] || { label: e.estado, tone: 'muted' };
              return (
                <li key={`${e.emision}-${e.estado}-${e.autorizadoEn}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line px-3.5 py-2.5 text-[12.5px]">
                  <span className="font-mono font-semibold text-fg">{e.numero} · {String(e.emision).padStart(2, '0')}</span>
                  <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                  <span className="min-w-0 flex-1 text-fg-muted">
                    {e.firmaFecha ? `Firmada el ${e.firmaFecha}${e.firmaDetectada === false ? ' (fecha indicada a mano)' : ''}` : `Autorizada por ${e.autorizadoPor}`}
                    {e.motivo ? ` · ${e.motivo}` : ''}
                    {e.anuladoMotivo ? ` · Anulada: ${e.anuladoMotivo}` : ''}
                  </span>
                  {e.estado !== 'ANULADO' && <Button size="sm" variant="secondary" onClick={() => onVerEmision(e.emision)}>Ver</Button>}
                  {e.firmaFecha && (
                    <Button size="sm" variant="secondary" onClick={() => abrirFirmado(data.codigo, e.emision)}>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> PDF firmado
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section aria-label="Historial del registro" className="card p-4 shadow-card sm:p-5">
        <h3 className="text-sm font-semibold text-fg">Historial del registro</h3>
        {data.historial.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-muted">Aún no hay acciones: el registro se crea con la primera corrección o al enviarlo a revisión.</p>
        ) : (
          <ol className="mt-3 flex flex-col">
            {data.historial.map(item => (
              <li key={item.id} className="relative border-l border-line pb-3.5 pl-4 last:pb-0">
                <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-fg-subtle" aria-hidden="true" />
                <p className="text-[12.5px]">
                  <span className="font-semibold text-fg">{ACCIONES_REGISTRO[item.accion] || item.accion}</span>
                  <span className="text-fg-muted"> · {item.usuario} · {fechaHora(item.fecha)}</span>
                </p>
                {item.motivo && <p className="text-[12.5px] text-fg">{item.motivo}</p>}
                {item.cambios.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-fg-muted">
                    {item.cambios.map(c => <li key={c.campo}>{etiquetaColumna(c.campo)}: {aTexto(c.antes) || 'vacío'} → <span className="font-medium text-fg">{aTexto(c.despues) || 'vacío'}</span></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
