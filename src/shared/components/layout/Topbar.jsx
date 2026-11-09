import { useEffect, useState } from 'react';
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { cn } from '../../utils/cn';
import { SIDEBAR_SHORTCUT_LABEL } from './shortcuts';
import { ThemeToggle } from './ThemeToggle';

export function Topbar({ view, section, isSidebarOpen, isDesktop, onToggleSidebar, className }) {
  const [scrolled, setScrolled] = useState(false);

  // El borde inferior solo aparece cuando hay contenido desplazándose debajo
  // del vidrio; en reposo la barra se funde con el lienzo.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      setScrolled(window.scrollY > 2);
    };
    const handleScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  const toggleLabel = isDesktop
    ? `${isSidebarOpen ? 'Ocultar' : 'Mostrar'} barra lateral (${SIDEBAR_SHORTCUT_LABEL})`
    : `Abrir menú (${SIDEBAR_SHORTCUT_LABEL})`;
  const ToggleIcon = !isDesktop ? Menu : isSidebarOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <header
      className={cn(
        'glass-bar sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b px-3 transition-[border-color] duration-200 sm:gap-3 sm:px-5',
        scrolled ? 'border-line' : 'border-transparent',
        className
      )}
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-controls="app-sidebar"
        aria-expanded={isSidebarOpen}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg"
      >
        <ToggleIcon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
      </button>

      {(!isDesktop || !isSidebarOpen) && (
        <img
          src={logoMetrica}
          alt="Métrica Ltda."
          className="h-7 w-auto shrink-0 select-none animate-fade-in"
          draggable={false}
        />
      )}

      <span className="hidden h-5 w-px shrink-0 bg-line-strong sm:block" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        {/* Con una sección abierta, el título dice dónde se está: «Calibración › Equipos».
            En el teléfono no cabe todo: se ve la sección y el apartado queda para lectores de pantalla. */}
        <h1 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-fg">
          {section ? (
            <>
              <span className="sr-only text-fg-muted sm:not-sr-only sm:min-w-0 sm:shrink-[3] sm:truncate">{view.label}</span>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-fg-subtle sm:block" strokeWidth={2.2} aria-hidden="true" />
              <span className="sr-only">: </span>
              {section.grupo && (
                <>
                  <span className="hidden text-fg-muted sm:inline sm:min-w-0 sm:shrink-[2] sm:truncate">{section.grupo}</span>
                  <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-fg-subtle sm:block" strokeWidth={2.2} aria-hidden="true" />
                </>
              )}
              <span className="min-w-0 truncate">{section.label}</span>
            </>
          ) : (
            <span className="truncate">{view?.title || view?.label}</span>
          )}
        </h1>
        {view?.description && (
          <p className="hidden truncate text-xs leading-tight text-fg-muted sm:block">{view.description}</p>
        )}
      </div>

      <ThemeToggle />
    </header>
  );
}
