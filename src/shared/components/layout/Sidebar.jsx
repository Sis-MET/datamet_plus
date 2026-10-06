import { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { cn } from '../../utils/cn';
import { usePageScrollLock } from '../../hooks/usePageScrollLock';
import { getNavigation } from './navigation';
import { ShortcutKeys } from './ShortcutKeys';

function getInitials(user) {
  const fromName = [user?.nombre, user?.apellido]
    .map((part) => String(part || '').trim()[0])
    .filter(Boolean)
    .join('');
  return (fromName || String(user?.usuario || '?').slice(0, 2)).toUpperCase();
}

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

  usePageScrollLock(isDrawer && isOpen);

  // En móvil el panel se comporta como un diálogo: Escape lo cierra y el foco
  // entra al primer módulo al abrirlo.
  useEffect(() => {
    if (!isDrawer || !isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      (panel?.querySelector('nav [aria-current="page"]') || panel?.querySelector('nav button'))
        ?.focus({ preventScroll: true });
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
        isDesktop && 'transition-[opacity,transform] duration-200 ease-out',
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

      <nav aria-label="Módulos" className="flex flex-col gap-1 px-3 pt-4">
        {modules.map((view) => {
          const Icon = view.icon;
          const active = activeView === view.id;
          const badge = badges?.[view.id];
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onNavigate(view.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-offset-0 transition-colors duration-150',
                active
                  ? 'bg-surface text-fg shadow-xs ring-1 ring-line'
                  : 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-fg' : 'text-fg-subtle group-hover:text-fg'
                )}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <span className="truncate">{view.label}</span>
              {badge && (
                <span
                  className={cn(
                    'ml-auto min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight tabular-nums',
                    badge.urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                  )}
                  title={badge.label}
                >
                  {badge.count}
                  <span className="sr-only"> {badge.label}</span>
                </span>
              )}
              {active && (
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full bg-brand ring-2 ring-brand/25', !badge && 'ml-auto')}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 p-3">
        {system.length > 0 && (
          <nav aria-label="Sistema" className="mb-1 flex flex-col gap-1">
            <p className="px-3 pb-0.5 text-xs font-medium text-fg-subtle">Sistema</p>
            {system.map((view) => {
              const Icon = view.icon;
              const active = activeView === view.id;
              const badge = badges?.[view.id];
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onNavigate(view.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium outline-offset-0 transition-colors duration-150',
                    active
                      ? 'bg-surface text-fg shadow-xs ring-1 ring-line'
                      : 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg'
                  )}
                >
                  <Icon
                    className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-fg' : 'text-fg-subtle group-hover:text-fg')}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  <span className="truncate">{view.label}</span>
                  {badge && (
                    <span
                      className={cn(
                        'ml-auto min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight tabular-nums',
                        badge.urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                      )}
                      title={badge.label}
                    >
                      {badge.count}
                      <span className="sr-only"> {badge.label}</span>
                    </span>
                  )}
                  {active && (
                    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-brand ring-2 ring-brand/25', !badge && 'ml-auto')} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </nav>
        )}
        {currentUser && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 shadow-xs">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg text-[12px] font-semibold tracking-wide text-canvas"
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
          'sticky top-0 z-30 h-dvh shrink-0 overflow-hidden border-r bg-canvas transition-[width,border-color,visibility] duration-200 ease-out',
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
          'glass fixed inset-y-2 left-2 z-[61] w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-[20px] border transition-[transform,opacity,visibility] duration-200 ease-out',
          isOpen ? 'visible translate-x-0 opacity-100' : 'invisible -translate-x-[calc(100%+1rem)] opacity-0'
        )}
      >
        {content}
      </aside>
    </>
  );
}
