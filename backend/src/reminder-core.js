import { ACTIVE_STATUS } from './core.js';

export const REMINDER_INTERVAL_MS = Object.freeze({
  support: 30 * 60 * 1000,
  equipment: 12 * 60 * 60 * 1000,
});
export function reminderInterval(type) {
  return REMINDER_INTERVAL_MS[type] || REMINDER_INTERVAL_MS.support;
}
export function initialReminderAt(ticket, now = Date.now()) {
  const base = Number(ticket.lastReminderAt || ticket.createdAt || now);
  const due = base + reminderInterval(ticket.type);
  // Old tickets have no reminder schedule: notify once on startup if overdue.
  return due <= now ? now : due;
}
export function isReminderDue(ticket, now = Date.now()) {
  return Boolean(ticket && ACTIVE_STATUS.has(ticket.status) &&
    Number.isFinite(ticket.nextReminderAt) && ticket.nextReminderAt > 0 &&
    ticket.nextReminderAt <= now);
}
export function claimReminder(ticket, now = Date.now()) {
  if (!isReminderDue(ticket, now)) return null;
  return {
    ...ticket,
    nextReminderAt: now + reminderInterval(ticket.type),
    lastReminderAt: now,
    reminderCount: (Number(ticket.reminderCount) || 0) + 1,
  };
}
