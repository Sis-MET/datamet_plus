import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const unusedVarsRule = ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }]

export default defineConfig([
  globalIgnores([
    'dist/**',
    '**/dist/**',
    '.agents/**',
    'node_modules/**',
    'test-results/**',
    'playwright-report/**',
  ]),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: { 'no-unused-vars': unusedVarsRule },
  },
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: { sourceType: 'commonjs' },
    },
    rules: { 'no-unused-vars': unusedVarsRule },
  },
  {
    files: ['*.config.js', 'e2e/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { sourceType: 'module' },
    },
    rules: { 'no-unused-vars': unusedVarsRule },
  },
])
