import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Trash2, Clock, ChevronDown } from 'lucide-react';
import { sileo } from 'sileo';
import { cn } from '../../../shared/utils/cn';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';
import { safeStorage } from '../../../shared/utils/storage';
import { useTheme } from '../../../shared/context/ThemeContext';
import { CotizacionAutocomplete } from './CotizacionAutocomplete';
// ⚠️  INTEGRACIÓN BITRIX24 — SUSPENDIDA TEMPORALMENTE (pendiente de lineamientos)
// import { createBitrixDeal } from '../utils/bitrixService';
const PRESET_COLORS = [
  '#dadd12ff', '#1d2e8fff', '#424242ff', '#ce1515ff', '#621fceff', '#44bfefff'
];

// Slots genericos de tiempo 00:00 a 23:30 para cualquier jornada
const TIME_SLOTS = (() => {
  const slots = [];
  for (let mins = 0; mins < 24 * 60; mins += 30) {
    slots.push(
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    );
  }
  return slots;
})();

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Construye bloques ocupados a partir de las tareas existentes.
 */
const buildOccupiedBlocks = (existingTasks, editingRowId, jornadaInicio) => {
  return (existingTasks || [])
    .filter(t => t.rowId !== editingRowId && t.horaFin)
    .map(t => ({
      start: t.horaInicio || jornadaInicio,
      end: t.horaFin,
      color: t.colorAM || '#37A65F',
      label: t.morning || '',
    }));
};

/**
 * Calcula el primer tramo libre desde el fin del último bloque
 */
const computeSuggestedStart = (existingTasks, editingRowId, jornadaInicio) => {
  const others = (existingTasks || []).filter(
    t => t.horaFin && t.rowId !== editingRowId
  );
  if (others.length === 0) return jornadaInicio;
  const maxEnd = others.reduce((max, t) => {
    const mins = timeToMinutes(t.horaFin);
    return mins > timeToMinutes(max) ? t.horaFin : max;
  }, jornadaInicio);
  return maxEnd;
};

/**
 * Selector de hora personalizado — reemplaza el <select> nativo para
 * evitar el dropdown blanco del sistema operativo.
 */
