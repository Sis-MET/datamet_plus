import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircle, X,
  ClipboardList, Zap, ArrowLeftRight, Copy, Calendar, SlidersHorizontal,
  MousePointer2, Pencil, Keyboard, GripHorizontal,
  ChevronLeft, ChevronRight, Star, RefreshCw, Filter,
} from 'lucide-react';
import { useTheme } from '../../../shared/context/ThemeContext';

// ── Definición de funciones disponibles ──────────────────────────────────────

const HELP_SECTIONS = [
  {
    id: 'tareas',
    label: 'Tareas',
    Icon: ClipboardList,
    color: 'blue',
    items: [
      {
        Icon: MousePointer2,
        action: 'Click en celda vacía',
        description: 'Abre el formulario para crear una nueva tarea en esa fecha y técnico.',
      },
      {
        Icon: Pencil,
        action: 'Click en una Tarea',
        description: 'Abre el formulario para editar los datos de esa tarea.',
      },
    ],
  },
  {
    id: 'contextmenu',
    label: 'Menú contextual',
    Icon: Zap,
    color: 'purple',
    items: [
      {
        Icon: MousePointer2,
        action: 'Click derecho en una Tarea',
        description: 'Despliega el menú rápido: cambiar estado, asignar vehículo o eliminar la tarea.',
        highlight: true,
      },
    ],
  },
  {
    id: 'mover',
    label: 'Mover Tarea',
    Icon: ArrowLeftRight,
    color: 'green',
    items: [
      {
        Icon: Keyboard,
        action: 'Ctrl + Arrastrar Tarea',
        description: 'Mantén presionado Ctrl, haz clic y arrastra la tarea a otra celda para moverla.',
        kbd: ['Ctrl', 'Drag'],
        highlight: true,
      },
    ],
  },
  {
    id: 'copiar',
    label: 'Copiar Tarea',
    Icon: Copy,
    color: 'amber',
    items: [
      {
        Icon: GripHorizontal,
        action: 'Arrastrar a otro técnico',
        description: 'Arrastra una Tarea hacia otro técnico para copiar la Tarea al destino.',
        highlight: true,
      },
    ],
  },
  {
    id: 'navegacion',
    label: 'Navegación',
    Icon: Calendar,
    color: 'cyan',
    items: [
      {
        Icon: ChevronLeft,
        action: 'Botón "Anterior"',
        description: 'Navega a la semana anterior.',
      },
      {
        Icon: ChevronRight,
        action: 'Botón "Próxima"',
        description: 'Navega a la siguiente semana.',
      },
      {
        Icon: Star,
        action: 'Botón "Hoy"',
        description: 'Regresa a la semana actual y centra la vista en el día de hoy.',
      },
      {
        Icon: RefreshCw,
        action: 'Botón Recargar',
        description: 'Actualiza los datos del cronograma desde el servidor.',
      },
    ],
  },
  {
    id: 'filtros',
    label: 'Filtros',
    Icon: SlidersHorizontal,
    color: 'rose',
    items: [
      {
        Icon: Filter,
        action: 'Botón "Áreas"',
        description: 'Filtra el cronograma para mostrar únicamente el área seleccionada.',
      },
    ],
  },
];

// ── Mapeo de colores por sección ──────────────────────────────────────────────

const COLOR_MAP = {
  blue:   { badge: 'bg-blue-500/15 text-blue-400',   highlight: 'bg-blue-500/8 border border-blue-500/15' },
  purple: { badge: 'bg-purple-500/15 text-purple-400', highlight: 'bg-purple-500/8 border border-purple-500/15' },
  green:  { badge: 'bg-emerald-500/15 text-emerald-400', highlight: 'bg-emerald-500/8 border border-emerald-500/15' },
  amber:  { badge: 'bg-amber-500/15 text-amber-400',  highlight: 'bg-amber-500/8 border border-amber-500/15' },
  cyan:   { badge: 'bg-cyan-500/15 text-cyan-400',    highlight: 'bg-cyan-500/8 border border-cyan-500/15' },
  rose:   { badge: 'bg-rose-500/15 text-rose-400',    highlight: 'bg-rose-500/8 border border-rose-500/15' },
};

