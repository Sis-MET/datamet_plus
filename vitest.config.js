import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['e2e/**', 'backend/**', 'node_modules/**'],
  },
});
