import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.mjs'],
      exclude: ['src/cli.mjs', 'src/utils.mjs'],
      reporter: ['text', 'lcov'],
    },
  },
});
