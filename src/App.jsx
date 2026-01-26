import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { FormSection } from './components/forms/FormSection';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { RadioGroup } from './components/ui/RadioGroup';
import { CheckboxGroup } from './components/ui/CheckboxGroup';
import { CheckboxWithLocation } from './components/ui/CheckboxWithLocation';
import { TextArea } from './components/ui/TextArea';
import { InventoryItem } from './components/forms/InventoryItem';
import { SignatureField } from './components/forms/SignatureField';
import { ImageUpload } from './components/forms/ImageUpload';
import { formSchema } from './utils/validations';
import { fileToBase64 } from './utils/files';
import { generatePDF } from './utils/pdfGenerator';
import { CheckCircle, AlertCircle, Save, User, Calendar } from 'lucide-react';

// Función para generar código RIM
function generateRIMCode(area, timestamp) {
  const areaCode = area.substring(0, 3).toUpperCase();
  const date = format(timestamp, 'ddMMyy'); // DDMMYY
  const time = format(timestamp, 'HHmm'); // HHMM
  return `RIM-${areaCode}-${date}-${time}`;
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // TODO: Estos datos vendrán del login en el futuro
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
    }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
        const processedPhotos = await Promise.all(
            data.photos.map(async (file) => {
                const base64 = await fileToBase64(file);
                return {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    content: base64
                };
            })
        );
        
        const payload = {
            ...data,
            photos: processedPhotos
        };

        console.log("=== FORM SUBMISSION ===");
        console.log(JSON.stringify(payload, null, 2));
        
        // Generar PDF
        console.log("Generando PDF...");
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

  return (
    <div className="min-h-screen bg-[#141414] pb-12">
      <Header />
      
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Información del Técnico y RIM */}
            <div className="bg-[#141414] border-2 border-gray-700/50 rounded-2xl p-8 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Datos del Técnico con foto */}
                    <div className="flex flex-col items-center text-center">
                        {/* Foto del usuario - placeholder */}
                        <div className="w-20 h-20 bg-gray-600 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                            <User className="h-12 w-12 text-gray-400" />
                            {/* TODO: Reemplazar con imagen del servidor */}
                            {/* <img src={technicianInfo.photoUrl} alt={technicianInfo.name} className="w-full h-full object-cover" /> */}
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Técnico Responsable</p>
                        <p className="text-lg font-bold text-gray-100">{technicianInfo.name}</p>
                        <p className="text-sm text-gray-400">{technicianInfo.area}</p>
                    </div>
                    
                    {/* Fecha y Hora */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-gray-700/30 rounded-xl mb-4 flex items-center justify-center">
                            <Calendar className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Fecha y Hora</p>
                        <p className="text-lg font-bold text-gray-100">
                            {format(technicianInfo.timestamp, 'dd/MM/yyyy')}
                        </p>
                        <p className="text-sm text-gray-400">
                            {format(technicianInfo.timestamp, 'HH:mm:ss')}
                        </p>
                    </div>
                </div>
                
                {/* Código RIM - Estilo badge verde */}
                <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 text-center">Código RIM</p>
                    <div className="bg-green-600/10 border-2 border-green-500/50 rounded-xl p-4 flex items-center justify-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-green-400 font-mono tracking-wider">
                            {rimCode}
                        </p>
                    </div>
                    
                    {/* Estado EN PROCESO */}
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">En Proceso</p>
                    </div>
                </div>
            </div>
            
            
            <FormSection title="1. Datos Generales del Cliente">
                {/* Subsección: Datos de la Empresa */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                        <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">Empresa</span>
                        Datos de la Empresa
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Empresa" {...register('companyName')} error={errors.companyName} required />
                        <Input label="Razón Social" {...register('companyRazonSocial')} error={errors.companyRazonSocial} required />
                        <Input label="NIT" {...register('taxId')} error={errors.taxId} required />
                        <Input label="Ciudad" {...register('city')} error={errors.city} required />
                        <Input label="Dirección" className="md:col-span-2" {...register('address')} error={errors.address} required />
                    </div>
                </div>

                {/* Separador visual */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                </div>

                {/* Subsección: Datos del Contacto */}
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
                    <TextArea 
                        label="Observaciones"
                        {...register('notes')}
                        rows={3}
                    />
                </div>
            </FormSection>

            <FormSection title="3. Estado del Instrumento">
                {/* 3.1 Inventario de Componentes */}
                <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                        <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">3.1</span>
                        Inventario de Componentes
                    </h4>
                    
                    <div className="bg-[#252525] rounded-lg p-4">
                        <Controller
                            control={control}
                            name="inventory.indicator"
                            render={({ field }) => (
                                <InventoryItem label="Indicador" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.voltageAdapter"
                            render={({ field }) => (
                                <InventoryItem label="Adaptador de Voltaje" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.powerCable"
                            render={({ field }) => (
                                <InventoryItem label="Cable de Poder" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.bracket"
                            render={({ field }) => (
                                <InventoryItem label="Bracket" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.column"
                            render={({ field }) => (
                                <InventoryItem label="Columna" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.weighingPan"
                            render={({ field }) => (
                                <InventoryItem label="Bandeja de Pesaje" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.windShield"
                            render={({ field }) => (
                                <InventoryItem label="Cabina Corta Aire" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.structure"
                            render={({ field }) => (
                                <InventoryItem label="Estructura" value={field.value} onChange={field.onChange} />
                            )}
                        />
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
                            name="inventory.loadCellCable"
                            render={({ field }) => (
                                <InventoryItem label="Cable de Celda" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.loadCellConnector"
                            render={({ field }) => (
                                <InventoryItem label="Conector de Celda" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.junctionBox"
                            render={({ field }) => (
                                <InventoryItem label="Caja Sumadora" value={field.value} onChange={field.onChange} />
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
                        <Controller
                            control={control}
                            name="inventory.manual"
                            render={({ field }) => (
                                <InventoryItem label="Manual" value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <Controller
                            control={control}
                            name="inventory.originalPackaging"
                            render={({ field }) => (
                                <InventoryItem label="Embalaje Original" value={field.value} onChange={field.onChange} />
                            )}
                        />
                    </div>
                    
                    <div className="mt-4">
                        <Input 
                            label="Otros componentes" 
                            placeholder="Especifique otros componentes..."
                            {...register('inventory.other')} 
                        />
                    </div>
                    
                    <div className="mt-4">
                        <TextArea
                            label="Observaciones de inventario"
                            placeholder="Detalles adicionales sobre componentes faltantes o en mal estado..."
                            {...register('inventoryNotes')}
                            rows={2}
                        />
                    </div>
                </div>

                {/* Separador */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                </div>

                {/* 3.2 Daños Físicos */}
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
                        <TextArea
                            label="Descripción de daños"
                            placeholder="Describa la ubicación y naturaleza de los daños detectados..."
                            {...register('damageDescription')}
                            rows={3}
                        />
                    </div>
                </div>

                {/* Separador */}
                <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                </div>

                {/* 3.3 Limpieza del Instrumento */}
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
                        <TextArea
                            label="Observaciones de limpieza"
                            placeholder="Detalles adicionales sobre el estado de limpieza..."
                            {...register('cleanlinessNotes')}
                            rows={2}
                        />
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
                        <TextArea
                            label="Descripción de las pruebas realizadas"
                            placeholder="Describa las pruebas de funcionamiento que se realizaron al instrumento..."
                            {...register('functionalityTestDescription')}
                            rows={4}
                        />
                    </div>
                )}
            </FormSection>

            <FormSection title="5. Evidencias Fotográficas">
                <Controller
                    control={control}
                    name="photos"
                    render={({ field }) => (
                         <ImageUpload 
                            files={field.value} 
                            onFilesChange={field.onChange} 
                            error={errors.photos}
                        />
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
                        <Controller
                            control={control}
                            name="receptionClientSignature"
                            render={({ field }) => (
                                <SignatureField
                                    label="Firma del Cliente"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.receptionClientSignature}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="receptionReceiverSignature"
                            render={({ field }) => (
                                <SignatureField
                                    label="Firma del Receptor"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.receptionReceiverSignature}
                                />
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Nombre del Cliente" 
                            {...register('receptionClientName')} 
                            error={errors.receptionClientName} 
                            required 
                        />
                        <Input 
                            label="Por MÉTRICA LTDA" 
                            {...register('receptionMetricaRepresentative')} 
                            error={errors.receptionMetricaRepresentative} 
                            required 
                        />
                        <Input 
                            label="Fecha de Recepción" 
                            type="date"
                            defaultValue={format(new Date(), 'yyyy-MM-dd')}
                            {...register('receptionDate')} 
                            error={errors.receptionDate} 
                        />
                        <Input 
                            label="Lugar de Recepción" 
                            {...register('receptionLocation')} 
                            error={errors.receptionLocation} 
                            required 
                        />
                    </div>
                </div>

                {/* Separador */}
                <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                </div>

                {/* 6.2 Ejecución */}
                <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                        <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">6.2</span>
                        Ejecución
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input 
                            label="Recepción S.T" 
                            {...register('executionSTReception')} 
                            error={errors.executionSTReception} 
                        />
                        <Input 
                            label="Fecha de Ingreso a S.T" 
                            type="date"
                            {...register('executionSTEntryDate')} 
                            error={errors.executionSTEntryDate} 
                        />
                        <Input 
                            label="Técnico Asignado" 
                            {...register('executionAssignedTechnician')} 
                            error={errors.executionAssignedTechnician} 
                        />
                        <Input 
                            label="Fecha de Inicio" 
                            type="date"
                            {...register('executionStartDate')} 
                            error={errors.executionStartDate} 
                        />
                        <Input 
                            label="Fecha de Informe" 
                            type="date"
                            {...register('executionReportDate')} 
                            error={errors.executionReportDate} 
                        />
                        <Input 
                            label="Fecha de Conclusión" 
                            type="date"
                            {...register('executionCompletionDate')} 
                            error={errors.executionCompletionDate} 
                        />
                        <Input 
                            label="N° de Cotización" 
                            {...register('executionQuoteNumber')} 
                            error={errors.executionQuoteNumber} 
                        />
                        <Input 
                            label="N° de Informe" 
                            {...register('executionReportNumber')} 
                            error={errors.executionReportNumber} 
                        />
                        <Input 
                            label="N° de Factura" 
                            {...register('executionInvoiceNumber')} 
                            error={errors.executionInvoiceNumber} 
                        />
                    </div>
                </div>

                {/* Separador */}
                <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                </div>

                {/* 6.3 Entrega */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                        <span className="bg-primary-600/20 text-primary-400 px-2 py-1 rounded text-xs mr-2">6.3</span>
                        Entrega
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Controller
                            control={control}
                            name="deliveryClientSignature"
                            render={({ field }) => (
                                <SignatureField
                                    label="Firma del Cliente"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.deliveryClientSignature}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="deliveryResponsibleSignature"
                            render={({ field }) => (
                                <SignatureField
                                    label="Firma del Responsable"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.deliveryResponsibleSignature}
                                />
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Nombre del Cliente" 
                            {...register('deliveryClientName')} 
                            error={errors.deliveryClientName} 
                            required 
                        />
                        <Input 
                            label="Por MÉTRICA LTDA" 
                            {...register('deliveryMetricaRepresentative')} 
                            error={errors.deliveryMetricaRepresentative} 
                            required 
                        />
                        <Input 
                            label="Fecha de Entrega" 
                            type="date"
                            {...register('deliveryDate')} 
                            error={errors.deliveryDate} 
                        />
                        <Input 
                            label="Lugar de Entrega" 
                            {...register('deliveryLocation')} 
                            error={errors.deliveryLocation} 
                            required 
                        />
                    </div>
                </div>
            </FormSection>

            <div className="bg-[#1e1e1e] border-t border-gray-700 rounded-lg p-6 mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="text-sm text-gray-400">
                    * Todos los campos marcados son obligatorios
                 </div>
                 <Button type="submit" size="lg" isLoading={isLoading} className="w-full sm:w-auto">
                    <Save className="h-5 w-5 mr-2" />
                    Registrar Entrega
                 </Button>
            </div>

        </form>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
