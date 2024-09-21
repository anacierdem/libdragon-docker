import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals['2021'],
        myCustomGlobal: 'readonly',
      },
    },
    rules: {
      'no-console': 2,
    },
  },
];
