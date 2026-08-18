import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, ChevronDown, Clock, Info, Loader2, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../../../shared/utils/cn';
import { safeStorage } from '../../../shared/utils/storage';
import { useTheme } from '../../../shared/context/ThemeContext';
import { api } from '../../../shared/api/client';
import { CotizacionAutocomplete } from './CotizacionAutocomplete';
import { AdditionalResourcesPicker } from './AdditionalResourcesPicker';
import { VehiclePicker } from './VehiclePicker';
import { TimelineBar } from './TimelineBar';
import { TimeSelect } from './TimeSelect';
import { FloatingDropdown } from './FloatingDropdown';
import { useVehicleAvailability } from '../hooks/useVehicleAvailability';
import {
  ACTIVITY_OPTIONS,
  NO_CLIENT_ACTIVITY_TYPES,
  PRESET_COLORS,
  QUOTE_ACTIVITY_TYPES,
  buildTaskPayload,
  getClientCodeFromPlantCode,
  getPlantOptionLabel,
  getPlantParts,
  isPlantCode,
  normalizeArea,
  parseActivityValue,
  validateTaskDraft,
} from '../domain/taskFormDomain';
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

const TaskDescriptionField = React.memo(React.forwardRef(function TaskDescriptionField(
  { isDarkGantt },
  forwardedRef
) {
  const [value, setValue] = useState('');

  React.useImperativeHandle(forwardedRef, () => ({
    getValue: () => value,
    setValue: (nextValue) => setValue(String(nextValue || '')),
  }), [value]);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="task-description" className={`text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
          Descripción <span className={isDarkGantt ? 'text-red-300' : 'text-red-600'}>*</span>
        </label>
        <span className={`text-[11px] tabular-nums ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>
          {value.length}/200
        </span>
      </div>
      <textarea
        id="task-description"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Describe el trabajo, la dirección o cualquier indicación útil…"
        maxLength={200}
        spellCheck={false}
        className={cn(
          'min-h-[104px] w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-5 shadow-inner transition-[border-color,box-shadow,background-color] focus:outline-none focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/20',
          isDarkGantt
            ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500'
            : 'border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-500'
        )}
      />
    </div>
  );
}));

TaskDescriptionField.displayName = 'TaskDescriptionField';


function ActivitySelect({ value, onChange, options, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Tipo de tarea"
        className={`h-[45px] w-full rounded-xl border px-3 text-sm font-semibold shadow-inner outline-none transition-colors focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 sm:hidden ${
          isDarkGantt
            ? 'border-white/5 bg-[#111111] text-gray-100'
            : 'border-gray-200 bg-gray-50 text-gray-900'
        }`}
      >
        <option value="" disabled>Seleccionar...</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`hidden h-[45px] w-full items-center justify-between gap-2 rounded-xl border px-4 text-sm font-semibold shadow-inner transition-all focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 sm:flex ${
          isDarkGantt
            ? 'bg-[#111111] border-white/5 text-gray-100'
            : 'bg-gray-50 border-gray-200 text-gray-900'
        }`}
      >
        <span className={`truncate ${value ? '' : isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>
          {value || 'Seleccionar...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          } ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={200}
        ariaLabel="Tipos de tarea"
        className={`rounded-xl border shadow-2xl ${
            isDarkGantt
              ? 'bg-[#1e1e24] border-white/10 shadow-black/80'
              : 'bg-white border-gray-200 shadow-gray-300/40'
          }`}
      >
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {options.map(option => (
              <button
                key={option}
                type="button"
                data-selected={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                  option === value
                    ? isDarkGantt
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-blue-50 text-blue-600'
                    : isDarkGantt
                      ? 'text-gray-300 hover:bg-white/6 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}

function ClienteAutocomplete({ value, onChange, onSelect, isDarkGantt }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchClientes = async (text) => {
    if (text.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.get('/clientes/search', { q: text });
      const items = data.success ? data.data || [] : [];
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (event) => {
    const text = event.target.value;
    setQuery(text);
    onChange(text);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClientes(text), 300);
  };

  const handleSelect = (item) => {
    setQuery(item.cliente || '');
    setResults([]);
    setOpen(false);
    onSelect(item);
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Buscar cliente..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          spellCheck={false}
          className={cn(
            'w-full h-[45px] border rounded-xl px-4 pr-10 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-semibold shadow-inner',
            isDarkGantt
              ? 'bg-[#111111] border-white/10 text-gray-100 placeholder-gray-400'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-400" />
        )}
      </div>

      <FloatingDropdown
        open={open && results.length > 0}
        anchorRef={inputRef}
        onClose={() => setOpen(false)}
        maxHeight={200}
        ariaLabel="Resultados de clientes"
        className={`rounded-xl border shadow-2xl ${
          isDarkGantt ? 'bg-[#1e1e24] border-white/10 shadow-black/80' : 'bg-white border-gray-200 shadow-gray-300/40'
        }`}
      >
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {results.map(item => (
              <button
                key={item.codigo_cliente || item.cliente}
                type="button"
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  isDarkGantt ? 'hover:bg-white/6 text-gray-200' : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span className="block text-xs font-bold truncate">{item.cliente}</span>
                {item.codigo_cliente && (
                  <span className={`block text-[10px] font-mono mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                    {item.codigo_cliente}
                  </span>
                )}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}

