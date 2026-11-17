import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';
import { exitDelay } from '../../../shared/utils/motion';
import { api } from '../../../shared/api/client';
import { CotizacionAutocomplete } from './CotizacionAutocomplete';
import { ActivitySelect } from './taskForm/ActivitySelect';
import { ClienteAutocomplete } from './taskForm/ClienteAutocomplete';
import { FieldLabel } from './taskForm/FieldLabel';
import { PlantaSelect } from './taskForm/PlantaSelect';
import { ServiceReferenceField } from './taskForm/ServiceReferenceField';
import { TaskAssignments } from './taskForm/TaskAssignments';
import { TaskColorPicker } from './taskForm/TaskColorPicker';
import { TaskDescriptionField } from './taskForm/TaskDescriptionField';
import { TaskScheduleFields } from './taskForm/TaskScheduleFields';
import { useRecentColors } from '../hooks/useRecentColors';
import { useTaskTimeSlots } from '../hooks/useTaskTimeSlots';
import { useVehicleAvailability } from '../hooks/useVehicleAvailability';
import { isVehicleResource } from '../domain/vehicleAvailability';
import {
  ACTIVITY_OPTIONS,
  NO_CLIENT_ACTIVITY_TYPES,
  QUOTE_ACTIVITY_TYPES,
  buildTaskPayload,
  getClientCodeFromPlantCode,
  getPlantParts,
  isPlantCode,
  normalizeArea,
  parseActivityValue,
  requiresServiceReference,
  validateTaskDraft,
} from '../domain/taskFormDomain';
import {
  TIME_SLOTS,
  buildOccupiedBlocks,
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

const NO_LINKED_TASKS = Object.freeze([]);

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
  linkedTasks = NO_LINKED_TASKS,
}) {
  usePageScrollLock(isOpen);
  const [activityType, setActivityType] = useState('');
  const [cotizacionCode, setCotizacionCode] = useState('');
  // Cotización, SECA u OTST del servicio al que va la salida (columna cotizacion).
  const [serviceReference, setServiceReference] = useState('');
  const [cliente, setCliente] = useState('');
  const [codCliente, setCodCliente] = useState('');
  const [plantas, setPlantas] = useState([]);
  const [selectedPlantaCode, setSelectedPlantaCode] = useState('');
  const [isLoadingPlantas, setIsLoadingPlantas] = useState(false);
  const [colorAM, setColorAM] = useState('');
  const [estadoAM, setEstadoAM] = useState('Pendiente');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [showAdditionalUsers, setShowAdditionalUsers] = useState(false);
  const [additionalResources, setAdditionalResources] = useState([]);
  const [showVehicles, setShowVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [showAssignments, setShowAssignments] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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

      if (isVehicleResource(item)) return;
      if (!map[area]) map[area] = [];
      map[area].push(item);
    });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tecnicos, prefilledResource]);

  const vehiculos = useMemo(
    () => tecnicos
      .filter(item => isVehicleResource(item) && item.id !== prefilledResource)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [tecnicos, prefilledResource]
  );

  // Las filas de esta misma ficha no cuentan como ocupación del vehículo.
  const ownRowIds = useMemo(
    () => [event?.rowId, ...linkedTasks.map(task => task.rowId)].filter(Boolean),
    [event?.rowId, linkedTasks]
  );

  const vehicleAvailability = useVehicleAvailability({
    vehicles: vehiculos,
    date: prefilledDate,
    start: horaInicio,
    end: horaFin,
    ignoredRowIds: ownRowIds,
    getTasksForResource,
  });

  const selectedVehicleConflict = selectedVehicle
    ? vehicleAvailability[selectedVehicle]?.conflict || null
    : null;

  const {
    occupiedBlocks,
    suggestedStart,
    isJornadaFull,
    horaInicioSlots,
    horaFinSlots,
  } = useTaskTimeSlots({ existingTasks, rowId: event?.rowId, jornadaInicio: userJInicio, jornadaFin: userJFin, horaInicio });

  const dateTitle = (() => {
    if (!prefilledDate) return '';
    const formattedDate = format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es });
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  })();

  const [recentColors, saveToRecent] = useRecentColors();

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
      // Con el buscador de cotizaciones apagado, la columna guarda la referencia
      // del servicio: no debe ocultar el cliente como lo haría una cotización.
      setCotizacionCode(QUOTES_ENABLED ? parsedActivity.quoteCode : '');
      setServiceReference(QUOTES_ENABLED ? '' : String(event.cotizacion || '').trim());
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
      setServiceReference('');
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

    // Al editar se muestran las personas y el vehículo que ya son parte de la ficha.
    const isVehicleRow = (task) => isVehicleResource(tecnicos.find(item => item.id === task.Tecnico));
    const linkedOthers = event ? linkedTasks.filter(task => task.Tecnico !== prefilledResource) : [];
    setIsColorPickerOpen(false);
    setAdditionalResources([...new Set(linkedOthers.filter(task => !isVehicleRow(task)).map(task => task.Tecnico))]);
    setSelectedVehicle(linkedOthers.find(isVehicleRow)?.Tecnico || '');
    setShowVehicles(false);
    setShowAdditionalUsers(false);
    setShowAssignments(false);
    setShowAvailability(false);
  }, [event, existingTasks, initializationKey, isOpen, linkedTasks, prefilledResource, setDescription, tecnicos, userJFin, userJInicio]);

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
    closeTimerRef.current = setTimeout(() => onClose(), exitDelay());
  }, [isClosing, isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, requestClose]);

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

  const handleHoraInicioChange = (newInicio) => {
    setHoraInicio(newInicio);
    if (timeToMinutes(horaFin) <= timeToMinutes(newInicio)) {
      const nextSlot = TIME_SLOTS.find(time => timeToMinutes(time) > timeToMinutes(newInicio));
      if (nextSlot) setHoraFin(nextSlot);
    }
  };

  const handleVehicleSelect = (vehicleId) => {
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
        serviceReference,
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
                      setServiceReference('');
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
                    <TaskColorPicker
                      value={colorAM}
                      onChange={setColorAM}
                      isOpen={isColorPickerOpen}
                      onOpenChange={setIsColorPickerOpen}
                      recentColors={recentColors}
                    />
                  </div>
                </div>

                {requiresServiceReference(activityType) && (
                  <ServiceReferenceField value={serviceReference} onChange={setServiceReference} />
                )}

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
                  <TaskScheduleFields
                    horaInicio={horaInicio}
                    horaFin={horaFin}
                    horaInicioSlots={horaInicioSlots}
                    horaFinSlots={horaFinSlots}
                    onHoraInicioChange={handleHoraInicioChange}
                    onHoraFinChange={setHoraFin}
                    isJornadaFull={isJornadaFull}
                    occupiedBlocks={occupiedBlocks}
                    suggestedStart={suggestedStart}
                    jornadaInicio={userJInicio}
                    jornadaFin={userJFin}
                    showAvailability={showAvailability}
                    onToggleAvailability={() => setShowAvailability(previous => !previous)}
                  />

                  <div className="h-px bg-line" />

                  <TaskAssignments
                    isOpen={showAssignments}
                    onToggleOpen={() => setShowAssignments(previous => !previous)}
                    vehicles={vehiculos}
                    vehicleAvailability={vehicleAvailability}
                    selectedVehicle={selectedVehicle}
                    showVehicles={showVehicles}
                    onToggleVehicles={() => setShowVehicles(previous => !previous)}
                    onSelectVehicle={handleVehicleSelect}
                    grupos={grupos}
                    additionalResources={additionalResources}
                    showAdditionalUsers={showAdditionalUsers}
                    onToggleAdditionalUsers={() => setShowAdditionalUsers(previous => !previous)}
                    onToggleResource={toggleAdditionalTecnico}
                    onSelectArea={selectAllArea}
                  />

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
