import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Loader2, ChevronDown, CheckCircle2, ClipboardList, UserCheck } from 'lucide-react';
import { useTheme } from '../../../shared/context/ThemeContext';
import { TIPOS_SALIDA } from '../constants';

// ── Los 3 estados del flujo ──
const PANELES = [
  {
    estado:    'Solicitud',
    label:     'Por Aceptar',
    sublabel:  'Esperando aprobación del jefe de área',
    icon:      ClipboardList,
    accent:    { dark: 'text-yellow-400', light: 'text-yellow-600' },
    badge:     { dark: 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30', light: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' },
    border:    { dark: 'border-yellow-500/20', light: 'border-yellow-300/40' },
    header:    { dark: 'from-yellow-500/10', light: 'from-yellow-100/60' },
  },
  {
    estado:    'Aceptado',
    label:     'En Salida Activa',
    sublabel:  'Aceptadas por el jefe de área',
    icon:      UserCheck,
    accent:    { dark: 'text-blue-400', light: 'text-blue-600' },
    badge:     { dark: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30', light: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
    border:    { dark: 'border-blue-500/20', light: 'border-blue-300/40' },
    header:    { dark: 'from-blue-500/10', light: 'from-blue-100/60' },
  },
  {
    estado:    'Aprobado',
    label:     'Aprobadas',
    sublabel:  'Aprobación administrativa completa',
    icon:      CheckCircle2,
    accent:    { dark: 'text-emerald-400', light: 'text-emerald-600' },
    badge:     { dark: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30', light: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    border:    { dark: 'border-emerald-500/20', light: 'border-emerald-300/40' },
    header:    { dark: 'from-emerald-500/10', light: 'from-emerald-100/60' },
  },
];

const ESTADOS_SALIDA = PANELES.map(p => p.estado);

function estadoBadge(estado, dark) {
  return PANELES.find(p => p.estado === estado)?.[dark ? 'badge' : 'badge']?.[dark ? 'dark' : 'light']
    ?? (dark ? 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/30' : 'bg-gray-100 text-gray-600');
}

/** Dropdown en portal — evita clipping por backdrop-filter stacking context */
function StateDropdown({ anchorRef, open, onClose, children, isDarkGantt }) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const recalc = () => {
      if (anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
      }
    };

    recalc();

    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div
        className={`fixed z-[9991] w-32 rounded-xl border shadow-2xl overflow-hidden ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}
        style={{
          top:   pos.top,
          right: pos.right,
          background: isDarkGantt ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ── Tarjeta de una salida individual ──
function DepartureCard({ dep, tecnicos, onChangeState, isAdmin, panel }) {
  const { isDarkGantt } = useTheme();
  const [stateOpen, setStateOpen] = useState(false);
  const [localState, setLocalState] = useState(dep.estado);
  const [updating,   setUpdating]   = useState(false);
  const buttonRef = useRef(null);

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
    <div
      className={`rounded-xl border transition-all ${isDarkGantt ? 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03]' : 'border-gray-200 hover:border-gray-300 hover:bg-black/[0.02]'}`}
      style={{
        background: isDarkGantt ? 'rgba(73,73,73,0.18)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTopColor: color,
        borderTopWidth: '2px',
      }}>


      <div className="px-3 py-2.5">
        {/* Persona + fecha */}
        <div className="flex items-center gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-bold truncate leading-none ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>
              {tecnico?.nombre || dep.tecnicoId}
            </p>
            <p className={`text-[10px] capitalize mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{dateLabel}</p>
          </div>
          {/* Badge de estado — clicable si es admin */}
          <div className="relative flex-shrink-0">
            {isAdmin ? (
              <>
                <button
                  ref={buttonRef}
                  onClick={() => setStateOpen(o => !o)}
                  disabled={updating}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${estadoBadge(localState, isDarkGantt)} ${updating ? 'opacity-60' : 'cursor-pointer hover:opacity-75'}`}>
                  {updating ? <Loader2 size={8} className="animate-spin" /> : localState}
                  <ChevronDown size={8} className={`transition-transform ${stateOpen ? 'rotate-180' : ''}`} />
                </button>
                <StateDropdown
                  anchorRef={buttonRef}
                  open={stateOpen}
                  onClose={() => setStateOpen(false)}
                  isDarkGantt={isDarkGantt}
                >
                  {ESTADOS_SALIDA.map(s => (
                    <button key={s} onClick={() => handleStateChange(s)}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${s === localState ? (isDarkGantt ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') : (isDarkGantt ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-700 hover:bg-gray-100')}`}>
                      {s}
                    </button>
                  ))}
                </StateDropdown>
              </>
            ) : (
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${estadoBadge(localState, isDarkGantt)}`}>{localState}</span>
            )}
          </div>
        </div>

        {/* Tipo con punto de color */}
        <div className="flex items-center gap-1.5 mb-1 pl-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className={`text-[11px] font-bold truncate ${isDarkGantt ? 'text-gray-200' : 'text-gray-700'}`}>{tipoInfo?.label || dep.tipoSalida}</span>
        </div>

        {/* Motivo */}
        {dep.motivo && (
          <p className={`text-[10px] truncate pl-3.5 mb-1.5 leading-tight ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{dep.motivo}</p>
        )}

        {/* Horario — mismo estilo LeftFilterSidebar */}
        <div className={`flex items-center gap-1 pt-2 border-t ${isDarkGantt ? 'border-white/[0.06]' : 'border-gray-100'}`}>
          <Clock size={10} className={`${isDarkGantt ? 'text-blue-300 opacity-70' : 'text-blue-600 opacity-70'}`} />
          <span className={`text-[10px] font-mono font-semibold opacity-80 ${isDarkGantt ? 'text-blue-300' : 'text-blue-600'}`}>
            {dep.horaInicio || '--:--'} {dep.horaFin ? `→ ${dep.horaFin}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Panel por estado (columna) ──
function Panel({ panel, departures, tecnicos, onChangeState, isAdmin, isDarkGantt }) {
  const Icon  = panel.icon;
  const count = departures.length;

  return (
    <div className={`flex flex-col rounded-2xl border overflow-hidden ${isDarkGantt ? `border-white/10 ${panel.border.dark}` : `border-gray-200 ${panel.border.light}`}`}
      style={{ background: isDarkGantt ? 'rgba(73,73,73,0.12)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

      {/* Header del panel */}
      <div className={`relative px-4 py-3 border-b overflow-hidden ${isDarkGantt ? 'border-white/[0.07]' : 'border-gray-200/80'}`}>
        {/* Glow de fondo sutil */}
        <div className={`absolute top-0 left-0 right-0 h-full bg-gradient-to-r ${panel.header.dark} to-transparent opacity-60 pointer-events-none`} />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${isDarkGantt ? panel.accent.dark : panel.accent.light}`} />
            <div>
              <p className={`text-[13px] font-bold leading-none ${isDarkGantt ? 'text-gray-100' : 'text-gray-900'}`}>{panel.label}</p>
              <p className={`text-[10px] mt-0.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>{panel.sublabel}</p>
            </div>
          </div>
          {/* Contador */}
          <span className={`text-lg font-black tabular-nums leading-none ${isDarkGantt ? panel.accent.dark : panel.accent.light}`}>{count}</span>
        </div>
      </div>

      {/* Cuerpo: lista de tarjetas */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar min-h-0">
        {count === 0 ? (
          <div className={`flex flex-col items-center justify-center flex-1 py-10 opacity-30`}>
            <Icon className={`h-8 w-8 mb-2 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>Sin registros</p>
          </div>
        ) : (
          departures.map(dep => (
            <DepartureCard key={dep.id} dep={dep} tecnicos={tecnicos} onChangeState={onChangeState} isAdmin={isAdmin} panel={panel} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Componente principal exportado ──
export function DeparturesPanels({ departures, tecnicos, loading, onChangeState, isAdmin }) {
  const { isDarkGantt } = useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className={`animate-spin ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
          <p className={`text-xs font-medium ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>Cargando salidas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {PANELES.map(panel => (
        <Panel
          key={panel.estado}
          panel={panel}
          departures={departures.filter(d => d.estado === panel.estado)}
          tecnicos={tecnicos}
          onChangeState={onChangeState}
          isAdmin={isAdmin}
          isDarkGantt={isDarkGantt}
        />
      ))}
    </div>
  );
}
