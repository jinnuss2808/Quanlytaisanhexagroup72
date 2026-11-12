// Pure rules for Vietnam-local leave scheduling and fair ticket handoff.
import { chooseAgent, ACTIVE_STATUS } from './core.js';
export const DEFAULT_REQUESTER_WORKFLOW = false;
export function vietnamDate(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ms);
  const part = type => parts.find(x => x.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function onLeave(user, day = vietnamDate()) {
  return Object.values(user?.leavePeriods || {}).some(p => p && p.startDate <= day && p.endDate >= day);
}
export function eligibleAgents(users, tickets, excluded = {}, day = vietnamDate()) {
  const workloads = {};
  for (const t of tickets) if (t.assignedTo && ACTIVE_STATUS.has(t.status)) {
    workloads[t.assignedTo] = (workloads[t.assignedTo] || 0) + 1;
  }
  return Object.entries(users || {})
    .filter(([uid, u]) => u?.role === 'agent' && u.active === true && !onLeave(u, day) && !excluded?.[uid])
    .map(([uid, u]) => ({ ...u, uid, activeTickets: workloads[uid] || 0 }));
}
export function chooseReplacement(users, tickets, rejected, historical, day = vietnamDate()) {
  const agents = eligibleAgents(users, tickets, rejected, day)
    .map(a => ({...a, totalAssigned: Math.max(Number(a.totalAssigned) || 0, historical[a.uid] || 0)}));
  return chooseAgent(agents);
}
export function workflowEnabled(settings) { return settings?.requesterWorkflowEnabled === true; }
