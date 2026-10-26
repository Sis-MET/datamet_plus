import React from 'react';
import { ChevronRight, Bell, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../../shared/utils/cn';
import { VehicleAvailabilityPanel } from './VehicleAvailabilityPanel';

const iconButton = 'flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg';

function getStateBadgeClass(estado) {
  const base = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset';
  switch (estado) {
    case 'Completado': return `${base} bg-success/10 text-success ring-success/25`;
    case 'En Proceso': return `${base} bg-info/10 text-info ring-info/25`;
    case 'Cancelado':  return `${base} bg-danger/10 text-danger ring-danger/25`;
    default:           return `${base} bg-warning/10 text-warning ring-warning/25`;
  }
}

export function LeftFilterSidebar({
  tecnicos = [],
  // Props del mini-calendario y detalle del día
  currentDate,
  selectedDay,
  calendarDays = [],
  onSelectDay,
  eventsForDay,
  isSameMonth,
  isSameDay,
  isToday,
  prevMonth,
  nextMonth,
  selectedDayEvents = [],
}) {
  // ── Mini calendario ──
  const monthTitle = currentDate ? format(currentDate, 'MMMM yyyy', { locale: es }) : '';
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  const dayAbbreviations = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

  const getDayClass = (day) => {
    const selected = isSameDay && selectedDay && isSameDay(day, selectedDay);
    const today = isToday && isToday(day);
    const outside = isSameMonth && currentDate && !isSameMonth(day, currentDate);
    return cn(
      'relative flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-150',
      selected && 'bg-accent font-semibold text-accent-fg',
      !selected && today && 'bg-brand font-semibold text-brand-fg',
      !selected && !today && outside && 'text-fg-subtle/70 hover:bg-fg/[0.05] hover:text-fg-muted',
      !selected && !today && !outside && 'text-fg hover:bg-fg/[0.06]'
    );
  };

  const tecnicoMap = {};
  selectedDayEvents.forEach(evt => {
    // Buscar nombre real del tecnico
    const tecObj = tecnicos.find(t => t.id === evt.client);
    const tecName = tecObj ? tecObj.nombre : evt.client;

    if (!tecnicoMap[tecName]) {
      tecnicoMap[tecName] = {
        name: tecName,
        tasks: []
      };
    }
    tecnicoMap[tecName].tasks.push(evt);
  });
  const tecnicosDelDia = Object.values(tecnicoMap);

  return (
    <aside className="calendar-sidebar flex w-full min-w-0 flex-col gap-4">

      {/* ── 1. Mini Calendario ── */}
      {currentDate && (
        <div className="calendar-mini card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">{monthTitleCapitalized}</h2>
            <div className="flex gap-0.5">
              <button onClick={prevMonth} aria-label="Mes anterior" className={iconButton}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} aria-label="Mes siguiente" className={iconButton}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {dayAbbreviations.map(day => (
              <div key={day} className="mb-1 text-center text-[10px] font-medium text-fg-subtle">{day}</div>
            ))}
            {calendarDays.map((day, idx) => {
              const evts = eventsForDay ? eventsForDay(day) : [];
              const amt = evts.length;
              const selected = isSameDay && selectedDay && isSameDay(day, selectedDay);
              return (
                <div key={day.toISOString?.() || idx} className="flex min-w-0 items-center justify-center p-0.5">
                  <button onClick={() => onSelectDay && onSelectDay(day)} className={getDayClass(day)}>
                    <span className="relative z-10">{format(day, 'd')}</span>
                    {amt > 0 && !selected && (
                      <span className="absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current opacity-60" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Disponibilidad de Vehículos ── */}
      <VehicleAvailabilityPanel tecnicos={tecnicos} selectedDayEvents={selectedDayEvents} />

      {/* ── 3. Detalle del Día (Compacto) ── */}
      <div className="calendar-day-detail flex flex-col gap-2">
        <h3 className="px-1 text-xs font-medium text-fg-muted">Detalle del Día</h3>
        {tecnicosDelDia.length === 0 ? (
          <div className="flex min-h-14 items-center justify-center rounded-2xl border border-dashed border-line-strong p-3">
            <span className="flex items-center gap-2 text-xs font-medium text-fg-muted">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Sin Novedades
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tecnicosDelDia.map((tecnico, idx) => (
              <div key={idx} className="card px-3.5 py-3 shadow-xs">
                {/* Nombre */}
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold capitalize leading-none text-fg">
                    {tecnico.name?.replace(/_/g, ' ')}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {tecnico.tasks.map((t, i) => (
                      <span key={i} className="h-2 w-2 rounded-full ring-1 ring-inset ring-black/15" style={{ backgroundColor: t.colorAM || '#10B981' }} title={t.estadoAM || 'Pendiente'} />
                    ))}
                  </div>
                </div>
                {/* Tareas en filas compactas */}
                <div className="flex flex-col gap-2.5">
                  {tecnico.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/15" style={{ backgroundColor: task.colorAM || '#10B981' }} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="truncate text-xs font-semibold leading-tight text-fg">{task.morning}</p>
                        {task.descripcion && (
                          <p className="mt-0.5 truncate text-[11px] leading-tight text-fg-muted">
                            {task.descripcion}
                          </p>
                        )}
                        {(task.horaInicio || task.horaFin) && (
                          <p className="mt-1 text-[11px] font-medium leading-none tabular-nums text-fg-muted">
                            {task.horaInicio || '08:30'} {task.horaFin ? `– ${task.horaFin}` : ''}
                          </p>
                        )}
                      </div>
                      <span className={cn(getStateBadgeClass(task.estadoAM), 'mt-0.5')}>{task.estadoAM || 'Pendiente'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ── 4. Referencia de Colores ── */}
      <div className="calendar-reference card p-4 shadow-xs">
        <h3 className="mb-3 text-xs font-medium text-fg-muted">Referencia de Colores</h3>
        <ul className="flex flex-col gap-2.5 text-[13px] text-fg">
          <li className="flex items-center gap-3">
            <span className="h-3 w-3 flex-shrink-0 rounded-full bg-brand ring-1 ring-inset ring-black/10" aria-hidden="true" />
            Día de Hoy
          </li>
          <li className="flex items-center gap-3">
            <span className="h-3 w-3 flex-shrink-0 rounded-full bg-danger" aria-hidden="true" />
            Domingos y Feriados (no laborable)
          </li>
          <li className="flex items-center gap-3">
            <span className="h-3 w-3 flex-shrink-0 rounded-full bg-info" aria-hidden="true" />
            Información Vehículos
          </li>
        </ul>
      </div>

    </aside>
  );
}
