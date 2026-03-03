import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CheckCircle, Save, User, Calendar } from 'lucide-react';

import { FormSection } from './components/FormSection';
import { InventoryItem } from './components/InventoryItem';
import { SignatureField } from './components/SignatureField';
import { ImageUpload } from './components/ImageUpload';
import { generateRIMCode } from './utils/rimCode';

import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';
import { Button } from '../../shared/components/ui/Button';
import { RadioGroup } from '../../shared/components/ui/RadioGroup';
import { CheckboxWithLocation } from '../../shared/components/ui/CheckboxWithLocation';
import { TextArea } from '../../shared/components/ui/TextArea';
import { SearchableInput } from '../../shared/components/ui/SearchableInput';

import { formSchema } from '../../utils/validations';
import { fileToBase64 } from '../../utils/files';
import { generatePDF } from '../../utils/pdfGenerator';

export function RimFormPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [technicianInfo] = useState({
    name: 'Juan Pérez',
    area: 'Soporte Técnico',
    timestamp: new Date(),
  });

  const rimCode = generateRIMCode(technicianInfo.area, technicianInfo.timestamp);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
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
      console.log("=== FORM SUBMISSION ===");
      console.log(JSON.stringify(payload, null, 2));

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error(error);
      alert("Error al procesar el formulario");
    } finally {
      setIsLoading(false);
    }
  };

  const onError = (errors) => {
    console.error("=== VALIDATION ERRORS ===", errors);
    alert("Hay errores en el formulario. Revisa la consola para más detalles.");
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {success && (
        <div className="mb-6 bg-green-900/30 border border-green-700/50 rounded-lg p-4 flex items-center text-green-400 animate-fade-in">
          <CheckCircle className="h-5 w-5 mr-3" />
          <div>
            <h4 className="font-semibold">Registro Exitoso</h4>
            <p className="text-sm">La entrega ha sido registrada correctamente.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6">
        {/* Información del Técnico y RIM */}
        <div className="bg-[#141414] border-2 border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-600 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                <User className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Técnico Responsable</p>
              <p className="text-lg font-bold text-gray-100">{technicianInfo.name}</p>
              <p className="text-sm text-gray-400">{technicianInfo.area}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-700/30 rounded-xl mb-4 flex items-center justify-center">
                <Calendar className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Fecha y Hora</p>
              <p className="text-lg font-bold text-gray-100">{format(technicianInfo.timestamp, 'dd/MM/yyyy')}</p>
              <p className="text-sm text-gray-400">{format(technicianInfo.timestamp, 'HH:mm:ss')}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 text-center">Código RIM</p>
            <div className="bg-green-600/10 border-2 border-green-500/50 rounded-xl p-4 flex items-center justify-center gap-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400 font-mono tracking-wider">{rimCode}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-xs uppercase tracking-wider text-gray-400">En Proceso</p>
            </div>
          </div>
        </div>

        <FormSection title="1. Datos Generales del Cliente">
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
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
                    }}
                    error={errors.companyName}
                    placeholder="Buscar empresa..."
                    required
                  />
                )}
              />
              <Input label="Razón Social" {...register('companyRazonSocial')} error={errors.companyRazonSocial} required />
              <Input label="NIT" {...register('taxId')} error={errors.taxId} required />
              <Select
                label="Departamento"
                {...register('city')}
                error={errors.city}
                placeholder="Seleccione un departamento"
                options={[
                  { value: 'La Paz', label: 'La Paz' },
                  { value: 'Cochabamba', label: 'Cochabamba' },
                  { value: 'Santa Cruz', label: 'Santa Cruz' },
                  { value: 'Oruro', label: 'Oruro' },
                  { value: 'Potosí', label: 'Potosí' },
                  { value: 'Tarija', label: 'Tarija' },
                  { value: 'Chuquisaca', label: 'Chuquisaca' },
                  { value: 'Beni', label: 'Beni' },
                  { value: 'Pando', label: 'Pando' },
                ]}
                required
              />
              <Input label="Dirección" className="md:col-span-2" {...register('address')} error={errors.address} required />
            </div>
          </div>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
          </div>
          <div className="mt-10">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
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
        </FormSection>

        <FormSection title="2. Datos Generales del Instrumento">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Instrumento" {...register('instrument')} error={errors.instrument} required />
            <Input label="Marca" {...register('brand')} error={errors.brand} required />
            <Input label="Modelo" {...register('model')} error={errors.model} required />
            <Input label="Número de Serie" {...register('serialNumber')} error={errors.serialNumber} required />
            <Input label="Capacidad Máxima" {...register('maxCapacity')} error={errors.maxCapacity} required />
            <Input label="Resolución" {...register('resolution')} error={errors.resolution} required />
            <Input label="Area de Trabajo" {...register('workArea')} error={errors.workArea} required />
          </div>
          <div className="mt-4">
            <TextArea label="Observaciones" {...register('notes')} rows={3} />
          </div>
        </FormSection>

        <FormSection title="3. Estado del Instrumento">
          {/* 3.1 Inventario */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.1</span>
              Inventario de Componentes
            </h4>
            <div className="bg-[#252525] rounded-lg p-4">
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
                      <InventoryItem
                        label="Celda(s) de Carga"
                        value={statusField.value}
                        onChange={statusField.onChange}
                        showQuantity
                        quantity={qtyField.value}
                        onQuantityChange={qtyField.onChange}
                      />
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
                      <InventoryItem
                        label="Patas"
                        value={statusField.value}
                        onChange={statusField.onChange}
                        showQuantity
                        quantity={qtyField.value}
                        onQuantityChange={qtyField.onChange}
                      />
                    )}
                  />
                )}
              />
            </div>
            <div className="mt-4">
              <Input label="Otros componentes" placeholder="Especifique otros componentes..." {...register('inventory.other')} />
            </div>
            <div className="mt-4">
              <TextArea label="Observaciones de inventario" placeholder="Detalles adicionales sobre componentes faltantes o en mal estado..." {...register('inventoryNotes')} rows={2} />
            </div>
          </div>

          <div className="relative my-8"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div></div>

          {/* 3.2 Daños */}
          <div className="mb-12 mt-10">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.2</span>
              Daños Físicos
            </h4>
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
                      { value: 'scratches', label: 'Rayones superficiales' },
                      { value: 'dents', label: 'Abolladuras' },
                      { value: 'corrosion', label: 'Corrosión/Oxidación' },
                      { value: 'cracks', label: 'Grietas' },
                      { value: 'broken', label: 'Piezas rotas' },
                      { value: 'wear', label: 'Desgaste excesivo' },
                      { value: 'other', label: 'Otros' },
                    ]}
                    locationOptions={[
                      { value: 'platform', label: 'Plataforma' },
                      { value: 'display', label: 'Indicador/Display' },
                      { value: 'structure', label: 'Estructura' },
                      { value: 'column', label: 'Columna' },
                      { value: 'loadCells', label: 'Celdas de carga' },
                      { value: 'wiring', label: 'Cableado' },
                      { value: 'other', label: 'Otro' },
                    ]}
                    value={field.value || {}}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="mt-6">
              <TextArea label="Descripción de daños" placeholder="Describa la ubicación y naturaleza de los daños detectados..." {...register('damageDescription')} rows={3} />
            </div>
          </div>

          <div className="relative my-10"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div></div>

          {/* 3.3 Limpieza */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.3</span>
              Limpieza del Instrumento
            </h4>
            <Controller
              control={control}
              name="cleanlinessLevel"
              render={({ field }) => (
                <RadioGroup
                  label="Nivel de Suciedad"
                  options={[
                    { value: 'clean', label: 'Limpio' },
                    { value: 'light', label: 'Polvo ligero' },
                    { value: 'moderate', label: 'Suciedad moderada' },
                    { value: 'heavy', label: 'Muy sucio' },
                  ]}
                  {...field}
                  error={errors.cleanlinessLevel}
                  required
                />
              )}
            />
            <div className="mt-6">
              <Controller
                control={control}
                name="dirtTypes"
                render={({ field }) => (
                  <CheckboxWithLocation
                    label="Tipos de suciedad detectada"
                    options={[
                      { value: 'dust', label: 'Polvo' },
                      { value: 'grease', label: 'Grasa/Aceite' },
                      { value: 'residue', label: 'Residuos de producto' },
                      { value: 'corrosion', label: 'Corrosión' },
                      { value: 'moisture', label: 'Humedad/Moho' },
                      { value: 'other', label: 'Otros' },
                    ]}
                    locationOptions={[
                      { value: 'platform', label: 'Plataforma' },
                      { value: 'display', label: 'Indicador/Display' },
                      { value: 'structure', label: 'Estructura' },
                      { value: 'column', label: 'Columna' },
                      { value: 'loadCells', label: 'Celdas de carga' },
                      { value: 'wiring', label: 'Cableado' },
                      { value: 'internal', label: 'Componentes internos' },
                      { value: 'other', label: 'Otro' },
                    ]}
                    value={field.value || {}}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="mt-4">
              <TextArea label="Observaciones de limpieza" placeholder="Detalles adicionales sobre el estado de limpieza..." {...register('cleanlinessNotes')} rows={2} />
            </div>
          </div>
        </FormSection>

        <FormSection title="4. Síntomas del Instrumento">
          <Controller
            control={control}
            name="functionalityTestPerformed"
            render={({ field }) => (
              <RadioGroup
                label="¿Se realizaron pruebas de funcionamiento al momento de la recepción del instrumento?"
                options={[
                  { value: 'yes', label: 'Sí' },
                  { value: 'no', label: 'No' },
                ]}
                {...field}
                error={errors.functionalityTestPerformed}
                required
              />
            )}
          />
          {watch('functionalityTestPerformed') === 'yes' && (
            <div className="mt-6">
              <TextArea label="Descripción de las pruebas realizadas" placeholder="Describa las pruebas de funcionamiento que se realizaron al instrumento..." {...register('functionalityTestDescription')} rows={4} />
            </div>
          )}
        </FormSection>

        <FormSection title="5. Evidencias Fotográficas">
          <Controller
            control={control}
            name="photos"
            render={({ field }) => (
              <ImageUpload files={field.value} onFilesChange={field.onChange} error={errors.photos} />
            )}
          />
        </FormSection>

        <FormSection title="6. Recepción, Ejecución y Entrega">
          {/* 6.1 Recepción */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">6.1</span>
              Recepción
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Controller control={control} name="receptionClientSignature" render={({ field }) => (
                <SignatureField label="Firma del Cliente" value={field.value} onChange={field.onChange} onEnd={field.onChange} error={errors.receptionClientSignature} />
              )} />
              <Controller control={control} name="receptionReceiverSignature" render={({ field }) => (
                <SignatureField label="Firma del Receptor" value={field.value} onChange={field.onChange} onEnd={field.onChange} error={errors.receptionReceiverSignature} />
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre del Cliente" {...register('receptionClientName')} error={errors.receptionClientName} required />
              <Input label="Por MÉTRICA LTDA" {...register('receptionMetricaRepresentative')} error={errors.receptionMetricaRepresentative} required />
              <Input label="Fecha de Recepción" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} {...register('receptionDate')} error={errors.receptionDate} />
              <Input label="Lugar de Recepción" {...register('receptionLocation')} error={errors.receptionLocation} required />
            </div>
          </div>

          <div className="relative my-10"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div></div>

          {/* 6.2 Ejecución */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">6.2</span>
              Ejecución
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label="Recepción S.T" {...register('executionSTReception')} error={errors.executionSTReception} />
              <Input label="Fecha de Ingreso a S.T" type="date" {...register('executionSTEntryDate')} error={errors.executionSTEntryDate} />
              <Input label="Técnico Asignado" {...register('executionAssignedTechnician')} error={errors.executionAssignedTechnician} />
              <Input label="Fecha de Inicio" type="date" {...register('executionStartDate')} error={errors.executionStartDate} />
              <Input label="Fecha de Informe" type="date" {...register('executionReportDate')} error={errors.executionReportDate} />
              <Input label="Fecha de Conclusión" type="date" {...register('executionCompletionDate')} error={errors.executionCompletionDate} />
              <Input label="N° de Cotización" {...register('executionQuoteNumber')} error={errors.executionQuoteNumber} />
              <Input label="N° de Informe" {...register('executionReportNumber')} error={errors.executionReportNumber} />
              <Input label="N° de Factura" {...register('executionInvoiceNumber')} error={errors.executionInvoiceNumber} />
            </div>
          </div>

          <div className="relative my-10"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div></div>

          {/* 6.3 Entrega */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
              <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">6.3</span>
              Entrega
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Controller control={control} name="deliveryClientSignature" render={({ field }) => (
                <SignatureField label="Firma del Cliente" value={field.value} onChange={field.onChange} onEnd={field.onChange} error={errors.deliveryClientSignature} />
              )} />
              <Controller control={control} name="deliveryResponsibleSignature" render={({ field }) => (
                <SignatureField label="Firma del Responsable" value={field.value} onChange={field.onChange} onEnd={field.onChange} error={errors.deliveryResponsibleSignature} />
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre del Cliente" {...register('deliveryClientName')} error={errors.deliveryClientName} required />
              <Input label="Por MÉTRICA LTDA" {...register('deliveryMetricaRepresentative')} error={errors.deliveryMetricaRepresentative} required />
              <Input label="Fecha de Entrega" type="date" {...register('deliveryDate')} error={errors.deliveryDate} />
              <Input label="Lugar de Entrega" {...register('deliveryLocation')} error={errors.deliveryLocation} required />
            </div>
          </div>
        </FormSection>

        <div className="bg-[#1e1e1e] border-t border-gray-700 rounded-lg p-6 mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-400">* Todos los campos marcados son obligatorios</div>
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full sm:w-auto">
            <Save className="h-5 w-5 mr-2" />
            Registrar Entrega
          </Button>
        </div>
      </form>
    </main>
  );
}
