export const STATUS = ['new', 'in_progress', 'on_hold', 'resolved', 'closed'];
export const ACTIVE_STATUS = new Set(['new', 'in_progress', 'on_hold']);
export const TYPE = ['support', 'equipment'];
export const PRIORITY = ['low', 'normal', 'high', 'urgent'];
export const DEADLINE_MS = 5 * 60 * 1000;

// Fair share is based on ALL assignments (including completed work):
// A with 2 assignments and B with 1 gets B as the next assignee.
// Active workload breaks ties, then stable uid avoids random reshuffling.
export function chooseAgent(agents) {
  if (!agents.length) return null;
  return [...agents].sort((a, b) => {
    const totalDiff = (a.totalAssigned ?? 0) - (b.totalAssigned ?? 0);
    if (totalDiff) return totalDiff;
    const openDiff = (a.activeTickets ?? 0) - (b.activeTickets ?? 0);
    if (openDiff) return openDiff;
    return String(a.uid).localeCompare(String(b.uid));
  })[0];
}
export function normalizeText(value, max = 250) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
export function statusDelta(before, after) {
  return Number(ACTIVE_STATUS.has(after)) - Number(ACTIVE_STATUS.has(before));
}

// Realtime Database returns objects keyed by push ID, not Firestore DocumentSnapshots.
export function entriesToArray(value) {
  return Object.entries(value || {}).map(([id, data]) => ({ id, ...data }));
}
export function newestFirst(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }

// Recompute active workloads from ticket records rather than trusting cached counters.
// This keeps assignment decisions correct even when an earlier counter write was interrupted.
export function computeWorkloads(tickets) {
  const counts = {};
  for (const ticket of tickets) {
    if (ticket.assignedTo && ACTIVE_STATUS.has(ticket.status)) {
      counts[ticket.assignedTo] = (counts[ticket.assignedTo] || 0) + 1;
    }
  }
  return counts;
}

// Minimum historical assignment count visible in current ticket records.
// Reassignments that are no longer visible are still counted by users.totalAssigned.
export function computeCurrentAssignmentCounts(tickets) {
  const counts = {};
  for (const ticket of tickets) {
    if (ticket.assignedTo) counts[ticket.assignedTo] = (counts[ticket.assignedTo] || 0) + 1;
  }
  return counts;
}
