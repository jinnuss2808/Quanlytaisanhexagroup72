import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequesterProfile, validateRequesterEmail, validateRequesterPassword,
  isRequesterEnabled, canRequesterConfirm } from '../src/requester-account.js';

test('requester profile validates names, department, position and contact', () => {
  assert.deepEqual(validateRequesterProfile({
    name: '  Nguyễn Văn A ', department: 'Kế toán', position: 'Nhân viên', contact: '0912345678'
  }), { name: 'Nguyễn Văn A', department: 'Kế toán', position: 'Nhân viên', contact: '0912345678' });
  assert.throws(() => validateRequesterProfile({ name: 'A', department: '', position: 'B', contact: '123' }), /đủ/);
});

test('admin may normalize requester login email and set a new password', () => {
  assert.equal(validateRequesterEmail(' USER@HEXA.VN '), 'user@hexa.vn');
  assert.equal(validateRequesterPassword('SecurePass2026!'), 'SecurePass2026!');
  assert.throws(() => validateRequesterPassword('123'), /8/);
  assert.throws(() => validateRequesterEmail('not-an-email'), /Email/);
});

test('requester confirmation is unavailable while feature OFF or requester locked', () => {
  assert.equal(canRequesterConfirm({ active: true }, false), false);
  assert.equal(canRequesterConfirm({ active: false }, true), false);
  assert.equal(canRequesterConfirm(null, true), false);
  assert.equal(canRequesterConfirm({ active: true }, true), true);
  assert.equal(isRequesterEnabled({ active: true }), true);
});
