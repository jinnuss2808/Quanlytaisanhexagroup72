import test from 'node:test';
import assert from 'node:assert/strict';
import { isITRole, countOtherManagers, mustKeepAnotherManager } from '../src/admin-roles.js';

test('manager is the existing Admin role and agent remains employee', () => {
  assert.equal(isITRole('manager'), true);
  assert.equal(isITRole('agent'), true);
  assert.equal(isITRole('admin'), false); // Avoid breaking existing RTDB rules.
  assert.equal(isITRole('requester'), false);
});
test('only other active managers can prevent losing the final Admin', () => {
  const users = { a: { role:'manager',active:true }, b: {role:'manager',active:false},
    c:{role:'agent',active:true} };
  assert.equal(countOtherManagers(users,'a'),0);
  assert.equal(countOtherManagers({...users, d:{role:'manager',active:true}},'a'),1);
  assert.equal(countOtherManagers(users,'nobody'),1);
});
test('demoting, disabling or deleting final Admin must be guarded', () => {
  const manager = { role:'manager',active:true };
  assert.equal(mustKeepAnotherManager(manager,'agent',true),true);
  assert.equal(mustKeepAnotherManager(manager,'manager',false),true);
  assert.equal(mustKeepAnotherManager(manager,null,false),true);
  assert.equal(mustKeepAnotherManager(manager,'manager',true),false);
  assert.equal(mustKeepAnotherManager({role:'agent',active:true},'agent',false),false);
});
