import { db } from './firebase.js';
import { ACTIVE_STATUS } from './core.js';
import { claimReminder, initialReminderAt } from './reminder-core.js';
import { notifyReminder } from './notify.js';
import { transactExistingTicket } from './ticket-transaction.js';

// One process is expected to own the timer. RTDB transactions claim each due reminder,
// making individual reminders safe from duplicate sends when the sweep overlaps.
let running = false;

export async function initializeLegacyReminders() {
  const snap = await db.ref('tickets').get();
  let updated = 0;
  for (const [id, ticketData] of Object.entries(snap.val() || {})) {
    if (!ACTIVE_STATUS.has(ticketData.status) || ticketData.nextReminderAt) continue;
    const ref = db.ref(`tickets/${id}`);
    const now = Date.now();
    const result = await transactExistingTicket(ref, ticket => {
      if (!ticket || !ACTIVE_STATUS.has(ticket.status) || ticket.nextReminderAt) return;
      return { ...ticket, nextReminderAt: initialReminderAt(ticket, now) };
    });
    if (result.committed) updated += 1;
  }
  return updated;
}

export async function sendDueReminder(id) {
  const now = Date.now();
  const ref = db.ref(`tickets/${id}`);
  const result = await transactExistingTicket(ref, ticket => claimReminder(ticket, now) || undefined);
  if (!result.committed) return false;
  const ticket = result.snapshot.val();
  const users = (await db.ref('users').get()).val() || {};
  const targets = Object.entries(users)
    .filter(([, u]) => u.active === true && ['agent', 'manager'].includes(u.role))
    .map(([uid]) => uid);
  if (targets.length) {
    try { await notifyReminder(ticket, targets, users); }
    catch (err) { console.error('[reminder] notify:', ticket.code, err); }
  } else {
    console.warn('[reminder] no active IT recipient for', ticket.code);
  }
  return true;
}

export async function runReminderSweep() {
  if (running) return 0;
  running = true;
  try {
    const snap = await db.ref('tickets').orderByChild('nextReminderAt')
      .startAt(1).endAt(Date.now()).limitToFirst(100).get();
    let sent = 0;
    for (const id of Object.keys(snap.val() || {})) {
      try { if (await sendDueReminder(id)) sent += 1; }
      catch (err) { console.error('[reminder] ticket:', id, err); }
    }
    return sent;
  } finally { running = false; }
}
