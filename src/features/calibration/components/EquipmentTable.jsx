import { useMemo, useState } from 'react';
import { PackageSearch, Settings2, X } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import {
  VIGENCIA,
  alertSummary,
  effectiveAlert,
  everyMonthsLabel,
  formatDate,
  hasOwnAlert,
  occurrenceWhen,
  periodLabel,
} from '../domain/format';
import { EmptyState, Glyph, ToneBadge } from './primitives';

function NextDate({ occurrence }) {
  if (!occurrence) return <span className="text-fg-subtle">—</span>;
  const tone = occurrence.situacion === 'VENCIDO' ? 'text-danger' : occurrence.situacion === 'PROXIMO' ? 'text-warning' : 'text-fg-muted';
  return (
    <span className="flex items-center gap-2">
      <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} size={9} />
      <span>
        {formatDate(occurrence.fechaPlan)}
        <small className={tone}>{occurrenceWhen(occurrence)}</small>
      </span>
    </span>
  );
}

/** Inventario de equipos con su certificado, plan y avisos; admite selección múltiple. */
export function EquipmentTable({ equipos, ajustes, canEdit, onOpenEquipo, onConfigureMany }) {
  const [selected, setSelected] = useState(() => new Set());
  const visibleIds = useMemo(() => equipos.map(equipo => equipo.id), [equipos]);
  const selectedVisible = visibleIds.filter(id => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggle = (id) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (equipos.length === 0) {
    return (
      <EmptyState icon={PackageSearch} title="No hay equipos con estos filtros">
        Los equipos salen de la tabla de equipos de calibración (solo los activos).
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div
          className={cn(
            'flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border px-3 py-1.5 transition-colors',
            selectedVisible.length > 0 ? 'border-fg/20 bg-surface shadow-xs' : 'border-dashed border-line-strong'
          )}
        >
          {selectedVisible.length > 0 ? (
            <>
              <span className="text-[13px] font-semibold text-fg">
                {selectedVisible.length} {selectedVisible.length === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Quitar selección
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => onConfigureMany(equipos.filter(equipo => selected.has(equipo.id)))}
              >
                <Settings2 className="h-3.5 w-3.5" /> Configurar juntos
              </Button>
            </>
          ) : (
            <span className="text-[13px] text-fg-muted">
              Marca varios equipos para darles la misma verificación interna, responsable o avisos.
            </span>
          )}
        </div>
      )}

      <div className="cal-table-wrap">
        <table className="cal-table">
          <thead>
            <tr>
              {canEdit && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="cal-checkbox"
                    aria-label="Seleccionar todos"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = selectedVisible.length > 0 && !allSelected;
                    }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))}
                  />
                </th>
              )}
              <th>Equipo</th>
              <th>Certificado</th>
              <th>Vencimiento</th>
              <th>Próxima calibración</th>
              <th>Verificación interna</th>
              <th>Responsable</th>
              <th>Avisos</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((equipo) => {
              const vigencia = VIGENCIA[equipo.vigencia] || VIGENCIA.SIN_DATOS;
              const alerta = effectiveAlert(equipo.calibracion, ajustes);
              const isSelected = selected.has(equipo.id);
              return (
                <tr key={equipo.id} data-selected={isSelected} onClick={() => onOpenEquipo(equipo)}>
                  {canEdit && (
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cal-checkbox"
                        aria-label={`Seleccionar ${equipo.codigo}`}
                        checked={isSelected}
                        onChange={() => toggle(equipo.id)}
                      />
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="text-left font-semibold text-fg underline-offset-4 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenEquipo(equipo);
                      }}
                    >
                      {equipo.codigo}
                    </button>
                    <small>{equipo.instrumento} · {equipo.planta}</small>
                  </td>
                  <td>
                    {equipo.certificado ? <span className="inline-block max-w-[220px] truncate align-bottom">{equipo.certificado}</span> : '—'}
                    <small>{[equipo.enteCalibrador, formatDate(equipo.certFecha)].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td>
                    <ToneBadge tone={vigencia.tone}>{vigencia.label}</ToneBadge>
                    <small>{formatDate(equipo.vence)} · {periodLabel(equipo.periodoDias)}</small>
                  </td>
                  <td>
                    {equipo.enPlan ? <NextDate occurrence={equipo.proximaCalibracion} /> : <span className="text-fg-muted">Fuera del plan</span>}
                  </td>
                  <td>
                    {equipo.verificacion?.activo ? (
                      <>
                        <NextDate occurrence={equipo.proximaVerificacion} />
                        <small>{everyMonthsLabel(equipo.verificacion.frecuenciaMeses)}</small>
                      </>
                    ) : (
                      <span className="text-fg-subtle">Sin programar</span>
                    )}
                  </td>
                  <td>
                    {equipo.calibracion?.responsableNombre || equipo.verificacion?.responsableNombre || <span className="text-fg-subtle">Sin asignar</span>}
                  </td>
                  <td>
                    <span className={hasOwnAlert(equipo.calibracion) ? 'text-fg' : 'text-fg-muted'}>{alertSummary(alerta)}</span>
                    <small>{hasOwnAlert(equipo.calibracion) ? 'Propios del equipo' : 'Generales'}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
