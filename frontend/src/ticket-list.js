/**
 * Filter management tickets by exactly one category. This function never writes to Firebase.
 * `support` = IT Support; `equipment` = asset requests.
 */
export function filterTicketsByType(tickets, { type = 'support', search = '', status = 'all' } = {}) {
  const requestedType = type === 'equipment' ? 'equipment' : 'support';
  const needle = String(search ?? '').trim().toLocaleLowerCase('vi-VN');
  return (Array.isArray(tickets) ? tickets : []).filter(ticket => {
    if (ticket?.type !== requestedType) return false;
    if (status !== 'all' && ticket.status !== status) return false;
    if (!needle) return true;
    return [ticket.code, ticket.subject, ticket.requesterName, ticket.department]
      .map(value => String(value ?? '')).join(' ').toLocaleLowerCase('vi-VN').includes(needle);
  });
}

export function countTicketsByType(tickets, type) {
  return filterTicketsByType(tickets, { type }).length;
}
