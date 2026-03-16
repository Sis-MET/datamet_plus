import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutList, Loader2, DatabaseZap,
} from 'lucide-react';

import { useCalendar } from './hooks/useCalendar';
import { useGantt } from './hooks/useGantt';
import { CalendarGrid } from './components/CalendarGrid';
import { StatsBar } from './components/StatsBar';
import { EventModal } from './components/EventModal';
import { EventFormModal } from './components/EventFormModal';
import { GanttPage } from './GanttPage';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch (e) { return null; }
}

export function CalendarPage() {
  const [calendarView, setCalendarView] = useState('gantt'); // 'month' | 'gantt'
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Determinar permisos del usuario
  const token = localStorage.getItem('rimmet_token');
  const user = token ? parseJwt(token) : null;
  const isAdmin = user?.acceso === 'SAdministrador';

  // ── Hook vista Gantt ── (Lo cargamos primero para tener las Tasks)
  const {
    tasks, // <--- Nueva variable extraída
    weekStart,
    weekEnd,
    weekDays,
    previewDays,
    tecnicos,
    loading,
    useMock,
    tasksForCell,
    createTask,
    updateTask,
    deleteTask,
    nextWeek,
    prevWeek,
    goToCurrentWeek,
    isToday: isTodayGantt,
  } = useGantt();

  // ── Hook vista mensual ──
  const {
    currentDate,
    selectedDay,
    calendarDays,
    selectedDayEvents,
    monthStats,
    eventsForDay,
    selectDay,
    nextMonth,
    prevMonth,
    goToToday,
    isToday,
    isSameDay,
    isSameMonth,
  } = useCalendar(tasks);

  // Títulos dinámicos
  const monthTitle = format(currentDate, "MMMM yyyy", { locale: es });
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const weekRangeLabel = `${format(weekStart, "d 'de' MMMM", { locale: es })} – ${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`;
  const weekRangeCapitalized = weekRangeLabel.charAt(0).toUpperCase() + weekRangeLabel.slice(1);

  const handleOpenForm = (evt = null) => {
    setEditingEvent(evt);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (data, id) => {
    if (id) {
      await updateTask(id, data);
    } else {
      await createTask(data);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ══ Encabezado unificado ══ */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">

          {/* Título + subtítulo */}
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary-400 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Calendario de Trabajo</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {calendarView === 'gantt'
                  ? <span className="capitalize">{weekRangeCapitalized}</span>
                  : <span className="capitalize">{monthTitleCapitalized}</span>}
              </p>
            </div>
          </div>

          {/* Controles derechos */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Badge datos de ejemplo (solo Gantt) */}
            {calendarView === 'gantt' && useMock && (
              <span className="gantt-mock-badge">
                <DatabaseZap size={10} />
                Datos de ejemplo
              </span>
            )}

            {/* Botón Nueva Tarea (Solo Admin) */}
            {isAdmin && (
              <button
                onClick={() => handleOpenForm()}
                className="px-3 py-1.5 text-xs font-medium bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 border border-primary-500/30 rounded-lg transition-all"
              >
                + Nueva Tarea
              </button>
            )}

            {/* Spinner (solo Gantt) */}
            {calendarView === 'gantt' && loading && (
              <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            )}

            {/* Botones Hoy + Prev/Next */}
            {calendarView === 'gantt' ? (
              <>
                <button
                  onClick={goToCurrentWeek}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all"
                >
                  Hoy
                </button>
                <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
                  <button
                    onClick={prevWeek}
                    className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all border-r border-gray-700/50"
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextWeek}
                    className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all"
                    aria-label="Semana siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all"
                >
                  Hoy
                </button>
                <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all border-r border-gray-700/50"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {/* Toggle de vista */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700/50 bg-[#1a1a1d] p-1 gap-1">
              <button
                onClick={() => setCalendarView('gantt')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  calendarView === 'gantt'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <LayoutList className="h-4 w-4" />
                Semana
              </button>
              <button
                onClick={() => setCalendarView('month')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  calendarView === 'month'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Mes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Cronograma semanal (Gantt) ══ */}
      {calendarView === 'gantt' && (
        <GanttPage
          weekDays={weekDays}
          previewDays={previewDays}
          tecnicos={tecnicos}
          tasksForCell={tasksForCell}
          isToday={isTodayGantt}
          onTaskClick={isAdmin ? handleOpenForm : undefined}
        />
      )}

      {/* ══ Vista mensual ══ */}
      {calendarView === 'month' && (
        <>
          <div className="mb-6">
            <StatsBar stats={monthStats} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#1a1a1d] border border-gray-700/50 rounded-2xl p-5 shadow-xl">
              <CalendarGrid
                calendarDays={calendarDays}
                currentDate={currentDate}
                selectedDay={selectedDay}
                onSelectDay={selectDay}
                eventsForDay={eventsForDay}
                isSameMonth={isSameMonth}
                isSameDay={isSameDay}
                isToday={isToday}
              />
            </div>

            <div className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl p-5 shadow-xl">
              <EventModal selectedDay={selectedDay} events={selectedDayEvents} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 justify-end">
            {[
              { color: 'bg-yellow-400', label: 'Pendiente' },
              { color: 'bg-blue-400',   label: 'En Proceso' },
              { color: 'bg-green-400',  label: 'Completado' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ Modal de Formulario (Crear/Editar) ══ */}
      <EventFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveForm}
        onDelete={deleteTask}
        tecnicos={tecnicos}
        event={editingEvent}
      />
    </main>
  );
}
