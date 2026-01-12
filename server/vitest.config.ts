import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals:          true,
    environment:      'node',
    silent:           true,
    passWithNoTests:  true,
    include:          ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude:          [
      ...configDefaults.exclude,
      '**/*.integration.*.ts',
      './scripts'
    ],
    typecheck: { tsconfig: './tsconfig.json' },
    coverage:  {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude:  ['node_modules/', 'dist/', '**/*.config.*', '**/__tests__/**'],
    },
  },
  resolve: { alias: { '@server': path.resolve(__dirname, './src') } },
});
