import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Save, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SearchableInput } from '../../../shared/components/ui/SearchableInput';
import { TASK_TYPE_CONFIG } from './GanttTaskCell';

const STATE_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'completado', label: 'Completado' }
];

const TIPO_TRABAJO_POR_AREA = {
  "Calibración": [
    { value: 'calibracion_tanques', label: '1 Calibracion de Tanques' },
    { value: 'calibracion_balanzas', label: '2 Calibracion de Balanzas' },
    { value: 'calibracion_pesas', label: '3 Calibracion de Pesas' }
  ],
  "Soporte Técnico": [
    { value: 'mp_regular', label: 'Mantenimiento Preventivo Regular' },
    { value: 'mp_avanzado', label: 'Mantenimiento Preventivo Avanzado' },
    { value: 'mantenimiento_regular', label: 'Mantenimiento Regular' },
    { value: 'diagnostico', label: 'Diagnostico' },
    { value: 'relevamiento', label: 'Relevamiento de Datos' },
    { value: 'verificaciones', label: 'Verificaciones Internas' },
    { value: 'ajustes', label: 'Ajustes Metrológicos' },
    { value: 'instalacion', label: 'Instalacion' }
  ],
  "Comercial": [
    { value: 'visita_comercial', label: 'Visita Comercial' },
    { value: 'relevamiento', label: 'Relevamiento de Datos' }
  ]
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function EventFormModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  tecnicos, 
  event = null 
}) {
  const [formData, setFormData] = useState({
    Tecnico: '',
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    fecha_fin: format(new Date(), 'yyyy-MM-dd'),
    tipo: 'calibracion', // default
    estado: 'pendiente',
    cod_metrica: '',
    descripcion: '',
    cliente: '',
    codigo_cliente: '',
    codigo_planta: ''
  });

  const [plantas, setPlantas] = useState([]);
  const [loadingPlantas, setLoadingPlantas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing event data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setFormData({
          Tecnico: event.Tecnico || '',
          fecha_inicio: typeof event.fecha_inicio === 'string' ? event.fecha_inicio.substring(0, 10) : format(new Date(event.fecha_inicio), 'yyyy-MM-dd'),
          fecha_fin: typeof event.fecha_fin === 'string' ? event.fecha_fin.substring(0, 10) : format(new Date(event.fecha_fin), 'yyyy-MM-dd'),
          tipo: event.tipo || 'calibracion',
          estado: event.estado || 'pendiente',
          cod_metrica: event.cod_metrica || '',
          descripcion: event.descripcion || '',
          cliente: event.cliente || '',
          codigo_cliente: event.codigo_cliente || '',
          codigo_planta: event.codigo_planta || ''
        });

        if (event.codigo_cliente) {
          fetchPlantas(event.codigo_cliente);
        }
      } else {
        const defaultTecnico = tecnicos.length > 0 ? tecnicos[0].usuario : '';
        const defaultArea = tecnicos.length > 0 ? tecnicos[0].area : 'Calibración';
        const opcionesIniciales = TIPO_TRABAJO_POR_AREA[defaultArea] || TIPO_TRABAJO_POR_AREA["Calibración"];

        // Reset for new event
        setFormData({
          Tecnico: defaultTecnico,
          fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
          fecha_fin: format(new Date(), 'yyyy-MM-dd'),
          tipo: opcionesIniciales[0].value,
          estado: 'pendiente',
          cod_metrica: '',
          descripcion: '',
          cliente: '',
          codigo_cliente: '',
          codigo_planta: ''
        });
        setPlantas([]);
      }
    }
  }, [isOpen, event, tecnicos]);

  const fetchPlantas = async (codigoCliente) => {
    try {
      setLoadingPlantas(true);
      const res = await fetch(`${API_BASE}/clientes/${codigoCliente}/plantas`);
      const json = await res.json();
      if (json.success) {
        setPlantas(json.data);
      }
    } catch (err) {
      console.error('Error fetching plantas:', err);
      setPlantas([]);
    } finally {
      setLoadingPlantas(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el técnico, actualizamos el tipo de trabajo disponible
    if (name === 'Tecnico') {
      const selectedTecnico = tecnicos.find(t => t.usuario === value);
      if (selectedTecnico) {
        const nuevaArea = selectedTecnico.area;
        const opciones = TIPO_TRABAJO_POR_AREA[nuevaArea] || TIPO_TRABAJO_POR_AREA["Calibración"];
        setFormData(prev => ({ ...prev, [name]: value, tipo: opciones[0].value }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectedTecnicoData = tecnicos.find(t => t.usuario === formData.Tecnico);
  const areaActual = selectedTecnicoData?.area || 'Calibración';
  const opcionesTipoTrabajo = TIPO_TRABAJO_POR_AREA[areaActual] || TIPO_TRABAJO_POR_AREA["Calibración"];

  const handleClientSelect = (clientItem) => {
    setFormData(prev => ({
      ...prev,
      cliente: clientItem.razonsocial || clientItem.cliente,
      codigo_cliente: clientItem.codigo_cliente,
      codigo_planta: '' // Reset planta on client change
    }));
    fetchPlantas(clientItem.codigo_cliente);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Formatear datos antes de enviar
      const submissionData = {
        ...formData,
        codigo_cliente: formData.codigo_cliente ? parseInt(formData.codigo_cliente, 10) : null,
        codigo_planta: formData.codigo_planta ? formData.codigo_planta : null,
        cod_metrica: formData.cod_metrica ? formData.cod_metrica : null,
        descripcion: formData.descripcion ? formData.descripcion : null
      };

      await onSave(submissionData, event?.id); // pases ID if editing
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Error al guardar la tarea");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('¿Está seguro de que desea eliminar esta tarea?')) {
      setIsSubmitting(true);
      try {
        await onDelete(event.id);
        onClose();
      } catch (error) {
        console.error("Error deleting event:", error);
        alert("Error al eliminar la tarea");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-primary-900/40 text-primary-400 rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-semibold text-gray-100">
              {event ? 'Editar Tarea' : 'Nueva Tarea'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Scrollable Form */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-5">
            
            {/* Row 1: Tecnico & Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-1">
                <label className="text-sm font-medium text-gray-300">Técnico *</label>
                <select 
                  name="Tecnico" 
                  value={formData.Tecnico} 
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="" disabled>Seleccione...</option>
                  {tecnicos.map(t => (
                    <option key={t.usuario} value={t.usuario}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Inicio *</label>
                <input 
                  type="date" 
                  name="fecha_inicio" 
                  value={formData.fecha_inicio} 
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Fin *</label>
                <input 
                  type="date" 
                  name="fecha_fin" 
                  value={formData.fecha_fin} 
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200"
                />
              </div>
            </div>

            {/* Row 2: Cliente & Planta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700/30 pt-4">
              <div className="space-y-1 relative">
                <SearchableInput
                  label="Cliente"
                  value={formData.cliente}
                  onChange={(val) => setFormData(prev => ({...prev, cliente: val}))}
                  onSelect={handleClientSelect}
                  placeholder="Buscar cliente..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Planta Obra</label>
                <div className="relative">
                  <select 
                    name="codigo_planta" 
                    value={formData.codigo_planta} 
                    onChange={handleChange}
                    disabled={!formData.codigo_cliente || loadingPlantas}
                    className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
                  >
                    <option value="">{loadingPlantas ? 'Cargando...' : 'Seleccione (Opcional)'}</option>
                    {plantas.map(p => (
                      <option key={p.codigo_planta} value={p.codigo_planta}>
                        {p.codigo_planta} {p.dir ? `- ${p.dir}` : ''} {p.localidad ? `(${p.localidad})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3: Tipo & Estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700/30 pt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Tipo de Trabajo *</label>
                <select 
                  name="tipo" 
                  value={formData.tipo} 
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {opcionesTipoTrabajo.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Estado *</label>
                <select 
                  name="estado" 
                  value={formData.estado} 
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {STATE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Referencia (Cod) & Descripción */}
            <div className="space-y-4 border-t border-gray-700/30 pt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Código / Referencia</label>
                <input 
                  type="text" 
                  name="cod_metrica" 
                  value={formData.cod_metrica} 
                  onChange={handleChange}
                  placeholder="Ej. C010-C01-161"
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Descripción / Detalles</label>
                <textarea 
                  name="descripcion" 
                  value={formData.descripcion} 
                  onChange={handleChange}
                  rows={2}
                  className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2 text-gray-200 resize-none font-mono text-sm"
                  placeholder="Detalles del trabajo a realizar..."
                />
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-900/30 flex justify-between items-center">
          <div>
            {event && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="event-form"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary-600/20 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Tarea
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
