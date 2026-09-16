import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, Clock, Info, Loader2, Palette, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';
import { cn } from '../../../shared/utils/cn';
import { safeStorage } from '../../../shared/utils/storage';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';
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

// Cotizaciones deshabilitadas: todavia no existen cotizaciones cargadas en el
// sistema, asi que el campo se oculta para todos los tipos de tarea. El codigo
// se conserva intacto; poner esto en true lo vuelve a mostrar tal cual estaba.
const QUOTES_ENABLED = false;

// Los selectores personalizados comparten la apariencia de `.field`; en
// pantallas angostas se usa el select nativo del sistema.
const SELECT_TRIGGER = 'field hidden h-11 cursor-pointer items-center justify-between gap-2 text-left font-medium sm:flex';
const NATIVE_SELECT = 'field h-11 cursor-pointer font-medium sm:hidden';
const MENU = 'glass rounded-xl border p-1';

function FieldLabel({ htmlFor, children, required, optional }) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(opcional)</span>}
    </label>
  );
}

const TaskDescriptionField = React.memo(React.forwardRef(function TaskDescriptionField(
  _props,
  forwardedRef
) {
  const [value, setValue] = useState('');

  React.useImperativeHandle(forwardedRef, () => ({
    getValue: () => value,
    setValue: (nextValue) => setValue(String(nextValue || '')),
  }), [value]);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="task-description" required>Descripción</FieldLabel>
        <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">
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
        className="field min-h-[112px] resize-y py-3 leading-relaxed"
      />
    </div>
  );
}));

TaskDescriptionField.displayName = 'TaskDescriptionField';


function ActivitySelect({ value, onChange, options }) {
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
        className={NATIVE_SELECT}
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
        className={SELECT_TRIGGER}
      >
        <span className={cn('truncate', !value && 'font-normal text-fg-subtle')}>
          {value || 'Seleccionar...'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <FloatingDropdown
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={220}
        ariaLabel="Tipos de tarea"
        className={MENU}
      >
          <div role="listbox" className="max-h-52 overflow-y-auto">
            {options.map(option => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                data-selected={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="menu-item"
              >
                {option}
              </button>
            ))}
          </div>
      </FloatingDropdown>
    </div>
  );
}

