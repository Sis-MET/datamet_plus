import { useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, FileCheck2, Loader2, Search, Sigma } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';
import { formatDate } from '../../domain/format';
import {
  ESTADOS_CERTIFICADO, ESTADOS_EMISION_TEXTO, aniosDe, capacidad, contarEstados, filtrarEmitidos, textoEmision, textoInstrumento,
} from '../../domain/emitidos';
import { Dropdown } from '../Dropdown';
import { EmptyState, Segmented, ToneBadge } from '../primitives';
import { abrirFirmado } from '../certificado/descargar';

const fechaCorta = iso => (iso ? new Date(iso).toLocaleDateString('es-BO', { dateStyle: 'medium' }) : '—');

/** La cadena de emisiones de un certificado (01 → 02 …) con sus motivos. */
function Emisiones({ certificado }) {
  return (
    <ol className="mt-2.5 flex flex-col gap-1.5 border-l border-line pl-3.5">
      {certificado.emisiones.map(e => (
        <li key={`${e.emision}-${e.estado}-${e.autorizadoEn}`} className="text-[12.5px]">
          <span className="font-mono font-semibold text-fg">Emisión {textoEmision(e.emision)}</span>
          <span className={cn('ml-2', e.estado === 'EMITIDO' ? 'text-success' : e.estado === 'AUTORIZADO' ? 'text-warning' : 'text-fg-muted')}>
            {ESTADOS_EMISION_TEXTO[e.estado] || e.estado}
          </span>
          <span className="text-fg-muted">
            {' · '}autorizada por {e.autorizadoPor || '—'} el {fechaCorta(e.autorizadoEn)}
            {e.firmaFecha ? ` · firmada el ${formatDate(e.firmaFecha)}${e.firmaDetectada === false ? ' (fecha indicada a mano)' : ''}` : ''}
          </span>
          {e.motivo && <span className="block text-fg">Motivo de la revisión: {e.motivo}</span>}
          {e.anuladoMotivo && <span className="block text-fg-muted">Anulada: {e.anuladoMotivo}</span>}
        </li>
      ))}
    </ol>
  );
}

function Certificado({ certificado: c, onAbrir }) {
  const [abierto, setAbierto] = useState(false);
  const meta = ESTADOS_CERTIFICADO[c.estado];
  const vigente = c.emisiones.find(e => e.estado === 'EMITIDO');
  const porFirmar = c.emisiones.find(e => e.estado === 'AUTORIZADO');
  const instrumento = [textoInstrumento(c.instrumento), capacidad(c.instrumento) && `Max ${capacidad(c.instrumento)}`].filter(Boolean).join(' · ');
  return (
    <li className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold tracking-wide text-fg">{c.numero}</span>
            <span className="font-mono text-[12.5px] text-fg-muted">· {textoEmision(vigente?.emision ?? porFirmar?.emision ?? c.emisiones.at(-1)?.emision)}</span>
            <ToneBadge tone={meta?.tone}>{meta?.label || c.estado}</ToneBadge>
            {c.reemisionPorFirmar && <ToneBadge tone="warning">Reemisión {textoEmision(porFirmar?.emision)} por firmar</ToneBadge>}
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-fg">{c.cliente || 'Sin cliente'}</p>
          <p className="truncate text-[12.5px] text-fg-muted">
            {[instrumento, c.instrumento.id && `ID ${c.instrumento.id}`, c.instrumento.serie && `serie ${c.instrumento.serie}`].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="text-right text-[12.5px] leading-snug">
          {vigente?.firmaFecha ? (
            <>
              <p className="text-fg">Firmado el {formatDate(vigente.firmaFecha)}</p>
              <p className="text-fg-muted">Calibrado el {formatDate(c.fechaCalibracion)}</p>
            </>
          ) : porFirmar ? (
            <p className="text-warning">Autorizado el {fechaCorta(porFirmar.autorizadoEn)}</p>
          ) : (
            <p className="text-fg-muted">Sin emisión vigente</p>
          )}
          <p className="text-fg-muted">por {(vigente || porFirmar || c.emisiones.at(-1))?.autorizadoPor || '—'}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAbrir(c.codigo)}>Abrir registro</Button>
        <Button size="sm" variant="secondary" onClick={() => onAbrir(c.codigo, 'calculo')}>
          <Sigma className="h-3.5 w-3.5" aria-hidden="true" /> Cómo se calcula
        </Button>
        {vigente && (
          <Button size="sm" variant="secondary" onClick={() => abrirFirmado(c.codigo, vigente.emision)}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> PDF firmado
          </Button>
        )}
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto(a => !a)}
          className="ml-auto text-[12.5px] font-medium text-info underline-offset-4 hover:underline"
        >
          {abierto ? 'Ocultar emisiones' : c.emisiones.length === 1 ? 'Ver la emisión' : `Ver las ${c.emisiones.length} emisiones`}
        </button>
      </div>
      {abierto && <Emisiones certificado={c} />}
    </li>
  );
}

