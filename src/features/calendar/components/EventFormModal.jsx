import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Save, Trash2, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function EventFormModal({ 
  isOpen, 
  onClose, 
  onSave, 
  tecnicos, 
  event = null,
  prefilledDate = new Date(),
  prefilledResource = ''
}) {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    resource: '',
    text: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos existentes o los preseleccionados cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Modo Edición
        setFormData({
          date: format(new Date(event.fecha), 'yyyy-MM-dd'),
          resource: event.Tecnico || '',
          text: event.texto || ''
        });
      } else {
        // Modo Nueva celda
        const defaultResource = prefilledResource || (tecnicos.length > 0 ? tecnicos[0].id : '');
        setFormData({
          date: format(prefilledDate, 'yyyy-MM-dd'),
          resource: defaultResource,
          text: ''
        });
      }
    }
  }, [isOpen, event, tecnicos, prefilledDate, prefilledResource]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData.date, formData.resource, formData.text);
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Error al guardar la tarea");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('¿Está seguro de que desea eliminar el texto de esta celda?')) {
      setIsSubmitting(true);
      try {
        // En nuestro esquema plano, eliminar significa actualizar con texto vacío
        await onSave(formData.date, formData.resource, '');
        onClose();
      } catch (error) {
        console.error("Error deleting event:", error);
        alert("Error al limpiar la celda");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  // Formato bonito de fecha para el Header
  const dateObj = new Date(formData.date + 'T00:00:00'); // Evitar timezone issues
  const dateLabel = format(dateObj, "EEEE d 'de' MMMM, yyyy", { locale: es });
  const dateLabelCapitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-primary-900/40 text-primary-400 rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                Detalle del Día
              </h2>
              <p className="text-xs text-primary-300/80">{dateLabelCapitalized}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Form */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="cell-form" onSubmit={handleSubmit} className="space-y-5">
            
            {/* Combo Recursos */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4 text-gray-400" /> Recurso asignado
              </label>
              <select 
                name="resource" 
                value={formData.resource} 
                onChange={handleChange}
                required
                className="w-full bg-[#1e1e1e] border border-gray-600 rounded-lg px-3 py-2.5 text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                disabled={!!event} // Si es edición de una celda específica, bloqueamos para no mover la tarea accidentalmente de columna
              >
                <option value="" disabled>Seleccione...</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} {t.cargo === 'Vehículo' ? '(Vehículo)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Texto Libre */}
            <div className="space-y-1 pt-2">
              <label className="text-sm font-medium text-gray-300">Actividad / Cliente</label>
              <textarea 
                name="text" 
                value={formData.text} 
                onChange={handleChange}
                rows={4}
                required
                className="w-full bg-[#1e1e1e]/60 border border-gray-600 focus:border-primary-500/50 rounded-lg px-4 py-3 text-gray-200 resize-none font-medium placeholder-gray-600 shadow-inner focus:ring-2 focus:ring-primary-500/20 transition-all leading-relaxed"
                placeholder="Ej. Viaje a Embol - La Paz - Mantenimiento de cámaras"
                autoFocus
              />
              <p className="text-[11px] text-gray-500 mt-1">Este texto será visible en la cuadrícula principal.</p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-900/30 flex justify-between items-center">
          <div>
            {event && event.texto && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar celda
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
              form="cell-form"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-primary-600/20 disabled:opacity-70 active:scale-95"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
