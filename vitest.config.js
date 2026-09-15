import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Igual que la app con @vitejs/plugin-react: los componentes no importan React.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['e2e/**', 'backend/**', 'node_modules/**'],
  },
});
