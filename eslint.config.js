// Flat ESLint config. Conservative scope: lints ONLY new AdventureOS code.
// The 23 migrated production pages/components are intentionally NOT linted —
// they were migrated verbatim and must not churn (ADR-001, Baseline §2).
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  {
    // Only these paths are linted. Widen deliberately as the app grows.
    files: [
      'src/islands/**/*.{ts,tsx}',
      'src/lib/**/*.ts',
      'src/utils/**/*.ts',
      'src/services/**/*.ts',
      'src/types/**/*.ts',
      'workers/**/*.ts',
      'tests/**/*.ts',
      'database/**/*.ts',
    ],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // Never lint build output, deps, the legacy site, or committed snapshots.
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'src/pages/**',
      'src/components/**',
      'src/layouts/**',
      'src/data/**',
      'astro.config.mjs',
      'content.config.ts',
      'public/**',
      'tests/visual/**/*-snapshots/**',
    ],
  },
  ...astro.configs.recommended
);
