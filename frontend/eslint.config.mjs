import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('prettier'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'src/app/**',
      'next-env.d.ts',
      'start-server.js',
    ],
  },
  {
    plugins: {
      prettier: (await import('eslint-plugin-prettier')).default,
      'react-hooks': reactHooks,
    },
    rules: {
      'prettier/prettier': 'warn',
    },
  },
  {
    files: [
      'src/pages/**/components/**/*.{ts,tsx}',
      'src/app/**/components/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'FunctionDeclaration[id.name=/^(Button|Card|Tag|Chip|SectionHeader|StatBadge|EmptyState)$/]',
          message:
            '请复用 src/components/ui 下的全局原子组件，而不是在页面目录重新定义。',
        },
        {
          selector:
            'VariableDeclarator[id.name=/^(Button|Card|Tag|Chip|SectionHeader|StatBadge|EmptyState)$/]',
          message:
            '请复用 src/components/ui 下的全局原子组件，而不是在页面目录重新定义。',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: [
      'src/App.tsx',
      'src/main.tsx',
      'src/pages/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/config/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/types/**/*.{ts,tsx}',
      'src/utils/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: 'Use react-router-dom Link instead',
            },
            {
              name: 'next/navigation',
              message: 'Use react-router-dom hooks instead',
            },
            {
              name: 'next/font/google',
              message: 'Use CSS @font-face or link tags instead',
            },
            {
              name: 'next/head',
              message: 'Use regular <head> or Helmet instead',
            },
          ],
          patterns: [
            {
              group: ['next/*'],
              message: 'Next.js APIs are not allowed in Vite SPA',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
