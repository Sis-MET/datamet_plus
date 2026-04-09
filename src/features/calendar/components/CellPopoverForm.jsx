import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Copy } from 'lucide-react';
import { sileo } from 'sileo';
import { cn } from '../../../shared/utils/cn';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HexColorPicker } from 'react-colorful';
import { safeStorage } from '../../../shared/utils/storage';
import { useTheme } from '../../../shared/context/ThemeContext';

const PRESET_COLORS = [
  '#dadd12ff', '#1d2e8fff', '#424242ff', '#ce1515ff', '#621fceff', '#44bfefff'
];



export function CellPopoverForm({
  isOpen,
  onClose,
  onSave,
  event,
  prefilledDate,
  prefilledResource
}) {
  const { isDarkGantt } = useTheme();
  const [morning, setMorning] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [colorAM, setColorAM] = useState(''); 
  const [colorPM, setColorPM] = useState(''); 
  const [estadoAM, setEstadoAM] = useState('Pendiente');
  const [estadoPM, setEstadoPM] = useState('Pendiente');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const colorPickerRefAM = useRef(null);
  const colorPickerRefPM = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeColorPicker === 'am' && colorPickerRefAM.current && !colorPickerRefAM.current.contains(e.target)) {
        setActiveColorPicker(null);
      }
      if (activeColorPicker === 'pm' && colorPickerRefPM.current && !colorPickerRefPM.current.contains(e.target)) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeColorPicker]);

  const [recentColors, setRecentColors] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeStorage.getItem('rimmet_recent_colors');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });

  const saveToRecent = (cAM, cPM) => {
    setRecentColors(prev => {
      let updated = [...prev];
      [cAM, cPM].forEach(c => {
        if (c && !PRESET_COLORS.includes(c)) {
          updated = updated.filter(prevC => prevC !== c);
          updated.unshift(c);
        }
      });
      // Sólo guardar hasta 5
      updated = updated.slice(0, 5);
      safeStorage.setItem('rimmet_recent_colors', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setMorning(event.morning || '');
        setAfternoon(event.afternoon || '');
        setColorAM(event.colorAM || event.color || '');
        setColorPM(event.colorPM || event.color || '');
        setEstadoAM(event.estadoAM || 'Pendiente');
        setEstadoPM(event.estadoPM || 'Pendiente');
      } else {
        setMorning('');
        setAfternoon('');
        setColorAM('');
        setColorPM('');
        setEstadoAM('Pendiente');
        setEstadoPM('Pendiente');
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

    const hasMorning = morning.trim().length > 0;
    const hasAfternoon = afternoon.trim().length > 0;

    setIsSubmitting(true);
    try {
      saveToRecent(colorAM, colorPM);
      await onSave(prefilledDate, prefilledResource, {
        morning: morning.trim().toUpperCase(),
        afternoon: afternoon.trim().toUpperCase(),
        colorAM,
        colorPM,
        estadoAM: hasMorning ? estadoAM : null,
        estadoPM: hasAfternoon ? estadoPM : null,
        lastModified: event ? (event.timestampUpdated || null) : null,
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
      await onSave(prefilledDate, prefilledResource, { morning: '', afternoon: '', colorAM: '', colorPM: '', estadoAM: null, estadoPM: null });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = prefilledDate ? format(prefilledDate, "EEEE, d 'de' MMMM", { locale: es }) : '';
  const dateTitle = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 ${isDarkGantt ? 'bg-black/40' : 'bg-gray-500/30'}`}>
      <div 
        className={`border rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 ${isDarkGantt ? 'bg-[#1a1a1d] border-gray-700/50' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b rounded-t-2xl ${isDarkGantt ? 'border-gray-800 bg-[#1e1e22]' : 'border-gray-200 bg-gray-50'}`}>
          <div>
            <h3 className={`text-base font-semibold uppercase tracking-widest text-[11px] mb-1 ${isDarkGantt ? 'text-gray-100' : 'text-gray-800'}`}>
              Personal: <span className="text-primary-400">{prefilledResource}</span>
            </h3>
            <p className={`text-sm font-medium capitalize ${isDarkGantt ? 'text-gray-400' : 'text-gray-600'}`}>{dateTitle}</p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDarkGantt ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'}`}
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
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>Mañana</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setMorning(''); setColorAM(''); }}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}
                        title="Limpiar Ficha Mañana"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAfternoon(morning); setColorPM(colorAM); setEstadoPM(estadoAM); }}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 hover:text-primary-300' : 'text-primary-600 bg-primary-50 hover:bg-primary-100'}`}
                        title="Copiar datos a Ficha Tarde"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar a Tarde
                      </button>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <input
                      type="text"
                      value={morning}
                      onChange={(e) => setMorning(e.target.value.toUpperCase())}
                      placeholder="EJ: EMBOL - LA PAZ"
                      className={`flex-1 min-w-0 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner ${isDarkGantt ? 'bg-[#111111] border-white/5 text-gray-100 placeholder-gray-700' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    />
                    {/* Botón para abrir Color Picker */}
                    <div className="relative" ref={colorPickerRefAM}>
                       <button
                         type="button"
                         onClick={() => setActiveColorPicker(activeColorPicker === 'am' ? null : 'am')}
                         className={`w-11 h-11 rounded-xl border shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-hidden ${isDarkGantt ? 'border-white/10 ring-offset-[#111]' : 'border-gray-200 ring-offset-white'}`}
                         style={{ backgroundColor: colorAM || 'transparent' }}
                         title="Elegir color AM"
                       >
                         {!colorAM && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMmEyYTMwIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzYTNjNDIiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzNhM2M0MiI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-30" />}
                         <div className={`w-5 h-5 rounded-full border-2 shadow-inner mix-blend-overlay relative z-10 ${isDarkGantt ? 'border-white/40' : 'border-black/20'}`} />
                       </button>

                       {/* Popover Custom Color Picker AM */}
                       {activeColorPicker === 'am' && (
                         <div className={`absolute top-14 right-0 z-50 p-3 border rounded-2xl shadow-2xl animate-fade-in w-56 ${isDarkGantt ? 'bg-[#1e1e24] border-gray-700/50' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                               <span className={`text-xs font-semibold ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>Color AM</span>
                               <button type="button" onClick={() => setActiveColorPicker(null)} className={`hover:text-primary-500 transition-colors ${isDarkGantt ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={14}/></button>
                            </div>
                            <HexColorPicker color={colorAM || PRESET_COLORS[1]} onChange={setColorAM} style={{ width: '100%', height: '120px' }} />
                            
                            <div className="mt-3">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Predefinidos</span>
                              <div className="flex flex-wrap gap-1.5 justify-center">
                                 {PRESET_COLORS.map(c => (
                                   <button
                                     key={c} type="button" onClick={() => setColorAM(c)}
                                     className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                     style={{ backgroundColor: c }}
                                   />
                                 ))}
                              </div>
                            </div>
                            
                            {recentColors.length > 0 && (
                              <div className={`mt-3 border-t pt-2 ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Recientes</span>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                   {recentColors.map((c, i) => (
                                     <button
                                       key={`am-recent-${c}-${i}`} type="button" onClick={() => setColorAM(c)}
                                       className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                       style={{ backgroundColor: c }}
                                     />
                                   ))}
                                </div>
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                 </div>
               </div>
            </div>

          </div>

          {/* Turno Tarde */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
               <div className="flex-1">
                 <div className="flex items-center justify-between mb-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`}>Tarde</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setAfternoon(''); setColorPM(''); }}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isDarkGantt ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}
                        title="Limpiar Ficha Tarde"
                      >
                        <Trash2 className="w-3 h-3" />
                        Limpiar
                      </button>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <input
                      type="text"
                      value={afternoon}
                      onChange={(e) => setAfternoon(e.target.value.toUpperCase())}
                      placeholder="EJ: EMBOL - EL ALTO"
                      className={`flex-1 min-w-0 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all font-mono uppercase shadow-inner ${isDarkGantt ? 'bg-[#111111] border-white/5 text-gray-100 placeholder-gray-700' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    />
                    {/* Botón para abrir Color Picker */}
                    <div className="relative" ref={colorPickerRefPM}>
                       <button
                         type="button"
                         onClick={() => setActiveColorPicker(activeColorPicker === 'pm' ? null : 'pm')}
                         className={`w-11 h-11 rounded-xl border shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-hidden ${isDarkGantt ? 'border-white/10 ring-offset-[#111]' : 'border-gray-200 ring-offset-white'}`}
                         style={{ backgroundColor: colorPM || 'transparent' }}
                         title="Elegir color PM"
                       >
                         {!colorPM && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMmEyYTMwIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzYTNjNDIiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzNhM2M0MiI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-30" />}
                         <div className={`w-5 h-5 rounded-full border-2 shadow-inner mix-blend-overlay relative z-10 ${isDarkGantt ? 'border-white/40' : 'border-black/20'}`} />
                       </button>

                       {/* Popover Custom Color Picker PM */}
                       {activeColorPicker === 'pm' && (
                         <div className={`absolute top-14 right-0 z-50 p-3 border rounded-2xl shadow-2xl animate-fade-in w-56 ${isDarkGantt ? 'bg-[#1e1e24] border-gray-700/50' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                               <span className={`text-xs font-semibold ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>Color PM</span>
                               <button type="button" onClick={() => setActiveColorPicker(null)} className={`hover:text-primary-500 transition-colors ${isDarkGantt ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={14}/></button>
                            </div>
                            <HexColorPicker color={colorPM || PRESET_COLORS[1]} onChange={setColorPM} style={{ width: '100%', height: '120px' }} />
                            
                            <div className="mt-3">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Predefinidos</span>
                              <div className="flex flex-wrap gap-1.5 justify-center">
                                 {PRESET_COLORS.map(c => (
                                   <button
                                     key={c} type="button" onClick={() => setColorPM(c)}
                                     className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                     style={{ backgroundColor: c }}
                                   />
                                 ))}
                              </div>
                            </div>

                            {recentColors.length > 0 && (
                              <div className={`mt-3 border-t pt-2 ${isDarkGantt ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 block mb-1.5">Recientes</span>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                   {recentColors.map((c, i) => (
                                     <button
                                       key={`pm-recent-${c}-${i}`} type="button" onClick={() => setColorPM(c)}
                                       className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ring-1 ${isDarkGantt ? 'ring-white/10' : 'ring-black/5'}`}
                                       style={{ backgroundColor: c }}
                                     />
                                   ))}
                                </div>
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                 </div>
               </div>
            </div>

          </div>

          {/* Metadata de Auditoría (Solo Lectura) */}
          {event && (event.author || event.timestampUpdated) && (
            <div className={`border rounded-lg p-3 mt-2 ${isDarkGantt ? 'bg-[#111111]/50 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-[12px] text-gray-500 font-mono leading-tight">
                {event.author && <span>Actualizado por: <span className="text-primary-400/80 font-medium">{event.author}</span><br/></span>}
                {event.timestampUpdated && <span>El {event.timestampUpdated}</span>}
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className={`pt-4 flex items-center justify-between border-t ${isDarkGantt ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>

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
