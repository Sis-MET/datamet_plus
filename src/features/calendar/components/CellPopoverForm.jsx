import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Loader2, Trash2, X } from 'lucide-react';
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

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

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

const ACTIVITY_OPTIONS = [
  'Servicio',
  'Visita',
  'Compensacion',
  'Permiso - Personal',
  'Permiso - Vacacion',
];

const QUOTE_ACTIVITY_TYPES = new Set(['Servicio']);

const normalizeArea = (area) => {
  return area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
};

const normalizeActivity = (value) => normalizeArea(value || '');

const parseActivityValue = (value) => {
  const rawValue = (value || '').trim();
  if (!rawValue) return { activityType: '', quoteCode: '' };

  const matchedOption = ACTIVITY_OPTIONS.find(
    option => normalizeActivity(option) === normalizeActivity(rawValue)
  );

  if (matchedOption) return { activityType: matchedOption, quoteCode: '' };

  const combinedMatch = rawValue.match(/^(.+?)\s*-\s*([0-9]+\.COT[0-9]+)$/i);
  if (combinedMatch) {
    const [, rawActivity, rawQuoteCode] = combinedMatch;
    const matchedActivity = ACTIVITY_OPTIONS.find(
      option => normalizeActivity(option) === normalizeActivity(rawActivity)
    );

    if (matchedActivity) {
      return {
        activityType: matchedActivity,
        quoteCode: rawQuoteCode.toUpperCase(),
      };
    }
  }

  return { activityType: '', quoteCode: '' };
};

const buildActivityValue = (activityType, quoteCode) => {
  const activity = activityType.trim().toUpperCase();
  const quote = quoteCode.trim().toUpperCase();

  if (QUOTE_ACTIVITY_TYPES.has(activityType) && quote) {
    return `${activity} - ${quote}`;
  }

  return activity;
};

const getPlantParts = (planta) => {
  const rawDir = (planta?.dir || '').trim();
  let address = rawDir;
  let department = (planta?.dep || planta?.localidad || '').trim();

  if (rawDir.includes('-')) {
    const parts = rawDir
      .split('-')
      .map(part => part.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      if (!department) {
        department = parts[parts.length - 1];
      }
      address = parts.slice(0, -1).join(' - ').trim();
    }
  }

  return {
    address,
    department,
  };
};

const getPlantDepartment = (planta) => getPlantParts(planta).department;

const getPlantOptionLabel = (planta, clienteLabel = '') => {
  const clientName = (clienteLabel || '').trim();
  const department = getPlantDepartment(planta);
  const pieces = [clientName, department].filter(Boolean);
  if (pieces.length > 0) return pieces.join(' - ');
  if (department) return department;
  return planta?.codigo_planta || '';
};

