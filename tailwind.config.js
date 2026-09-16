/** @type {import('tailwindcss').Config} */

// Los colores semánticos leen canales RGB definidos en src/index.css para el
// tema claro (:root) y el oscuro (.dark). Así los modificadores de opacidad
// (`bg-fg/5`, `border-danger/30`) funcionan igual en ambos temas.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-up': 'fade-in-up 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 140ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
          3: token('surface-3'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
        },
        brand: {
          DEFAULT: token('brand'),
          hover: token('brand-hover'),
          fg: token('brand-fg'),
        },
        focus: token('focus'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        // Paleta heredada: solo la usan componentes retirados y el PDF.
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#1E3E70',
          700: '#1a3560',
          800: '#162c50',
          900: '#0f1f38',
          950: '#0a1628',
        },
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        dialog: 'var(--shadow-dialog)',
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Mono"', '"SF Mono"', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
