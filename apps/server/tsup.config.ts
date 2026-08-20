import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ['@handyin/types', '@handyin/validation'],
  outExtension() {
    return { js: '.js' };
  },
});
