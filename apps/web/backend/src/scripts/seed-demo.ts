// backend/src/scripts/seed-demo.ts
import '../env.js';
import { runDemoReset } from './seed-demo/index.js';

const isReset = process.argv.includes('--reset');

try {
  await runDemoReset({ wipeFirst: isReset });
  console.log(`[seed-demo] OK — ${isReset ? 'reset' : 'init'} complete`);
  process.exit(0);
} catch (err) {
  console.error('[seed-demo] FAIL', err);
  process.exit(1);
}
