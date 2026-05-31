import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    // swc transforme les décorateurs + emit metadata (DI NestJS) pour Vitest
    swc.vite({ module: { type: 'es6' } }),
  ],
});
