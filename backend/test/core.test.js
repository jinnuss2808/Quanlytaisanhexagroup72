import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAgent, statusDelta, DEADLINE_MS, normalizeText, computeWorkloads,
  entriesToArray, newestFirst, computeCurrentAssignmentCounts } from '../src/core.js';

test('5-minute assignment timeout', () => assert.equal(DEADLINE_MS, 300000));
test('auto assignment favors fewer total assignments: A=2 B=1 => B', () => {
  const agents = [{ uid: 'a', activeTickets: 0, totalAssigned: 2 }, { uid: 'b', activeTickets: 1, totalAssigned: 1 }];
  assert.equal(chooseAgent(agents).uid, 'b');
});
test('tie in total assignments favors fewer open tickets', () => {
  assert.equal(chooseAgent([{ uid: 'a', activeTickets: 2, totalAssigned: 4 }, { uid: 'b', activeTickets: 1, totalAssigned: 4 }]).uid, 'b');
});
test('returns null without agents', () => assert.equal(chooseAgent([]), null));
test('resolved decrements active workload; reopened increments', () => {
  assert.equal(statusDelta('in_progress', 'resolved'), -1);
  assert.equal(statusDelta('resolved', 'in_progress'), 1);
  assert.equal(statusDelta('new', 'on_hold'), 0);
});
test('trims and bounds user input', () => assert.equal(normalizeText('  abcdef ', 3), 'abc'));
test('Realtime Database keyed objects become list items with IDs', () => {
  assert.deepEqual(entriesToArray({ abc: { status: 'new' } }), [{ id: 'abc', status: 'new' }]);
  assert.deepEqual(entriesToArray(null), []);
});
test('workload counts only assigned open tickets', () => {
  const counts = computeWorkloads([
    { assignedTo: 'a', status: 'new' }, { assignedTo: 'a', status: 'resolved' },
    { assignedTo: 'a', status: 'on_hold' }, { assignedTo: 'b', status: 'in_progress' },
    { assignedTo: null, status: 'new' },
  ]);
  assert.deepEqual(counts, { a: 2, b: 1 });
});
test('Realtime timestamp sorting uses numeric milliseconds', () => {
  assert.deepEqual([{ createdAt: 100 }, { createdAt: 300 }].sort(newestFirst), [{ createdAt: 300 }, { createdAt: 100 }]);
});

test('historical assignment count includes resolved tickets for fairness', () => {
  const tickets = [
    { assignedTo: 'a', status: 'resolved' },
    { assignedTo: 'a', status: 'new' },
    { assignedTo: 'b', status: 'closed' },
    { assignedTo: null, status: 'new' },
  ];
  assert.deepEqual(computeCurrentAssignmentCounts(tickets), { a: 2, b: 1 });
});
