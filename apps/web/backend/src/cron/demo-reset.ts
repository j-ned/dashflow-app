import cron from 'node-cron';
import { runDemoReset } from '../scripts/seed-demo/index.js';

export function startDemoResetCron(): void {
  if (process.env['DEMO_ENABLED'] !== 'true') return;

  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Reset démo démarré');
    try {
      await runDemoReset();
      console.log('[cron] Reset démo OK');
    } catch (err) {
      console.error('[cron] Reset démo FAIL', err);
    }
  });

  console.log('[cron] Demo reset planifié (toutes les 6h)');
}
