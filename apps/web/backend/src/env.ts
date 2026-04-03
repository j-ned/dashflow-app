import { config } from 'dotenv';

const path = process.env['DOTENV_PATH'] ?? '../.env';
config({ path });

if (!process.env['DATABASE_URL']) {
  console.warn(`[ENV] Warning: DATABASE_URL not found (path: ${path})`);
} else {
  console.log(`[ENV] Environment loaded successfully`);
}
