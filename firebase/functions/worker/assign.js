import { db, ServerValue } from './firebase.js';
import { ACTIVE_STATUS, DEADLINE_MS, entriesToArray, computeCurrentAssignmentCounts } from './core.js';
import { transactExistingTicket } from './ticket-transaction.js';
import { notifyPeople } from './notify.js';
import { chooseReplacement } from './workflow.js';

export async function autoAssignOne(ticketId) {
  // RTDB transactions are scoped to one ticket: manager/worker cannot assign that ticket twice.
  // Prefer fewer historical assignments, then fewer open tickets; cached counters are backfilled from ticket records.
  const [usersSnap, ticketsSnap] = await Promise.all([db.ref('users').get(), db.ref('tickets').get()]);
  const users = usersSnap.val() || {};
  const tickets = entriesToArray(ticketsSnap.val());
  const historicalCounts = computeCurrentAssignmentCounts(tickets);
  const target = tickets.find(t => t.id === ticketId);
  if (!target) return null;
  const chosen = chooseReplacement(users, tickets, target.rejectedBy || {}, historicalCounts);
  if (!chosen) return null;

  const now = Date.now();
  const ref = db.ref(`tickets/${ticketId}`);
  const result = await transactExistingTicket(ref, ticket => {
    if (!ticket || ticket.assignedTo || !ACTIVE_STATUS.has(ticket.status)
      || !ticket.createdAt || (ticket.assignmentDeadline || ticket.createdAt + DEADLINE_MS) > now) return;
    if (ticket.rejectedBy?.[chosen.uid]) return;
    return { ...ticket, assignedTo: chosen.uid, assignedToName: chosen.name,
      assignmentMethod: 'auto', assignmentDecision: 'pending', acceptedAt: null,
      assignedAt: now, assignmentDeadline: null, updatedAt: now };
  });
  if (!result.committed) return null;

  const ticket = result.snapshot.val();
  const actId = db.ref(`activities/${ticketId}`).push().key;
  const updates = {
    [`users/${chosen.uid}/activeTickets`]: ServerValue.increment(1),
    [`users/${chosen.uid}/totalAssigned`]: ServerValue.increment(1),
    [`activities/${ticketId}/${actId}`]: { action: 'auto_assigned', actorName: 'Hệ thống', actorId: null,
      detail: `Tự phân công cho ${chosen.name} sau 5 phút`, createdAt: now },
  };
  await db.ref().update(updates);
  try { await notifyPeople([chosen.uid], ticketId, `Đã giao tự động · ${ticket.code}`, 'Bạn được giao một yêu cầu mới.'); }
  catch (err) { console.error('[notifications] auto assign:', err); }
  return { uid: chosen.uid, code: ticket.code };
}

/** Align existing pending tickets to the new five-minute rule after upgrades.
 * Only modifies their deadline, not assignment, ownership, or status.
 * A transaction prevents overwriting a manager assignment made concurrently.
 */
export async function alignPendingTicketDeadlines() {
  const snap = await db.ref('tickets').get();
  let changed = 0;
  for (const [id, t] of Object.entries(snap.val() || {})) {
    if (t.assignedTo || !ACTIVE_STATUS.has(t.status) || !(t.createdAt > 0) || Object.keys(t.rejectedBy || {}).length) continue;
    const expected = t.createdAt + DEADLINE_MS;
    if (t.assignmentDeadline === expected) continue;
    const ref = db.ref(`tickets/${id}`);
    const result = await transactExistingTicket(ref, ticket => {
      if (!ticket || ticket.assignedTo || !ACTIVE_STATUS.has(ticket.status) || !(ticket.createdAt > 0) || Object.keys(ticket.rejectedBy || {}).length) return;
      const due = ticket.createdAt + DEADLINE_MS;
      if (ticket.assignmentDeadline === due) return;
      return { ...ticket, assignmentDeadline: due };
    });
    if (result.committed) changed += 1;
  }
  return changed;
}

// Upgrade pre-existing newly assigned tickets so staff can accept or reject them.
// Already in-progress, resolved or closed tickets are not interrupted.
export async function initializeLegacyPendingDecisions() {
  const snap = await db.ref('tickets').get();
  let changed = 0;
  for (const [id, t] of Object.entries(snap.val() || {})) {
    if (!t.assignedTo || t.status !== 'new' || t.assignmentDecision) continue;
    const result = await transactExistingTicket(db.ref(`tickets/${id}`), ticket => {
      if (!ticket || !ticket.assignedTo || ticket.status !== 'new' || ticket.assignmentDecision) return;
      return { ...ticket, assignmentDecision: 'pending', acceptedAt: null };
    });
    if (result.committed) changed += 1;
  }
  return changed;
}

let sweepRunning = false;
export async function runAssignmentSweep() {
  if (sweepRunning) return 0;
  sweepRunning = true;
  try {
    // startAt(1) skips unassigned-null and completed tickets; .indexOn is in database.rules.json.
    const snap = await db.ref('tickets').orderByChild('assignmentDeadline')
      .startAt(1).endAt(Date.now()).limitToFirst(50).get();
    let done = 0;
    for (const id of Object.keys(snap.val() || {})) {
      try { if (await autoAssignOne(id)) done += 1; }
      catch (err) { console.error('[autoAssign] ticket', id, err); }
    }
    return done;
  } finally { sweepRunning = false; }
}
