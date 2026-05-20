import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../../../shared/utils/cn';
import { safeStorage } from '../../../shared/utils/storage';
import { useTheme } from '../../../shared/context/ThemeContext';
import { CotizacionAutocomplete } from './CotizacionAutocomplete';
import { AdditionalResourcesPicker } from './AdditionalResourcesPicker';
import { TimelineBar } from './TimelineBar';
import { TimeSelect } from './TimeSelect';
import {
  TIME_SLOTS,
  buildOccupiedBlocks,
  computeSuggestedStart,
  getFirstFreeSlot,
  getMaxEndForStart,
  hasTimeOverlap,
  timeToMinutes,
} from '../utils/calendarTime';

// Integracion Bitrix24 suspendida temporalmente.
// import { createBitrixDeal } from '../utils/bitrixService';

const PRESET_COLORS = [
  '#dadd12ff',
  '#1d2e8fff',
  '#424242ff',
  '#ce1515ff',
  '#621fceff',
  '#44bfefff',
];

const normalizeArea = (area) => {
  return area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
};

export function CellPopoverForm({
  isOpen,
  onClose,
  onSave,
  event,
  prefilledDate,
  prefilledResource,
  existingTasks = [],
  tecnicos = [],
}) {
  const { isDarkGantt } = useTheme();
  const [morning, setMorning] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [colorAM, setColorAM] = useState('');
  const [estadoAM, setEstadoAM] = useState('Pendiente');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const [showAdditionalUsers, setShowAdditionalUsers] = useState(false);
  const [additionalResources, setAdditionalResources] = useState([]);
  const colorPickerRefAM = useRef(null);
  const lastInitializationKeyRef = useRef(null);

  const tecnico = tecnicos.find(item => item.id === prefilledResource);
  const userJInicio = tecnico?.hora_ingreso ? tecnico.hora_ingreso.substring(0, 5) : '08:30';
  const userJFin = tecnico?.hora_salida ? tecnico.hora_salida.substring(0, 5) : '18:30';

  const [horaInicio, setHoraInicio] = useState(userJInicio);
  const [horaFin, setHoraFin] = useState(userJFin);

  const grupos = useMemo(() => {
    const map = {};

    tecnicos.forEach(item => {
      if (item.id === prefilledResource) return;

      const area = typeof item.area === 'string' && item.area.trim()
        ? item.area.trim()
        : 'Sin Area';

      if (normalizeArea(area) === 'VEHICULOS') return;
      if (!map[area]) map[area] = [];
      map[area].push(item);
    });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos, prefilledResource]);

  const occupiedBlocks = useMemo(
    () => buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio),
    [existingTasks, event?.rowId, userJInicio]
  );

  const suggestedStart = useMemo(
    () => computeSuggestedStart(existingTasks, event?.rowId, userJInicio),
    [existingTasks, event?.rowId, userJInicio]
  );

  const isJornadaFull = timeToMinutes(suggestedStart) >= timeToMinutes(userJFin);
  const maxFinMinutes = timeToMinutes(getMaxEndForStart(occupiedBlocks, horaInicio, userJFin));

  const isInsideOccupied = (time) => {
    const minutes = timeToMinutes(time);
    return occupiedBlocks.some(
      block => minutes >= timeToMinutes(block.start) && minutes < timeToMinutes(block.end)
    );
  };

  const horaInicioSlots = TIME_SLOTS.filter(time => {
    if (timeToMinutes(time) >= timeToMinutes(userJFin)) return false;
    return !isInsideOccupied(time) && timeToMinutes(time) >= timeToMinutes(userJInicio);
  });

  const horaFinSlots = TIME_SLOTS.filter(time => {
    const minutes = timeToMinutes(time);
    return minutes > timeToMinutes(horaInicio) && minutes <= maxFinMinutes;
  });

  const dateTitle = (() => {
    if (!prefilledDate) return '';
    const formattedDate = format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es });
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  })();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        activeColorPicker === 'am' &&
        colorPickerRefAM.current &&
        !colorPickerRefAM.current.contains(e.target)
      ) {
        setActiveColorPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeColorPicker]);

  const [recentColors, setRecentColors] = useState(() => {
    if (typeof window === 'undefined') return [];

    try {
      const saved = safeStorage.getItem('rimmet_recent_colors');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const initializationKey = [
    event?.rowId ?? 'new',
    prefilledResource ?? '',
    prefilledDate ? format(prefilledDate, 'yyyy-MM-dd') : '',
  ].join('|');

  useEffect(() => {
    if (!isOpen) return;
    if (lastInitializationKeyRef.current === initializationKey) return;

    lastInitializationKeyRef.current = initializationKey;

    const blocks = buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio);

    if (event) {
      setMorning(event.morning || '');
      setDescripcion(event.descripcion || '');
      setColorAM(event.colorAM || event.color || '');
      setEstadoAM(event.estadoAM || 'Pendiente');
      setHoraInicio(event.horaInicio || getFirstFreeSlot(blocks, userJInicio));
      setHoraFin(event.horaFin || userJFin);
    } else {
      const freeStart = getFirstFreeSlot(blocks, userJInicio);
      setMorning('');
      setDescripcion('');
      setColorAM('');
      setEstadoAM('Pendiente');
      setHoraInicio(freeStart);
      setHoraFin(getMaxEndForStart(blocks, freeStart, userJFin));
    }

    setActiveColorPicker(null);
    setAdditionalResources([]);
    setShowAdditionalUsers(false);
  }, [event, existingTasks, initializationKey, isOpen, userJFin, userJInicio]);

  useEffect(() => {
    if (!isOpen) {
      lastInitializationKeyRef.current = null;
    }
  }, [isOpen]);

  const saveToRecent = (color) => {
    setRecentColors(prev => {
      let updated = [...prev];

      if (color && !PRESET_COLORS.includes(color)) {
        updated = updated.filter(item => item !== color);
        updated.unshift(color);
      }

      updated = updated.slice(0, 5);
      safeStorage.setItem('rimmet_recent_colors', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleAdditionalTecnico = (id) => {
    setAdditionalResources(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllArea = (areaTecs) => {
    const ids = areaTecs.map(item => item.id);
    const allSelected = ids.every(id => additionalResources.includes(id));

    if (allSelected) {
      setAdditionalResources(prev => prev.filter(id => !ids.includes(id)));
      return;
    }

    setAdditionalResources(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!morning.trim()) {
      toast.error('Debe ingresar al menos una cotizacion.');
      return;
    }

    if (timeToMinutes(horaFin) <= timeToMinutes(horaInicio)) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    if (hasTimeOverlap(occupiedBlocks, horaInicio, horaFin)) {
      toast.error(`El rango ${horaInicio}-${horaFin} se superpone con una tarea ya registrada. Por favor elige un tramo libre.`);
      return;
    }

    setIsSubmitting(true);
    try {
      saveToRecent(colorAM);
      await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        cotizacion: morning.trim().toUpperCase(),
        morning: morning.trim().toUpperCase(),
        descripcion: descripcion.trim(),
        afternoon: '',
        colorAM,
        colorPM: colorAM,
        estadoAM,
        estadoPM: null,
        horaInicio,
        horaFin,
        lastModified: event ? event.timestampUpdated || null : null,
        additionalResources,
      });

      // Bitrix24 suspendido temporalmente. Mantener aqui el punto de integracion.
    } catch (err) {
      toast.error(err?.message || 'Error al guardar. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        cotizacion: '',
        morning: '',
        afternoon: '',
        colorAM: '',
        colorPM: '',
        descripcion: '',
        estadoAM: null,
        estadoPM: null,
        turno: '',
        horaDuracion: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {event?.codigoRegistro ? (
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-500 rounded border border-blue-500/30">
                Registro: {event.codigoRegistro}
              </span>
            ) : (
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-gray-500/20 text-gray-500 rounded border border-gray-500/30">
                Registro: {event ? 'No asignado (NULL)' : 'Se generara al guardar'}
              </span>
            )}
          </div>
          <button
            type="button"
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
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
                    Cotizacion o Tarea Asignada
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMorning('');
                      setDescripcion('');
                      setColorAM('');
                    }}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isDarkGantt
                        ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300'
                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                    }`}
                    title="Limpiar campos"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>

                <div className="flex gap-2">
                  <CotizacionAutocomplete
                    key={event?.rowId ?? 'new'}
                    value={morning}
                    onChange={setMorning}
                    onDescripcionChange={setDescripcion}
                    placeholder="EJ: 260001.COT01"
                    isDarkGantt={isDarkGantt}
                  />

                  <div className="relative shrink-0" ref={colorPickerRefAM}>
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
                          <button
                            type="button"
                            onClick={() => setActiveColorPicker(null)}
                            className={`transition-colors ${isDarkGantt ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <HexColorPicker
                          color={colorAM || PRESET_COLORS[1]}
                          onChange={setColorAM}
                          style={{ width: '100%', height: '120px' }}
                        />

                        <div className="mt-3">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Predefinidos</span>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setColorAM(color)}
                                className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>

                        {recentColors.length > 0 && (
                          <div className={`mt-3 border-t pt-2 ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Recientes</span>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {recentColors.map((color, index) => (
                                <button
                                  key={`recent-${color}-${index}`}
                                  type="button"
                                  onClick={() => setColorAM(color)}
                                  className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                  style={{ backgroundColor: color }}
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

            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                isDarkGantt ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Descripcion <span className={`normal-case font-normal text-[9px] ${
                  isDarkGantt ? 'text-gray-600' : 'text-gray-400'
                }`}>(opcional)</span>
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalles adicionales..."
                maxLength={200}
                spellCheck={false}
                className={cn(
                  'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all shadow-inner',
                  isDarkGantt
                    ? 'bg-[#111111] border-white/5 text-gray-200 placeholder-gray-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
          </div>

          <div className={`h-px ${isDarkGantt ? 'bg-white/8' : 'bg-gray-100'}`} />

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

            <div className={`flex items-center rounded-xl border overflow-visible ${
              isDarkGantt ? 'bg-[#111]/60 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
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
                      const nextSlot = TIME_SLOTS.find(time => timeToMinutes(time) > timeToMinutes(newInicio));
                      if (nextSlot) setHoraFin(nextSlot);
                    }
                  }}
                />
              </div>

              <div className={`w-px self-stretch ${
                isDarkGantt ? 'bg-white/10' : 'bg-gray-200'
              }`} />

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

            <TimelineBar
              occupiedBlocks={occupiedBlocks}
              horaInicio={horaInicio}
              horaFin={horaFin}
              isDarkGantt={isDarkGantt}
              jInicio={userJInicio}
              jFin={userJFin}
            />

            {!isJornadaFull && occupiedBlocks.length > 0 && (
              <p className={`text-[9px] font-medium ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                Proximo tiempo libre:{' '}
                <span className={`font-bold ${isDarkGantt ? 'text-blue-400' : 'text-blue-600'}`}>
                  {suggestedStart} - {userJFin}
                </span>
              </p>
            )}
          </div>

          {event && (event.author || event.timestampUpdated) && (
            <div className={`border rounded-lg p-3 ${isDarkGantt ? 'bg-[#111111]/50 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-[12px] text-gray-500 font-mono leading-tight">
                {event.author && <span>Actualizado por: <span className="text-primary-400/80 font-medium">{event.author}</span><br /></span>}
                {event.timestampUpdated && <span>El {event.timestampUpdated}</span>}
              </p>
            </div>
          )}

          <AdditionalResourcesPicker
            grupos={grupos}
            isDarkGantt={isDarkGantt}
            isOpen={showAdditionalUsers}
            selectedResources={additionalResources}
            onToggleOpen={() => setShowAdditionalUsers(prev => !prev)}
            onToggleResource={toggleAdditionalTecnico}
            onSelectArea={selectAllArea}
          />

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
