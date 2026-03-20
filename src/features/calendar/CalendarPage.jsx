import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutList, Loader2, DatabaseZap,
} from 'lucide-react';
import { sileo } from 'sileo';

import { useCalendar } from './hooks/useCalendar';
import { useGantt } from './hooks/useGantt';
import { SidebarWidgets } from './components/SidebarWidgets';
import { LeftFilterSidebar } from './components/LeftFilterSidebar';
import { CellPopoverForm } from './components/CellPopoverForm';
import { GanttPage } from './GanttPage';

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch (e) { return null; }
}

export function CalendarPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedArea, setSelectedArea] = useState('Todas');
  
  // Guardar la cede de click de la grilla (para nuevas tareas)
  const [prefilledDate, setPrefilledDate] = useState(new Date());
  const [prefilledResource, setPrefilledResource] = useState('');

  // Determinar permisos del usuario
  const token = localStorage.getItem('rimmet_token');
  const user = token ? parseJwt(token) : null;
  const isAdmin = user?.acceso === 'SAdministrador';

  // ── Hook vista Gantt ── (Lo cargamos primero para tener las Tasks)
  const {
    tasks, 
    weekStart,
    weekEnd,
    weekDays,
    previewDays,
    tecnicos,
    loading,
    useMock,
    tasksForCell,
    upsertScheduleCell,
    nextWeek,
    prevWeek,
    goToCurrentWeek,
    goToDate,
    isToday: isTodayGantt,
  } = useGantt();

  // Filtrado de Técnicos Reactivo por Área
  const filteredTecnicos = React.useMemo(() => {
    if (!tecnicos) return [];
    if (selectedArea === 'Todas') return tecnicos;
    return tecnicos.filter(t => {
      const pArea = typeof t.area === 'string' && t.area.trim() !== '' ? t.area.trim() : 'Sin Área';
      return pArea === selectedArea;
    });
  }, [tecnicos, selectedArea]);

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

  // Computar qué vehículos están ocupados para este día en específico
  const takenVehicles = React.useMemo(() => {
    if (!prefilledDate || !tasks) return [];
    return tasks
      .filter(t => 
        t.fecha.getTime() === prefilledDate.getTime() && 
        t.vehiculo && 
        t.vehiculo !== 'Ninguno' && 
        t.vehiculo !== 'Vehículo Propio' &&
        t.Tecnico !== prefilledResource // No bloquea si el técnico actual ya lo tiene asignado
      )
      .map(t => t.vehiculo);
  }, [tasks, prefilledDate, prefilledResource]);

  const handleOpenForm = (evt = null, date = new Date(), resourceId = '') => {
    setEditingEvent(evt);
    setPrefilledDate(date);
    setPrefilledResource(resourceId);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (date, resource, text) => {
    try {
      await upsertScheduleCell(date, resource, text);
      setIsFormOpen(false);
      
      if (!text || (typeof text === 'object' && !text.morning && !text.afternoon) || (typeof text === 'string' && text.trim() === '')) {
        sileo.success({ description: "Celda limpiada correctamente." });
      } else {
        sileo.success({ description: "Actividad guardada correctamente." });
      }
    } catch (err) {
      sileo.error({ description: err.message || "Error al guardar en el calendario" });
    }
  };

  const handleTaskDrop = async (sourceTask, targetDate, targetResource) => {
    if (!sourceTask) return;
    
    // Buscar el nombre del técnico para un mensaje más amigable
    const targetTecnico = tecnicos.find(t => t.id === targetResource);
    const targetName = targetTecnico ? targetTecnico.nombre : targetResource;

    const executeCopy = async () => {
      try {
        // Aseguramos que targetDate sea un objeto Date
        const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
        
        await upsertScheduleCell(dateObj, targetResource, {
          morning: sourceTask.morning,
          afternoon: sourceTask.afternoon,
          colorAM: sourceTask.colorAM,
          colorPM: sourceTask.colorPM
        });
        sileo.success({ description: "Actividad copiada correctamente." });
      } catch (err) {
        sileo.error({ description: err.message || "Error al copiar la actividad" });
      }
    };

    if (sourceTask.sourceResource && sourceTask.sourceResource !== targetResource) {
      // Diferente técnico: solicitar confirmación usando ReactNode en el description
      const handleConfirm = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        executeCopy();
        sileo.clear();
      };

      const handleCancel = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        sileo.clear();
      };

      sileo.action({
        title: "¿Copiar a otro técnico?",
        duration: 10000, // Darle 10 segundos para reaccionar
        description: (
          <div className="flex flex-col gap-3.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
            <span className="text-[13px] text-gray-600 leading-snug">
              Vas a copiar esta actividad a <strong className="font-semibold text-gray-800">{targetName}</strong>. ¿Estás seguro?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 py-1.5 px-4 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl text-[13px] font-semibold transition-colors shadow-sm"
              >
                Sí, Copiar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 py-1.5 px-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-[13px] font-semibold transition-colors shadow-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      });
    } else {
      // Mismo técnico (diferente día), copiamos directo
      executeCopy();
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 2xl:px-12 py-6">

      {/* ══ Encabezado unificado ══ */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">

          {/* Título + navegación semanal inline */}
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary-400 shrink-0" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-100">Calendario Metrica</h1>
                {/* Botones de semana inline con el título */}
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={goToCurrentWeek}
                    className="px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all border border-gray-700/50"
                  >
                    Hoy
                  </button>
                  <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
                    <button
                      onClick={prevWeek}
                      className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all border-r border-gray-700/50"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={nextWeek}
                      className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 transition-all"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="capitalize">{weekRangeCapitalized}</span>
              </p>
            </div>
          </div>

          {/* Controles derechos — solo indicadores */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Badge datos de ejemplo (solo Gantt) */}
            {useMock && (
              <span className="gantt-mock-badge">
                <DatabaseZap size={10} />
                Datos Oficiales
              </span>
            )}

          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ══ Panel Lateral Izq (Filtros Organizacionales) ══ */}
        <LeftFilterSidebar 
          tecnicos={tecnicos}
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
        />

        {/* ══ Cronograma semanal (Gantt Principal) ══ */}
        <div className="flex-1 min-w-0 w-full overflow-hidden">
          <GanttPage
            weekDays={weekDays}
            previewDays={previewDays}
            tecnicos={filteredTecnicos}
            tasksForCell={tasksForCell}
            isToday={isTodayGantt}
            onTaskClick={isAdmin ? handleOpenForm : undefined}
            onTaskDrop={isAdmin ? handleTaskDrop : undefined}
          />
        </div>

        {/* ══ Panel Lateral (Sidebar Widgets) ══ */}
        <SidebarWidgets
          currentDate={currentDate}
          selectedDay={selectedDay}
          calendarDays={calendarDays}
          onSelectDay={(date) => {
            selectDay(date);
            goToDate(date);
          }}
          eventsForDay={eventsForDay}
          isSameMonth={isSameMonth}
          isSameDay={isSameDay}
          isToday={isToday}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          selectedDayEvents={selectedDayEvents}
          tasks={tasks}
        />
      </div>

      {/* ══ Modal Flotante de Formulario (Crear/Editar Celda) ══ */}
      <CellPopoverForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveForm}
        event={editingEvent}
        prefilledDate={prefilledDate}
        prefilledResource={prefilledResource}
        takenVehicles={takenVehicles}
      />
    </main>
  );
}
