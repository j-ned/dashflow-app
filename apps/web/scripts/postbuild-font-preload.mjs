/**
 * Post-build script: injects <link rel="preload"> for Inter Latin font
 * into the built index.html. This breaks the CSS→Font critical chain
 * by letting the browser discover the font immediately.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BROWSER_DIR = join(import.meta.dirname, '..', 'dist', 'dash-flow', 'browser');
const INDEX_PATH = join(BROWSER_DIR, 'index.html');
const MEDIA_DIR = join(BROWSER_DIR, 'media');

// Find the hashed Inter Latin font file
const files = readdirSync(MEDIA_DIR);
const interLatinFile = files.find(f => f.startsWith('inter-latin-wght-normal-') && f.endsWith('.woff2'));

if (!interLatinFile) {
  console.warn('[postbuild] Inter Latin font not found, skipping preload injection');
  process.exit(0);
}

let html = readFileSync(INDEX_PATH, 'utf-8');

const preloadTag = `<link rel="preload" as="font" type="font/woff2" href="media/${interLatinFile}" crossorigin>`;

// Insert after <meta charset> for earliest possible discovery
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  ${preloadTag}`);

writeFileSync(INDEX_PATH, html);
console.log(`[postbuild] Injected font preload: ${interLatinFile}`);