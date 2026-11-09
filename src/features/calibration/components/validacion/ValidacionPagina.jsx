import { useCallback, useState } from 'react';
import { AlertCircle, BadgeCheck, Check, FileCheck2, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { APP_VERSION } from '../../../../shared/utils/appVersion';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';
import { cifras } from '../../domain/explicacion';
import { ReasonModal } from '../ReasonModal';
import { ToneBadge } from '../primitives';

const fechaHora = iso => (iso ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const valor = (v, decimales = null) => {
  if (v == null) return '—';
  if (decimales != null && typeof v === 'number') return v.toFixed(decimales).replace('.', ',');
  return typeof v === 'number' && Number.isInteger(v) ? String(v) : cifras(v, 4);
};

function Caso({ caso }) {
  const completo = caso.aprobados === caso.valores;
  const [abierto, setAbierto] = useState(!completo);
  return (
    <section aria-labelledby={`caso-${caso.id}`} className="card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-medium uppercase tracking-wide text-fg-muted">{caso.fuente}</p>
          <h3 id={`caso-${caso.id}`} className="mt-0.5 text-sm font-semibold text-fg">{caso.titulo}</h3>
          <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-fg-muted">{caso.nota}</p>
        </div>
        <ToneBadge tone={completo ? 'success' : 'danger'}>{caso.aprobados} de {caso.valores} dentro del criterio</ToneBadge>
      </div>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(a => !a)} className="mt-2.5 text-[12.5px] font-medium text-info underline-offset-4 hover:underline">
        {abierto ? 'Ocultar los valores' : 'Ver los valores'}
      </button>
      {abierto && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12.5px] tabular-nums">
            <thead className="text-left text-fg-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Magnitud</th>
                <th className="py-1 pr-3 text-right font-medium">Guía</th>
                <th className="py-1 pr-3 text-right font-medium">DataMET+</th>
                <th className="py-1 pr-3 font-medium">Criterio</th>
                <th className="py-1 font-medium"><span className="sr-only">Resultado</span></th>
              </tr>
            </thead>
            <tbody>
              {caso.filas.map((f, i) => (
                <tr key={i} className={cn('border-t border-line/70', !f.ok && 'bg-danger/5')}>
                  <td className="py-1 pr-3">{f.magnitud}</td>
                  <td className="py-1 pr-3 text-right">{valor(f.guia, f.decimales)}{f.unidad ? ` ${f.unidad}` : ''}</td>
                  <td className="py-1 pr-3 text-right font-medium">{valor(f.motor, f.decimales)}{f.unidad ? ` ${f.unidad}` : ''}</td>
                  <td className="py-1 pr-3 text-fg-muted">{f.criterio}</td>
                  <td className="py-1">
                    {f.ok
                      ? <Check className="h-4 w-4 text-success" aria-label="Dentro del criterio" />
                      : <X className="h-4 w-4 text-danger" aria-label="Fuera del criterio" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Evidencias({ evidencias, onVer, viendo }) {
  if (!evidencias.length) return <p className="text-[12.5px] text-fg-muted">Aún no se registró ninguna evidencia.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {evidencias.map(e => (
        <li key={e.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-[12.5px]', viendo === e.id ? 'border-info/50 bg-info/5' : 'border-line')}>
          <span className="font-semibold text-fg">Versión {e.version}</span>
          <ToneBadge tone={e.ok ? 'success' : 'danger'}>{e.aprobados} de {e.valores}</ToneBadge>
          <span className="min-w-0 flex-1 text-fg-muted">
            {e.registradoPor} · {fechaHora(e.registradoEn)} · huella {e.huella.slice(0, 12)}…{e.observacion ? ` · ${e.observacion}` : ''}
          </span>
          <Button size="sm" variant="secondary" onClick={() => onVer(e.id)}>Ver</Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Calibración › Certificados › Validación: los ejemplos publicados (EURAMET
 * Anexo H, Guía SIM Apéndice G, GUM G.2) recalculados ahora con el motor del
 * servidor, valor por valor, y la evidencia registrada por versión (7.11.2).
 */
export function ValidacionPagina() {
  const cargar = useCallback(() => calibrationApi.validacion(APP_VERSION), []);
  const { data, error, loading, reload } = useResource(cargar);
  const [registrando, setRegistrando] = useState(false);
  const [evidencia, setEvidencia] = useState(null);

  const verEvidencia = async (id) => {
    try {
      setEvidencia(await calibrationApi.evidenciaValidacion(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (failure) {
      toast.error(failure.message);
    }
  };

  if (!data) {
    return error ? (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
        <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
        <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
      </div>
    ) : (
      <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-label="Corriendo la validación">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />}
      </div>
    );
  }

  const r = data.resumen;
  const casos = evidencia ? evidencia.casos : data.casos;

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-fg">Validación del motor de cálculo</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-fg-muted">
          Los ejemplos publicados de EURAMET cg-18 v4.0 (Anexo H), de la Guía SIM (Apéndice G) y la tabla G.2 de la GUM se recalculan con el motor de cálculo que está corriendo, y cada valor se compara con el de la guía según un criterio declarado (NB/ISO/IEC 17025, 7.11.2 y 7.11.6). Son los mismos casos de las pruebas automáticas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3 shadow-card">
          <p className="text-[12px] text-fg-muted">Versión de la aplicación</p>
          <p className="mt-0.5 text-xl font-semibold text-fg">{data.version || APP_VERSION}</p>
          <p className="text-[11.5px] text-fg-muted">Corrida del {fechaHora(data.ejecutadoEn)}</p>
        </div>
        <div className="card px-4 py-3 shadow-card">
          <p className="text-[12px] text-fg-muted">Valores dentro del criterio</p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', r.ok ? 'text-success' : 'text-danger')}>
            {r.aprobados} <span className="text-[13px] font-normal text-fg-muted">de {r.valores}</span>
          </p>
          <p className="text-[11.5px] text-fg-muted">en {r.casos} casos</p>
        </div>
        <div className="card px-4 py-3 shadow-card">
          <p className="text-[12px] text-fg-muted">Evidencia de esta versión</p>
          <p className={cn('mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold', data.registradaEstaVersion ? 'text-success' : 'text-warning')}>
            {data.registradaEstaVersion ? <><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Registrada</> : 'Sin registrar'}
          </p>
          {data.permisos.registrar ? (
            <Button size="sm" variant={data.registradaEstaVersion ? 'secondary' : 'primary'} className="mt-1.5" onClick={() => setRegistrando(true)}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Registrar evidencia
            </Button>
          ) : data.permisos.motivo && <p className="mt-1 text-[11.5px] text-fg-muted">{data.permisos.motivo}</p>}
        </div>
      </div>

      {evidencia && (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3', evidencia.integra ? 'border-info/30 bg-info/5' : 'border-danger/30 bg-danger/5')} role="status">
          <FileCheck2 className={cn('h-[18px] w-[18px] flex-none', evidencia.integra ? 'text-info' : 'text-danger')} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            Viendo la evidencia de la versión <strong>{evidencia.version}</strong>, registrada por {evidencia.registradoPor} el {fechaHora(evidencia.registradoEn)}.
            {' '}{evidencia.integra ? 'Su huella coincide: los resultados no cambiaron.' : 'Su huella no coincide: los resultados guardados fueron alterados.'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setEvidencia(null)}>Volver a la corrida de ahora</Button>
        </div>
      )}

      {casos.map(caso => <Caso key={`${evidencia?.id || 'ahora'}-${caso.id}`} caso={caso} />)}

      <section aria-label="Evidencias registradas" className="card p-4 shadow-card sm:p-5">
        <h3 className="text-sm font-semibold text-fg">Evidencias registradas</h3>
        <p className="mb-3 mt-0.5 text-[12.5px] text-fg-muted">Cada una guarda los resultados de la corrida con su huella SHA-256; no se editan ni se borran.</p>
        <Evidencias evidencias={data.evidencias} onVer={verEvidencia} viendo={evidencia?.id} />
      </section>

      {registrando && (
        <ReasonModal
          title={`Registrar la evidencia de la versión ${data.version || APP_VERSION}`}
          subtitle={`${r.aprobados} de ${r.valores} valores dentro del criterio`}
          heading="Evidencia de validación"
          description="Se vuelve a correr la validación en el servidor y se guardan sus resultados con su huella, quién y cuándo. Sirve para el informe de validación y para la auditoría."
          confirmLabel="Registrar" requireReason={false} reasonLabel="Observación" reasonPlaceholder="Ej.: antes de la puesta en marcha"
          onConfirm={async (observacion) => {
            const res = await calibrationApi.registrarValidacion({ version: data.version || APP_VERSION, observacion });
            toast.success(`Evidencia registrada: ${res.aprobados} de ${res.valores}`);
            reload();
          }}
          onClose={() => setRegistrando(false)}
        />
      )}
    </div>
  );
}
