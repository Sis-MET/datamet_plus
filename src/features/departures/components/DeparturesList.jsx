import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Loader2, ChevronDown } from 'lucide-react';
import { useTheme } from '../../../shared/context/ThemeContext';
import { TIPOS_SALIDA } from './DepartureFormModal';

// ── 3 estados del flujo de aprobación ──
const ESTADOS_SALIDA = ['Solicitud', 'Aceptado', 'Aprobado'];

function estadoBadge(estado, dark) {
  switch (estado) {
    case 'Aceptado':  return dark ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'     : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
    case 'Aprobado':  return dark ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    default:          return dark ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30'  : 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200'; // Solicitud
  }
}

function DepartureCard({ dep, tecnicos, onChangeState, isAdmin }) {
  const { isDarkGantt } = useTheme();
  const [stateOpen, setStateOpen] = useState(false);
  const [localState, setLocalState] = useState(dep.estado);
  const [updating,   setUpdating]   = useState(false);

  const tecnico  = tecnicos.find(t => t.id === dep.tecnicoId);
  const tipoInfo = TIPOS_SALIDA.find(t => t.value === dep.tipoSalida);
  const color    = tipoInfo?.color || dep.color || '#7c3aed';
  const dateLabel = format(dep.fecha, "EEE d MMM", { locale: es });

  const handleStateChange = async (newState) => {
    setStateOpen(false);
    setUpdating(true);
    setLocalState(newState);
    try   { await onChangeState(dep, newState); }
    catch { setLocalState(dep.estado); }
    finally { setUpdating(false); }
  };

  return (
    <div className={`rounded-xl border transition-all hover:border-white/20 ${isDarkGantt ? 'border-white/[0.07] hover:bg-white/[0.02]' : 'border-gray-200 hover:border-gray-300 hover:bg-black/[0.01]'}`}
      style={{ background: isDarkGantt ? 'rgba(73,73,73,0.18)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

      {/* Stripe de color del tipo de salida */}
      <div className="h-0.5 rounded-t-xl" style={{ background: color }} />

      <div className="px-3 py-2.5">
        {/* Fila 1: persona + fecha + estado */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Inicial con color del tipo */}
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white shadow-sm"
              style={{ background: color }}>
              {(tecnico?.nombre || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-bold truncate leading-none ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>
                {tecnico?.nombre || dep.tecnicoId}
              </p>
              <p className={`text-[10px] capitalize mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{dateLabel}</p>
            </div>
          </div>

          {/* Estado badge / selector — mismo patrón del LeftFilterSidebar */}
          <div className="relative flex-shrink-0">
            {isAdmin ? (
              <>
                <button onClick={() => setStateOpen(o => !o)} disabled={updating}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${estadoBadge(localState, isDarkGantt)} ${updating ? 'opacity-60' : 'cursor-pointer hover:opacity-80'}`}>
                  {updating ? <Loader2 size={8} className="animate-spin" /> : localState}
                  <ChevronDown size={8} className={`transition-transform ${stateOpen ? 'rotate-180' : ''}`} />
                </button>
                {stateOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setStateOpen(false)} />
                    <div className={`absolute right-0 top-[calc(100%+4px)] z-50 w-32 rounded-xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}
                      style={{ background: isDarkGantt ? 'rgba(30,30,35,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}>
                      {ESTADOS_SALIDA.map(s => (
                        <button key={s} onClick={() => handleStateChange(s)}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${s === localState ? (isDarkGantt ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') : (isDarkGantt ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100')}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${estadoBadge(localState, isDarkGantt)}`}>{localState}</span>
            )}
          </div>
        </div>

        {/* Fila 2: tipo con punto de color */}
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className={`text-xs font-bold truncate ${isDarkGantt ? 'text-gray-200' : 'text-gray-800'}`}>{tipoInfo?.label || dep.tipoSalida}</span>
        </div>

        {/* Fila 3: motivo */}
        {dep.motivo && (
          <p className={`text-[10px] truncate pl-3.5 mb-1.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{dep.motivo}</p>
        )}

        {/* Fila 4: horario — mismo estilo que en LeftFilterSidebar */}
        <div className="flex items-center gap-1 pl-0.5">
          <Clock size={10} className={isDarkGantt ? 'text-blue-300 opacity-70' : 'text-blue-600 opacity-70'} />
          <span className={`text-[10px] font-mono font-semibold leading-none opacity-80 ${isDarkGantt ? 'text-blue-300' : 'text-blue-600'}`}>
            {dep.horaInicio || '--:--'} {dep.horaFin ? `→ ${dep.horaFin}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DeparturesList({ departures, tecnicos, loading, onChangeState, isAdmin }) {
  const { isDarkGantt } = useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className={`animate-spin ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
          <p className={`text-xs font-medium ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>Cargando salidas...</p>
        </div>
      </div>
    );
  }

  if (departures.length === 0) {
    return (
      <div className={`flex items-center justify-center py-16 border rounded-2xl border-dashed opacity-40 ${isDarkGantt ? 'border-white/10' : 'border-gray-300'}`}>
        <p className={`text-xs font-bold tracking-widest uppercase ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>Sin registros para el período</p>
      </div>
    );
  }

  // Agrupar por fecha — mismo patrón que el Detalle del Día del LeftFilterSidebar
  const byDate = departures.reduce((acc, dep) => {
    const key = format(dep.fecha, 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = { date: dep.fecha, items: [] };
    acc[key].items.push(dep);
    return acc;
  }, {});

  const groups = Object.values(byDate).sort((a, b) => b.date - a.date);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(group => {
        const dayLabel = format(group.date, "EEEE d 'de' MMMM yyyy", { locale: es });
        const dayLabelCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
        return (
          <div key={format(group.date, 'yyyy-MM-dd')}>
            {/* Separador de fecha — mismo estilo que el área separator del Gantt */}
            <div className={`flex items-center py-1.5 border-b mb-2 ${isDarkGantt ? 'bg-[#111114] border-gray-700/30' : 'bg-[#dcdce6]/40 border-gray-300/40'}`}>
              <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-1 ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>{dayLabelCap}</span>
              <div className={`flex-1 h-[1px] bg-gradient-to-r ml-2 ${isDarkGantt ? 'from-gray-700/40' : 'from-gray-400/40'} to-transparent`} />
              <span className={`text-[9px] font-bold px-3 ${isDarkGantt ? 'text-gray-600' : 'text-gray-500'}`}>{group.items.length}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {group.items.map(dep => (
                <DepartureCard key={dep.id} dep={dep} tecnicos={tecnicos} onChangeState={onChangeState} isAdmin={isAdmin} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
