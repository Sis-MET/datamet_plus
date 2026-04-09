import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  CheckCircle,
  Save,
  User,
  Calendar,
  Building2,
  Loader2,
  Search,
  ChevronRight,
  ChevronLeft,
  FileText,
  ClipboardList,
  CheckSquare,
  Plus,
  Trash2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

import { InventoryItem } from './components/InventoryItem';
import { SignatureField } from './components/SignatureField';
import { ImageUpload } from './components/ImageUpload';
import { EquipoSearch } from './components/EquipoSearch';
import { generateRIMCode } from './utils/rimCode';

import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';
import { Button } from '../../shared/components/ui/Button';
import { RadioGroup } from '../../shared/components/ui/RadioGroup';
import { CheckboxWithLocation } from '../../shared/components/ui/CheckboxWithLocation';
import { TextArea } from '../../shared/components/ui/TextArea';
import { SearchableInput } from '../../shared/components/ui/SearchableInput';
import { cn } from '../../shared/utils/cn';

import { formSchema } from '../../utils/validations';
import { fileToBase64 } from '../../utils/files';
import { generatePDF } from '../../utils/pdfGenerator.jsx';
import { useTheme } from '../../shared/context/ThemeContext';

const STEPS = [
  { id: 1, title: 'Cliente y Planta', icon: Building2 },
  { id: 2, title: 'Instrumento', icon: Search },
  { id: 3, title: 'Estado Físico', icon: ClipboardList },
  { id: 4, title: 'Recepción y Entrega', icon: CheckSquare },
];

