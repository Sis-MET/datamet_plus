import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formSchema } from '../../../utils/validations';
import { APP_VERSION } from '../../../shared/utils/appVersion';
import { rimApi } from '../api/rim';
import { nuevoUuid, registroWebDesdeFormulario } from '../domain/rim';
import { fotoParaRegistro } from '../utils/fotos';

export function useRimForm(currentUser) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [showPlanta, setShowPlanta] = useState(false);
  const [selectedPlanta, setSelectedPlanta] = useState('');
  const [plantas, setPlantas] = useState([]);
  const [plantasLoading, setPlantasLoading] = useState(false);
  // Identifica el RIM antes de registrarlo: reintentar no consume otro número.
  const [uuid, setUuid] = useState(nuevoUuid);
  const [registrado, setRegistrado] = useState(null);
  const [submitError, setSubmitError] = useState(null);

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

  /**
   * Registra el RIM en el servidor, que le asigna su número RIM-AA-NNNN, y
   * recién entonces genera el PDF con ese código.
   */
  const onSubmit = async (data) => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      const fotos = await Promise.all((data.photos || []).map(file => fotoParaRegistro(file)));
      const plantaInfo = plantas.find(planta => planta.codigo_planta === data.planta);
      const registro = await rimApi.registrar(registroWebDesdeFormulario(data, {
        uuid,
        clienteId,
        plantaCodigo: data.planta || null,
        plantaNombre: data.plantaDireccion || plantaInfo?.dir || null,
        fotos,
        appVersion: `DataMET+ ${APP_VERSION}`,
      }));

      let pdf = false;
      try {
        const { generatePDF } = await import('../../../utils/pdfGenerator.jsx');
        const pdfResult = await generatePDF({
          ...data,
          photos: fotos.map(foto => ({ name: foto.nombre, content: foto.contenido })),
        }, registro.codigo);
        pdf = Boolean(pdfResult?.success);
      } catch (error) {
        console.error('Error al generar el PDF del RIM:', error);
      }

      setRegistrado({ ...registro, pdf });
      form.reset();
      setUuid(nuevoUuid());
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      // El formulario conserva lo llenado: reintentar usa el mismo RIM.
      setSubmitError(error?.message || 'No se pudo registrar el RIM.');
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
      setRegistrado(null);
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    currentStep,
    isLoading,
    registrado,
    submitError,
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
    gestion: technicianInfo.timestamp.getFullYear(),
    form,
    otherFields,
    appendOther,
    removeOther,
    onSubmit: form.handleSubmit(onSubmit),
    nextStep,
    prevStep,
  };
}
