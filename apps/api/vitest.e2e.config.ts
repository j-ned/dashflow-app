import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env without dotenv (not a direct dep) so the e2e specs can
// read DATABASE_URL from process.env when vitest spawns the worker.
function loadDotEnv(path: string): Record<string, string> {
  try {
    const content = readFileSync(resolve(path), 'utf8');
    return Object.fromEntries(
      content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string];
        }),
    );
  } catch {
    return {};
  }
}

const dotEnvVars = loadDotEnv('.env');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Chaque fichier démarre son propre processus API (cf. test/e2e/api-server.ts).
    hookTimeout: 60_000,
    env: dotEnvVars,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
