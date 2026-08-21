import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    testTimeout: 3000,
    hookTimeout: 15000,
  },
});