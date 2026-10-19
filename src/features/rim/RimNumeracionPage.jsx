import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Hash, Loader2, Lock, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../shared/components/ui/Button';
import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';
import { TextArea } from '../../shared/components/ui/TextArea';
import { CancelButton, EmptyState, Modal, Segmented, ToneBadge } from '../calibration/components/primitives';
import { useResource } from '../system/hooks/useResource';
import { rimApi } from './api/rim';
import { ESTADOS_TALONARIO, MOTIVOS_CIERRE, fechaHora, rangos } from './domain/rim';
import '../calibration/calibration.css';
import './rim.css';

const GESTION_INICIAL = 2026;

function Numeros({ titulo, numeros, tone, ayuda }) {
  if (!numeros.length) return null;
  return (
    <div className="text-[13px]">
      <dt className="flex items-center gap-2 text-fg-muted">
        <ToneBadge tone={tone}>{numeros.length}</ToneBadge> {titulo}
      </dt>
      <dd className="rim-numeros mt-1 break-words font-mono text-[12.5px] text-fg">{rangos(numeros)}</dd>
      {ayuda && <dd className="mt-0.5 text-xs text-fg-subtle">{ayuda}</dd>}
    </div>
  );
}

function Talonario({ talonario, onCerrar }) {
  const estado = ESTADOS_TALONARIO[talonario.estado] || ESTADOS_TALONARIO.en_uso;
  return (
    <li className="card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[14px] font-semibold tracking-wide text-fg">{talonario.rango}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-fg-muted">
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            {[
              talonario.usuarioNombre ? `${talonario.usuarioNombre} (${talonario.usuario})` : talonario.usuario,
              talonario.dispositivo,
              talonario.appVersion && `ServiceMET ${talonario.appVersion}`,
              fechaHora(talonario.entregadoEn),
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Numeros titulo="con RIM registrado" numeros={talonario.registrados} tone="success" />
        <Numeros
          titulo="emitidos y por subir"
          numeros={talonario.pendientes}
          tone="warning"
          ayuda="Se usaron en el teléfono y su RIM todavía no llega al servidor."
        />
        <Numeros titulo="disponibles en el teléfono" numeros={talonario.disponibles} tone="info" />
        <Numeros titulo="no utilizados" numeros={talonario.noUtilizados} tone="muted" ayuda="El talonario se cerró: no se usarán." />
      </dl>

      {talonario.cierre && (
        <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-fg-muted">
          <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Cerrado · {MOTIVOS_CIERRE[talonario.cierre.motivo] || talonario.cierre.motivo}
          {talonario.cierre.ultimoUsado ? ` · último número usado ${String(talonario.cierre.ultimoUsado).padStart(4, '0')}` : ''}
          {' · '}{[talonario.cierre.usuario, fechaHora(talonario.cierre.fecha)].filter(Boolean).join(' · ')}
          {talonario.cierre.detalle && <span className="block text-fg">{talonario.cierre.detalle}</span>}
        </p>
      )}

      {talonario.acciones.cerrar && (
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <Button size="sm" variant="secondary" onClick={() => onCerrar(talonario)}>
            <Lock className="h-4 w-4" aria-hidden="true" /> Cerrar talonario
          </Button>
        </div>
      )}
    </li>
  );
}

/** Cierra el talonario de un teléfono perdido o reinstalado. */
function CerrarTalonarioModal({ talonario, onClose, onCerrado }) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [ultimoUsado, setUltimoUsado] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const cerrar = async (close) => {
    if (!motivo) {
      setError('Elige el motivo del cierre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rimApi.cerrarTalonario(talonario.id, { motivo, detalle, ultimoUsado });
      toast.success(`Talonario ${talonario.rango} cerrado.`);
      onCerrado();
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title="Cerrar talonario"
      subtitle={talonario.rango}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <button
            type="button"
            onClick={() => cerrar(close)}
            disabled={busy}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-fg px-4 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cerrar talonario
          </button>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          Use esto cuando el teléfono que recibió el talonario ya no lo usará (perdido, dañado o con la app reinstalada).
          Los números sin RIM quedarán como «no utilizados». Si el teléfono todavía tiene RIM sin subir, súbalos antes.
          El cierre no se puede deshacer.
        </p>
        <Select
          label="Motivo"
          required
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder="Elegir…"
          options={['telefono_perdido', 'reinstalacion', 'otro'].map(value => ({ value, label: MOTIVOS_CIERRE[value] }))}
        />
        <Input
          label="Último número usado (si se conoce)"
          type="number"
          inputMode="numeric"
          min={talonario.desde}
          max={talonario.hasta}
          value={ultimoUsado}
          onChange={(event) => setUltimoUsado(event.target.value)}
          placeholder={`${talonario.desde} a ${talonario.hasta}`}
        />
        <TextArea
          label={motivo === 'otro' ? 'Detalle' : 'Detalle (opcional)'}
          required={motivo === 'otro'}
          value={detalle}
          onChange={(event) => setDetalle(event.target.value)}
          rows={2}
          maxLength={500}
        />
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * Numeración del RIM por gestión: los talonarios que recibió cada teléfono y
 * qué pasó con cada número, para explicar cualquier número sin RIM.
 */
export function RimNumeracionPage() {
  const actual = new Date().getFullYear();
  const gestiones = useMemo(() => {
    const lista = [];
    for (let year = actual + (new Date().getMonth() === 11 ? 1 : 0); year >= GESTION_INICIAL; year -= 1) lista.push(year);
    return lista;
  }, [actual]);
  const [gestion, setGestion] = useState(actual);
  const [cerrando, setCerrando] = useState(null);

  const load = useCallback(() => rimApi.talonarios(gestion), [gestion]);
  const { data, error, loading, reload } = useResource(load);

  const telefonos = (data?.talonarios || []).filter(talonario => talonario.origen === 'servicemet');
  const web = (data?.talonarios || []).filter(talonario => talonario.origen === 'datametplus');

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="rim-numeracion-titulo" className="card p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/20 text-fg">
            <Hash className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rim-numeracion-titulo" className="text-[15px] font-semibold text-fg">Numeración del RIM</h2>
            <p className="mt-0.5 max-w-[78ch] text-[13px] leading-relaxed text-fg-muted">
              Cada RIM lleva un código único RIM-AA-NNNN. Como ServiceMET trabaja sin conexión, cada teléfono recibe por adelantado
              talonarios de números libres y los usa en orden; el servidor nunca entrega el mismo número dos veces. Aquí se ve qué pasó
              con cada número: con RIM, emitido y por subir, disponible o no utilizado.
            </p>
          </div>
        </div>
        {gestiones.length > 1 && (
          <Segmented
            className="mt-4"
            label="Gestión"
            value={gestion}
            onChange={setGestion}
            options={gestiones.map(year => ({ value: year, label: String(year) }))}
          />
        )}
      </section>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            <span className="font-semibold">No se pudo cargar la numeración.</span>{' '}
            <span className="text-fg-muted">{error.message}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {!data && !error && (
        <div className="flex min-h-[20vh] items-center justify-center" role="status" aria-label="Cargando la numeración">
          <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
        </div>
      )}

      {data && telefonos.length === 0 && web.length === 0 && (
        <EmptyState icon={Hash} title={`Sin números entregados en ${gestion}`}>
          Los teléfonos reciben su primer talonario al abrir ServiceMET con conexión.
        </EmptyState>
      )}

      {web.length > 0 && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-fg-muted">
          <span className="font-semibold text-fg">DataMET+ (formulario web):</span>{' '}
          {web.length} {web.length === 1 ? 'número asignado' : 'números asignados'} al registrar, cada uno con su RIM
          {' '}(<span className="rim-numeros font-mono">{rangos(web.flatMap(talonario => talonario.registrados))}</span>).
        </p>
      )}

      {telefonos.length > 0 && (
        <ul className={loading ? 'grid gap-3 opacity-60' : 'grid gap-3'}>
          {telefonos.map(talonario => (
            <Talonario key={talonario.id} talonario={talonario} onCerrar={setCerrando} />
          ))}
        </ul>
      )}

      {cerrando && (
        <CerrarTalonarioModal talonario={cerrando} onClose={() => setCerrando(null)} onCerrado={reload} />
      )}
    </div>
  );
}
