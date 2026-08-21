import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          exclude: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/setup.ts'],
          fileParallelism: false,
          testTimeout: 3000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});