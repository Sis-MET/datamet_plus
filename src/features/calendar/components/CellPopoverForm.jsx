import React, { useState, useEffect } from 'react';
import { X, Trash2, Copy } from 'lucide-react';
import { sileo } from 'sileo';
import { cn } from '../../../shared/utils/cn';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';

const PRESET_COLORS = [
  '#10B981', '#37A65F', '#84CC16', '#F59E0B', '#F97316', '#EF4444'
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
  const [colorAM, setColorAM] = useState(PRESET_COLORS[1]); 
  const [colorPM, setColorPM] = useState(PRESET_COLORS[1]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setMorning(event.morning || '');
        setAfternoon(event.afternoon || '');
        setColorAM(event.colorAM || event.color || PRESET_COLORS[1]);
        setColorPM(event.colorPM || event.color || PRESET_COLORS[1]);
      } else {
        setMorning('');
        setAfternoon('');
        setColorAM(PRESET_COLORS[1]);
        setColorPM(PRESET_COLORS[1]);
      }
      setActiveColorPicker(null);
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
        colorAM,
        colorPM,
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
      await onSave(prefilledDate, prefilledResource, { morning: '', afternoon: '', colorAM: '', colorPM: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = prefilledDate ? format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es }) : '';
  const dateTitle = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1a1a1d] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-[#1e1e22] rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-gray-100 uppercase tracking-widest text-[11px] mb-1">
              Personal: <span className="text-primary-400">{prefilledResource}</span>
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
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
               <div className="flex-1">
                 <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mañana</label>
                    <button
                      type="button"
                      onClick={() => { setAfternoon(morning); setColorPM(colorAM); }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 hover:text-primary-300 transition-colors"
                      title="Copiar datos a Turno Tarde"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar a Tarde
                    </button>
                 </div>
                 <div className="flex gap-2">
                    {/* Botón para abrir Color Picker */}
                    <div className="relative">
                       <button
                         type="button"
                         onClick={() => setActiveColorPicker(activeColorPicker === 'am' ? null : 'am')}
                         className="w-11 h-11 rounded-xl border border-white/10 shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-offset-2 ring-offset-[#111] focus:outline-none focus:ring-2 focus:ring-primary-500"
                         style={{ backgroundColor: colorAM }}
                         title="Elegir color AM"
                       >
                         <div className="w-5 h-5 rounded-full border-2 border-white/40 shadow-inner mix-blend-overlay" />
                       </button>

                       {/* Popover Custom Color Picker AM */}
                       {activeColorPicker === 'am' && (
                         <div className="absolute top-14 left-0 z-50 p-3 bg-[#1e1e24] border border-gray-700/50 rounded-2xl shadow-2xl animate-fade-in w-56">
                            <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-semibold text-gray-300">Color AM</span>
                               <button type="button" onClick={() => setActiveColorPicker(null)} className="text-gray-500 hover:text-white"><X size={14}/></button>
                            </div>
                            <HexColorPicker color={colorAM} onChange={setColorAM} style={{ width: '100%', height: '120px' }} />
                            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                               {PRESET_COLORS.map(c => (
                                 <button
                                   key={c} type="button" onClick={() => setColorAM(c)}
                                   className="w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm"
                                   style={{ backgroundColor: c }}
                                 />
                               ))}
                            </div>
                         </div>
                       )}
                    </div>
                    <input
                      type="text"
                      value={morning}
                      onChange={(e) => setMorning(e.target.value.toUpperCase())}
                      placeholder="EJ: EMBOL - LA PAZ"
                      className="flex-1 min-w-0 bg-[#111111] border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-700 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner"
                    />
                 </div>
               </div>
            </div>
          </div>

          {/* Turno Tarde */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
               <div className="flex-1">
                 <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tarde</label>
                 </div>
                 <div className="flex gap-2">
                    {/* Botón para abrir Color Picker */}
                    <div className="relative">
                       <button
                         type="button"
                         onClick={() => setActiveColorPicker(activeColorPicker === 'pm' ? null : 'pm')}
                         className="w-11 h-11 rounded-xl border border-white/10 shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-offset-2 ring-offset-[#111] focus:outline-none focus:ring-2 focus:ring-primary-500"
                         style={{ backgroundColor: colorPM }}
                         title="Elegir color PM"
                       >
                         <div className="w-5 h-5 rounded-full border-2 border-white/40 shadow-inner mix-blend-overlay" />
                       </button>

                       {/* Popover Custom Color Picker PM */}
                       {activeColorPicker === 'pm' && (
                         <div className="absolute top-14 left-0 z-50 p-3 bg-[#1e1e24] border border-gray-700/50 rounded-2xl shadow-2xl animate-fade-in w-56">
                            <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-semibold text-gray-300">Color PM</span>
                               <button type="button" onClick={() => setActiveColorPicker(null)} className="text-gray-500 hover:text-white"><X size={14}/></button>
                            </div>
                            <HexColorPicker color={colorPM} onChange={setColorPM} style={{ width: '100%', height: '120px' }} />
                            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                               {PRESET_COLORS.map(c => (
                                 <button
                                   key={c} type="button" onClick={() => setColorPM(c)}
                                   className="w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm"
                                   style={{ backgroundColor: c }}
                                 />
                               ))}
                            </div>
                         </div>
                       )}
                    </div>
                    <input
                      type="text"
                      value={afternoon}
                      onChange={(e) => setAfternoon(e.target.value.toUpperCase())}
                      placeholder="EJ: EMBOL - EL ALTO"
                      className="flex-1 min-w-0 bg-[#111111] border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-700 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner"
                    />
                 </div>
               </div>
            </div>
          </div>

          {/* Metadata de Auditoría (Solo Lectura) */}
          {event && (event.author || event.timestampUpdated) && (
            <div className="bg-[#111111]/50 border border-white/5 rounded-lg p-3 mt-2">
              <p className="text-[10px] text-gray-500 font-mono leading-tight">
                {event.author && <span>Actualizado por: <span className="text-primary-400/80 font-medium">{event.author}</span><br/></span>}
                {event.timestampUpdated && <span>El {event.timestampUpdated}</span>}
              </p>
            </div>
          )}

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
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
