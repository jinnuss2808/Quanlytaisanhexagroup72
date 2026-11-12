import { isValidEmail, normalizeText } from './core.js';

export function validateRequesterProfile(body = {}) {
  const name = normalizeText(body.name, 100);
  const department = normalizeText(body.department, 100);
  const position = normalizeText(body.position, 100);
  const contact = normalizeText(body.contact, 100);
  if (!name || !department || !position || !contact) {
    throw Object.assign(new Error('Vui lòng nhập đủ họ tên, phòng ban, chức vụ và số liên hệ.'), { status: 400 });
  }
  return { name, department, position, contact };
}
export function validateRequesterEmail(value) {
  const email = normalizeText(value, 254).toLowerCase();
  if (!isValidEmail(email)) throw Object.assign(new Error('Email không hợp lệ.'), { status: 400 });
  return email;
}
export function validateRequesterPassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw Object.assign(new Error('Mật khẩu phải có từ 8 đến 128 ký tự.'), { status: 400 });
  }
  return value;
}
export function isRequesterEnabled(profile) {
  return Boolean(profile) && profile.active !== false;
}
export function canRequesterConfirm(profile, requesterMode) {
  return requesterMode === true && isRequesterEnabled(profile);
}

// Requested position is self-declared, but privileged urgency is granted by Admin only.
export function requesterLevel(value) { return value === 'manager' ? 'manager' : 'employee'; }
export function canUseUrgent(profile) {
  return profile?.jobLevel === 'manager' && profile?.jobLevelApproved === true && profile?.active !== false;
}
