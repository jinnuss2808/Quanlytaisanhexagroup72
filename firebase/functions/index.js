import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeLegacyReminders, runReminderSweep } from './worker/remind.js';
import { performDailyDatabaseBackup } from './worker/backup.js';

// Shared queue: no automatic assignment, no acceptance/rejection.
// Scheduler is only for 30-minute support and 12-hour asset reminders.
export const processDueTickets = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Ho_Chi_Minh',
  region: 'asia-southeast1',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 1,
}, async () => {
  await initializeLegacyReminders();
  const reminded = await runReminderSweep();
  if (reminded) console.log('[HEXA reminders]', { reminded });
});

// A Cloud Storage bucket and Firebase Blaze billing are required for scheduled backups.
export const backupRealtimeDatabase = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'Asia/Ho_Chi_Minh',
  region: 'asia-southeast1',
  memory: '1GiB',
  timeoutSeconds: 540,
  maxInstances: 1,
}, performDailyDatabaseBackup);