export function RimFormPage({ currentUser }) {
  const { isDarkGantt } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estado de la planta del cliente
  const [clienteId, setClienteId] = useState(null);
  const [showPlanta, setShowPlanta] = useState(false);
  const [selectedPlanta, setSelectedPlanta] = useState('');
  const [plantas, setPlantas] = useState([]);
  const [plantasLoading, setPlantasLoading] = useState(false);

  const fetchPlantas = useCallback(async (id) => {
    if (!id) return;
    setPlantasLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clientes/${id}/plantas`);
      const data = await res.json();
      if (data.success) setPlantas(data.data);
    } catch (e) {
      console.error('Error al cargar plantas:', e);
    } finally {
      setPlantasLoading(false);
    }
  }, []);

  const [technicianInfo] = useState({
    timestamp: new Date(),
  });

  // Extraer datos del usuario actual
  const userFullName = currentUser ? `${currentUser.nombre} ${currentUser.apellido}`.trim() : 'Usuario Desconocido';
  const userRole = currentUser?.cargo || 'TÉCNICO';

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    trigger,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photos: [],
      damageTypes: {},
      dirtTypes: {},
      affectedAreas: [],
      inventory: {},
    }
  });

  const { fields: otherFields, append: appendOther, remove: removeOther } = useFieldArray({
    control,
    name: 'inventory.otherItems'
  });

  // Generar código RIM de forma reactiva (en el panel izquierdo)
  const currentCliente = clienteId; // o el código si se guarda aparte. El clienteId actual es texto (ej: "0121") si viene de SearchableInput
  const currentPlantaCode = watch('planta');
  const rimCode = generateRIMCode(currentCliente, currentPlantaCode, technicianInfo.timestamp.getFullYear());

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const processedPhotos = await Promise.all(
        data.photos.map(async (file) => {
          const base64 = await fileToBase64(file);
          return { name: file.name, size: file.size, type: file.type, content: base64 };
        })
      );
      const payload = { ...data, photos: processedPhotos };
      console.log("=== FORM SUBMISSION ===", payload);

      const pdfResult = await generatePDF(data, rimCode);
      if (pdfResult.success) {
        console.log(`PDF generado exitosamente: ${pdfResult.fileName}`);
      } else {
        console.error('Error al generar PDF:', pdfResult.error);
        alert('El formulario se procesó correctamente, pero hubo un error al generar el PDF.');
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
      reset();
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      alert("Error al procesar el formulario");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    let fieldsToValidate = [];
    if (currentStep === 1) {
      fieldsToValidate = ['companyName', 'companyRazonSocial', 'taxId', 'address', 'city', 'clientName', 'clientCargo', 'phone', 'email'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['instrument', 'brand', 'model', 'serialNumber', 'maxCapacity', 'unit', 'resolution', 'workArea'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['damageLevel', 'cleanlinessLevel'];
    }

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------------------------------------------------------------------
  // RENDER SECCIONES POR PASO
  // ---------------------------------------------------------------------------
  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className="mb-6">
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">Empresa</span>
          Datos de la Empresa
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            control={control}
            name="companyName"
            render={({ field }) => (
              <SearchableInput
                label="Empresa"
                value={field.value}
                onChange={field.onChange}
                onSelect={(clienteData) => {
                  field.onChange(clienteData.cliente);
                  if (clienteData.razonsocial) setValue('companyRazonSocial', clienteData.razonsocial);
                  if (clienteData.nit) setValue('taxId', String(clienteData.nit));
                  if (clienteData.contacto_nombre) setValue('clientName', clienteData.contacto_nombre);
                  if (clienteData.contacto_cargo) setValue('clientCargo', clienteData.contacto_cargo);
                  if (clienteData.contacto_fono) setValue('phone', clienteData.contacto_fono);
                  if (clienteData.contacto_email) setValue('email', clienteData.contacto_email);

                  const newId = clienteData.codigo_cliente;
                  setClienteId(newId);
                  setShowPlanta(false);
                  setPlantas([]);
                  setValue('planta', '');
                  setSelectedPlanta('');
                }}
                error={errors.companyName}
                required
              />
            )}
          />
          <Input label="Razón Social" {...register('companyRazonSocial')} error={errors.companyRazonSocial} required />
          <Input label="NIT / RUT" {...register('taxId')} error={errors.taxId} required />
        </div>
      </div>



      <div className="mt-8">
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">Contacto</span>
          Datos del Contacto
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre de Contacto" {...register('clientName')} error={errors.clientName} required />
          <Input label="Cargo" {...register('clientCargo')} error={errors.clientCargo} required />
          <Input label="Teléfono" type="tel" {...register('phone')} error={errors.phone} required />
          <Input label="Email" type="email" {...register('email')} error={errors.email} required />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className={`border rounded-xl p-4 shadow-2xl ${isDarkGantt ? 'bg-[#0f0f11] border-gray-700/50' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary-400" />
            <div>
              <p className={`text-sm font-semibold font-medium ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>Asociar a Planta del Cliente</p>
              <p className={`text-xs font-medium ${isDarkGantt ? 'text-white/70' : 'text-gray-500'}`}>
                {clienteId ? 'Activa para filtrar equipos por planta' : 'Selecciona un cliente para habilitar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!clienteId}
            onClick={() => {
              const next = !showPlanta;
              setShowPlanta(next);
              if (next && plantas.length === 0) fetchPlantas(clienteId);
              if (!next) {
                setValue('planta', '');
                setSelectedPlanta('');
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${!clienteId ? 'opacity-40 cursor-not-allowed bg-gray-700' : showPlanta ? 'bg-primary-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showPlanta ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {showPlanta && (
          <div className={`mt-4 pt-4 border-t ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
            {plantasLoading ? (
              <div className={`flex items-center gap-2 text-sm font-medium ${isDarkGantt ? 'text-white' : 'text-gray-600'}`}>
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantas...
              </div>
            ) : plantas.length === 0 ? (
              <p className="text-sm text-yellow-500/80">Este cliente no tiene plantas registradas.</p>
            ) : (
              <div className="space-y-4">
                <Controller
                  control={control}
                  name="planta"
                  render={({ field }) => (
                    <Select
                      label="Seleccionar Planta"
                      value={field.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val);
                        setSelectedPlanta(val);
                        
                        // Auto-completar datos de la planta seleccionada
                        const plantaInfo = plantas.find(p => p.codigo_planta === val);
                        if (plantaInfo) {
                           let rawDir = plantaInfo.dir || '';
                           let dirPart = rawDir;
                           let deptPart = plantaInfo.localidad || '';
                           
                           if (rawDir.includes('-')) {
                             const parts = rawDir.split('-');
                             deptPart = parts.pop().trim();
                             dirPart = parts.join('-').trim();
                           }
                           
                           setValue('plantaDireccion', dirPart);
                           setValue('plantaDepartamento', deptPart);
                        } else {
                           setValue('plantaDireccion', '');
                           setValue('plantaDepartamento', '');
                        }
                      }}
                      error={errors.planta}
                      placeholder="Seleccione una planta..."
                      options={plantas.map(p => ({
                        value: p.codigo_planta,
                        label: `${p.codigo_planta}${p.dir ? ` - ${p.dir}` : ''}`
                      }))}
                    />
                  )}
                />
                
                {selectedPlanta && (
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border shadow-inner ${isDarkGantt ? 'bg-[#141414] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <Input label="Código Cliente y Planta" value={selectedPlanta} disabled className="opacity-80" />
                    <Input label="Departamento" {...register('plantaDepartamento')} disabled className="opacity-80" />
                    <Input label="Dirección y Nombre de la Planta" {...register('plantaDireccion')} disabled className="opacity-80 md:col-span-2" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`mb-6 p-4 shadow-2xl border rounded-xl ${isDarkGantt ? 'bg-[#0f0f11] border-primary-600/20' : 'bg-white border-primary-300'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-primary-400" />
          <p className={`text-sm font-semibold ${isDarkGantt ? 'text-primary-300' : 'text-primary-700'}`}>Buscar por Código Métrica</p>
          {selectedPlanta && (
            <span className="ml-auto text-xs bg-primary-600/20 text-primary-400 px-2 py-0.5 rounded-full border border-primary-600/30">
              Planta: {selectedPlanta}
            </span>
          )}
        </div>
        <EquipoSearch
          planta={selectedPlanta}
          clienteId={clienteId}
          onSelect={(equipo) => {
            setValue('instrument', equipo.instrumento || '');
            setValue('brand', equipo.marca || '');
            setValue('model', equipo.modelo || '');
            setValue('serialNumber', equipo.serie || '');
            setValue('maxCapacity', equipo.cap_max1 != null ? String(equipo.cap_max1) : '');
            setValue('unit', equipo.unidad || '');
            setValue('resolution', equipo.d1 != null ? String(equipo.d1) : '');
            setValue('workArea', equipo.ubicacion || '');
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Instrumento" {...register('instrument')} error={errors.instrument} required />
        <Input label="Marca" {...register('brand')} error={errors.brand} required />
        <Input label="Modelo" {...register('model')} error={errors.model} required />
        <Input label="Número de Serie" {...register('serialNumber')} error={errors.serialNumber} required />
        <Input label="Capacidad Máxima" {...register('maxCapacity')} error={errors.maxCapacity} required />
        <Input label="Unidad" {...register('unit')} error={errors.unit} required />
        <Input label="Resolución" {...register('resolution')} error={errors.resolution} required />
        <Input label="Area de Trabajo" className="md:col-span-2" {...register('workArea')} error={errors.workArea} required />
      </div>

      <div className="mt-4">
        <TextArea label="Observaciones" {...register('notes')} rows={3} />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h4 className={`text-sm font-semibold font-medium flex items-center m-0 ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
            <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.1</span>
            Inventario de Componentes
          </h4>
          <div className={`flex items-center gap-2 p-1.5 rounded-lg border shadow-inner ${isDarkGantt ? 'bg-[#1c1c21] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
            <span className={`text-xs font-medium px-2 hidden md:inline ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>Marcar todos:</span>
            {['present', 'missing', 'na'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  const keys = [
                    'indicator', 'voltageAdapter', 'powerCable', 'bracket', 'column', 
                    'weighingPan', 'windShield', 'structure', 'loadCellCable', 
                    'loadCellConnector', 'junctionBox', 'manual', 'originalPackaging',
                    'loadCells', 'feet'
                  ];
                  keys.forEach(k => setValue(`inventory.${k}`, val, { shouldValidate: true }));
                  
                  // Aplicar autocompletado también a los "otros ítems" existentes
                  otherFields.forEach((field, index) => {
                    setValue(`inventory.otherItems.${index}.status`, val, { shouldValidate: true });
                  });
                }}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors border',
                  val === 'present' ? 'bg-green-900/40 text-green-400 border-green-700/50 hover:bg-green-800/60' :
                  val === 'missing' ? 'bg-red-900/40 text-red-400 border-red-700/50 hover:bg-red-800/60' :
                  (isDarkGantt ? 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300')
                )}
              >
                {val === 'present' ? 'Presente' : val === 'missing' ? 'Faltante' : 'N/A'}
              </button>
            ))}
          </div>
        </div>
        <div className={`shadow-inner ring-1 rounded-xl p-4 border ${isDarkGantt ? 'bg-[#1c1c21] ring-white/10 border-gray-700/50' : 'bg-white ring-black/5 border-gray-200'}`}>
          <div className="grid gap-2">
            {[
              { name: 'inventory.indicator', label: 'Indicador' },
              { name: 'inventory.voltageAdapter', label: 'Adaptador de Voltaje' },
              { name: 'inventory.powerCable', label: 'Cable de Poder' },
              { name: 'inventory.bracket', label: 'Bracket' },
              { name: 'inventory.column', label: 'Columna' },
              { name: 'inventory.weighingPan', label: 'Bandeja de Pesaje' },
              { name: 'inventory.windShield', label: 'Cabina Corta Aire' },
              { name: 'inventory.structure', label: 'Estructura' },
              { name: 'inventory.loadCellCable', label: 'Cable de Celda' },
              { name: 'inventory.loadCellConnector', label: 'Conector de Celda' },
              { name: 'inventory.junctionBox', label: 'Caja Sumadora' },
              { name: 'inventory.manual', label: 'Manual' },
              { name: 'inventory.originalPackaging', label: 'Embalaje Original' },
            ].map(({ name, label }) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <InventoryItem label={label} value={field.value} onChange={field.onChange} />
                )}
              />
            ))}
            <Controller
              control={control}
              name="inventory.loadCells"
              render={({ field: statusField }) => (
                <Controller
                  control={control}
                  name="inventory.loadCellsQty"
                  render={({ field: qtyField }) => (
                    <InventoryItem label="Celda(s)" value={statusField.value} onChange={statusField.onChange} showQuantity quantity={qtyField.value} onQuantityChange={qtyField.onChange} />
                  )}
                />
              )}
            />
            <Controller
              control={control}
              name="inventory.feet"
              render={({ field: statusField }) => (
                <Controller
                  control={control}
                  name="inventory.feetQty"
                  render={({ field: qtyField }) => (
                    <InventoryItem label="Patas" value={statusField.value} onChange={statusField.onChange} showQuantity quantity={qtyField.value} onQuantityChange={qtyField.onChange} />
                  )}
                />
              )}
            />
          </div>
          <div className={`mt-4 pt-4 border-t ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
            <h5 className={`text-sm font-semibold mb-3 ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>Otros Componentes Agregados</h5>
            <div className="flex flex-col gap-3">
              {otherFields.map((field, index) => (
                <div key={field.id} className="flex flex-col lg:flex-row lg:items-center gap-3 bg-[#141414] p-3 rounded-lg border border-gray-700/30 shadow-inner">
                  <div className="flex-1">
                    <Input 
                      placeholder="Ej. Cable RS232, Pesa patrón..." 
                      {...register(`inventory.otherItems.${index}.name`)} 
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="flex-1 pl-2 border-l-2 border-primary-500/30">
                    <Controller
                      control={control}
                      name={`inventory.otherItems.${index}.status`}
                      render={({ field: statusField }) => (
                        <InventoryItem label="" value={statusField.value} onChange={statusField.onChange} />
                      )}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOther(index)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
                    title="Eliminar este componente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                className="self-start text-xs border-dashed border-gray-600 hover:border-primary-500 hover:text-primary-400 mt-2"
                onClick={() => appendOther({ name: '', status: 'present' })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar nuevo componente
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <TextArea label="Observaciones de inventario" {...register('inventoryNotes')} rows={2} />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.2</span>
          Daños Físicos
        </h4>
        <div className={`shadow-inner ring-1 rounded-xl p-4 border ${isDarkGantt ? 'bg-[#1c1c21] ring-white/10 border-gray-700/50' : 'bg-white ring-black/5 border-gray-200'}`}>
          <Controller
            control={control}
            name="damageLevel"
            render={({ field }) => (
              <RadioGroup
                label="Estado General del Instrumento"
                options={[
                  { value: 'excellent', label: 'Excelente' },
                  { value: 'good', label: 'Bueno' },
                  { value: 'fair', label: 'Regular' },
                  { value: 'poor', label: 'Malo' },
                  { value: 'critical', label: 'Crítico' },
                ]}
                {...field}
                error={errors.damageLevel}
                required
              />
            )}
          />
          <div className="mt-6">
            <Controller
              control={control}
              name="damageTypes"
              render={({ field }) => (
                <CheckboxWithLocation
                  label="Tipos de daños detectados"
                  options={[
                    { value: 'scratches', label: 'Rayones' },
                    { value: 'dents', label: 'Abolladuras' },
                    { value: 'corrosion', label: 'Corrosión' },
                    { value: 'cracks', label: 'Grietas' },
                    { value: 'broken', label: 'Piezas rotas' },
                    { value: 'wear', label: 'Desgaste' },
                    { value: 'other', label: 'Otros' },
                  ]}
                  locationOptions={[
                    { value: 'platform', label: 'Plataforma' },
                    { value: 'display', label: 'Display' },
                    { value: 'structure', label: 'Estructura' },
                    { value: 'loadCells', label: 'Celdas' },
                    { value: 'wiring', label: 'Cableado' },
                  ]}
                  value={field.value || {}}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="mt-4">
            <TextArea label="Descripción de daños" {...register('damageDescription')} rows={2} />
          </div>
        </div>
      </div>

      <div>
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.3</span>
          Nivel de Suciedad
        </h4>
        <div className={`shadow-inner ring-1 rounded-xl p-4 border ${isDarkGantt ? 'bg-[#1c1c21] ring-white/10 border-gray-700/50' : 'bg-white ring-black/5 border-gray-200'}`}>
          <Controller
            control={control}
            name="cleanlinessLevel"
            render={({ field }) => (
              <RadioGroup
                label="Nivel de Suciedad"
                options={[
                  { value: 'clean', label: 'Limpio' },
                  { value: 'light', label: 'Polvo ligero' },
                  { value: 'moderate', label: 'Moderado' },
                  { value: 'heavy', label: 'Muy sucio' },
                ]}
                {...field}
                error={errors.cleanlinessLevel}
                required
              />
            )}
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">4.1</span>
          Síntomas y Evidencias
        </h4>
        <div className={`shadow-inner ring-1 rounded-xl p-4 border mb-4 ${isDarkGantt ? 'bg-[#1c1c21] ring-white/10 border-gray-700/50' : 'bg-white ring-black/5 border-gray-200'}`}>
          <Controller
            control={control}
            name="functionalityTestPerformed"
            render={({ field }) => (
              <RadioGroup
                label="¿Se realizaron pruebas de funcionamiento?"
                options={[{ value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }]}
                {...field}
                error={errors.functionalityTestPerformed}
                required
              />
            )}
          />
          {watch('functionalityTestPerformed') === 'yes' && (
            <div className="mt-4">
              <TextArea label="Descripción de pruebas" {...register('functionalityTestDescription')} rows={3} />
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className={`text-sm font-semibold font-medium mb-3 flex items-center ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
          <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">4.2</span>
          Recepción y Ejecución
        </h4>
        <div className={`shadow-inner ring-1 rounded-xl p-4 border mb-4 ${isDarkGantt ? 'bg-[#1c1c21] ring-white/10 border-gray-700/50' : 'bg-white ring-black/5 border-gray-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre del Cliente" {...register('receptionClientName')} error={errors.receptionClientName} required />
            <Input label="Representante Métrica" {...register('receptionMetricaRepresentative')} error={errors.receptionMetricaRepresentative} required />
            <Input label="Lugar de Recepción" {...register('receptionLocation')} error={errors.receptionLocation} required />
            <Input label="Técnico Asignado" {...register('executionAssignedTechnician')} error={errors.executionAssignedTechnician} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {success && (
        <div className="mb-6 bg-green-900/30 border border-green-700/50 rounded-lg p-4 flex items-center text-green-400 animate-fade-in-up mx-auto w-full max-w-2xl text-center justify-center">
          <CheckCircle className="h-5 w-5 mr-3" />
          <h4 className="font-semibold">Registro Exitoso</h4>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        
        {/* SIDEBAR IZQUIERDO */}
        <div className="lg:w-1/3 xl:w-1/4 shrink-0 w-full lg:sticky lg:top-8">
          <div className="space-y-6">
            {/* Info y Estado */}
            <div className={`shadow-2xl border rounded-2xl p-6 ${isDarkGantt ? 'bg-[#0f0f11] border-gray-700/50' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center gap-4 mb-6 pb-6 border-b ${isDarkGantt ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-white font-medium" />
                </div>
                <div>
                  <p className={`text-xs font-medium uppercase ${isDarkGantt ? 'text-white/80' : 'text-gray-500'}`}>{userRole}</p>
                  <p className={`text-sm font-semibold font-medium ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>{userFullName}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className={`text-xs uppercase tracking-wider font-medium font-semibold mb-2 ${isDarkGantt ? 'text-white' : 'text-gray-700'}`}>Código RIM Generado</p>
                <div className="bg-primary-900/20 border-2 border-primary-500/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-xl font-bold text-primary-400 font-mono tracking-wider break-all leading-tight relative z-10">
                    {rimCode}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  <p className={`text-[10px] uppercase tracking-wider font-medium ${isDarkGantt ? 'text-white' : 'text-gray-600'}`}>Progreso en vivo</p>
                </div>
              </div>
            </div>

            {/* Navegación por Pasos Vertical */}
            <div className={`shadow-2xl border rounded-2xl p-4 hidden lg:block ${isDarkGantt ? 'bg-[#0f0f11] border-gray-700/50' : 'bg-white border-gray-200'}`}>
              <div className="space-y-2">
                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ease-out",
                        isActive ? "bg-primary-600/10 border border-primary-500/30" : "border border-transparent",
                        isCompleted ? "opacity-70" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isActive ? "bg-primary-500 text-white" : 
                        isCompleted ? "bg-green-500/20 text-green-400" : (isDarkGantt ? "bg-gray-800 text-white font-medium" : "bg-gray-200 text-gray-700 font-medium")
                      )}>
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${isDarkGantt ? 'text-white' : 'text-gray-500'}`}>Paso {step.id}</p>
                        <p className={cn("text-sm font-semibold", isActive ? "text-primary-400" : (isDarkGantt ? "text-white font-medium" : "text-gray-900 font-medium"))}>{step.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL (DERECHA) */}
        <div className="flex-1 space-y-1">
          {/* Header Mobile Steps */}
          <div className={`lg:hidden flex items-center justify-between shadow-2xl p-4 rounded-xl border ${isDarkGantt ? 'bg-[#0f0f11] border-gray-700/50' : 'bg-white border-gray-200'}`}>
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {currentStep}
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDarkGantt ? 'text-white' : 'text-gray-500'}`}>Paso {currentStep} de {STEPS.length}</p>
                  <p className={`text-sm font-semibold font-medium ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>{STEPS[currentStep - 1].title}</p>
                </div>
             </div>
             <p className="text-xs text-primary-400 font-mono tracking-wider bg-primary-900/30 px-2 py-1 rounded hidden sm:block">
                {rimCode}
             </p>
          </div>

          <div className={`shadow-2xl ring-1 border rounded-2xl p-6 min-h-[500px] ${isDarkGantt ? 'bg-[#151518] ring-white/5 border-gray-700/50' : 'bg-[#F9FAFB] ring-black/5 border-gray-200'}`}>
             {/* Animación y Renderizado Condicional */}
             {currentStep === 1 && renderStep1()}
             {currentStep === 2 && renderStep2()}
             {currentStep === 3 && renderStep3()}
             {currentStep === 4 && renderStep4()}
          </div>

          {/* Botonera Guardar / Siguiente */}
          <div className={`shadow-2xl border rounded-2xl p-4 flex items-center justify-between ${isDarkGantt ? 'bg-[#0f0f11] border-gray-700/50' : 'bg-white border-gray-200'}`}>
            <Button 
              type="button" 
              variant="outline" 
              onClick={prevStep} 
              disabled={currentStep === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>

            {currentStep < 4 ? (
              <Button type="button" onClick={nextStep} className="bg-primary-600 hover:bg-primary-500 text-white">
                Siguiente <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" isLoading={isLoading} className="bg-green-600 hover:bg-green-500 text-white min-w-[150px]">
                <Save className="h-4 w-4 mr-2" /> Exportar RIM
              </Button>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
