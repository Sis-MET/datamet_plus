import { ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { alertSummary, effectiveAlert, frequencyLabel } from '../domain/format';
import { EmptyState } from './primitives';
import { NextDateInline } from './NextDateInline';

/** Actividades del área agrupadas por categoría. */
export function ActivitiesList({ actividades, ajustes, canEdit, onOpen, onCreate }) {
  if (actividades.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Todavía no hay actividades en el plan"
        action={canEdit && <Button onClick={onCreate}><Plus className="h-4 w-4" /> Nueva actividad</Button>}
      >
        Agrega las tareas que el área planifica cada año, como revisar los documentos legales en Fundaempresa
        o la política de calidad. Tendrán sus propias fechas y avisos.
      </EmptyState>
    );
  }

  const groups = new Map();
  for (const actividad of actividades) {
    const key = actividad.categoria || 'Sin categoría';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(actividad);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([categoria, items]) => (
        <section key={categoria} aria-labelledby={`act-${categoria}`}>
          <h3 id={`act-${categoria}`} className="mb-2 flex items-baseline gap-2 px-1">
            <span className="text-[13px] font-semibold text-fg">{categoria}</span>
            <span className="text-xs text-fg-muted">{items.length}</span>
          </h3>
          <ul className="card divide-y divide-line overflow-hidden shadow-xs">
            {items.map(actividad => (
              <li key={actividad.id}>
                <button
                  type="button"
                  onClick={() => onOpen(actividad)}
                  className="group flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-fg/[0.025]"
                >
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{actividad.titulo}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {[frequencyLabel(actividad.frecuenciaMeses), actividad.responsableNombre || 'Sin responsable'].join(' · ')}
                    </span>
                  </span>
                  <span className="hidden basis-48 text-xs text-fg-muted md:block">
                    {alertSummary(effectiveAlert(actividad, ajustes))}
                  </span>
                  <NextDateInline occurrence={actividad.proxima} />
                  <ChevronRight className="h-4 w-4 flex-none text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
