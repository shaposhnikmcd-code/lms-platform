// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Вимикаємо правило для лапок (воно найчастіше ламає збірку)
      'react/no-unescaped-entities': 'off',
      // Робимо попередження, а не помилки для невикористаних змінних
      '@typescript-eslint/no-unused-vars': 'warn',
      // Робимо попередження, а не помилки для типу 'any'
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Ігноруємо стандартні папки Next.js
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;