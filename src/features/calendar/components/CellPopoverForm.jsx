import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { sileo } from 'sileo';
import { cn } from '../../../shared/utils/cn';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = [
  { label: 'Green', value: '#37A65F' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
];

export function CellPopoverForm({
  isOpen,
  onClose,
  onSave,
  event,
  prefilledDate,
  prefilledResource,
}) {
  const [morning, setMorning] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setMorning(event.morning || '');
        setAfternoon(event.afternoon || '');
        setColor(event.color || COLORS[0].value);
      } else {
        setMorning('');
        setAfternoon('');
        setColor(COLORS[0].value);
      }
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!morning.trim() && !afternoon.trim()) {
      sileo.error({ description: 'Debe ingresar al menos una actividad (Mañana o Tarde)' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(prefilledDate, prefilledResource, {
        morning: morning.trim().toUpperCase(),
        afternoon: afternoon.trim().toUpperCase(),
        color,
      });
      // Sileo success is handled by the parent
    } catch (err) {
      // Sileo error is handled by the parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      // Para limpiar la celda, mandamos campos vacíos
      await onSave(prefilledDate, prefilledResource, { morning: '', afternoon: '', color: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = prefilledDate ? format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es }) : '';
  const dateTitle = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-[#1e1e22]">
          <div>
            <h3 className="text-base font-semibold text-gray-100 uppercase tracking-widest text-[11px] mb-1">
              Recurso: <span className="text-primary-400">{prefilledResource}</span>
            </h3>
            <p className="text-sm font-medium text-gray-400 capitalize">{dateTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Turno Mañana */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Turno Mañana</label>
            <input
              type="text"
              value={morning}
              onChange={(e) => setMorning(e.target.value.toUpperCase())}
              placeholder="EJ: EMBOL - LA PAZ"
              className="w-full bg-[#141414] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono uppercase"
            />
          </div>

          {/* Turno Tarde */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Turno Tarde</label>
            <input
              type="text"
              value={afternoon}
              onChange={(e) => setAfternoon(e.target.value.toUpperCase())}
              placeholder="EJ: EMBOL - EL ALTO"
              className="w-full bg-[#141414] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono uppercase"
            />
          </div>

          {/* Color Picker Lineal */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Color de Etiqueta</label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-transform ring-offset-2 ring-offset-[#1a1a1d]',
                    color === c.value ? 'ring-2 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
                  )}
                  style={{ backgroundColor: c.value, ringColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-gray-800">
            {event ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Limpiar
              </button>
            ) : (
              <div /> // Spacer
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg shadow-lg shadow-primary-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Celda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
