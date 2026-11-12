import { ACTIVE_STATUS, STATUS } from './core.js';

// Every active IT employee sees the same queue. Only the FIRST successful
// completion is credited; Firebase ETag conditional writes serialize races.
export function applySharedTicketStatus(ticket, newStatus, actor, now, requesterCanConfirm = false) {
  if (!ticket || !STATUS.includes(newStatus) || ticket.status === newStatus) return undefined;
  if (newStatus === 'closed' && ticket.requesterUid && requesterCanConfirm) return undefined;
  // An agent must not erase a colleague's completion by reopening it.
  if (!ACTIVE_STATUS.has(ticket.status) && ACTIVE_STATUS.has(newStatus) && actor.role !== 'manager') return undefined;
  const next = { ...ticket, status: newStatus, updatedAt: now, assignmentDeadline: null,
    assignmentDecision: null };
  if (!ACTIVE_STATUS.has(newStatus)) {
    next.nextReminderAt = null;
    if (ACTIVE_STATUS.has(ticket.status) || !ticket.completedAt) {
      next.completedAt = now;
      next.completedBy = actor.uid;
      next.completedByName = actor.name;
    }
  } else if (!ACTIVE_STATUS.has(ticket.status)) {
    next.completedAt = null;
    next.completedBy = null;
    next.completedByName = null;
    // A reopened ticket needs a new reminder cycle; set by caller if needed.
    next.nextReminderAt = null;
  }
  return next;
}
