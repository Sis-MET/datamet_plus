import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../../shared/context/ThemeContext';
import { generateRIMCode } from '../utils/rimCode';
import { fileToBase64 } from '../../../utils/files';
import { formSchema } from '../../../utils/validations';
import { rimApi } from '../api/rim';

export function useRimForm(currentUser) {
  const { isDarkGantt } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [showPlanta, setShowPlanta] = useState(false);
  const [selectedPlanta, setSelectedPlanta] = useState('');
  const [plantas, setPlantas] = useState([]);
  const [plantasLoading, setPlantasLoading] = useState(false);

  const technicianInfo = useMemo(() => ({ timestamp: new Date() }), []);

  const userFullName = currentUser
    ? `${currentUser.nombre} ${currentUser.apellido}`.trim()
    : 'Usuario Desconocido';
  const userRole = currentUser?.cargo || 'TÉCNICO';

  const fetchPlantas = useCallback(async (id) => {
    if (!id) return;
    setPlantasLoading(true);
    try {
      const data = await rimApi.getPlantas(id);
      if (data.success) setPlantas(data.data);
    } catch (e) {
      console.error('Error al cargar plantas:', e);
    } finally {
      setPlantasLoading(false);
    }
  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photos: [],
      damageTypes: {},
      dirtTypes: {},
      affectedAreas: [],
      inventory: {},
    },
  });

  const { fields: otherFields, append: appendOther, remove: removeOther } = useFieldArray({
    control: form.control,
    name: 'inventory.otherItems',
  });

  const currentPlantaCode = form.watch('planta');
  const rimCode = generateRIMCode(clienteId, currentPlantaCode, technicianInfo.timestamp.getFullYear());

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const processedPhotos = await Promise.all(
        data.photos.map(async (file) => {
          const base64 = await fileToBase64(file);
          return { name: file.name, size: file.size, type: file.type, content: base64 };
        })
      );

      const { generatePDF } = await import('../../../utils/pdfGenerator.jsx');
      const pdfResult = await generatePDF({ ...data, photos: processedPhotos }, rimCode);
      if (!pdfResult.success) {
        alert('El formulario se procesó correctamente, pero hubo un error al generar el PDF.');
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
      form.reset();
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      alert('Error al procesar el formulario');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    const stepFields = {
      1: ['companyName', 'companyRazonSocial', 'taxId', 'address', 'city', 'clientName', 'clientCargo', 'phone', 'email'],
      2: ['instrument', 'brand', 'model', 'serialNumber', 'maxCapacity', 'unit', 'resolution', 'workArea'],
      3: ['damageLevel', 'cleanlinessLevel'],
    };
    const fieldsToValidate = stepFields[currentStep] || [];
    const isStepValid = await form.trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    isDarkGantt,
    currentStep,
    isLoading,
    success,
    clienteId,
    showPlanta,
    selectedPlanta,
    plantas,
    plantasLoading,
    setClienteId,
    setShowPlanta,
    setSelectedPlanta,
    fetchPlantas,
    userFullName,
    userRole,
    rimCode,
    form,
    otherFields,
    appendOther,
    removeOther,
    onSubmit: form.handleSubmit(onSubmit),
    nextStep,
    prevStep,
  };
}