function TimeSelect({ value, onChange, slots, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll al elemento seleccionado al abrir
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 py-2 text-xs font-semibold bg-transparent border-none outline-none cursor-pointer ${
          isDarkGantt ? 'text-gray-100' : 'text-gray-800'
        }`}
      >
        <span className="font-mono tracking-wide">{value}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          } ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      {/* Panel */}
      {open && (
        <div
          className={`absolute z-[200] bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-24 rounded-xl border shadow-2xl overflow-hidden animate-fade-in ${
            isDarkGantt
              ? 'bg-[#1e1e24] border-white/10 shadow-black/80'
              : 'bg-white border-gray-200 shadow-gray-300/40'
          }`}
        >
          <div ref={listRef} className="max-h-44 overflow-y-auto py-1 custom-scrollbar">
            {slots.map(t => (
              <button
                key={t}
                type="button"
                data-selected={t === value}
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-[5px] text-xs font-mono font-semibold transition-colors ${
                  t === value
                    ? isDarkGantt
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-blue-50 text-blue-600'
                    : isDarkGantt
                      ? 'text-gray-300 hover:bg-white/6 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Barra de timeline visual — estilo Gantt premium */
function TimelineBar({ occupiedBlocks, horaInicio, horaFin, isDarkGantt, jInicio, jFin }) {
  const OFFSET = timeToMinutes(jInicio);
  const totalMin = timeToMinutes(jFin) - OFFSET;
  const clamp  = (v) => Math.max(0, Math.min(100, v));
  const toPercent = (t) => clamp(((timeToMinutes(t) - OFFSET) / (totalMin || 600)) * 100);

  const selLeft  = toPercent(horaInicio);
  const selWidth = Math.max(0, toPercent(horaFin) - selLeft);

  // Duración formateada
  const selMins  = Math.max(0, timeToMinutes(horaFin) - timeToMinutes(horaInicio));
  const durHours = Math.floor(selMins / 60);
  const durMins  = selMins % 60;
  const durLabel = selMins > 0
    ? durMins > 0 ? `${durHours}h ${durMins}m` : `${durHours}h`
    : null;

  // Marcas de hora: 09, 10, 11 … 18 (cada hora completa dentro de la jornada)
  const hourTicks = [];
  const startH = Math.ceil(timeToMinutes(jInicio) / 60);
  const endH   = Math.floor(timeToMinutes(jFin) / 60);
  for (let h = startH; h <= endH; h++) {
    const pct = clamp(((h * 60 - OFFSET) / (totalMin || 600)) * 100);
    hourTicks.push({ h, pct });
  }

  return (
    <div className="select-none space-y-1.5 mt-2">

      {/* ── Cabecera: inicio | duración | fin ── */}
      <div className="flex items-center justify-between px-0.5">
        <span className={`text-[9px] font-mono font-semibold ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
          {horaInicio}
        </span>
        {durLabel && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
            isDarkGantt
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
              : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
            Tiempo disponible {durLabel}
          </span>
        )}
        <span className={`text-[9px] font-mono font-semibold ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
          {horaFin}
        </span>
      </div>

      {/* ── Track principal ── */}
      <div className="relative">
        {/* Fondo base de la jornada — segmentos por hora */}
        <div className={`relative h-3 rounded-lg overflow-hidden flex ${
          isDarkGantt ? 'bg-white/5' : 'bg-gray-100'
        }`}>

          {/* Segmentos alternados por hora (sutil) */}
          {hourTicks.slice(0, -1).map(({ h, pct }, i) => {
            const nextPct = hourTicks[i + 1]?.pct ?? 100;
            return (
              <div
                key={h}
                className="absolute top-0 h-full"
                style={{
                  left: `${pct}%`,
                  width: `${nextPct - pct}%`,
                  backgroundColor: isDarkGantt
                    ? i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)'
                    : i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)',
                }}
              />
            );
          })}

          {/* Divisiones de hora (tick lines) */}
          {hourTicks.map(({ h, pct }) => (
            <div
              key={`tick-${h}`}
              className={`absolute top-0 w-px h-full ${isDarkGantt ? 'bg-white/8' : 'bg-gray-200/80'}`}
              style={{ left: `${pct}%` }}
            />
          ))}

          {/* Bloques ocupados por otras fichas */}
          {occupiedBlocks.map((block, i) => {
            const left  = toPercent(block.start);
            const width = Math.max(0, toPercent(block.end) - left);
            return (
              <div
                key={i}
                className="absolute top-0 h-full opacity-65"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: block.color }}
              />
            );
          })}

          {/* Rango seleccionado — gradiente azul→cyan */}
          {selWidth > 0 && (
            <div
              className="absolute top-0 h-full"
              style={{
                left:  `${selLeft}%`,
                width: `${selWidth}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 0 6px rgba(59,130,246,0.35)',
              }}
            />
          )}
        </div>

        {/* Etiquetas de hora bajo el track */}
        <div className="relative h-4 mt-0.5">
          {hourTicks.filter((_, i) => i % 2 === 0).map(({ h, pct }) => (
            <span
              key={`lbl-${h}`}
              className={`absolute text-[8px] font-mono -translate-x-1/2 top-0 ${
                isDarkGantt ? 'text-gray-600' : 'text-gray-300'
              }`}
              style={{ left: `${pct}%` }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ))}
          {/* Etiquetas inicio y fin fijas */}
          <span className={`absolute text-[8px] font-mono top-0 left-0 ${isDarkGantt ? 'text-gray-600' : 'text-gray-300'}`}>
            {jInicio.split(':')[0]}
          </span>
          <span className={`absolute text-[8px] font-mono top-0 right-0 translate-x-1/2 ${isDarkGantt ? 'text-gray-600' : 'text-gray-300'}`}>
            {jFin.split(':')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CellPopoverForm({
  isOpen,
  onClose,
  onSave,
  event,
  prefilledDate,
  prefilledResource,
  existingTasks = [],
  tecnicos = []
}) {
  const { isDarkGantt } = useTheme();
  const [morning, setMorning]   = useState('');
  const [colorAM, setColorAM]   = useState('');
  const [estadoAM, setEstadoAM] = useState('Pendiente');

  // Buscar el tecnico para extraer las horas dinámicas
  const _tec = tecnicos.find(t => t.id === prefilledResource);
  const userJInicio = (_tec && _tec.hora_ingreso) ? _tec.hora_ingreso.substring(0, 5) : '08:30';
  const userJFin    = (_tec && _tec.hora_salida)  ? _tec.hora_salida.substring(0, 5)  : '18:30';

  // Rango horario
  const [horaInicio, setHoraInicio] = useState(userJInicio);
  const [horaFin,    setHoraFin]    = useState(userJFin);

  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const colorPickerRefAM = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeColorPicker === 'am' && colorPickerRefAM.current && !colorPickerRefAM.current.contains(e.target)) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeColorPicker]);

  const [recentColors, setRecentColors] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeStorage.getItem('rimmet_recent_colors');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });

  const saveToRecent = (c) => {
    setRecentColors(prev => {
      let updated = [...prev];
      if (c && !PRESET_COLORS.includes(c)) {
        updated = updated.filter(x => x !== c);
        updated.unshift(c);
      }
      updated = updated.slice(0, 5);
      safeStorage.setItem('rimmet_recent_colors', JSON.stringify(updated));
      return updated;
    });
  };

  // ── Inicializar al abrir ──
  useEffect(() => {
    if (!isOpen) return;

    // Calcular bloques ocupados en el momento de la apertura
    const blocks = buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio);

    // --- Función auxiliar: obtener primer tramo libre válido ---
    const getFirstFreeSlot = () => {
      // Ordenar bloques por inicio
      const sorted = [...blocks].sort(
        (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
      );
      let cursor = userJInicio;
      for (const blk of sorted) {
        if (timeToMinutes(blk.start) > timeToMinutes(cursor)) break; // hay hueco antes de este bloque
        if (timeToMinutes(blk.end) > timeToMinutes(cursor)) cursor = blk.end;
      }
      return cursor; // inicio del primer tramo libre
    };

    // --- Obtener el máximo fin disponible a partir de un inicio ---
    const getMaxFin = (inicio) => {
      const inicioMins = timeToMinutes(inicio);
      const nextBlock = blocks
        .filter(b => timeToMinutes(b.start) > inicioMins)
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0];
      return nextBlock ? nextBlock.start : userJFin;
    };

    if (event) {
      setMorning(event.morning || '');
      setColorAM(event.colorAM || event.color || '');
      setEstadoAM(event.estadoAM || 'Pendiente');
      setHoraInicio(event.horaInicio || getFirstFreeSlot());
      setHoraFin(event.horaFin || userJFin);
    } else {
      setMorning('');
      setColorAM('');
      setEstadoAM('Pendiente');
      const freeStart = getFirstFreeSlot();
      setHoraInicio(freeStart);
      setHoraFin(getMaxFin(freeStart));
    }
    setActiveColorPicker(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event]);

  // ── Datos calculados para la UI ──
  const occupiedBlocks = useMemo(
    () => buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio),
    [existingTasks, event?.rowId, userJInicio]
  );

  const suggestedStart = useMemo(
    () => computeSuggestedStart(existingTasks, event?.rowId, userJInicio),
    [existingTasks, event?.rowId, userJInicio]
  );

  const isJornadaFull = timeToMinutes(suggestedStart) >= timeToMinutes(userJFin);

  // ── Slots de hora con filtrado inteligente (excluye rangos ocupados) ──

  /** ¿El instante T cae dentro de algún bloque ocupado? */
  const isInsideOccupied = (t) => {
    const tMins = timeToMinutes(t);
    return occupiedBlocks.some(
      b => tMins >= timeToMinutes(b.start) && tMins < timeToMinutes(b.end)
    );
  };

  /**
   * Máximo tiempo de fin disponible para el inicio dado:
   * es el inicio del primer bloque ocupado ESTRICTAMENTE después del inicio,
   * o el fin de la jornada si no hay ninguno.
   */
  const maxFinMinutes = (() => {
    const inicioMins = timeToMinutes(horaInicio);
    const next = occupiedBlocks
      .filter(b => timeToMinutes(b.start) > inicioMins)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0];
    return next ? timeToMinutes(next.start) : timeToMinutes(userJFin);
  })();

  // Slots inicio: excluye horas dentro de un bloque ocupado
  const horaInicioSlots = TIME_SLOTS.filter(t => {
    if (timeToMinutes(t) >= timeToMinutes(userJFin)) return false;
    return !isInsideOccupied(t) && timeToMinutes(t) >= timeToMinutes(userJInicio);
  });

  // Slots fin: > horaInicio y sin sobrepasar el siguiente bloque ocupado
  const horaFinSlots = TIME_SLOTS.filter(t => {
    const tMins = timeToMinutes(t);
    return tMins > timeToMinutes(horaInicio) && tMins <= maxFinMinutes;
  });

  /** Verifica solapamiento entre [horaInicio, horaFin] y los bloques ocupados */
  const hasOverlap = () => {
    const startA = timeToMinutes(horaInicio);
    const endA   = timeToMinutes(horaFin);
    return occupiedBlocks.some(b => {
      const startB = timeToMinutes(b.start);
      const endB   = timeToMinutes(b.end);
      return startA < endB && endA > startB;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Validaciones previas al envío ──
    if (!morning.trim()) {
      sileo.error({ description: 'Debe ingresar al menos una actividad.' });
      return;
    }
    if (timeToMinutes(horaFin) <= timeToMinutes(horaInicio)) {
      sileo.error({ description: 'La hora de fin debe ser posterior a la hora de inicio.' });
      return;
    }
    if (hasOverlap()) {
      sileo.error({
        description: `El rango ${horaInicio}–${horaFin} se superpone con una actividad ya registrada. Por favor elige un tramo libre.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      saveToRecent(colorAM);
      await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        morning: morning.trim().toUpperCase(),
        afternoon: '',
        colorAM,
        colorPM: colorAM,
        estadoAM,
        estadoPM: null,
        horaInicio,
        horaFin,
        lastModified: event ? (event.timestampUpdated || null) : null,
      });

      // ⚠️  INTEGRACIÓN BITRIX24 — SUSPENDIDA TEMPORALMENTE (pendiente de lineamientos)
      // === INTEGRACIÓN BITRIX24 ===
      // Si estamos creando una nueva actividad (o también puedes hacerlo al editar si le quitas el if)
      // if (!event) {
      //   try {
      //     await createBitrixDeal({
      //       morning: morning.trim().toUpperCase(),
      //       tecnico: prefilledResource?.replace(/_/g, ' '),
      //       fecha: prefilledDate ? format(prefilledDate, 'yyyy-MM-dd') : '',
      //       horaInicio,
      //       horaFin,
      //     });
      //     sileo.success({ description: 'Actividad enviada a Bitrix24 exitosamente.' });
      //   } catch (bitrixErr) {
      //     // No bloqueamos el flujo principal si falla Bitrix, pero avisamos al usuario
      //     sileo.error({ description: 'La actividad se guardó localmente pero falló el envío a Bitrix24.' });
      //   }
      // }
      
    } catch (err) {
      // Mostrar el error recibido del backend
      const msg = err?.message || 'Error al guardar. Intente nuevamente.';
      sileo.error({ description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        morning: '', afternoon: '', colorAM: '', colorPM: '',
        estadoAM: null, estadoPM: null,
        turno: '', horaDuracion: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = prefilledDate
    ? format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es })
    : '';
  const dateTitle = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 ${
        isDarkGantt ? 'bg-black/40' : 'bg-gray-500/30'
      }`}
    >
      <div
        className={`border rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 ${
          isDarkGantt ? 'bg-[#1a1a1d] border-gray-700/50' : 'bg-white border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b rounded-t-2xl ${
            isDarkGantt ? 'border-gray-800 bg-[#1e1e22]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div>
            <h3 className={`text-base font-semibold uppercase tracking-widest text-[11px] mb-1 ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>
              Personal: <span className="text-primary-400">{prefilledResource?.replace(/_/g, ' ')}</span>
            </h3>
            <p className={`text-sm font-medium capitalize ${isDarkGantt ? 'text-gray-400' : 'text-gray-600'}`}>
              {dateTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkGantt
                ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── Actividad ── */}
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
                    Actividad
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMorning(''); setColorAM(''); }}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isDarkGantt
                        ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300'
                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                    }`}
                    title="Limpiar Ficha"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                <div className="flex gap-2">
                  <CotizacionAutocomplete
                    key={event?.rowId ?? 'new'}
                    value={morning}
                    onChange={setMorning}
                    placeholder="EJ: 260001.COT01 · EMBOL"
                    isDarkGantt={isDarkGantt}
                  />

                  {/* Color Picker */}
                  <div className="relative" ref={colorPickerRefAM}>
                    <button
                      type="button"
                      onClick={() => setActiveColorPicker(activeColorPicker === 'am' ? null : 'am')}
                      className={`w-11 h-11 rounded-xl border shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-hidden ${
                        isDarkGantt ? 'border-white/10 ring-offset-[#111]' : 'border-gray-200 ring-offset-white'
                      }`}
                      style={{ backgroundColor: colorAM || 'transparent' }}
                      title="Elegir color"
                    >
                      {!colorAM && (
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMmEyYTMwIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzYTNjNDIiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzNhM2M0MiI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-30" />
                      )}
                      <div className={`w-5 h-5 rounded-full border-2 shadow-inner mix-blend-overlay relative z-10 ${isDarkGantt ? 'border-white/40' : 'border-black/20'}`} />
                    </button>

                    {activeColorPicker === 'am' && (
                      <div className={`absolute top-14 right-0 z-50 p-3 border rounded-2xl shadow-2xl animate-fade-in w-56 ${isDarkGantt ? 'bg-[#1e1e24] border-gray-700/50' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs font-semibold ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>Color</span>
                          <button type="button" onClick={() => setActiveColorPicker(null)} className={`transition-colors ${isDarkGantt ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}>
                            <X size={14} />
                          </button>
                        </div>
                        <HexColorPicker color={colorAM || PRESET_COLORS[1]} onChange={setColorAM} style={{ width: '100%', height: '120px' }} />
                        <div className="mt-3">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Predefinidos</span>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {PRESET_COLORS.map(c => (
                              <button
                                key={c} type="button" onClick={() => setColorAM(c)}
                                className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                        {recentColors.length > 0 && (
                          <div className={`mt-3 border-t pt-2 ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Recientes</span>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {recentColors.map((c, i) => (
                                <button
                                  key={`recent-${c}-${i}`} type="button" onClick={() => setColorAM(c)}
                                  className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Separador ── */}
          <div className={`h-px ${isDarkGantt ? 'bg-white/8' : 'bg-gray-100'}`} />

          {/* ── Rango Horario ── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Clock className={`w-3 h-3 ${isDarkGantt ? 'text-blue-400' : 'text-blue-500'}`} />
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
                Rango Horario
              </label>
              {isJornadaFull && (
                <span className="ml-auto text-[9px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                  Jornada completa
                </span>
              )}
            </div>

            {/* Selectores compactos en fila unificada */}
            <div className={`flex items-center rounded-xl border overflow-visible ${
              isDarkGantt ? 'bg-[#111]/60 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
              {/* De */}
              <div className="flex items-center gap-1.5 pl-3 pr-2 py-0.5 flex-1 min-w-0">
                <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${
                  isDarkGantt ? 'text-gray-500' : 'text-gray-400'
                }`}>De</span>
                <TimeSelect
                  value={horaInicio}
                  slots={horaInicioSlots}
                  isDarkGantt={isDarkGantt}
                  onChange={(newInicio) => {
                    setHoraInicio(newInicio);
                    if (timeToMinutes(horaFin) <= timeToMinutes(newInicio)) {
                      const nextSlot = TIME_SLOTS.find(t => timeToMinutes(t) > timeToMinutes(newInicio));
                      if (nextSlot) setHoraFin(nextSlot);
                    }
                  }}
                />
              </div>

              {/* Divider */}
              <div className={`w-px self-stretch ${
                isDarkGantt ? 'bg-white/10' : 'bg-gray-200'
              }`} />

              {/* A */}
              <div className="flex items-center gap-1.5 pl-3 pr-2 py-0.5 flex-1 min-w-0">
                <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${
                  isDarkGantt ? 'text-gray-500' : 'text-gray-400'
                }`}>A</span>
                <TimeSelect
                  value={horaFin}
                  slots={horaFinSlots}
                  isDarkGantt={isDarkGantt}
                  onChange={setHoraFin}
                />
              </div>
            </div>

            {/* Barra visual de la jornada */}
            <TimelineBar
              occupiedBlocks={occupiedBlocks}
              horaInicio={horaInicio}
              horaFin={horaFin}
              isDarkGantt={isDarkGantt}
              jInicio={userJInicio}
              jFin={userJFin}
            />

            {/* Info de disponibilidad */}
            {!isJornadaFull && occupiedBlocks.length > 0 && (
              <p className={`text-[9px] font-medium ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                Próximo tiempo libre:{' '}
                <span className={`font-bold ${isDarkGantt ? 'text-blue-400' : 'text-blue-600'}`}>
                  {suggestedStart} → {userJFin}
                </span>
              </p>
            )}
          </div>

          {/* ── Auditoría (Solo Lectura) ── */}
          {event && (event.author || event.timestampUpdated) && (
            <div className={`border rounded-lg p-3 ${isDarkGantt ? 'bg-[#111111]/50 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-[12px] text-gray-500 font-mono leading-tight">
                {event.author && <span>Actualizado por: <span className="text-primary-400/80 font-medium">{event.author}</span><br /></span>}
                {event.timestampUpdated && <span>El {event.timestampUpdated}</span>}
              </p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className={`pt-4 flex items-center justify-between border-t ${isDarkGantt ? 'border-gray-800' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg shadow-lg shadow-primary-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
