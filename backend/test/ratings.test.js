import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingRecord, createReport } from '../src/report.js';
const dt = s => Date.parse(s);
const employee = { uid: 'it-a', name: 'Nhân viên A', email: 'a@example.com', role: 'agent' };
const sample = { status: 'closed', requesterRating: 5, ratedAgentUid: 'it-a', completedBy: 'it-a',
  requesterConfirmedAt: dt('2026-11-05T09:00:00+07:00'), completedAt: dt('2026-10-30T09:00:00+07:00'), type: 'support' };

test('1 ticket rated 5 stars counts as one rating, not five tickets', () => {
  const report = createReport([sample], [employee], 2026, 11);
  const row = report.employees[0];
  assert.deepEqual(row.ratingMonth, { tickets: 1, sum: 5, average: 5 });
  assert.equal(row.ratingAll.average, 5);
  assert.equal(report.ratingTotals.month.tickets, 1);
});
test('mean = total stars / rated tickets; exclude unrated tickets from divisor', () => {
  const ratings = [sample, {...sample, requesterRating: 3},
    {...sample, requesterRating: null}, {...sample, requesterRating: 0},
    {...sample, requesterRating: 6}];
  const { employees: [a] } = createReport(ratings, [employee], 2026, 11);
  assert.equal(a.ratingMonth.tickets, 2);
  assert.equal(a.ratingMonth.sum, 8);
  assert.equal(a.ratingMonth.average, 4);
});
test('unrated employee has null average rather than misleading zero stars', () => {
  const a = createReport([], [employee], 2026, 11).employees[0];
  assert.deepEqual(a.ratingAll, { tickets: 0, sum: 0, average: null });
});
test('monthly and yearly reviews use review date, not completion date', () => {
  const r = createReport([sample], [employee], 2026, 10).employees[0];
  assert.equal(r.ratingMonth.tickets, 0);
  assert.equal(r.ratingYear.tickets, 1);
  assert.equal(r.yearCompleted, 1);
  assert.equal(r.monthCompleted, 1);
});
test('all-time aggregates reviews across all years; month and year only match selected', () => {
  const old = { ...sample, requesterRating: 1, requesterConfirmedAt: dt('2025-12-31T10:00:00+07:00') };
  const r = createReport([sample, old], [employee], 2026, 11).employees[0];
  assert.equal(r.ratingMonth.tickets, 1);
  assert.equal(r.ratingYear.tickets, 1);
  assert.equal(r.ratingAll.tickets, 2);
  assert.equal(r.ratingAll.average, 3);
});
test('rating sticks to the technician at completion after ticket reassignment', () => {
  const changed = { ...sample, assignedTo: 'it-b', completedBy: 'it-b', ratedAgentUid: 'it-a' };
  const r = createReport([changed], [employee, { uid: 'it-b', name: 'B', role: 'agent' }], 2026, 11);
  assert.equal(r.employees.find(x => x.uid === 'it-a').ratingAll.tickets, 1);
  assert.equal(r.employees.find(x => x.uid === 'it-b').ratingAll.tickets, 0);
});
test('rating without owner is visible on ticket but not assigned to employee KPI', () => {
  assert.equal(ratingRecord({ requesterRating: 5, status: 'closed' }), null);
});
test('deleted technician remains visible in rating statistics', () => {
  const r = createReport([{ ...sample, ratedAgentUid: 'removed', ratedAgentName: 'Nhân viên cũ' }],
    [employee], 2026, 11);
  const removed = r.employees.find(x => x.uid === 'removed');
  assert.equal(removed.ratingAll.tickets, 1);
  assert.equal(removed.name, 'Nhân viên cũ');
});
test('agent sees only their own reviews', () => {
  const r = createReport([sample, {...sample, ratedAgentUid:'it-b'}], [employee], 2026, 11, 'it-a');
  assert.equal(r.employees.length, 1);
  assert.equal(r.ratingTotals.all.tickets, 1);
});
test('average is rounded to 2 decimal places', () => {
  const r = createReport([{...sample, requesterRating: 5}, {...sample, requesterRating: 4}, {...sample, requesterRating: 3}],
    [employee], 2026, 11);
  assert.equal(r.ratingTotals.all.average, 4);
  const two = createReport([{...sample, requesterRating: 5}, {...sample, requesterRating: 4}, {...sample, requesterRating: 4}],
    [employee], 2026, 11);
  assert.equal(two.ratingTotals.all.average, 4.33);
});
