import React from 'react';
import { Controller } from 'react-hook-form';
import {
  AlertCircle, Check, CheckCircle2, Save, Building2, Loader2, Search,
  ChevronRight, ChevronLeft, ClipboardList, CheckSquare,
  Plus, Trash2
} from 'lucide-react';

import { InventoryItem } from './components/InventoryItem';
import { EquipoSearch } from './components/EquipoSearch';
import { ImageUpload } from './components/ImageUpload';
import { SignatureField } from './components/SignatureField';
import { Input } from '../../shared/components/ui/Input';
import { Dropdown } from '../calibration/components/Dropdown';
import { FieldLabel } from '../calibration/components/primitives';
import { Button } from '../../shared/components/ui/Button';
import { RadioGroup } from '../../shared/components/ui/RadioGroup';
import { CheckboxWithLocation } from '../../shared/components/ui/CheckboxWithLocation';
import { TextArea } from '../../shared/components/ui/TextArea';
import { SearchableInput } from '../../shared/components/ui/SearchableInput';
import { cn } from '../../shared/utils/cn';
import { useRimForm } from './hooks/useRimForm';

const STEPS = [
  { id: 1, title: 'Cliente y Planta', icon: Building2 },
  { id: 2, title: 'Instrumento', icon: Search },
  { id: 3, title: 'Estado Físico', icon: ClipboardList },
  { id: 4, title: 'Recepción y Entrega', icon: CheckSquare },
];

const INVENTORY_KEYS = [
  'indicator', 'voltageAdapter', 'powerCable', 'bracket', 'column',
  'weighingPan', 'windShield', 'structure', 'loadCellCable',
  'loadCellConnector', 'junctionBox', 'manual', 'originalPackaging',
  'loadCells', 'feet'
];

