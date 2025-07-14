import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/**/*.integration.{test,spec}.{js,ts}'],
    testTimeout: 10_000,
    setupFiles: ['tests/setup.ts'],
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
});
