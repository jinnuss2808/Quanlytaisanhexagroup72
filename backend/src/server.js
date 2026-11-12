import 'dotenv/config';
import app from './app.js';
import { initializeLegacyReminders, runReminderSweep } from './remind.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4000);
app.listen(port, host, () => {
  console.log(`[HEXA API] http://${host}:${port}`);
  // Shared queue: every IT employee can directly complete any ticket.
  // No assignment scheduler or acceptance/decline sweep.
  // Restore reminder schedules for tickets created by older app versions.
  initializeLegacyReminders()
    .then(n => { console.log('[reminder] legacy schedules:', n); return runReminderSweep(); })
    .then(n => console.log('[reminder] startup:', n))
    .catch(err => console.error('[reminder] startup:', err));
  const reminderSweepMs = Math.max(10_000, Number(process.env.REMINDER_SWEEP_MS || 30000));
  setInterval(() => runReminderSweep()
    .then(n => { if (n) console.log('[reminder] sent:', n); })
    .catch(err => console.error('[reminder] sweep:', err)), reminderSweepMs);
});
