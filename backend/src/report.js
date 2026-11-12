const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const localParts = new Intl.DateTimeFormat('en-US', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric', month: '2-digit',
});
export function yearMonth(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return null;
  const parts = Object.fromEntries(localParts.formatToParts(new Date(Number(timestamp)))
    .filter(p => p.type === 'year' || p.type === 'month')
    .map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month) };
}
export function completionRecord(ticket) {
  if (!['resolved', 'closed'].includes(ticket.status)) return null;
  // For older tickets, updatedAt is an approximation (may include edits after resolution).
  const inferred = !ticket.completedAt && !ticket.resolvedAt;
  const at = Number(ticket.completedAt || ticket.resolvedAt || ticket.updatedAt);
  const uid = ticket.completedBy || ticket.assignedTo;
  if (!uid || !Number.isFinite(at) || at <= 0) return null;
  return { at, uid, inferred, type: ticket.type, name: ticket.completedByName || ticket.assignedToName || '' };
}
// A rating is linked to the technician who completed the ticket, not to
// whoever happens to be assigned to it in the future. Older tickets are
// attributed using completedBy / assignedTo if no rating owner was stored.
export function ratingRecord(ticket) {
  const stars = Number(ticket.requesterRating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  const uid = ticket.ratedAgentUid || ticket.completedBy || ticket.assignedTo;
  if (!uid) return null; // Keep unattributed reviews visible on ticket, not in employee KPIs.
  const at = Number(ticket.ratedAt || ticket.requesterConfirmedAt);
  return { uid, stars, at: Number.isFinite(at) && at > 0 ? at : null,
    name: ticket.ratedAgentName || ticket.completedByName || ticket.assignedToName || '' };
}

const emptyRatingStats = () => ({ tickets: 0, sum: 0, average: null });
const addRating = (stats, stars) => {
  stats.tickets += 1;
  stats.sum += stars;
  stats.average = Math.round((stats.sum / stats.tickets) * 100) / 100;
};
const newEmployee = (uid, name, email, role) => ({
  uid, name, email: email || '', role,
  monthCompleted: 0, yearCompleted: 0,
  monthSupport: 0, monthEquipment: 0,
  yearSupport: 0, yearEquipment: 0,
  monthly: Array(12).fill(0), inferred: 0,
  ratingMonth: emptyRatingStats(),
  ratingYear: emptyRatingStats(),
  ratingAll: emptyRatingStats(),
});

export function createReport(tickets, users, year, month, scopeUid = null) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 ||
    !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Năm hoặc tháng không hợp lệ.');
  const employees = new Map();
  for (const user of users) {
    if (scopeUid && user.uid !== scopeUid) continue;
    if (!scopeUid && user.role !== 'agent') continue;
    employees.set(user.uid, newEmployee(user.uid, user.name, user.email, user.role));
  }
  let excluded = 0;
  for (const ticket of tickets) {
    const completed = completionRecord(ticket);
    if (!completed || (scopeUid && completed.uid !== scopeUid)) continue;
    const period = yearMonth(completed.at);
    if (!period || period.year !== year) continue;
    if (!employees.has(completed.uid)) {
      // Historical employee can have been deleted from Authentication/users.
      employees.set(completed.uid, newEmployee(completed.uid, completed.name || 'Nhân viên đã xóa', '', 'former'));
    }
    const row = employees.get(completed.uid);
    row.yearCompleted += 1;
    row.monthly[period.month - 1] += 1;
    if (completed.type === 'support') row.yearSupport += 1;
    if (completed.type === 'equipment') row.yearEquipment += 1;
    if (period.month === month) {
      row.monthCompleted += 1;
      if (completed.type === 'support') row.monthSupport += 1;
      if (completed.type === 'equipment') row.monthEquipment += 1;
    }
    if (completed.inferred) { row.inferred += 1; excluded += 1; }
  }
  // Ratings have their own date (the date the requester submitted a review).
  // Calculate all-time rating averages independently of the selected report year;
  // never use the count of unreviewed/completed tickets as the denominator.
  for (const ticket of tickets) {
    const rated = ratingRecord(ticket);
    if (!rated || (scopeUid && rated.uid !== scopeUid)) continue;
    if (!employees.has(rated.uid)) {
      employees.set(rated.uid, newEmployee(rated.uid, rated.name || 'Nhân viên đã xóa', '', 'former'));
    }
    const row = employees.get(rated.uid);
    addRating(row.ratingAll, rated.stars);
    const ratingPeriod = rated.at ? yearMonth(rated.at) : null;
    if (ratingPeriod?.year === year) {
      addRating(row.ratingYear, rated.stars);
      if (ratingPeriod.month === month) addRating(row.ratingMonth, rated.stars);
    }
  }
  const rows = [...employees.values()].sort((a, b) => b.yearCompleted - a.yearCompleted ||
    b.ratingAll.tickets - a.ratingAll.tickets || a.name.localeCompare(b.name, 'vi'));
  const ratingTotals = { month: emptyRatingStats(), year: emptyRatingStats(), all: emptyRatingStats() };
  for (const row of rows) {
    for (const period of ['month', 'year', 'all']) {
      const source = row[period === 'all' ? 'ratingAll' : period === 'month' ? 'ratingMonth' : 'ratingYear'];
      ratingTotals[period].tickets += source.tickets;
      ratingTotals[period].sum += source.sum;
    }
  }
  for (const stats of Object.values(ratingTotals)) {
    stats.average = stats.tickets ? Math.round(stats.sum / stats.tickets * 100) / 100 : null;
  }
  const total = rows.reduce((acc, row) => {
    acc.month += row.monthCompleted;
    acc.year += row.yearCompleted;
    return acc;
  }, { month: 0, year: 0 });
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, completed: rows.reduce((sum, row) => sum + row.monthly[i], 0) }));
  return { year, month, timezone: VIETNAM_TIME_ZONE, total, months, employees: rows, ratingTotals, inferredCount: excluded };
}
