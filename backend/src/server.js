import 'dotenv/config';
import app from './app.js';
import { alignPendingTicketDeadlines, initializeLegacyPendingDecisions, runAssignmentSweep } from './assign.js';
import { initializeLegacyReminders, runReminderSweep } from './remind.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4000);
app.listen(port, host, () => {
  console.log(`[HEXA API] http://${host}:${port}`);
  // Always check overdue tickets on startup, then periodically while this process is running.
  alignPendingTicketDeadlines()
    .then(n => { if (n) console.log('[autoAssign] migrated pending deadlines:', n); return initializeLegacyPendingDecisions(); })
    .then(n => { if (n) console.log('[assignment] legacy tickets awaiting response:', n); return runAssignmentSweep(); })
    .then(n => console.log('[autoAssign] startup:', n)).catch(console.error);
  const interval = Math.max(10_000, Number(process.env.ASSIGNMENT_SWEEP_MS || 30000));
  setInterval(() => runAssignmentSweep().then(n => { if (n) console.log('[autoAssign] assigned:', n); }).catch(console.error), interval);
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
