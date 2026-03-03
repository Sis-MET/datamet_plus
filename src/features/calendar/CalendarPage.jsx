import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, ArrowLeft } from 'lucide-react';

import { useCalendar } from './hooks/useCalendar';
import { CalendarGrid } from './components/CalendarGrid';
import { StatsBar } from './components/StatsBar';
import { EventModal } from './components/EventModal';

export function CalendarPage() {
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
  } = useCalendar();

  const monthTitle = format(currentDate, "MMMM yyyy", { locale: es });
  const monthTitleFormatted = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <CalendarDays className="h-6 w-6 text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-100">Calendario de Trabajo</h1>
        </div>
        <p className="text-sm text-gray-400 ml-9">
          Visualiza y gestiona los instrumentos recibidos por fecha
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6">
        <StatsBar stats={monthStats} />
      </div>

      {/* Main grid: Calendar + Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendar panel ── */}
        <div className="lg:col-span-2 bg-[#1a1a1d] border border-gray-700/50 rounded-2xl p-5 shadow-xl">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-100 capitalize">{monthTitleFormatted}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all"
              >
                Hoy
              </button>
              <div className="flex">
                <button
                  onClick={prevMonth}
                  className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-white/8 rounded-lg transition-all"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

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

        {/* ── Detail / Events panel ── */}
        <div className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl p-5 shadow-xl">
          <EventModal selectedDay={selectedDay} events={selectedDayEvents} />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-4 justify-end">
        {[
          { color: 'bg-yellow-400', label: 'Pendiente' },
          { color: 'bg-blue-400', label: 'En Proceso' },
          { color: 'bg-green-400', label: 'Completado' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </main>
  );
}
