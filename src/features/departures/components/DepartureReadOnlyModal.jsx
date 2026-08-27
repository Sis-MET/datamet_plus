import React, { useEffect, useRef } from 'react';
import { X, MapPin, Clock, Calendar, Info, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '../../../shared/context/ThemeContext';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';

export function DepartureReadOnlyModal({ task, date, resourceName, onClose }) {
  usePageScrollLock(Boolean(task));
  const { isDarkGantt } = useTheme();
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!task) return null;

  const bgClass = isDarkGantt ? 'bg-[#1a1a1d]' : 'bg-white';
  const borderClass = isDarkGantt ? 'border-white/10' : 'border-gray-200';
  const textClass = isDarkGantt ? 'text-gray-200' : 'text-gray-800';
  const mutedClass = isDarkGantt ? 'text-gray-500' : 'text-gray-400';

  const getStateColor = (estado) => {
    switch(estado) {
      case 'Aprobado':
      case 'Completado': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case 'Aceptado':
      case 'En Proceso': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'Cancelado': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'Solicitud':
      default: return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        ref={modalRef} 
        className={`w-full max-w-md max-h-[90dvh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-slide-up ${bgClass} ${borderClass}`}
      >
        {/* Header con color de la tarea */}
        <div 
          className="px-5 py-4 flex shrink-0 items-center justify-between border-b relative overflow-hidden"
          style={{ borderColor: isDarkGantt ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: task.colorAM || '#7c3aed' }} />
          <div className="relative z-10 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.colorAM || '#7c3aed' }} />
            <h3 className={`text-sm font-bold uppercase tracking-widest ${textClass}`}>
              Detalle de Salida Personal
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className={`relative z-10 p-1.5 rounded-lg transition-colors hover:bg-black/10 ${mutedClass}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 min-h-0 overflow-y-auto overscroll-contain">
          {/* Técnico y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Personal</p>
              <div className={`flex items-center gap-2 text-sm font-semibold ${textClass}`}>
                <User size={14} className="opacity-70" />
                {resourceName || 'Desconocido'}
              </div>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Fecha</p>
              <div className={`flex items-center gap-2 text-sm font-semibold capitalize ${textClass}`}>
                <Calendar size={14} className="opacity-70" />
                {date ? format(date, "d MMM, yyyy", { locale: es }) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Tipo y Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Tipo de Salida</p>
              <div className={`flex items-center gap-2 text-sm font-semibold ${textClass}`}>
                <MapPin size={14} className="opacity-70" />
                {task.morning || 'No especificado'}
              </div>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Estado</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getStateColor(task.estadoAM)}`}>
                {task.estadoAM || 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Horario */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Rango Horario</p>
            <div className={`flex items-center gap-2 text-sm font-bold font-mono ${textClass}`}>
              <Clock size={14} className="opacity-70" />
              {task.horaInicio || '08:30'} — {task.horaFin || '18:30'}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mutedClass}`}>Motivo / Lugar</p>
            <div className={`p-3 rounded-xl border text-sm leading-relaxed ${isDarkGantt ? 'bg-black/20 border-white/5 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
              {task.descripcion || 'Sin descripción...'}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex shrink-0 items-center justify-between ${isDarkGantt ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-mono ${mutedClass}`}>
            <Info size={12} />
            <span>Módulo de Salidas</span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDarkGantt ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