/**
 * Calibración › Certificados › Emitidos: el libro de certificados. Cada n.º
 * con su emisión vigente, el cliente y el instrumento como se autorizaron, la
 * fecha de la firma y la cadena de reemisiones (7.8.8).
 */
export function EmitidosPanel({ onAbrir }) {
  const { data, error, loading, reload } = useResource(calibrationApi.emitidos);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [anio, setAnio] = useState(null);

  const certificados = useMemo(() => data?.certificados || [], [data]);
  const anios = useMemo(() => aniosDe(certificados), [certificados]);
  const delAnio = useMemo(() => filtrarEmitidos(certificados, { anio }), [certificados, anio]);
  const cuenta = useMemo(() => contarEstados(delAnio), [delAnio]);
  const lista = useMemo(() => filtrarEmitidos(delAnio, { q, estado }), [delAnio, q, estado]);

  const opcionesEstado = [
    { value: 'TODOS', label: 'Todos', count: cuenta.TODOS },
    { value: 'VIGENTE', label: 'Vigentes', count: cuenta.VIGENTE },
    { value: 'POR_FIRMAR', label: 'Por firmar', count: cuenta.POR_FIRMAR, alert: cuenta.POR_FIRMAR > 0 },
    { value: 'ANULADO', label: 'Anulados', count: cuenta.ANULADO },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-fg">Certificados emitidos</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-fg-muted">
          Cada certificado con su emisión vigente, el cliente y el instrumento tal como se autorizaron, la fecha de la firma y sus reemisiones. Los datos no se editan aquí: se corrigen abriendo una revisión en el registro.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-fg/40">
          <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por n.º, cliente, instrumento, ID. o serie…"
            aria-label="Buscar certificados"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
        {anios.length > 1 && (
          <Dropdown
            value={anio ?? ''}
            onChange={v => setAnio(v === '' ? null : Number(v))}
            options={[{ value: '', label: 'Todos los años' }, ...anios.map(a => ({ value: a, label: String(a) }))]}
            ariaLabel="Año del certificado"
            className="w-44"
          />
        )}
      </div>

      <Segmented label="Estado del certificado" value={estado} onChange={setEstado} options={opcionesEstado} className="cal-tabs self-start" />

      {!data && error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      )}
      {!data && !error && (
        <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-label="Cargando los certificados">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />}
        </div>
      )}
      {data && !certificados.length && (
        <EmptyState icon={FileCheck2} title="Aún no hay certificados emitidos">
          Aparecen aquí desde que el jefe de Calibración autoriza el primero. Los emitidos con el libro Excel se agregarán con la migración de históricos.
        </EmptyState>
      )}
      {data && certificados.length > 0 && !lista.length && (
        <EmptyState icon={Search} title="Ningún certificado coincide">Prueba con otro texto, estado o año.</EmptyState>
      )}
      {lista.length > 0 && (
        <>
          <p className="text-[12.5px] text-fg-muted">{lista.length === 1 ? '1 certificado' : `${lista.length} certificados`}</p>
          <ul className="flex flex-col gap-2">
            {lista.map(c => <Certificado key={c.numero} certificado={c} onAbrir={onAbrir} />)}
          </ul>
        </>
      )}
    </div>
  );
}
