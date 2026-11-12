import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './worker/firebase.js';
import { alignPendingTicketDeadlines, initializeLegacyPendingDecisions, runAssignmentSweep } from './worker/assign.js';
import { initializeLegacyReminders, runReminderSweep } from './worker/remind.js';

// First run migrates due times for legacy tickets, at most once.
async function migrateLegacyTickets() {
  const flag=db.ref('settings/cloudSchedulerMigrationV2');
  const now=Date.now();
  const tx=await flag.transaction(old=>{
    if(old?.done || (old?.startedAt && now-old.startedAt<15*60_000)) return;
    return {startedAt:now};
  },undefined,false);
  if(!tx.committed) return;
  try {
    await alignPendingTicketDeadlines();
    await initializeLegacyPendingDecisions();
    await initializeLegacyReminders();
    await flag.set({done:true,completedAt:Date.now()});
  } catch(e){ await flag.remove().catch(console.error); throw e; }
}

// Required for automatic 5-minute assignment and 30-minute/12-hour reminders.
export const processDueTickets=onSchedule({
  schedule:'every 1 minutes',
  timeZone:'Asia/Ho_Chi_Minh',
  region:'asia-southeast1',
  memory:'512MiB',
  timeoutSeconds:120,
  maxInstances:1,
},async()=>{
  await migrateLegacyTickets();
  const assigned=await runAssignmentSweep();
  const reminded=await runReminderSweep();
  if(assigned||reminded) console.log('[HEXA scheduler]',{assigned,reminded});
});
