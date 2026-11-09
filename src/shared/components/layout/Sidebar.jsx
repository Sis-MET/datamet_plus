import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Lock, LogOut, X } from 'lucide-react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { cn } from '../../utils/cn';
import { usePageScrollLock } from '../../hooks/usePageScrollLock';
import { leerRuta, rutaDe, useRuta } from '../../navigation/ruta';
import { getNavigation } from './navigation';
import { ShortcutKeys } from './ShortcutKeys';

function getInitials(user) {
  const fromName = [user?.nombre, user?.apellido]
    .map((part) => String(part || '').trim()[0])
    .filter(Boolean)
    .join('');
  return (fromName || String(user?.usuario || '?').slice(0, 2)).toUpperCase();
}

const itemBase = 'group relative flex w-full items-center gap-3 rounded-xl px-3 text-left font-medium outline-offset-0 transition-colors duration-150';
const itemActive = 'bg-surface text-fg shadow-xs ring-1 ring-line';
const itemIdle = 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg';

function Badge({ badge }) {
  return (
    <span
      className={cn(
        'min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight tabular-nums',
        badge.urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
      )}
      title={badge.label}
    >
      {badge.count}
      <span className="sr-only"> {badge.label}</span>
    </span>
  );
}

const ActiveDot = () => (
  <span className="h-2 w-2 shrink-0 rounded-full bg-brand ring-2 ring-brand/25" aria-hidden="true" />
);

// Ctrl, Cmd, Shift o clic central abren la sección en otra pestaña, como
// cualquier enlace; el clic normal navega dentro de la aplicación.
const abreAparte = (event) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** Enlace a una sección (pestaña) de un apartado. */
function SectionLink({ view, section, active, badge, onNavigate }) {
  return (
    <a
      href={rutaDe(view.id, section.id)}
      onClick={(event) => {
        if (abreAparte(event)) return;
        event.preventDefault();
        onNavigate(view.id, section.id);
      }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium outline-offset-0 transition-colors duration-150',
        active ? itemActive : itemIdle
      )}
    >
      <span className="truncate">{section.label}</span>
      {(badge || active) && (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {badge && <Badge badge={badge} />}
          {active && <ActiveDot />}
        </span>
      )}
    </a>
  );
}

/**
 * Sección con su propio desplegable (Calibración › Certificados: Registros y
 * Método de cálculo). Se abre sola al entrar a una de sus páginas.
 */