function PlantaSelect({ value, onChange, plantas, clienteLabel, isLoading, disabled, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const selectedPlanta = plantas.find(planta => planta.codigo_planta === value) || null;
  const isDropdownOpen = open && !disabled;

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDropdownOpen]);

  const placeholder = isLoading
    ? 'Cargando plantas...'
    : disabled
      ? 'Selecciona un cliente primero...'
      : 'Seleccionar planta...';

  return (
    <div ref={containerRef} className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isLoading}
        aria-label="Planta"
        className={cn(
          'h-[45px] w-full rounded-xl border px-3 text-sm font-semibold shadow-inner outline-none transition-colors focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden',
          isDarkGantt
            ? 'border-white/5 bg-[#111111] text-gray-100'
            : 'border-gray-200 bg-gray-50 text-gray-900'
        )}
      >
        <option value="">{placeholder}</option>
        {plantas.map(planta => (
          <option key={planta.codigo_planta} value={planta.codigo_planta}>
            {getPlantOptionLabel(planta, clienteLabel)}
          </option>
        ))}
      </select>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!disabled && !isLoading && plantas.length > 0) {
            setOpen(current => !current);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen && plantas.length > 0}
        className={cn(
          'hidden h-[45px] w-full items-center justify-between gap-2 rounded-xl border px-4 text-sm font-semibold shadow-inner transition-all focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:flex',
          isDarkGantt
            ? 'bg-[#111111] border-white/5 text-gray-100'
            : 'bg-gray-50 border-gray-200 text-gray-900'
        )}
      >
        <span
          className={cn(
            'truncate text-left',
            selectedPlanta
              ? ''
              : isDarkGantt
                ? 'text-gray-400'
                : 'text-gray-500'
          )}
        >
          {selectedPlanta ? getPlantOptionLabel(selectedPlanta, clienteLabel) : placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-400" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-150',
              isDropdownOpen ? 'rotate-180' : '',
              isDarkGantt ? 'text-gray-500' : 'text-gray-400'
            )}
          />
        )}
      </button>

      <FloatingDropdown
        open={isDropdownOpen && plantas.length > 0}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={232}
        ariaLabel="Plantas disponibles"
        className={cn(
            'rounded-xl border shadow-2xl',
            isDarkGantt
              ? 'bg-[#1e1e24] border-white/10 shadow-black/80'
              : 'bg-white border-gray-200 shadow-gray-300/40'
          )}
      >
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
            {plantas.map(planta => {
              const plantaLabel = getPlantOptionLabel(planta, clienteLabel);
              const isSelected = planta.codigo_planta === value;

              return (
                <button
                  key={planta.codigo_planta}
                  type="button"
                  onClick={() => {
                    onChange(planta.codigo_planta);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 transition-colors',
                    isSelected
                      ? isDarkGantt
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-blue-50 text-blue-600'
                      : isDarkGantt
                        ? 'text-gray-300 hover:bg-white/6 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="block text-xs font-bold truncate">{plantaLabel}</span>
                  {planta.codigo_planta && (
                    <span className={cn(
                      'block text-[10px] font-mono mt-0.5',
                      isSelected
                        ? isDarkGantt
                          ? 'text-blue-200'
                          : 'text-blue-500'
                        : isDarkGantt
                          ? 'text-gray-500'
                          : 'text-gray-400'
                    )}>
                      {planta.codigo_planta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
      </FloatingDropdown>
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
  getTasksForResource,
  tecnicos = [],
}) {
  const { isDarkGantt } = useTheme();
  const [activityType, setActivityType] = useState('');
  const [cotizacionCode, setCotizacionCode] = useState('');
  const [cliente, setCliente] = useState('');
  const [codCliente, setCodCliente] = useState('');
  const [plantas, setPlantas] = useState([]);
  const [selectedPlantaCode, setSelectedPlantaCode] = useState('');
  const [isLoadingPlantas, setIsLoadingPlantas] = useState(false);
  const [colorAM, setColorAM] = useState('');
  const [estadoAM, setEstadoAM] = useState('Pendiente');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const [showAdditionalUsers, setShowAdditionalUsers] = useState(false);
  const [additionalResources, setAdditionalResources] = useState([]);
  const [showVehicles, setShowVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [showAssignments, setShowAssignments] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const colorPickerRefAM = useRef(null);
  const colorButtonRefAM = useRef(null);
  const lastInitializationKeyRef = useRef(null);
  const closeTimerRef = useRef(null);
  const descriptionFieldRef = useRef(null);
  const setDescription = useCallback((value) => {
    descriptionFieldRef.current?.setValue(value);
  }, []);

  const tecnico = tecnicos.find(item => item.id === prefilledResource);
  const userJInicio = tecnico?.hora_ingreso ? tecnico.hora_ingreso.substring(0, 5) : '08:30';
  const userJFin = tecnico?.hora_salida ? tecnico.hora_salida.substring(0, 5) : '18:30';

  const [horaInicio, setHoraInicio] = useState(userJInicio);
  const [horaFin, setHoraFin] = useState(userJFin);
  const requiresQuote = QUOTE_ACTIVITY_TYPES.has(activityType);
  const requiresPlantAssistance = (activityType === 'Visita' || (activityType === 'Servicio' && !cotizacionCode.trim())) && !NO_CLIENT_ACTIVITY_TYPES.has(activityType);
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

  const vehiculos = useMemo(
    () => tecnicos
      .filter(item => normalizeArea(item.area || '') === 'VEHICULOS' && item.id !== prefilledResource)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [tecnicos, prefilledResource]
  );

  const vehicleAvailability = useVehicleAvailability({
    vehicles: vehiculos,
    date: prefilledDate,
    start: horaInicio,
    end: horaFin,
    sourceTask: event,
    getTasksForResource,
  });

  const selectedVehicleConflict = selectedVehicle
    ? vehicleAvailability[selectedVehicle]?.conflict || null
    : null;

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
    if (!codCliente) {
      setPlantas([]);
      return;
    }

    if (!requiresPlantAssistance) {
      setPlantas([]);
      return;
    }

    let cancelled = false;

    const fetchPlantas = async () => {
      setIsLoadingPlantas(true);
      try {
        const data = await api.get(`/clientes/${encodeURIComponent(codCliente)}/plantas`);
        if (cancelled) return;
        setPlantas(data.success ? data.data || [] : []);
      } catch {
        if (!cancelled) setPlantas([]);
      } finally {
        if (!cancelled) setIsLoadingPlantas(false);
      }
    };

    fetchPlantas();

    return () => {
      cancelled = true;
    };
  }, [codCliente, requiresPlantAssistance]);

  useEffect(() => {
    if (!requiresPlantAssistance) return;
    if (plantas.length === 0) return;

    const currentDescription = descriptionFieldRef.current?.getValue().trim() || '';
    if (!currentDescription) return;

    const normalizedDescription = currentDescription;
    const matchedByDescription = plantas.find((planta) => {
      const rawDir = (planta.dir || '').trim();
      const plantAddress = getPlantParts(planta).address;
      return rawDir === normalizedDescription || plantAddress === normalizedDescription;
    });
    if (matchedByDescription) {
      setSelectedPlantaCode(matchedByDescription.codigo_planta);
    }
  }, [plantas, requiresPlantAssistance]);

  useEffect(() => {
    if (!isOpen) return;
    if (lastInitializationKeyRef.current === initializationKey) return;

    lastInitializationKeyRef.current = initializationKey;

    const blocks = buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio);

    if (event) {
      const parsedActivity = event.tipoTarea
        ? {
            activityType: ACTIVITY_OPTIONS.find(
              option => normalizeArea(option) === normalizeArea(event.tipoTarea)
            ) || event.tipoTarea,
            quoteCode: event.cotizacion || '',
          }
        : parseActivityValue(event.morning || event.cotizacion || '');
      const storedCode = String(event.cod_cliente || '').trim();
      const storedPlantCode = String(event.planta || '').trim() || (isPlantCode(storedCode) ? storedCode : '');
      const storedClientCode = storedPlantCode ? getClientCodeFromPlantCode(storedPlantCode) : storedCode;
      setActivityType(parsedActivity.activityType);
      setCotizacionCode(parsedActivity.quoteCode);
      setCliente(event.cliente || '');
      setCodCliente(storedClientCode);
      setSelectedPlantaCode(storedPlantCode);
      setDescription(event.descripcion || '');
      setColorAM(event.colorAM || event.color || '');
      setEstadoAM(event.estadoAM || 'Pendiente');
      setHoraInicio(event.horaInicio || getFirstFreeSlot(blocks, userJInicio));
      setHoraFin(event.horaFin || userJFin);
    } else {
      const freeStart = getFirstFreeSlot(blocks, userJInicio);
      setActivityType('');
      setCotizacionCode('');
      setCliente('');
      setCodCliente('');
      setPlantas([]);
      setSelectedPlantaCode('');
      setDescription('');
      setColorAM('');
      setEstadoAM('Pendiente');
      setHoraInicio(freeStart);
      setHoraFin(getMaxEndForStart(blocks, freeStart, userJFin));
    }

    setActiveColorPicker(null);
    setAdditionalResources([]);
    setSelectedVehicle('');
    setShowVehicles(false);
    setShowAdditionalUsers(false);
    setShowAssignments(false);
    setShowAvailability(false);
  }, [event, existingTasks, initializationKey, isOpen, setDescription, userJFin, userJInicio]);

  useEffect(() => {
    if (!isOpen) {
      lastInitializationKeyRef.current = null;
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const requestClose = useCallback((allowWhileSubmitting = false) => {
    if (isClosing || (isSubmitting && !allowWhileSubmitting)) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => onClose(), 100);
  }, [isClosing, isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, requestClose]);

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

  const handleActivityChange = (value) => {
    if (value !== activityType) {
      setCotizacionCode('');
      setCliente('');
      setCodCliente('');
      setPlantas([]);
      setSelectedPlantaCode('');
      setDescription('');
    }
    setActivityType(value);
  };

  const handleCotizacionSelect = (item) => {
    setCliente((item.nombre_cliente || '').trim());
    setCodCliente(item.codigo_cliente ? String(item.codigo_cliente).trim() : '');
    setSelectedPlantaCode(item.codigo_planta || '');
  };

  const handleClienteInputChange = (value) => {
    setCliente(value);
    setCodCliente('');
    setPlantas([]);
    setSelectedPlantaCode('');
    setDescription('');
  };

  const handleClienteSelect = (item) => {
    setCliente((item.cliente || '').trim());
    setCodCliente(item.codigo_cliente ? String(item.codigo_cliente).trim() : '');
    setDescription('');
    setSelectedPlantaCode('');
  };

  const handlePlantaChange = (codigoPlanta) => {
    setSelectedPlantaCode(codigoPlanta);
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
    const description = descriptionFieldRef.current?.getValue().trim() || '';

    const validationError = validateTaskDraft({
      activityType,
      requiresPlantAssistance,
      cliente,
      color: colorAM,
      descripcion: description,
      horaInicio,
      horaFin,
      overlaps: hasTimeOverlap(occupiedBlocks, horaInicio, horaFin),
      vehicleConflict: selectedVehicleConflict,
    });

    if (validationError) {
      toast.error(validationError, selectedVehicleConflict ? {
        description: `Se solapa con “${selectedVehicleConflict.label}” (${selectedVehicleConflict.start}–${selectedVehicleConflict.end}).`,
        duration: 6000,
      } : undefined);
      return;
    }

    // Cliente escrito manualmente sin seleccionar de la base de datos
    if (requiresPlantAssistance && cliente.trim() && !codCliente.trim()) {
      toast.warning(`El cliente "${cliente.trim()}" no está registrado en el DataMET. La ficha se guardará de todas formas.`, { duration: 5000 });
    }

    // Planta es opcional: solo advertir si hay cliente pero no planta
    if (requiresPlantAssistance && cliente.trim() && codCliente.trim() && !selectedPlantaCode) {
      toast.info(`Creando tarea con cliente "${cliente.trim()}" sin planta asignada.`, { duration: 4000 });
    }

    setIsSubmitting(true);
    try {
      saveToRecent(colorAM);
      const wasSaved = await onSave(prefilledDate, prefilledResource, buildTaskPayload({
        event,
        activityType,
        requiresQuote,
        cotizacionCode,
        descripcion: description,
        color: colorAM,
        estado: estadoAM,
        horaInicio,
        horaFin,
        cliente,
        codCliente,
        planta: selectedPlantaCode,
        additionalResources,
        selectedVehicle,
      }));

      if (wasSaved !== false) requestClose(true);

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
      const wasDeleted = await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        tipo_tarea: '',
        cotizacion: '',
        morning: '',
        afternoon: '',
        colorAM: '',
        colorPM: '',
        descripcion: '',
        estadoAM: null,
        estadoPM: null,
        horaDuracion: '',
      });
      if (wasDeleted !== false) requestClose(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedVehicleName = vehiculos.find(vehicle => vehicle.id === selectedVehicle)?.nombre;
  const assignmentCount = additionalResources.length + (selectedVehicle ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
      data-state={isClosing ? 'closing' : 'open'}
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) requestClose();
      }}
      className={`task-dialog-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 ${
        isDarkGantt ? 'bg-black/65' : 'bg-slate-900/35'
      }`}
    >
      <div
        data-state={isClosing ? 'closing' : 'open'}
        className={`task-dialog-panel flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl ${
          isDarkGantt
            ? 'border-white/10 bg-[#17171c]/95 shadow-black/70'
            : 'border-slate-500/25 bg-slate-100/92 shadow-slate-950/30'
        }`}
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header
          className={`flex items-center justify-between gap-4 border-b px-4 py-3.5 sm:px-6 sm:py-4 ${
            isDarkGantt ? 'border-white/10 bg-[#1d1d22]/90' : 'border-slate-500/20 bg-slate-200/60'
          }`}
        >
          <div className="min-w-0">
            <h2 id="task-form-title" className={`text-base font-semibold tracking-[-0.01em] sm:text-lg ${isDarkGantt ? 'text-white' : 'text-slate-950'}`}>
              {event ? 'Editar tarea' : 'Nueva tarea'}
            </h2>
            <p className={`mt-0.5 truncate text-xs sm:text-sm ${isDarkGantt ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className="font-semibold">{tecnico?.nombre || prefilledResource?.replace(/_/g, ' ')}</span>
              <span aria-hidden="true" className="px-1.5 opacity-50">·</span>
              <span className="capitalize">{dateTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestClose()}
            aria-label="Cerrar ficha de tarea"
            disabled={isSubmitting}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-40 ${
              isDarkGantt
                ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <section className="space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:pr-7" aria-labelledby="task-details-heading">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 id="task-details-heading" className={`text-sm font-semibold ${isDarkGantt ? 'text-slate-100' : 'text-slate-900'}`}>
                      Datos de la tarea
                    </h3>
                    <p className={`mt-0.5 text-xs ${isDarkGantt ? 'text-slate-400' : 'text-slate-500'}`}>
                      Define el tipo, el destino y lo que se realizará.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivityType('');
                      setCotizacionCode('');
                      setCliente('');
                      setCodCliente('');
                      setPlantas([]);
                      setSelectedPlantaCode('');
                      setDescription('');
                      setColorAM('');
                      setSelectedVehicle('');
                      setAdditionalResources([]);
                    }}
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                      isDarkGantt
                        ? 'text-red-300 hover:bg-red-500/15'
                        : 'text-red-700 hover:bg-red-50'
                    }`}
                    title="Limpiar campos"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpiar
                  </button>
                </div>

                <div>
                  <div>
                    <label className={`mb-2 block text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                      Tipo de tarea <span className={isDarkGantt ? 'text-red-300' : 'text-red-600'}>*</span>
                    </label>
                    <div className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2">
                  <ActivitySelect
                    value={activityType}
                    onChange={handleActivityChange}
                    options={ACTIVITY_OPTIONS}
                    isDarkGantt={isDarkGantt}
                  />
                  <div className="relative shrink-0" ref={colorPickerRefAM}>
                    <button
                      ref={colorButtonRefAM}
                      type="button"
                      onClick={() => setActiveColorPicker(activeColorPicker === 'am' ? null : 'am')}
                          aria-haspopup="dialog"
                          aria-expanded={activeColorPicker === 'am'}
                          aria-label={colorAM ? `Cambiar color de la ficha, actual ${colorAM}` : 'Elegir color de la ficha, obligatorio'}
                          className={`relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ring-offset-2 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        !colorAM
                          ? isDarkGantt ? 'border-red-500/50 ring-offset-[#111]' : 'border-red-400/60 ring-offset-white'
                          : isDarkGantt ? 'border-white/10 ring-offset-[#111]' : 'border-gray-200 ring-offset-white'
                      }`}
                      style={{ backgroundColor: colorAM || 'transparent' }}
                          title="Elegir color de la ficha"
                    >
                      {!colorAM && (
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMmEyYTMwIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzYTNjNDIiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzNhM2M0MiI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-30" />
                        </div>
                      )}
                      <div className={`w-5 h-5 rounded-full border-2 shadow-inner mix-blend-overlay relative z-10 ${isDarkGantt ? 'border-white/40' : 'border-black/20'}`} />
                      {!colorAM && (
                        <div className={`absolute -top-2 -right-2 z-20 flex items-center justify-center rounded-full bg-white dark:bg-[#1a1a1d] shadow-sm pointer-events-none ${isDarkGantt ? 'bg-[#1a1a1d]' : 'bg-white'}`}>
                          <AlertCircle className="w-[18px] h-[18px] text-red-500" />
                        </div>
                      )}
                    </button>

                    <FloatingDropdown
                      open={activeColorPicker === 'am'}
                      anchorRef={colorButtonRefAM}
                      onClose={() => setActiveColorPicker(null)}
                      width={224}
                      maxHeight={330}
                      align="end"
                      ariaLabel="Selector de color"
                      className={`rounded-2xl border p-3 shadow-2xl ${isDarkGantt ? 'border-slate-700/70 bg-[#1e1e24]' : 'border-slate-200 bg-white'}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs font-semibold ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>Color *</span>
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
                    </FloatingDropdown>
                  </div>
                    </div>
                  </div>

                  <div className={`task-disclosure ${requiresQuote ? 'is-open' : ''}`} aria-hidden={!requiresQuote}>
                    <div>
                    <div className="pt-4">
                      <label className={`mb-2 block text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                        Cotización
                      </label>
                      <CotizacionAutocomplete
                        key={`${event?.rowId ?? 'new'}-${activityType}`}
                        value={cotizacionCode}
                        onChange={(value) => {
                          setCotizacionCode(value);
                          setCliente('');
                          setCodCliente('');
                          setSelectedPlantaCode('');
                          setDescription('');
                        }}
                        onSelect={handleCotizacionSelect}
                        placeholder="Buscar cotizacion"
                        isDarkGantt={isDarkGantt}
                      />
                    </div>
                    </div>
                  </div>

                  <div className={`task-disclosure ${requiresPlantAssistance ? 'is-open' : ''}`} aria-hidden={!requiresPlantAssistance}>
                    <div>
                    <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                          Cliente <span className={isDarkGantt ? 'text-red-300' : 'text-red-600'}>*</span>
                        </label>
                      <ClienteAutocomplete
                        value={cliente}
                        onChange={handleClienteInputChange}
                        onSelect={handleClienteSelect}
                        isDarkGantt={isDarkGantt}
                      />
                      </div>
                      <div>
                        <label className={`mb-2 block text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                          Planta <span className={`font-normal ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>(opcional)</span>
                        </label>
                      <PlantaSelect
                        value={selectedPlantaCode}
                        onChange={handlePlantaChange}
                        plantas={plantas}
                        clienteLabel={cliente}
                        isLoading={isLoadingPlantas}
                        disabled={!codCliente}
                        isDarkGantt={isDarkGantt}
                      />
                      </div>
                    </div>
                    </div>
                  </div>

                  <TaskDescriptionField ref={descriptionFieldRef} isDarkGantt={isDarkGantt} />
                </div>
              </section>

              <aside className={`border-t px-4 py-5 sm:px-6 sm:py-6 lg:border-l lg:border-t-0 ${
                isDarkGantt ? 'border-white/10 bg-black/10' : 'border-slate-500/20 bg-slate-200/45'
              }`} aria-labelledby="task-schedule-heading">
                <div>
                  <h3 id="task-schedule-heading" className={`text-sm font-semibold ${isDarkGantt ? 'text-slate-100' : 'text-slate-900'}`}>
                    Agenda y recursos
                  </h3>
                  <p className={`mt-0.5 text-xs ${isDarkGantt ? 'text-slate-400' : 'text-slate-500'}`}>
                    Ajusta el horario y las asignaciones necesarias.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${isDarkGantt ? 'text-blue-300' : 'text-blue-600'}`} />
                      <span className={`text-xs font-semibold ${isDarkGantt ? 'text-slate-300' : 'text-slate-700'}`}>
                        Horario
                      </span>
                      {isJornadaFull && (
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDarkGantt ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700'}`}>
                          Jornada completa
                        </span>
                      )}
                    </div>

                    <div className={`grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border ${
                      isDarkGantt ? 'border-white/10 bg-black/20' : 'border-slate-500/20 bg-slate-100/65'
                    }`}>
                      <div className="min-w-0 px-3 py-1.5">
                        <span className={`block text-[10px] font-medium ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>Desde</span>
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
                      <span className={`h-7 w-px ${isDarkGantt ? 'bg-white/10' : 'bg-slate-200'}`} />
                      <div className="min-w-0 px-3 py-1.5">
                        <span className={`block text-[10px] font-medium ${isDarkGantt ? 'text-slate-500' : 'text-slate-500'}`}>Hasta</span>
                        <TimeSelect value={horaFin} slots={horaFinSlots} isDarkGantt={isDarkGantt} onChange={setHoraFin} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAvailability(previous => !previous)}
                      aria-expanded={showAvailability}
                      className={`mt-2 flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        isDarkGantt ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        {showAvailability ? 'Ocultar disponibilidad' : 'Ver disponibilidad del día'}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-100 ${showAvailability ? 'rotate-180' : ''}`} />
                    </button>

                    <div className={`task-disclosure ${showAvailability ? 'is-open' : ''}`} aria-hidden={!showAvailability}>
                      <div>
                        <div className="space-y-2 px-1 pb-1 pt-2">
                          <TimelineBar
                            occupiedBlocks={occupiedBlocks}
                            horaInicio={horaInicio}
                            horaFin={horaFin}
                            isDarkGantt={isDarkGantt}
                            jInicio={userJInicio}
                            jFin={userJFin}
                          />
                          {!isJornadaFull && occupiedBlocks.length > 0 && (
                            <p className={`text-[11px] ${isDarkGantt ? 'text-slate-400' : 'text-slate-600'}`}>
                              Próximo tramo libre: <span className={`font-semibold tabular-nums ${isDarkGantt ? 'text-blue-300' : 'text-blue-700'}`}>{suggestedStart}–{userJFin}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`h-px ${isDarkGantt ? 'bg-white/10' : 'bg-slate-200'}`} />

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAssignments(previous => !previous)}
                      aria-expanded={showAssignments}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        isDarkGantt ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          assignmentCount > 0
                            ? isDarkGantt ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                            : isDarkGantt ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-200/70 text-slate-600'
                        }`}>
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-xs font-semibold ${isDarkGantt ? 'text-slate-200' : 'text-slate-800'}`}>Asignaciones</span>
                          <span className={`block truncate text-[11px] ${isDarkGantt ? 'text-slate-400' : 'text-slate-500'}`}>
                            {assignmentCount === 0
                              ? 'Sin vehículo ni personal adicional'
                              : `${selectedVehicleName || 'Sin vehículo'}${additionalResources.length ? ` · ${additionalResources.length} persona${additionalResources.length === 1 ? '' : 's'}` : ''}`}
                          </span>
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-100 ${showAssignments ? 'rotate-180' : ''}`} />
                    </button>

                    <div className={`task-disclosure ${showAssignments ? 'is-open' : ''}`} aria-hidden={!showAssignments}>
                      <div>
                        <div className="space-y-2 pb-1 pt-2">
                          <VehiclePicker
                            vehicles={vehiculos}
                            isDarkGantt={isDarkGantt}
                            isOpen={showVehicles}
                            selectedVehicle={selectedVehicle}
                            availability={vehicleAvailability}
                            onToggleOpen={() => setShowVehicles(previous => !previous)}
                            onSelectVehicle={(vehicleId) => {
                              if (vehicleId) {
                                const status = vehicleAvailability[vehicleId];
                                if (status && !status.available) {
                                  const vehicleName = vehiculos.find(vehicle => vehicle.id === vehicleId)?.nombre || 'Este vehículo';
                                  toast.error(`${vehicleName} no está disponible en este horario.`, {
                                    description: `Ya está asignado a “${status.conflict.label}” de ${status.conflict.start} a ${status.conflict.end}.`,
                                    duration: 5000,
                                  });
                                  return;
                                }
                              }
                              setSelectedVehicle(vehicleId);
                              setShowVehicles(false);
                            }}
                          />
                          <AdditionalResourcesPicker
                            grupos={grupos}
                            isDarkGantt={isDarkGantt}
                            isOpen={showAdditionalUsers}
                            selectedResources={additionalResources}
                            onToggleOpen={() => setShowAdditionalUsers(previous => !previous)}
                            onToggleResource={toggleAdditionalTecnico}
                            onSelectArea={selectAllArea}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {event && (event.author || event.timestampUpdated) && (
                    <div className={`flex items-start gap-2 pt-1 text-[11px] leading-4 ${isDarkGantt ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        {event.author && <>Última edición por <span className={isDarkGantt ? 'text-slate-200' : 'text-slate-700'}>{event.author}</span></>}
                        {event.author && event.timestampUpdated && <span aria-hidden="true"> · </span>}
                        {event.timestampUpdated && <span>{event.timestampUpdated}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>

          <footer className={`flex shrink-0 items-center gap-2 border-t px-4 py-3 sm:px-6 ${
            isDarkGantt ? 'border-white/10 bg-[#1a1a1f]/95' : 'border-slate-500/20 bg-slate-200/75'
          }`}>
            {event && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isClosing}
                className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50 ${
                  isDarkGantt ? 'text-red-300 hover:bg-red-500/15' : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => requestClose()}
                disabled={isSubmitting || isClosing}
                className={`min-h-11 rounded-xl px-3.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 ${
                  isDarkGantt ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isClosing}
                className="flex min-h-11 min-w-[116px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(37,99,235,0.9)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-primary-500 hover:shadow-[0_12px_28px_-12px_rgba(37,99,235,0.95)] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Guardando' : event ? 'Guardar cambios' : 'Crear tarea'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
