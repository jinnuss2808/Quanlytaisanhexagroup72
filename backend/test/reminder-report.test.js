import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderInterval, initialReminderAt, isReminderDue, claimReminder } from '../src/reminder-core.js';
import { completionRecord, createReport, yearMonth } from '../src/report.js';

const halfHour = 30 * 60 * 1000;
const twelveHours = 12 * 60 * 60 * 1000;

test('support reminder every 30 minutes; equipment reminder every 12 hours', () => {
  assert.equal(reminderInterval('support'), halfHour);
  assert.equal(reminderInterval('equipment'), twelveHours);
});
test('legacy active ticket immediately due if already overdue, otherwise waits', () => {
  assert.equal(initialReminderAt({ createdAt: 1000, type: 'support' }, halfHour + 1200), halfHour + 1200);
  assert.equal(initialReminderAt({ createdAt: 1000, type: 'equipment' }, halfHour), 1000 + twelveHours);
});
test('active due reminder claimed once and schedules the next interval', () => {
  const now = Date.now();
  const initial = { type: 'support', status: 'on_hold', nextReminderAt: now - 1000, reminderCount: 3 };
  assert.equal(isReminderDue(initial, now), true);
  const updated = claimReminder(initial, now);
  assert.equal(updated.nextReminderAt, now + halfHour);
  assert.equal(updated.lastReminderAt, now);
  assert.equal(updated.reminderCount, 4);
  assert.equal(claimReminder(updated, now), null);
});
test('resolved / closed tickets never produce reminders', () => {
  const now = Date.now();
  for (const status of ['resolved', 'closed']) {
    assert.equal(claimReminder({ status, nextReminderAt: now - 1 }, now), null);
  }
});
test('Vietnamese local calendar month is used across UTC boundary', () => {
  assert.deepEqual(yearMonth(Date.parse('2025-12-31T18:30:00Z')), { year: 2026, month: 1 });
});
test('resolved then closed counted only once per ticket, in correct month and year', () => {
  const at = Date.parse('2026-11-05T10:00:00+07:00');
  const tickets = [
    { status: 'closed', type: 'support', completedBy: 'a', completedAt: at, updatedAt: at + 2000 },
    { status: 'resolved', type: 'equipment', completedBy: 'a', completedAt: at + 1000 },
    { status: 'new', type: 'support', assignedTo: 'a', updatedAt: at },
    { status: 'resolved', type: 'support', completedBy: 'b', completedAt: Date.parse('2026-10-25T10:00:00+07:00') },
  ];
  const report = createReport(tickets, [{ uid: 'a', name: 'Anh A', role: 'agent' }, { uid: 'b', name: 'Anh B', role: 'agent' }], 2026, 11);
  assert.deepEqual(report.total, { month: 2, year: 3 });
  assert.equal(report.employees[0].monthCompleted, 2);
  assert.equal(report.employees[0].monthSupport, 1);
  assert.equal(report.employees[0].monthEquipment, 1);
  assert.equal(report.employees[0].yearCompleted, 2);
  assert.equal(report.months[10].completed, 2);
  assert.equal(report.months[9].completed, 1);
});
test('employee report is scoped and deleted personnel remains historically countable', () => {
  const at = Date.parse('2026-05-10T12:00:00+07:00');
  const tickets = [
    { status: 'resolved', type: 'support', completedAt: at, completedBy: 'deleted', completedByName: 'Former IT' },
    { status: 'resolved', type: 'support', completedAt: at, completedBy: 'a' },
  ];
  const report = createReport(tickets, [{ uid: 'a', name: 'IT A', role: 'agent' }], 2026, 5);
  assert.equal(report.employees.length, 2);
  assert.equal(report.employees.find(x => x.uid === 'deleted').yearCompleted, 1);
  const self = createReport(tickets, [{ uid: 'a', name: 'IT A', role: 'agent' }], 2026, 5, 'a');
  assert.deepEqual(self.total, { month: 1, year: 1 });
  assert.equal(self.employees.length, 1);
});
test('historical completed ticket without completedAt inferred from updatedAt', () => {
  const old = completionRecord({ status: 'closed', type: 'support', assignedTo: 'a', updatedAt: 1730000000000 });
  assert.equal(old.inferred, true);
  assert.equal(old.uid, 'a');
});
test('report rejects non-calendar period values', () => {
  assert.throws(() => createReport([], [], 2026, 13), /Năm hoặc tháng/);
});