function SectionGroup({ view, section, inModule, activeSection, onNavigate }) {
  const contieneActiva = inModule && section.children.some(child => child.id === activeSection);
  const [open, setOpen] = useState(contieneActiva);
  const [visto, setVisto] = useState(contieneActiva);
  if (visto !== contieneActiva) {
    setVisto(contieneActiva);
    if (contieneActiva) setOpen(true);
  }
  const listId = `nav-${view.id}-${section.id}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(actual => !actual)}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium outline-offset-0 transition-colors duration-150',
          contieneActiva && !open ? itemActive : contieneActiva ? 'text-fg hover:bg-fg/[0.05]' : itemIdle
        )}
      >
        <span className="truncate">{section.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {contieneActiva && !open && <ActiveDot />}
          <ChevronRight
            className={cn('h-3.5 w-3.5 text-fg-subtle transition-transform duration-300 ease-expo motion-reduce:transition-none', open && 'rotate-90')}
            strokeWidth={2}
            aria-hidden="true"
          />
        </span>
      </button>
      <div
        id={listId}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 ease-expo motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-line py-0.5 pl-2" aria-label={section.label}>
            {section.children.map(child => (
              <li key={child.id}>
                <SectionLink view={view} section={child} active={inModule && activeSection === child.id} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

/** Apartado con sub-lista: el botón la despliega y cada sección es un enlace a su pestaña. */
function ModuleGroup({ view, open, onToggle, activeView, activeSection, badge, onNavigate }) {
  const Icon = view.icon;
  const inModule = activeView === view.id;
  const listId = `nav-${view.id}`;
  // Cerrado, el apartado muestra que se está en él y lleva el contador.
  const showActive = inModule && !open;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(itemBase, 'h-10 text-sm', showActive ? itemActive : inModule ? 'text-fg hover:bg-fg/[0.05]' : itemIdle)}
      >
        <Icon
          className={cn('h-[18px] w-[18px] shrink-0 transition-colors', inModule ? 'text-fg' : 'text-fg-subtle group-hover:text-fg')}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <span className="truncate">{view.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {badge && !open && <Badge badge={badge} />}
          <ChevronRight
            className={cn(
              'h-4 w-4 text-fg-subtle transition-transform duration-300 ease-expo motion-reduce:transition-none',
              open && 'rotate-90'
            )}
            strokeWidth={2}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* La fila de la cuadrícula pasa de 0 a su alto natural: se despliega sin
          medir nada. Abierta hereda la visibilidad: con la barra oculta, también
          se oculta. */}
      <div
        id={listId}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 ease-expo motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="ml-[20px] mt-0.5 flex flex-col gap-0.5 border-l border-line-strong py-1 pl-2" aria-label={view.label}>
            {view.sections.map(section => (
              section.children ? (
                <SectionGroup
                  key={section.id}
                  view={view}
                  section={section}
                  inModule={inModule}
                  activeSection={activeSection}
                  onNavigate={onNavigate}
                />
              ) : (
                <li key={section.id}>
                  <SectionLink
                    view={view}
                    section={section}
                    active={inModule && activeSection === section.id}
                    badge={view.badgeSection === section.id ? badge : null}
                    onNavigate={onNavigate}
                  />
                </li>
              )
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

/** Apartado sin secciones (o con candado): un solo acceso. */
function ModuleLink({ view, active, badge, onNavigate, compact = false }) {
  const Icon = view.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(view.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(itemBase, compact ? 'h-9 text-[13px]' : 'h-10 text-sm', active ? itemActive : itemIdle)}
    >
      <Icon
        className={cn(
          compact ? 'h-4 w-4' : 'h-[18px] w-[18px]',
          'shrink-0 transition-colors',
          active ? 'text-fg' : 'text-fg-subtle group-hover:text-fg'
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />
      <span className="truncate">{view.label}</span>
      {(view.locked || badge || active) && (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {view.locked && (
            <>
              <Lock className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={2} aria-hidden="true" />
              <span className="sr-only"> (sin acceso)</span>
            </>
          )}
          {badge && <Badge badge={badge} />}
          {active && <ActiveDot />}
        </span>
      )}
    </button>
  );
}

const hasSections = (view) => view?.sections?.length > 0;

export function Sidebar({
  activeView,
  onNavigate,
  currentUser,
  onLogout,
  badges,
  isOpen,
  isDesktop,
  onClose,
}) {
  const panelRef = useRef(null);
  const navigation = getNavigation(currentUser);
  const modules = navigation.filter(view => !view.group);
  const system = navigation.filter(view => view.group === 'system');
  const isDrawer = !isDesktop;
  const fullName = [currentUser?.nombre, currentUser?.apellido].filter(Boolean).join(' ').trim();

  // Sección abierta según la dirección: /soporte/proximos → «proximos».
  const ruta = leerRuta(useRuta());
  const activeSection = ruta.vista === activeView ? ruta.resto[0] : null;

  // Una sola sub-lista abierta a la vez; al cambiar de apartado se abre la suya.
  const groupFor = (view) => (hasSections(modules.find(item => item.id === view)) ? view : null);
  const [openGroup, setOpenGroup] = useState(() => groupFor(activeView));
  const [shownView, setShownView] = useState(activeView);
  if (shownView !== activeView) {
    setShownView(activeView);
    setOpenGroup(groupFor(activeView));
  }

  usePageScrollLock(isDrawer && isOpen);

  // En móvil el panel se comporta como un diálogo: Escape lo cierra y el foco
  // entra a la sección actual (o al primer módulo) al abrirlo.
  useEffect(() => {
    if (!isDrawer || !isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const current = [...(panel?.querySelectorAll('nav [aria-current="page"]') || [])]
        .find(element => element.checkVisibility?.({ visibilityProperty: true }) ?? true);
      (current || panel?.querySelector('nav button'))?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [isDrawer, isOpen, onClose]);

  const content = (
    <div
      className={cn(
        'flex h-full w-[var(--sidebar-width)] flex-col',
        isDrawer && 'w-full',
        isDesktop && 'transition-[opacity,transform] duration-300 ease-expo',
        isDesktop && !isOpen && '-translate-x-3 opacity-0'
      )}
    >
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 px-4">
        <img
          src={logoMetrica}
          alt="Métrica Ltda. — Expertos en sistemas de pesaje"
          className="h-8 w-auto select-none"
          draggable={false}
        />
        <span className="h-5 w-px bg-line-strong" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-fg">DataMET+</span>
        {isDrawer && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* Con una sub-lista abierta la lista puede no caber en pantallas bajas: se desplaza sola. */}
      <nav aria-label="Módulos" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-4">
        <ul className="flex flex-col gap-1">
          {modules.map((view) => (
            hasSections(view) ? (
              <ModuleGroup
                key={view.id}
                view={view}
                open={openGroup === view.id}
                onToggle={() => setOpenGroup(current => (current === view.id ? null : view.id))}
                activeView={activeView}
                activeSection={activeSection}
                badge={badges?.[view.id]}
                onNavigate={onNavigate}
              />
            ) : (
              <li key={view.id}>
                <ModuleLink view={view} active={activeView === view.id} badge={badges?.[view.id]} onNavigate={onNavigate} />
              </li>
            )
          ))}
        </ul>
      </nav>

      <div className="flex shrink-0 flex-col gap-2 p-3">
        {system.length > 0 && (
          <nav aria-label="Sistema" className="mb-1 flex flex-col gap-1">
            <p className="px-3 pb-0.5 text-xs font-medium text-fg-subtle">Sistema</p>
            {system.map((view) => (
              <ModuleLink
                key={view.id}
                view={view}
                active={activeView === view.id}
                badge={badges?.[view.id]}
                onNavigate={onNavigate}
                compact
              />
            ))}
          </nav>
        )}
        {currentUser && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 shadow-xs">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold tracking-wide text-brand-fg"
              aria-hidden="true"
            >
              {getInitials(currentUser)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-fg">
                {fullName || currentUser.usuario}
              </p>
              <p className="mt-0.5 truncate text-xs leading-tight text-fg-muted">
                {currentUser.cargo || currentUser.usuario}
              </p>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </button>
            )}
          </div>
        )}

        {isDesktop && (
          <p className="flex items-center justify-between px-2 pb-1 text-xs text-fg-subtle">
            Ocultar panel
            <ShortcutKeys />
          </p>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        id="app-sidebar"
        aria-label="Barra lateral"
        inert={!isOpen}
        className={cn(
          'theme-navy sticky top-0 z-30 h-dvh shrink-0 overflow-hidden border-r bg-canvas transition-[width,border-color,visibility] duration-300 ease-expo',
          isOpen ? 'visible w-[var(--sidebar-width)] border-line' : 'invisible w-0 border-transparent'
        )}
      >
        {content}
      </aside>
    );
  }

  return (
    <>
      <div
        className={cn(
          'scrim fixed inset-0 z-[60] transition-opacity duration-200 ease-out',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="app-sidebar"
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Menú de navegación"
        inert={!isOpen}
        className={cn(
          'theme-navy glass fixed inset-y-2 left-2 z-[61] w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-[20px] border',
          // Entra con la curva de Métrica; sale más rápido y sin rebote.
          isOpen
            ? 'visible translate-x-0 opacity-100 transition-[transform,opacity,visibility] duration-300 ease-expo'
            : 'invisible -translate-x-[calc(100%+1rem)] opacity-0 transition-[transform,opacity,visibility] duration-200 ease-in'
        )}
      >
        {content}
      </aside>
    </>
  );
}
