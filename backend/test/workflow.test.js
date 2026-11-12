import test from 'node:test';
import assert from 'node:assert/strict';
import { vietnamDate, validDate, onLeave, eligibleAgents, chooseReplacement, workflowEnabled } from '../src/workflow.js';

test('requester workflow OFF until explicitly enabled', () => {
  assert.equal(workflowEnabled(null), false);
  assert.equal(workflowEnabled({}), false);
  assert.equal(workflowEnabled({ requesterWorkflowEnabled: 'true' }), false);
  assert.equal(workflowEnabled({ requesterWorkflowEnabled: true }), true);
});
test('date validation rejects invalid calendar days and unpadded input', () => {
  assert.equal(validDate('2026-11-06'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2026-2-06'), false);
  assert.equal(validDate('2026-13-01'), false);
  assert.equal(validDate('__proto__'), false);
});
test('Vietnam timezone rolls over at UTC+7, not UTC midnight', () => {
  assert.equal(vietnamDate(Date.parse('2026-11-06T16:59:59Z')), '2026-11-06');
  assert.equal(vietnamDate(Date.parse('2026-11-06T17:00:00Z')), '2026-11-07');
});
test('leave is inclusive on first and last day', () => {
  const user = { leavePeriods: { x: { startDate: '2026-11-08', endDate: '2026-11-10' } } };
  assert.equal(onLeave(user, '2026-11-07'), false);
  assert.equal(onLeave(user, '2026-11-08'), true);
  assert.equal(onLeave(user, '2026-11-10'), true);
  assert.equal(onLeave(user, '2026-11-11'), false);
});
test('agents on vacation or inactive never receive new assignments', () => {
  const users = {
    a: { role:'agent', active:true, leavePeriods:{ leave:{startDate:'2026-11-06',endDate:'2026-11-06'} } },
    b: { role:'agent', active:true },
    c: { role:'agent', active:false },
    d: { role:'manager',active:true }
  };
  assert.deepEqual(eligibleAgents(users, [], {}, '2026-11-06').map(u => u.uid), ['b']);
  assert.deepEqual(eligibleAgents(users, [], {}, '2026-11-07').map(u => u.uid), ['a','b']);
});
test('refusal permanently excludes that agent for this ticket', () => {
  const users = { a:{ role:'agent',active:true,totalAssigned:0 }, b:{role:'agent',active:true,totalAssigned:5} };
  const chosen = chooseReplacement(users, [], {a:true}, {}, '2026-11-06');
  assert.equal(chosen.uid, 'b');
  assert.equal(chooseReplacement(users, [], {a:true,b:true}, {}, '2026-11-06'), null);
});
test('fairness A=2 jobs B=1 job gives ticket to B, including after refusal', () => {
  const users = { a:{role:'agent',active:true,totalAssigned:2}, b:{role:'agent',active:true,totalAssigned:1} };
  assert.equal(chooseReplacement(users, [], {}, {}, '2026-11-06').uid, 'b');
  assert.equal(chooseReplacement(users, [], {b:true}, {}, '2026-11-06').uid, 'a');
});
test('fallback to current workload when total assigned ties', () => {
  const users = {a:{role:'agent',active:true,totalAssigned:1},b:{role:'agent',active:true,totalAssigned:1}};
  const tickets = [{assignedTo:'a',status:'new'}, {assignedTo:'a',status:'in_progress'}];
  assert.equal(chooseReplacement(users, tickets, {}, {}, '2026-11-06').uid, 'b');
});
test('leave changes over a new calendar day and later allows allocation again', () => {
  const users = {a:{role:'agent',active:true,totalAssigned:0,leavePeriods:{x:{startDate:'2026-11-06',endDate:'2026-11-07'}}},
    b:{role:'agent',active:true,totalAssigned:1}};
  assert.equal(chooseReplacement(users, [], {}, {}, '2026-11-06').uid, 'b');
  assert.equal(chooseReplacement(users, [], {}, {}, '2026-11-08').uid, 'a');
});