// ── Estilos de transición del panel ──────────────────────────────────────────
// Usamos CSS transitions manuales para controlar entrada Y salida suavemente.

const PANEL_TRANSITION = 'opacity, transform';
const PANEL_DURATION   = '240ms';
const PANEL_EASING     = 'cubic-bezier(0.22, 1, 0.36, 1)';

// ── Componente principal ──────────────────────────────────────────────────────

export function GanttHelpButton() {
  const { isDarkGantt } = useTheme();

  // panelMounted: el DOM existe (para poder animar la salida antes de desmontar)
  // panelShown:   la clase visible (controla opacity + transform)
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelShown,   setPanelShown]   = useState(false);

  const [hovered, setHovered] = useState(false);
  const panelRef  = useRef(null);
  const btnRef    = useRef(null);
  const hoverTimer = useRef(null);
  const closeTimer = useRef(null);
  const exitTimer  = useRef(null);

  // ── Abrir / cerrar ────────────────────────────────────────────────────────

  const openPanel = useCallback(() => {
    clearTimeout(exitTimer.current);
    setPanelMounted(true);
    // doble rAF garantiza que el navegador pinte el estado inicial antes de la transición
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setPanelShown(true))
    );
  }, []);

  const closePanel = useCallback(() => {
    setPanelShown(false);                           // dispara la transición de salida
    exitTimer.current = setTimeout(() => {
      setPanelMounted(false);                       // desmonta después de la animación
    }, 260);
  }, []);

  const isOpen = panelMounted;

  // ── Cerrar al hacer clic fuera ────────────────────────────────────────────

  useEffect(() => {
    if (!panelMounted) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) closePanel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelMounted, closePanel]);

  // ── Interacción del botón ─────────────────────────────────────────────────

  const handleBtnMouseEnter = () => {
    clearTimeout(hoverTimer.current);
    clearTimeout(closeTimer.current);
    setHovered(true);
    hoverTimer.current = setTimeout(openPanel, 160);
  };

  const handleBtnMouseLeave = () => {
    setHovered(false);
    clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(closePanel, 300);
  };

  const handleBtnClick = () => {
    if (isOpen) closePanel(); else openPanel();
  };

  // ── Hover del panel mantiene abierto ─────────────────────────────────────

  const handlePanelMouseEnter = () => clearTimeout(closeTimer.current);
  const handlePanelMouseLeave = () => {
    closeTimer.current = setTimeout(closePanel, 300);
  };

  return (
    <>
      {/* ── Panel flotante ────────────────────────────────────────────────── */}
      {panelMounted && (
        <div
          ref={panelRef}
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
          style={{
            // Estado inicial (oculto) → visible con transición suave
            opacity:   panelShown ? 1 : 0,
            transform: panelShown ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
            transitionProperty: PANEL_TRANSITION,
            transitionDuration: PANEL_DURATION,
            transitionTimingFunction: PANEL_EASING,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
          className={`
            fixed bottom-20 right-6 z-[9999]
            w-[21rem] rounded-2xl overflow-hidden
            ${isDarkGantt
              ? 'bg-[#14141a]/95 shadow-[0_8px_40px_rgba(0,0,0,0.7)] ring-1 ring-white/5'
              : 'bg-white/96 shadow-[0_8px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/5'}
          `}
        >
          {/* Cabecera */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b ${
            isDarkGantt ? 'border-white/5 bg-white/2' : 'border-gray-100/80 bg-gray-50/60'
          }`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-900/30 flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-white" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-bold leading-tight ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>
                Funciones del Cronograma
              </p>
              <p className={`text-[10px] ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                Guía rápida de interacciones
              </p>
            </div>
            <button
              onClick={closePanel}
              className={`p-1 rounded-lg transition-colors ${
                isDarkGantt
                  ? 'text-gray-600 hover:text-gray-300 hover:bg-white/8'
                  : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Secciones */}
          <div className="max-h-[72vh] overflow-y-auto custom-scrollbar py-2 space-y-0.5">
            {HELP_SECTIONS.map((section) => {
              const c = COLOR_MAP[section.color];
              return (
                <div key={section.id} className="px-2.5 pb-1">
                  {/* Título de sección */}
                  <div className="flex items-center gap-2 px-1.5 pt-2 pb-1.5">
                    <div className={`flex items-center justify-center w-5 h-5 rounded-md ${c.badge}`}>
                      <section.Icon className="w-3 h-3" strokeWidth={2} />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`}>
                      {section.label}
                    </span>
                    <div className={`flex-1 h-px ${isDarkGantt ? 'bg-white/5' : 'bg-gray-100'}`} />
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {section.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={`
                          flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors
                          ${item.highlight
                            ? (isDarkGantt ? c.highlight : 'bg-gray-50 border border-gray-100')
                            : (isDarkGantt ? 'hover:bg-white/4' : 'hover:bg-gray-50')}
                        `}
                      >
                        <div className={`
                          w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                          ${item.highlight
                            ? (isDarkGantt ? c.badge : 'bg-primary-50 text-primary-500')
                            : (isDarkGantt ? 'bg-white/6 text-gray-400' : 'bg-gray-100 text-gray-500')}
                        `}>
                          <item.Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-semibold leading-tight mb-0.5 ${
                            isDarkGantt ? 'text-gray-200' : 'text-gray-800'
                          }`}>
                            {item.action}
                          </p>

                          {item.kbd && (
                            <div className="flex items-center gap-1 mb-1">
                              {item.kbd.map((key, ki) => (
                                <React.Fragment key={ki}>
                                  <kbd className={`
                                    inline-flex items-center px-1.5 py-0.5 rounded text-[9px]
                                    font-bold uppercase tracking-wider border
                                    ${isDarkGantt
                                      ? 'bg-white/8 border-white/12 text-gray-300'
                                      : 'bg-gray-100 border-gray-300 text-gray-600'}
                                  `}>
                                    {key}
                                  </kbd>
                                  {ki < item.kbd.length - 1 && (
                                    <span className={`text-[9px] font-bold ${isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>+</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}

                          <p className={`text-[10px] leading-relaxed ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Pie */}
            <div className={`mx-2.5 mt-1 mb-2 px-3 py-2 rounded-xl text-center ${
              isDarkGantt ? 'bg-white/2' : 'bg-gray-50'
            }`}>
              <p className={`text-[9px] ${isDarkGantt ? 'text-gray-600' : 'text-gray-400'}`}>
                Pasa el cursor sobre el panel para mantenerlo abierto
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Botón flotante ───────────────────────────────────────────────── */}
      <button
        ref={btnRef}
        onMouseEnter={handleBtnMouseEnter}
        onMouseLeave={handleBtnMouseLeave}
        onClick={handleBtnClick}
        aria-label="Ayuda — funciones del cronograma"
        className={`
          fixed bottom-6 right-6 z-[9999]
          w-11 h-11 rounded-full
          flex items-center justify-center
          transition-all duration-200
          bg-gradient-to-br from-primary-500 to-primary-700
          ${isOpen || hovered ? 'scale-110' : 'scale-100 hover:scale-105'}
        `}
        style={{
          boxShadow: isOpen || hovered
            ? '0 0 0 4px rgba(99,102,241,0.18), 0 8px 24px rgba(99,102,241,0.38)'
            : '0 4px 16px rgba(99,102,241,0.30)',
        }}
      >
        <X
          className="w-4 h-4 text-white absolute transition-all duration-200"
          strokeWidth={2.5}
          style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? 'rotate(0deg) scale(1)' : 'rotate(-45deg) scale(0.6)' }}
        />
        <HelpCircle
          className="w-4 h-4 text-white absolute transition-all duration-200"
          strokeWidth={2}
          style={{ opacity: isOpen ? 0 : 1, transform: isOpen ? 'rotate(45deg) scale(0.6)' : 'rotate(0deg) scale(1)' }}
        />

        {/* Pulso de atención: ciclo lento (3 s) cuando el panel está cerrado */}
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full bg-primary-400/20 pointer-events-none"
            style={{ animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}
          />
        )}
      </button>
    </>
  );
}
