import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAssetStatusEdit} from '../src/asset-core.js';

test('broken legacy asset without assignedTo can become available',()=>{
 assert.deepEqual(prepareAssetStatusEdit({status:'broken'},'available'),{assignedTo:null,recoveredAssignee:null});
});
test('maintenance legacy asset with null assignedTo can become available',()=>{
 assert.deepEqual(prepareAssetStatusEdit({status:'maintenance',assignedTo:null},'available'),{assignedTo:null,recoveredAssignee:null});
});
test('broken legacy asset with stale user releases old assignee',()=>{
 assert.deepEqual(prepareAssetStatusEdit({status:'broken',assignedTo:'Nguyen Van A'},'available'),{assignedTo:null,recoveredAssignee:'Nguyen Van A'});
});
test('active assignment must use return endpoint',()=>{
 assert.throws(()=>prepareAssetStatusEdit({status:'using',assignedTo:'A'},'available'),/thu hồi/);
});
test('cannot assign by changing status directly',()=>{
 assert.throws(()=>prepareAssetStatusEdit({status:'available'},'using'),/bàn giao/);
});
test('no user data lost when editing a non-using state without recovery',()=>{
 assert.deepEqual(prepareAssetStatusEdit({status:'broken',assignedTo:'A'},'broken'),{assignedTo:'A',recoveredAssignee:null});
});