const MARK_ALL = [
  { value: 'present', label: 'Presente', className: 'text-success hover:bg-success/10' },
  { value: 'missing', label: 'Faltante', className: 'text-danger hover:bg-danger/10' },
  { value: 'na', label: 'N/A', className: 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg' },
];

function Section({ title, description, action, children, className }) {
  return (
    <section className={cn('border-t border-line pt-7 first:border-t-0 first:pt-0', className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.01em] text-fg">{title}</h3>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RimFormPage({ currentUser }) {
  const {
    currentStep, isLoading, registrado, submitError,
    clienteId, showPlanta, selectedPlanta, plantas, plantasLoading,
    setClienteId, setShowPlanta, setSelectedPlanta,
    fetchPlantas,
    userFullName, userRole, gestion,
    form, otherFields, appendOther, removeOther,
    onSubmit, nextStep, prevStep,
  } = useRimForm(currentUser);

  const { register, control, setValue, watch, formState: { errors } } = form;
  const initials = userFullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const renderStep1 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section title="Datos de la Empresa" description="Busca el cliente para completar sus datos registrados.">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
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
                  setClienteId(clienteData.codigo_cliente);
                  setShowPlanta(false);
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
      </Section>

      <Section title="Datos del Contacto">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <Input label="Nombre de Contacto" {...register('clientName')} error={errors.clientName} required />
          <Input label="Cargo" {...register('clientCargo')} error={errors.clientCargo} required />
          <Input label="Teléfono" type="tel" {...register('phone')} error={errors.phone} required />
          <Input label="Email" type="email" {...register('email')} error={errors.email} required />
        </div>
      </Section>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <div className="rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted">
              <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p id="rim-planta-toggle-label" className="text-sm font-semibold text-fg">Asociar a Planta del Cliente</p>
              <p className="text-xs text-fg-muted">
                {clienteId ? 'Activa para filtrar equipos por planta' : 'Selecciona un cliente para habilitar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showPlanta}
            aria-labelledby="rim-planta-toggle-label"
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
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
              showPlanta ? 'bg-fg' : 'bg-fg/15'
            )}
          >
            <span
              className={cn(
                'inline-block h-[18px] w-[18px] rounded-full bg-canvas shadow-xs transition-transform duration-200 ease-out',
                showPlanta ? 'translate-x-[23px]' : 'translate-x-[3px]'
              )}
            />
          </button>
        </div>
        {showPlanta && (
          <div className="mt-4 border-t border-line pt-4 animate-fade-in">
            {plantasLoading ? (
              <div className="flex items-center gap-2 text-sm text-fg-muted" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantas...
              </div>
            ) : plantas.length === 0 ? (
              <p className="text-sm text-warning">Este cliente no tiene plantas registradas.</p>
            ) : (
              <div className="space-y-4">
                <Controller
                  control={control}
                  name="planta"
                  render={({ field }) => (
                    <div>
                      <FieldLabel htmlFor="rim-form-planta">Seleccionar Planta</FieldLabel>
                      <Dropdown
                        id="rim-form-planta"
                        ariaLabel="Planta"
                        value={field.value}
                        onChange={(val) => {
                          field.onChange(val);
                          setSelectedPlanta(val);
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
                        placeholder="Seleccione una planta…"
                        options={plantas.map(p => ({
                          value: p.codigo_planta,
                          label: p.dir || p.codigo_planta,
                          hint: p.dir ? p.codigo_planta : undefined,
                        }))}
                      />
                      {errors.planta && <p className="field-error">{errors.planta.message}</p>}
                    </div>
                  )}
                />
                {selectedPlanta && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input label="Código Cliente y Planta" value={selectedPlanta} disabled />
                    <Input label="Departamento" {...register('plantaDepartamento')} disabled />
                    <div className="md:col-span-2">
                      <Input label="Dirección y Nombre de la Planta" {...register('plantaDireccion')} disabled />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Section
        title="Buscar por Código Métrica"
        description="Elige un instrumento para completar sus datos."
        action={selectedPlanta && (
          <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted">
            Planta <span className="ml-1 font-mono text-fg">{selectedPlanta}</span>
          </span>
        )}
      >
        <EquipoSearch
          planta={selectedPlanta}
          clienteId={clienteId}
          onSelect={(equipo) => {
            setValue('codMetrica', equipo.cod_metrica || '');
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
      </Section>

      <Section title="Datos del Instrumento">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <Input label="Instrumento" {...register('instrument')} error={errors.instrument} required />
          <Input label="Marca" {...register('brand')} error={errors.brand} required />
          <Input label="Modelo" {...register('model')} error={errors.model} required />
          <Input label="Número de Serie" {...register('serialNumber')} error={errors.serialNumber} required />
          <Input label="Capacidad Máxima" {...register('maxCapacity')} error={errors.maxCapacity} required />
          <Input label="Unidad" {...register('unit')} error={errors.unit} required />
          <Input label="Resolución" {...register('resolution')} error={errors.resolution} required />
          <div className="md:col-span-2">
            <Input label="Area de Trabajo" {...register('workArea')} error={errors.workArea} required />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Observaciones" {...register('notes')} rows={3} />
          </div>
        </div>
      </Section>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section
        title="Inventario de Componentes"
        action={
          <div className="flex items-center gap-1 self-start rounded-xl border border-line bg-surface-2/60 p-1 sm:self-auto">
            <span className="hidden px-2 text-xs font-medium text-fg-muted md:inline">Marcar todos:</span>
            {MARK_ALL.map(({ value: val, label, className }) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  INVENTORY_KEYS.forEach(k => setValue(`inventory.${k}`, val, { shouldValidate: true }));
                  otherFields.forEach((field, index) => {
                    setValue(`inventory.otherItems.${index}.status`, val, { shouldValidate: true });
                  });
                }}
                className={cn('h-7 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150', className)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="divide-y divide-line rounded-2xl border border-line">
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

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-fg">Otros Componentes Agregados</h4>
          <div className="flex flex-col gap-2.5">
            {otherFields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-3 rounded-2xl border border-line p-3 animate-fade-in lg:flex-row lg:items-center">
                <div className="flex-1">
                  <Input
                    placeholder="Ej. Cable RS232, Pesa patrón..."
                    aria-label={`Nombre del componente ${index + 1}`}
                    {...register(`inventory.otherItems.${index}.name`)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Controller
                    control={control}
                    name={`inventory.otherItems.${index}.status`}
                    render={({ field: statusField }) => (
                      <InventoryItem label="" compact value={statusField.value} onChange={statusField.onChange} />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => removeOther(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Eliminar este componente"
                    aria-label="Eliminar este componente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start border border-dashed border-line-strong"
              onClick={() => appendOther({ name: '', status: 'present' })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Agregar nuevo componente
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <TextArea label="Observaciones de inventario" {...register('inventoryNotes')} rows={2} />
        </div>
      </Section>

      <Section title="Daños Físicos">
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
        <div className="mt-6">
          <TextArea label="Descripción de daños" {...register('damageDescription')} rows={2} />
        </div>
      </Section>

      <Section title="Nivel de Suciedad">
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
      </Section>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section title="Síntomas y Evidencias">
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
          <div className="mt-5 animate-fade-in">
            <TextArea label="Descripción de pruebas" {...register('functionalityTestDescription')} rows={3} />
          </div>
        )}
        <div className="mt-6">
          <Controller
            control={control}
            name="photos"
            render={({ field }) => (
              <ImageUpload files={field.value} onFilesChange={field.onChange} error={errors.photos} />
            )}
          />
        </div>
      </Section>

      <Section title="Recepción y Ejecución">
        <div className="mb-5">
          <TextArea
            label="Motivo de la recepción"
            {...register('receptionReason')}
            error={errors.receptionReason}
            rows={3}
            placeholder="Por qué se recibe el instrumento o no pudo concluirse el servicio"
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <Input label="Nombre del Cliente" {...register('receptionClientName')} error={errors.receptionClientName} required />
          <Input label="Representante Métrica" {...register('receptionMetricaRepresentative')} error={errors.receptionMetricaRepresentative} required />
          <Input label="Lugar de Recepción" {...register('receptionLocation')} error={errors.receptionLocation} required />
          <Input label="Técnico Asignado" {...register('executionAssignedTechnician')} error={errors.executionAssignedTechnician} />
        </div>
      </Section>

      <Section
        title="Firmas"
        description="Firman quien entrega el instrumento y el representante de Métrica. Las dos son obligatorias para registrar el RIM."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
          <Controller
            control={control}
            name="receptionClientSignature"
            render={({ field }) => (
              <SignatureField label="Firma del cliente" onEnd={(value) => field.onChange(value || '')} error={errors.receptionClientSignature} />
            )}
          />
          <Controller
            control={control}
            name="receptionReceiverSignature"
            render={({ field }) => (
              <SignatureField label="Firma del representante de Métrica" onEnd={(value) => field.onChange(value || '')} error={errors.receptionReceiverSignature} />
            )}
          />
        </div>
      </Section>
    </div>
  );

  const current = STEPS[currentStep - 1];

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {registrado && (
        <div
          className="mx-auto mb-6 flex w-full max-w-2xl items-start gap-2.5 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 animate-fade-in-up"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success" aria-hidden="true" />
          <div className="text-sm text-fg">
            <p className="font-semibold">
              {registrado.duplicate ? 'El RIM ya estaba registrado' : 'RIM registrado'}:{' '}
              <span className="font-mono">{registrado.codigo}</span>
            </p>
            <p className="text-fg-muted">
              {registrado.pdf
                ? 'El PDF se descargó con este código. Puede consultarlo en la pestaña Registros.'
                : 'No se pudo generar el PDF; el RIM quedó registrado y puede consultarlo en la pestaña Registros.'}
            </p>
          </div>
        </div>
      )}
      {submitError && (
        <div
          className="mx-auto mb-6 flex w-full max-w-2xl items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-danger" aria-hidden="true" />
          <div className="text-sm text-fg">
            <p className="font-semibold">No se pudo registrar el RIM.</p>
            <p className="text-fg-muted">{submitError} Lo llenado se conserva: puede volver a intentarlo sin duplicar el RIM.</p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">

        {/* Resumen y pasos */}
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:w-[300px]">
          <div className="card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-fg" aria-hidden="true">
                {initials || '—'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{userFullName}</p>
                <p className="truncate text-xs text-fg-muted">{userRole}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-xs font-medium text-fg-muted">Código del RIM</p>
              <p className="mt-2 break-all rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-[17px] font-semibold tracking-wide text-fg">
                {`RIM-${String(gestion % 100).padStart(2, '0')}-····`}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                El número se asigna al registrar: es único para todos los RIM, de ServiceMET y de la web.
              </p>
            </div>
          </div>

          <ol className="card hidden p-2 shadow-card lg:block" aria-label="Pasos del formulario">
            {STEPS.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const StepIcon = step.icon;
              return (
                <li key={step.id} className="relative">
                  {index < STEPS.length - 1 && (
                    <span
                      className={cn(
                        'absolute left-[27px] top-[46px] h-[calc(100%-36px)] w-px',
                        isCompleted ? 'bg-fg/40' : 'bg-line'
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <div
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200',
                      isActive && 'bg-surface-2'
                    )}
                  >
                    <span
                      className={cn(
                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                        isActive && 'border-fg bg-fg text-canvas',
                        isCompleted && 'border-fg/40 bg-surface text-fg',
                        !isActive && !isCompleted && 'border-line-strong bg-surface text-fg-subtle'
                      )}
                    >
                      {isCompleted
                        ? <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                        : <StepIcon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-fg-subtle">Paso {step.id}</p>
                      <p className={cn('truncate text-sm font-medium', isActive ? 'text-fg' : isCompleted ? 'text-fg' : 'text-fg-muted')}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Contenido del paso */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div className="card flex items-center justify-between gap-3 p-4 shadow-card lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-sm font-semibold text-canvas">
                {currentStep}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-fg-muted">Paso {currentStep} de {STEPS.length}</p>
                <p className="truncate text-sm font-semibold text-fg">{current.title}</p>
              </div>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {STEPS.map((step) => (
                <span
                  key={step.id}
                  className={cn('h-1.5 w-5 rounded-full', step.id <= currentStep ? 'bg-fg' : 'bg-fg/15')}
                />
              ))}
            </div>
          </div>

          <div className="card min-h-[500px] p-5 shadow-card sm:p-8">
            <div className="mb-8 hidden lg:block">
              <p className="text-sm text-fg-muted">Paso {currentStep} de {STEPS.length}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-fg">{current.title}</h2>
            </div>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </div>

          <div className="card flex items-center justify-between gap-3 p-3 shadow-card">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Atrás
            </Button>
            {currentStep < 4 ? (
              <Button type="button" onClick={nextStep}>
                Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" isLoading={isLoading} className="min-w-[150px]">
                {!isLoading && <Save className="h-4 w-4" aria-hidden="true" />} Registrar RIM
              </Button>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
