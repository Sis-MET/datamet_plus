import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircle, X,
  ClipboardList, Zap, ArrowLeftRight, Copy, Calendar, SlidersHorizontal,
  MousePointer2, Pencil, Keyboard, GripHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Filter,
} from 'lucide-react';

// ── Definición de funciones disponibles ──────────────────────────────────────

const HELP_SECTIONS = [
  {
    id: 'tareas',
    label: 'Tareas',
    Icon: ClipboardList,
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
        Icon: CalendarDays,
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
    items: [
      {
        Icon: Filter,
        action: 'Botón "Áreas"',
        description: 'Filtra el cronograma para mostrar únicamente el área seleccionada.',
      },
    ],
  },
];

// ── Estilos de transición del panel ──────────────────────────────────────────
// Usamos CSS transitions manuales para controlar entrada Y salida suavemente.

const PANEL_TRANSITION = 'opacity, transform';
const PANEL_DURATION   = '240ms';
const PANEL_EASING     = 'cubic-bezier(0.22, 1, 0.36, 1)';

// ── Componente principal ──────────────────────────────────────────────────────

export function GanttHelpButton() {
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
          role="dialog"
          aria-label="Funciones del Cronograma"
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
          style={{
            // Estado inicial (oculto) → visible con transición suave
            opacity:   panelShown ? 1 : 0,
            transform: panelShown ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
            transitionProperty: PANEL_TRANSITION,
            transitionDuration: PANEL_DURATION,
            transitionTimingFunction: PANEL_EASING,
            transformOrigin: 'bottom right',
          }}
          className="glass fixed bottom-20 right-6 z-40 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border"
        >
          {/* Cabecera */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-fg text-canvas">
              <HelpCircle className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight text-fg">
                Funciones del Cronograma
              </p>
              <p className="text-xs text-fg-muted">
                Guía rápida de interacciones
              </p>
            </div>
            <button
              onClick={closePanel}
              aria-label="Cerrar guía"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Secciones */}
          <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {HELP_SECTIONS.map((section) => (
              <div key={section.id} className="pb-1">
                {/* Título de sección */}
                <div className="flex items-center gap-2 px-2 pb-1.5 pt-2">
                  <section.Icon className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={2} aria-hidden="true" />
                  <span className="text-[11px] font-medium text-fg-subtle">
                    {section.label}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-0.5">
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors ${item.highlight ? 'bg-fg/[0.04]' : 'hover:bg-fg/[0.03]'}`}
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted">
                        <item.Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[13px] font-medium leading-tight text-fg">
                          {item.action}
                        </p>

                        {item.kbd && (
                          <div className="my-1 flex items-center gap-1">
                            {item.kbd.map((key, ki) => (
                              <React.Fragment key={ki}>
                                <kbd className="kbd">{key}</kbd>
                                {ki < item.kbd.length - 1 && (
                                  <span className="text-[10px] text-fg-subtle">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        )}

                        <p className="text-xs leading-relaxed text-fg-muted">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pie */}
            <p className="px-2 pb-1 pt-2 text-center text-[11px] text-fg-subtle">
              Pasa el cursor sobre el panel para mantenerlo abierto
            </p>
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
        aria-expanded={isOpen}
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-fg text-canvas shadow-pop transition-transform duration-200 ease-out ${isOpen || hovered ? 'scale-105' : 'scale-100'}`}
      >
        <X
          className="absolute h-4 w-4 transition-all duration-200"
          strokeWidth={2.5}
          style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? 'rotate(0deg) scale(1)' : 'rotate(-45deg) scale(0.6)' }}
        />
        <HelpCircle
          className="absolute h-[18px] w-[18px] transition-all duration-200"
          strokeWidth={2}
          style={{ opacity: isOpen ? 0 : 1, transform: isOpen ? 'rotate(45deg) scale(0.6)' : 'rotate(0deg) scale(1)' }}
        />
      </button>
    </>
  );
}
