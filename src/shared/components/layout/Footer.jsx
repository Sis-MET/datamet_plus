import pkg from '../../../../package.json';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto px-4 pb-6 pt-10">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-fg-subtle">
        <span className="font-medium text-fg-muted">Versión {pkg.version}</span>
        <span aria-hidden="true">·</span>
        <span>
          Desarrollado por{' '}
          <a
            href="https://lenash.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            lenash.dev
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <span>© Todos los derechos reservados METRICA LTDA, {currentYear}</span>
      </p>
    </footer>
  );
}