function ActivitySelect({ value, onChange, options, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

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
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`w-full h-[45px] flex items-center justify-between gap-2 border rounded-xl px-4 text-sm font-semibold shadow-inner transition-all focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 ${
          isDarkGantt
            ? 'bg-[#111111] border-white/5 text-gray-100'
            : 'bg-gray-50 border-gray-200 text-gray-900'
        }`}
      >
        <span className={`truncate ${value ? '' : isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>
          {value || 'Seleccionar...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          } ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-[200] top-[calc(100%+6px)] left-0 w-full rounded-xl border shadow-2xl overflow-hidden animate-fade-in ${
            isDarkGantt
              ? 'bg-[#1e1e24] border-white/10 shadow-black/80'
              : 'bg-white border-gray-200 shadow-gray-300/40'
          }`}
        >
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
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
        </div>
      )}
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
      const token = safeStorage.getItem('rimmet_token') || safeStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/api/clientes/search?q=${encodeURIComponent(text)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
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
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Buscar cliente..."
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full h-[45px] border rounded-xl px-4 pr-10 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-semibold shadow-inner',
            isDarkGantt
              ? 'bg-[#111111] border-white/5 text-gray-100 placeholder-gray-700'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-400" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className={`absolute z-[200] top-[calc(100%+6px)] left-0 w-full rounded-xl border shadow-2xl overflow-hidden animate-fade-in ${
          isDarkGantt ? 'bg-[#1e1e24] border-white/10 shadow-black/80' : 'bg-white border-gray-200 shadow-gray-300/40'
        }`}>
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
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
        </div>
      )}
    </div>
  );
}

function PlantaSelect({ value, onChange, plantas, clienteLabel, isLoading, disabled, isDarkGantt }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedPlanta = plantas.find(planta => planta.codigo_planta === value) || null;

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

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const placeholder = isLoading
    ? 'Cargando plantas...'
    : disabled
      ? 'Selecciona un cliente primero...'
      : 'Seleccionar planta...';

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          if (!disabled && !isLoading && plantas.length > 0) {
            setOpen(current => !current);
          }
        }}
        disabled={disabled}
        className={cn(
          'w-full h-[45px] flex items-center justify-between gap-2 border rounded-xl px-4 text-sm font-semibold shadow-inner transition-all focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
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
                ? 'text-gray-600'
                : 'text-gray-400'
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
              open ? 'rotate-180' : '',
              isDarkGantt ? 'text-gray-500' : 'text-gray-400'
            )}
          />
        )}
      </button>

      {open && plantas.length > 0 && (
        <div
          className={cn(
            'absolute z-[200] top-[calc(100%+6px)] left-0 w-full rounded-xl border shadow-2xl overflow-hidden animate-fade-in',
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
        </div>
      )}
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
  const requiresQuote = QUOTE_ACTIVITY_TYPES.has(activityType);
  const requiresPlantAssistance = activityType === 'Visita' || (activityType === 'Servicio' && !cotizacionCode.trim());
  const selectedPlanta = useMemo(
    () => plantas.find(planta => planta.codigo_planta === selectedPlantaCode) || null,
    [plantas, selectedPlantaCode]
  );

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
    if (!codCliente) {
      setPlantas([]);
      setSelectedPlantaCode('');
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
        const token = safeStorage.getItem('rimmet_token') || '';
        const res = await fetch(`${API_URL}/api/clientes/${encodeURIComponent(codCliente)}/plantas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
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
    if (selectedPlantaCode || !descripcion.trim() || plantas.length === 0) return;

    const normalizedDescription = descripcion.trim();
    const matchedByDescription = plantas.find((planta) => {
      const rawDir = (planta.dir || '').trim();
      const plantAddress = getPlantParts(planta).address;
      return rawDir === normalizedDescription || plantAddress === normalizedDescription;
    });
    if (matchedByDescription) {
      setSelectedPlantaCode(matchedByDescription.codigo_planta);
    }
  }, [descripcion, plantas, requiresPlantAssistance, selectedPlantaCode]);

  useEffect(() => {
    if (!isOpen) return;
    if (lastInitializationKeyRef.current === initializationKey) return;

    lastInitializationKeyRef.current = initializationKey;

    const blocks = buildOccupiedBlocks(existingTasks, event?.rowId, userJInicio);

    if (event) {
      const parsedActivity = parseActivityValue(event.morning || event.cotizacion || '');
      setActivityType(parsedActivity.activityType);
      setCotizacionCode(parsedActivity.quoteCode);
      setCliente(event.cliente || '');
      setCodCliente(event.cod_cliente || '');
      setSelectedPlantaCode('');
      setDescripcion(event.descripcion || '');
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

  const handleActivityChange = (value) => {
    if (value !== activityType) {
      setCotizacionCode('');
      setCliente('');
      setCodCliente('');
      setPlantas([]);
      setSelectedPlantaCode('');
      setDescripcion('');
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
    setDescripcion('');
  };

  const handleClienteSelect = (item) => {
    setCliente((item.cliente || '').trim());
    setCodCliente(item.codigo_cliente ? String(item.codigo_cliente).trim() : '');
    setDescripcion('');
    setSelectedPlantaCode('');
  };

  const handlePlantaChange = (codigoPlanta) => {
    setSelectedPlantaCode(codigoPlanta);
    const selected = plantas.find(planta => planta.codigo_planta === codigoPlanta);
    setDescripcion(selected ? getPlantParts(selected).address : '');
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

    if (!activityType) {
      toast.error('Debe seleccionar una actividad.');
      return;
    }

    if (requiresPlantAssistance && (!cliente.trim() || !codCliente.trim())) {
      toast.error(`Debe seleccionar un cliente para ${activityType.toLowerCase()}.`);
      return;
    }

    if (requiresPlantAssistance && !selectedPlantaCode) {
      toast.error(`Debe seleccionar una planta para ${activityType.toLowerCase()}.`);
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
      const activityValue = buildActivityValue(activityType, cotizacionCode);
      saveToRecent(colorAM);
      await onSave(prefilledDate, prefilledResource, {
        rowId: event ? event.rowId : null,
        cotizacion: activityValue,
        morning: activityValue,
        descripcion: descripcion.trim(),
        afternoon: '',
        colorAM,
        colorPM: colorAM,
        estadoAM,
        estadoPM: null,
        horaInicio,
        horaFin,
        cliente: cliente.trim(),
        cod_cliente: codCliente.trim(),
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
          className={`flex items-start justify-between gap-4 px-5 py-4 border-b rounded-t-2xl ${
            isDarkGantt ? 'border-gray-800 bg-[#1e1e22]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="min-w-0 flex-1 pr-1">
            <h3 className={`text-base font-semibold uppercase tracking-widest text-[11px] mb-1 ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>
              Personal: <span className="text-primary-400">{prefilledResource?.replace(/_/g, ' ')}</span>
            </h3>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-sm font-medium capitalize truncate ${isDarkGantt ? 'text-gray-400' : 'text-gray-600'}`}>
                {dateTitle}
              </p>
              <span className="shrink-0 flex items-baseline gap-1.5">
                <span className={`text-[8px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>
                  Registro
                </span>
                <span className={`text-[12px] font-mono font-extrabold tracking-tight ${
                  event?.codigoRegistro
                    ? isDarkGantt ? 'text-blue-200' : 'text-blue-700'
                    : isDarkGantt ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {event?.codigoRegistro || (event ? 'Sin codigo' : 'Pendiente')}
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
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
                    Tarea
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActivityType('');
                      setCotizacionCode('');
                      setCliente('');
                      setCodCliente('');
                      setPlantas([]);
                      setSelectedPlantaCode('');
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

                <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 items-start">
                  <ActivitySelect
                    value={activityType}
                    onChange={handleActivityChange}
                    options={ACTIVITY_OPTIONS}
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

                  {requiresQuote && (
                    <div className="col-span-full">
                      <CotizacionAutocomplete
                        key={`${event?.rowId ?? 'new'}-${activityType}`}
                        value={cotizacionCode}
                        onChange={(value) => {
                          setCotizacionCode(value);
                          setCliente('');
                          setCodCliente('');
                          setSelectedPlantaCode('');
                          setDescripcion('');
                        }}
                        onDescripcionChange={setDescripcion}
                        onSelect={handleCotizacionSelect}
                        placeholder="Buscar cotizacion"
                        isDarkGantt={isDarkGantt}
                      />
                    </div>
                  )}

                  {requiresPlantAssistance && (
                    <div className="col-span-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                      <ClienteAutocomplete
                        value={cliente}
                        onChange={handleClienteInputChange}
                        onSelect={handleClienteSelect}
                        isDarkGantt={isDarkGantt}
                      />
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
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2 items-end">
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
              <div
                className={cn(
                  'h-[45px] rounded-xl border px-3 py-2 flex flex-col justify-center text-right shadow-inner',
                  isDarkGantt
                    ? 'bg-[#111111] border-white/5'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <span className={cn(
                  'text-[8px] font-bold uppercase tracking-widest',
                  isDarkGantt ? 'text-gray-600' : 'text-gray-400'
                )}>
                  Cod. Cliente
                </span>
                <span className={cn(
                  'text-xs font-mono font-bold leading-tight',
                  isDarkGantt ? 'text-blue-300' : 'text-blue-700'
                )}>
                  {selectedPlantaCode || '--'}
                </span>
              </div>
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
