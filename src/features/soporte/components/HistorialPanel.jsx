import { useMemo, useState } from 'react';
import { BadgeCheck, Camera, FilePenLine, History, PencilLine, Undo2 } from 'lucide-react';
import { EmptyState } from '../../calibration/components/primitives';
import { ACCIONES_HISTORIAL, fechaHora, formatoFecha } from '../domain/informe';
import { etiquetasCampos } from '../domain/plantillas';
import { claseValoracion, CLASES_VALORACION } from '../domain/valoraciones';

const ICONOS = {
  EDICION: PencilLine,
  CORRECCION: FilePenLine,
  EMISION: BadgeCheck,
  FOTO_AGREGADA: Camera,
  FOTO_EDITADA: Camera,
  FOTO_QUITADA: Camera,
  FOTOS_ORDEN: Camera,
  REVISION_ABIERTA: FilePenLine,
  REEMISION: BadgeCheck,
  REVISION_CANCELADA: Undo2,
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const mostrar = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 'vacío';
  if (typeof valor === 'string' && FECHA.test(valor)) return formatoFecha(valor);
  const clase = claseValoracion(valor);
  if (clase && CLASES_VALORACION[clase].label !== valor) return `${valor} (${CLASES_VALORACION[clase].label})`;
  return String(valor);
};

function Cambios({ cambios, etiquetas }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? cambios : cambios.slice(0, 6);
  return (
    <>
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {visibles.map((cambio, index) => (
          <li key={`${cambio.campo}-${index}`} className="grid gap-x-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <span className="text-fg-muted">
              {etiquetas.get(cambio.campo) || cambio.campo}
              {cambio.ia && <span className="cal-badge cal-tone-info ml-1.5 align-middle" title="Texto redactado con la sugerencia de Gemini">IA</span>}
            </span>
            <span className="min-w-0 break-words text-fg">
              <span className="text-fg-subtle line-through decoration-fg/30">{mostrar(cambio.antes)}</span>
              <span className="px-1.5 text-fg-subtle">→</span>
              {mostrar(cambio.despues)}
            </span>
          </li>
        ))}
      </ul>
      {cambios.length > 6 && (
        <button type="button" onClick={() => setTodos(value => !value)} className="mt-1.5 text-[12.5px] font-medium text-fg-muted underline underline-offset-4 hover:text-fg">
          {todos ? 'Ver menos' : `Ver los ${cambios.length} cambios`}
        </button>
      )}
    </>
  );
}

/**
 * Historial del informe: cada edición, corrección, emisión y cambio de fotos
 * con quién, cuándo, el motivo y el valor anterior y el nuevo.
 */
export function HistorialPanel({ informe, plantilla }) {
  const etiquetas = useMemo(() => {
    const mapa = etiquetasCampos(plantilla);
    mapa.set('descripcion', 'Descripción');
    return mapa;
  }, [plantilla]);
  const { trazabilidad } = informe;
  const persona = (p) => (p ? p.nombre || p.usuario : null);

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-3 rounded-2xl border border-line bg-surface p-4 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted">Datos de campo</dt>
          <dd className="mt-0.5 text-fg">
            ServiceMET · {informe.fuente.personal || 'técnico sin registrar'}
            {informe.fuente.fecha_servicio && ` · ${formatoFecha(informe.fuente.fecha_servicio)}`}
          </dd>
          <dd className="mt-0.5 font-mono text-[12px] text-fg-subtle">{informe.codigo}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Informe</dt>
          <dd className="mt-0.5 text-fg">
            {trazabilidad.creadoEn
              ? `Abierto por ${persona(trazabilidad.creadoPor)} · ${fechaHora(trazabilidad.creadoEn)}`
              : 'Sin cambios: muestra los datos de ServiceMET'}
          </dd>
          {trazabilidad.emitidoEn && (
            <dd className="mt-0.5 text-fg">
              Emitido por {persona(trazabilidad.emitidoPor)} · {fechaHora(trazabilidad.emitidoEn)}
              {informe.revision > 0 && ` · revisión ${informe.revision}`}
            </dd>
          )}
          {trazabilidad.actualizadoEn && trazabilidad.actualizadoEn !== trazabilidad.creadoEn && (
            <dd className="mt-0.5 text-fg-muted">Último cambio: {persona(trazabilidad.actualizadoPor)} · {fechaHora(trazabilidad.actualizadoEn)}</dd>
          )}
        </div>
      </dl>

      {informe.historial.length === 0 ? (
        <EmptyState icon={History} title="Sin historial">
          Cada cambio que se guarde aquí queda registrado con el dato anterior, el nuevo, quién y cuándo. Los datos de ServiceMET no se modifican.
        </EmptyState>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {informe.historial.map(entrada => {
            const Icono = ICONOS[entrada.accion] || History;
            return (
              <li key={entrada.id} className="relative">
                <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-fg-muted">
                  <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <p className="text-[13.5px] font-semibold text-fg">
                  {ACCIONES_HISTORIAL[entrada.accion] || entrada.accion}
                  {entrada.detalle && <span className="font-normal text-fg-muted"> · {entrada.detalle}</span>}
                </p>
                <p className="text-[12.5px] text-fg-muted">
                  {[entrada.usuarioNombre || entrada.usuario, fechaHora(entrada.fecha), entrada.revision > 0 && `revisión ${entrada.revision}`].filter(Boolean).join(' · ')}
                </p>
                {entrada.motivo && (
                  <p className="mt-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-fg">
                    <span className="font-medium">Motivo:</span> {entrada.motivo}
                  </p>
                )}
                {entrada.cambios.length > 0 && <Cambios cambios={entrada.cambios} etiquetas={etiquetas} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
