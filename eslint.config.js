import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'api/**', '.codegraph/**', '.dsh-code-index/**', 'node-compile-cache/**'],
  },
  js.configs.recommended,
  reactHooks.configs['recommended-latest'],
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-refresh': reactRefresh },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // JSX usage counts as a variable reference, otherwise every component used
      // only inside JSX is reported as unused.
      'react/jsx-uses-vars': 'error',
      // React 19 uses the automatic runtime, so `React` does not need importing.
      'react/jsx-uses-react': 'off',
      // Fast Refresh only survives when modules export nothing but components.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