function ClienteAutocomplete({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  // Secuencia de peticiones: solo la ultima en salir puede tocar el estado.
  const requestIdRef = useRef(0);

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

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    // Invalida cualquier respuesta que llegue despues de desmontar.
    requestIdRef.current += 1;
  }, []);

  const searchClientes = async (text) => {
    const requestId = ++requestIdRef.current;

    if (text.length < 1) {
      setResults([]);
      setOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.get('/clientes/search', { q: text });
      if (requestId !== requestIdRef.current) return;
      const items = data.success ? data.data || [] : [];
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setOpen(false);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
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
          id="task-client"
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
          className="field h-11 pr-10 font-medium"
        />
        {isLoading && (
          /* El centrado va por margen y no por -translate-y-1/2: `animate-spin`
             reemplaza el transform completo y el icono se descolgaba hacia abajo. */
          <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 -mt-2 h-4 w-4 animate-spin text-fg-subtle" />
        )}
      </div>

      <FloatingDropdown
        open={open && results.length > 0}
        anchorRef={inputRef}
        onClose={() => setOpen(false)}
        maxHeight={220}
        ariaLabel="Resultados de clientes"
        className={MENU}
      >
          <div role="listbox" className="max-h-52 overflow-y-auto">
            {results.map(item => (
              <button
                key={item.codigo_cliente || item.cliente}
                type="button"
                role="option"
                onClick={() => handleSelect(item)}
                className="menu-item flex-col items-start gap-0.5"
              >
                <span className="block w-full truncate text-[13px] font-medium">{item.cliente}</span>
                {item.codigo_cliente && (
                  <span className="block font-mono text-[11px] text-fg-subtle">
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

function PlantaSelect({ value, onChange, plantas, clienteLabel, isLoading, disabled }) {
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
        className={NATIVE_SELECT}
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
        className={SELECT_TRIGGER}
      >
        <span className={cn('truncate', !selectedPlanta && 'font-normal text-fg-subtle')}>
          {selectedPlanta ? getPlantOptionLabel(selectedPlanta, clienteLabel) : placeholder}
        </span>
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fg-subtle" />
        ) : (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150', isDropdownOpen && 'rotate-180')} />
        )}
      </button>

      <FloatingDropdown
        open={isDropdownOpen && plantas.length > 0}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        maxHeight={250}
        ariaLabel="Plantas disponibles"
        className={MENU}
      >
          <div role="listbox" className="max-h-60 overflow-y-auto">
            {plantas.map(planta => {
              const plantaLabel = getPlantOptionLabel(planta, clienteLabel);
              const isSelected = planta.codigo_planta === value;

              return (
                <button
                  key={planta.codigo_planta}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => {
                    onChange(planta.codigo_planta);
                    setOpen(false);
                  }}
                  className="menu-item flex-col items-start gap-0.5"
                >
                  <span className="block w-full truncate text-[13px]">{plantaLabel}</span>
                  {planta.codigo_planta && (
                    <span className="block font-mono text-[11px] font-normal text-fg-subtle">
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
  usePageScrollLock(isOpen);
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
  const requiresQuote = QUOTES_ENABLED && QUOTE_ACTIVITY_TYPES.has(activityType);
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
  const swatchClass = 'h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-150 hover:scale-110';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
      data-state={isClosing ? 'closing' : 'open'}
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) requestClose();
      }}
      className="task-dialog-backdrop scrim fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <div
        data-state={isClosing ? 'closing' : 'open'}
        className="task-dialog-panel flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[22px] border border-line bg-surface shadow-dialog sm:max-h-[90dvh] sm:rounded-[22px]"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="task-form-title" className="text-lg font-semibold tracking-[-0.01em] text-fg">
              {event ? 'Editar tarea' : 'Nueva tarea'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-fg-muted">
              <span className="font-medium text-fg">{tecnico?.nombre || prefilledResource?.replace(/_/g, ' ')}</span>
              <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
              <span>{dateTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestClose()}
            aria-label="Cerrar ficha de tarea"
            disabled={isSubmitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <section className="px-5 py-6 sm:px-6 lg:pr-7" aria-labelledby="task-details-heading">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h3 id="task-details-heading" className="text-sm font-semibold text-fg">
                      Datos de la tarea
                    </h3>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
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
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Limpiar campos"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpiar
                  </button>
                </div>

                <div>
                  <FieldLabel required>Tipo de tarea</FieldLabel>
                  <div className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2">
                    <ActivitySelect
                      value={activityType}
                      onChange={handleActivityChange}
                      options={ACTIVITY_OPTIONS}
                    />
                    <div className="relative shrink-0" ref={colorPickerRefAM}>
                      <button
                        ref={colorButtonRefAM}
                        type="button"
                        onClick={() => setActiveColorPicker(activeColorPicker === 'am' ? null : 'am')}
                        aria-haspopup="dialog"
                        aria-expanded={activeColorPicker === 'am'}
                        aria-label={colorAM ? `Cambiar color de la ficha, actual ${colorAM}` : 'Elegir color de la ficha, obligatorio'}
                        title="Elegir color de la ficha"
                        className={cn(
                          'relative flex h-11 w-11 items-center justify-center rounded-xl border transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px',
                          colorAM
                            ? 'border-black/10 shadow-xs'
                            : 'border-dashed border-danger/60 bg-surface text-fg-subtle hover:border-danger'
                        )}
                        style={{ backgroundColor: colorAM || undefined }}
                      >
                        {colorAM ? (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/80 shadow-xs" aria-hidden="true" />
                        ) : (
                          <>
                            <Palette className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden="true" />
                          </>
                        )}
                      </button>

                      <FloatingDropdown
                        open={activeColorPicker === 'am'}
                        anchorRef={colorButtonRefAM}
                        onClose={() => setActiveColorPicker(null)}
                        width={232}
                        maxHeight={340}
                        align="end"
                        ariaLabel="Selector de color"
                        className="glass rounded-2xl border p-3"
                      >
                          <div className="mb-2.5 flex items-center justify-between">
                            <span className="text-[13px] font-medium text-fg">Color de la ficha</span>
                            <button
                              type="button"
                              onClick={() => setActiveColorPicker(null)}
                              aria-label="Cerrar selector de color"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <HexColorPicker
                            color={colorAM || PRESET_COLORS[1]}
                            onChange={setColorAM}
                            style={{ width: '100%', height: '124px' }}
                          />

                          <div className="mt-3">
                            <span className="mb-2 block text-[11px] font-medium text-fg-subtle">Predefinidos</span>
                            <div className="flex flex-wrap gap-2">
                              {PRESET_COLORS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setColorAM(color)}
                                  aria-label={`Usar color ${color}`}
                                  className={cn(swatchClass, colorAM === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          {recentColors.length > 0 && (
                            <div className="mt-3 border-t border-line pt-3">
                              <span className="mb-2 block text-[11px] font-medium text-fg-subtle">Recientes</span>
                              <div className="flex flex-wrap gap-2">
                                {recentColors.map((color, index) => (
                                  <button
                                    key={`recent-${color}-${index}`}
                                    type="button"
                                    onClick={() => setColorAM(color)}
                                    aria-label={`Usar color ${color}`}
                                    className={cn(swatchClass, colorAM === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')}
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

                {QUOTES_ENABLED && (
                <div className={`task-disclosure ${requiresQuote ? 'is-open' : ''}`} aria-hidden={!requiresQuote}>
                  <div>
                  <div className="pt-5">
                    <FieldLabel>Cotización</FieldLabel>
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
                    />
                  </div>
                  </div>
                </div>
                )}

                <div className={`task-disclosure ${requiresPlantAssistance ? 'is-open' : ''}`} aria-hidden={!requiresPlantAssistance}>
                  <div>
                  <div className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="task-client" required>Cliente</FieldLabel>
                      <ClienteAutocomplete
                        value={cliente}
                        onChange={handleClienteInputChange}
                        onSelect={handleClienteSelect}
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Planta</FieldLabel>
                      <PlantaSelect
                        value={selectedPlantaCode}
                        onChange={handlePlantaChange}
                        plantas={plantas}
                        clienteLabel={cliente}
                        isLoading={isLoadingPlantas}
                        disabled={!codCliente}
                      />
                    </div>
                  </div>
                  </div>
                </div>

                <TaskDescriptionField ref={descriptionFieldRef} />
              </section>

              <aside className="border-t border-line bg-surface-2/50 px-5 py-6 sm:px-6 lg:border-l lg:border-t-0" aria-labelledby="task-schedule-heading">
                <div>
                  <h3 id="task-schedule-heading" className="text-sm font-semibold text-fg">
                    Agenda y recursos
                  </h3>
                  <p className="mt-0.5 text-[13px] text-fg-muted">
                    Ajusta el horario y las asignaciones necesarias.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-fg-muted" />
                      <span className="text-[13px] font-medium text-fg">
                        Horario
                      </span>
                      {isJornadaFull && (
                        <span className="ml-auto rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                          Jornada completa
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-line-strong bg-surface shadow-xs">
                      <div className="min-w-0 px-3.5 py-1.5">
                        <span className="block text-[11px] text-fg-subtle">Desde</span>
                        <TimeSelect
                          value={horaInicio}
                          slots={horaInicioSlots}
                          onChange={(newInicio) => {
                            setHoraInicio(newInicio);
                            if (timeToMinutes(horaFin) <= timeToMinutes(newInicio)) {
                              const nextSlot = TIME_SLOTS.find(time => timeToMinutes(time) > timeToMinutes(newInicio));
                              if (nextSlot) setHoraFin(nextSlot);
                            }
                          }}
                        />
                      </div>
                      <span className="h-8 w-px bg-line" />
                      <div className="min-w-0 px-3.5 py-1.5">
                        <span className="block text-[11px] text-fg-subtle">Hasta</span>
                        <TimeSelect value={horaFin} slots={horaFinSlots} onChange={setHoraFin} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAvailability(previous => !previous)}
                      aria-expanded={showAvailability}
                      className="mt-2 flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/[0.05] hover:text-fg"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        {showAvailability ? 'Ocultar disponibilidad' : 'Ver disponibilidad del día'}
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', showAvailability && 'rotate-180')} />
                    </button>

                    <div className={`task-disclosure ${showAvailability ? 'is-open' : ''}`} aria-hidden={!showAvailability}>
                      <div>
                        <div className="space-y-2 px-1 pb-1 pt-2">
                          <TimelineBar
                            occupiedBlocks={occupiedBlocks}
                            horaInicio={horaInicio}
                            horaFin={horaFin}
                            jInicio={userJInicio}
                            jFin={userJFin}
                          />
                          {!isJornadaFull && occupiedBlocks.length > 0 && (
                            <p className="text-xs text-fg-muted">
                              Próximo tramo libre: <span className="font-semibold tabular-nums text-fg">{suggestedStart}–{userJFin}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-line" />

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAssignments(previous => !previous)}
                      aria-expanded={showAssignments}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-fg/[0.05]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          assignmentCount > 0 ? 'border-fg bg-fg text-canvas' : 'border-line bg-surface text-fg-muted'
                        )}>
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-fg">Asignaciones</span>
                          <span className="block truncate text-xs text-fg-muted">
                            {assignmentCount === 0
                              ? 'Sin vehículo ni personal adicional'
                              : `${selectedVehicleName || 'Sin vehículo'}${additionalResources.length ? ` · ${additionalResources.length} persona${additionalResources.length === 1 ? '' : 's'}` : ''}`}
                          </span>
                        </span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-muted transition-transform duration-150', showAssignments && 'rotate-180')} />
                    </button>

                    <div className={`task-disclosure ${showAssignments ? 'is-open' : ''}`} aria-hidden={!showAssignments}>
                      <div>
                        <div className="space-y-2 pb-1 pt-2">
                          <VehiclePicker
                            vehicles={vehiculos}
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
                    <div className="flex items-start gap-2 pt-1 text-xs leading-4 text-fg-muted">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        {event.author && <>Última edición por <span className="font-medium text-fg">{event.author}</span></>}
                        {event.author && event.timestampUpdated && <span aria-hidden="true"> · </span>}
                        {event.timestampUpdated && <span>{event.timestampUpdated}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>

          <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-5 py-3 sm:px-6">
            {event && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isClosing}
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
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
                className="h-10 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isClosing}
                className="flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-[background-color,transform] duration-150 hover:bg-brand-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
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
