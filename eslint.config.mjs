import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

// ESLint 9 defaults to flat config, and Next 16 removed the `next lint` shim
// that used to read `.eslintrc.json`. FlatCompat bridges the existing
// `eslint-config-next` (still distributed as a legacy/eslintrc config in the
// pinned 15.x) into the flat-config format so `eslint .` works unchanged.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', '*.tsbuildinfo'],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // The app deliberately uses <img> for client-rendered data URLs / blobs
      // that next/image can't optimize.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
