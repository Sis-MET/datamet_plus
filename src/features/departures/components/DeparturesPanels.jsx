import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Loader2, ChevronDown, CheckCircle2, ClipboardList, UserCheck } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { TIPOS_SALIDA } from '../constants';

// ── Los 3 estados del flujo ──
const PANELES = [
  {
    estado:    'Solicitud',
    label:     'Por Aceptar',
    sublabel:  'Esperando aprobación del jefe de área',
    icon:      ClipboardList,
    accent:    'text-warning',
    badge:     'bg-warning/10 text-warning ring-warning/25',
  },
  {
    estado:    'Aceptado',
    label:     'En Salida Activa',
    sublabel:  'Aceptadas por el jefe de área',
    icon:      UserCheck,
    accent:    'text-info',
    badge:     'bg-info/10 text-info ring-info/25',
  },
  {
    estado:    'Aprobado',
    label:     'Aprobadas',
    sublabel:  'Aprobación administrativa completa',
    icon:      CheckCircle2,
    accent:    'text-success',
    badge:     'bg-success/10 text-success ring-success/25',
  },
];

const ESTADOS_SALIDA = PANELES.map(p => p.estado);

function estadoBadge(estado) {
  return PANELES.find(p => p.estado === estado)?.badge ?? 'bg-fg/[0.06] text-fg-muted ring-line';
}

/** Dropdown en portal — evita el recorte dentro de las columnas desplazables */
function StateDropdown({ anchorRef, open, onClose, children }) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const recalc = () => {
      if (anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
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
        role="menu"
        className="glass fixed z-[9991] w-36 overflow-hidden rounded-xl border p-1 animate-pop-in"
        style={{ top: pos.top, right: pos.right }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ── Tarjeta de una salida individual ──
function DepartureCard({ dep, tecnicos, onChangeState, isAdmin }) {
  const [stateOpen, setStateOpen] = useState(false);
  const [localState, setLocalState] = useState(dep.estado);
  const [updating,   setUpdating]   = useState(false);
  const buttonRef = useRef(null);

  const tecnico  = tecnicos.find(t => t.id === dep.tecnicoId);
  const tipoInfo = TIPOS_SALIDA.find(t => t.value === dep.tipoSalida);
  const color    = tipoInfo?.color || dep.color || '#7c3aed';
  const dateLabel = format(dep.fecha, "EEE d MMM", { locale: es });
  const badgeClass = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset';

  const handleStateChange = async (newState) => {
    setStateOpen(false);
    setUpdating(true);
    setLocalState(newState);
    try   { await onChangeState(dep, newState); }
    catch { setLocalState(dep.estado); }
    finally { setUpdating(false); }
  };

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 shadow-xs transition-colors hover:border-fg/20">
      {/* Persona + fecha */}
      <div className="mb-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-fg">
            {tecnico?.nombre || dep.tecnicoId}
          </p>
          <p className="mt-0.5 text-xs capitalize text-fg-muted">{dateLabel}</p>
        </div>
        {/* Badge de estado — clicable si es admin */}
        <div className="relative flex-shrink-0">
          {isAdmin ? (
            <>
              <button
                ref={buttonRef}
                onClick={() => setStateOpen(o => !o)}
                disabled={updating}
                aria-haspopup="menu"
                aria-expanded={stateOpen}
                className={cn(badgeClass, estadoBadge(localState), updating ? 'opacity-60' : 'cursor-pointer hover:opacity-80')}
              >
                {updating ? <Loader2 size={11} className="animate-spin" /> : localState}
                <ChevronDown size={11} className={cn('transition-transform', stateOpen && 'rotate-180')} />
              </button>
              <StateDropdown
                anchorRef={buttonRef}
                open={stateOpen}
                onClose={() => setStateOpen(false)}
              >
                {ESTADOS_SALIDA.map(s => (
                  <button
                    key={s}
                    role="menuitem"
                    data-selected={s === localState}
                    onClick={() => handleStateChange(s)}
                    className="menu-item"
                  >
                    {s}
                  </button>
                ))}
              </StateDropdown>
            </>
          ) : (
            <span className={cn(badgeClass, estadoBadge(localState))}>{localState}</span>
          )}
        </div>
      </div>

      {/* Tipo con punto de color */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ background: color }} />
        <span className="truncate text-xs font-medium text-fg">{tipoInfo?.label || dep.tipoSalida}</span>
      </div>

      {/* Motivo */}
      {dep.motivo && (
        <p className="mt-1 truncate pl-4 text-xs leading-tight text-fg-muted">{dep.motivo}</p>
      )}

      {/* Horario */}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-fg-muted">
        <Clock size={12} aria-hidden="true" />
        <span className="font-medium tabular-nums">
          {dep.horaInicio || '--:--'} {dep.horaFin ? `– ${dep.horaFin}` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Panel por estado (columna) ──
function Panel({ panel, departures, tecnicos, onChangeState, isAdmin }) {
  const Icon  = panel.icon;
  const count = departures.length;

  return (
    <div className="card flex min-h-0 flex-col overflow-hidden shadow-card">
      {/* Header del panel */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={cn('h-4 w-4 shrink-0', panel.accent)} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-fg">{panel.label}</p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">{panel.sublabel}</p>
          </div>
        </div>
        {/* Contador */}
        <span className="rounded-full bg-fg/[0.06] px-2 py-0.5 text-sm font-semibold tabular-nums text-fg">{count}</span>
      </div>

      {/* Cuerpo: lista de tarjetas */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-surface-2/40 p-3">
        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-fg-subtle">
            <Icon className="mb-2 h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
            <p className="text-xs font-medium">Sin registros</p>
          </div>
        ) : (
          departures.map(dep => (
            <DepartureCard key={dep.id} dep={dep} tecnicos={tecnicos} onChangeState={onChangeState} isAdmin={isAdmin} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Componente principal exportado ──
export function DeparturesPanels({ departures, tecnicos, loading, onChangeState, isAdmin }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="flex flex-col items-center gap-3 text-fg-muted">
          <Loader2 size={22} className="animate-spin" />
          <p className="text-xs font-medium">Cargando salidas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3">
      {PANELES.map(panel => (
        <Panel
          key={panel.estado}
          panel={panel}
          departures={departures.filter(d => d.estado === panel.estado)}
          tecnicos={tecnicos}
          onChangeState={onChangeState}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
