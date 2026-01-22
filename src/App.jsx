import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Header } from './components/layout/Header';
import { FormSection } from './components/forms/FormSection';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { SignatureField } from './components/forms/SignatureField';
import { ImageUpload } from './components/forms/ImageUpload';
import { formSchema } from './utils/validations';
import { fileToBase64 } from './utils/files';
import { CheckCircle, AlertCircle, Save } from 'lucide-react';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deliveryDate: format(new Date(), 'yyyy-MM-dd'),
      serviceTimestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      status: 'nuevo',
      photos: []
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
    <div className="min-h-screen bg-gray-50 pb-12">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center text-green-700 animate-fade-in">
                <CheckCircle className="h-5 w-5 mr-3" />
                <div>
                    <h4 className="font-semibold">Registro Exitoso</h4>
                    <p className="text-sm">La entrega ha sido registrada correctamente.</p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            

            <FormSection title="1. Información del Cliente">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Empresa" {...register('companyName')} error={errors.companyName} required />
                    <Input label="Razón Social" {...register('companyRazonSocial')} error={errors.companyRazonSocial} required />
                    <Input label="NIT" {...register('taxId')} error={errors.taxId} required />
                    <Input label="Nombre de Contacto" {...register('clientName')} error={errors.clientName} required />
                    <Input label="Teléfono" type="tel" {...register('phone')} error={errors.phone} required />
                    <Input label="Email" type="email" {...register('email')} error={errors.email} required />
                    <Input label="Ciudad" {...register('city')} error={errors.city} required />
                    <Input label="Dirección" className="md:col-span-2" {...register('address')} error={errors.address} required />
                </div>
            </FormSection>

            <FormSection title="2. Información de la Balanza">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Marca" {...register('brand')} error={errors.brand} required />
                    <Input label="Modelo" {...register('model')} error={errors.model} required />
                    <Input label="Número de Serie" {...register('serialNumber')} error={errors.serialNumber} required />
                    <Input 
                        type="date" 
                        label="Fecha de Entrega" 
                        {...register('deliveryDate')} 
                        error={errors.deliveryDate} 
                        required 
                    />
                    
                     <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                             Estado <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('status')}
                            className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.status ? 'border-red-500' : 'border-gray-300'}`}
                        >
                            <option value="nuevo">Nuevo</option>
                            <option value="usado">Usado</option>
                            <option value="reparado">Reparado</option>
                        </select>
                        {errors.status && <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>}
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                    <textarea 
                        {...register('notes')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        rows={3}
                    />
                </div>
            </FormSection>

            <FormSection title="3. Información del Técnico">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input label="Nombre del Técnico" {...register('techName')} error={errors.techName} required />
                     <Input label="ID Técnico" {...register('techId')} error={errors.techId} required />
                     <Input 
                        type="datetime-local" 
                        label="Fecha y Hora" 
                        {...register('serviceTimestamp')} 
                        error={errors.serviceTimestamp} 
                        required 
                    />
                </div>
            </FormSection>

            <FormSection title="4. Evidencias Fotográficas">
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

            <FormSection title="5. Conformidad y Firmas">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Controller
                        control={control}
                        name="clientSignature"
                        render={({ field }) => (
                            <SignatureField 
                                label="Firma del Cliente" 
                                onEnd={field.onChange}
                                error={errors.clientSignature}
                            />
                        )}
                    />
                     <Controller
                        control={control}
                        name="techSignature"
                        render={({ field }) => (
                            <SignatureField 
                                label="Firma del Técnico" 
                                onEnd={field.onChange}
                                error={errors.techSignature}
                            />
                        )}
                    />
                 </div>
            </FormSection>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 sm:mx-0 sm:rounded-lg shadow-lg flex justify-between items-center z-20">
                 <div className="text-sm text-gray-500 hidden sm:block">
                    * Todos los campos marcados son obligatorios
                 </div>
                 <Button type="submit" size="lg" isLoading={isLoading} className="w-full sm:w-auto">
                    <Save className="h-5 w-5 mr-2" />
                    Registrar Entrega
                 </Button>
            </div>

        </form>
      </main>
    </div>
  );
}

export default App;
