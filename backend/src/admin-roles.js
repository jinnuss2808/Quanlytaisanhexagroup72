// The existing DB role `manager` is presented as "Admin" in the UI.
// Keeping this role name preserves Realtime Database Rules and existing accounts.
export const isITRole = role => role === 'manager' || role === 'agent';
export const countOtherManagers = (users, exceptUid) => Object.entries(users || {})
  .filter(([uid, account]) => uid !== exceptUid && account?.role === 'manager' && account?.active === true).length;
export const mustKeepAnotherManager = (old, nextRole, nextActive) =>
  old?.role === 'manager' && old?.active === true && (nextRole !== 'manager' || nextActive !== true);
