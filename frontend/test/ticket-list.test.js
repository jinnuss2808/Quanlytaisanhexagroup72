import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTicketsByType, countTicketsByType } from '../src/ticket-list.js';

const tickets = [
  { id: '1', type: 'support', code: 'IT-01', subject: 'Lỗi kết nối Wi-Fi', requesterName: 'Mai', department: 'Hành chính', status: 'new' },
  { id: '2', type: 'equipment', code: 'TS-02', subject: 'Xin laptop', requesterName: 'Lan', department: 'Kế toán', status: 'new' },
  { id: '3', type: 'support', code: 'IT-03', subject: 'Thay bàn phím', requesterName: 'Minh', department: 'Kỹ thuật', status: 'closed' },
  { id: '4', type: 'equipment', code: 'TS-04', subject: 'Xin màn hình', requesterName: 'Quang', department: 'Kế toán', status: 'resolved' },
];

test('support tab never displays asset requests', () => {
  assert.deepEqual(filterTicketsByType(tickets, { type: 'support' }).map(t => t.id), ['1','3']);
});
test('equipment tab never displays support requests', () => {
  assert.deepEqual(filterTicketsByType(tickets, { type: 'equipment' }).map(t => t.id), ['2','4']);
});
test('status filters apply only to selected category', () => {
  assert.deepEqual(filterTicketsByType(tickets, { type: 'support', status: 'new' }).map(t => t.id), ['1']);
  assert.deepEqual(filterTicketsByType(tickets, { type: 'equipment', status: 'resolved' }).map(t => t.id), ['4']);
});
test('Vietnamese search matches department, requester and subject', () => {
  assert.deepEqual(filterTicketsByType(tickets, { type: 'equipment', search: 'kế toán' }).map(t => t.id), ['2','4']);
  assert.deepEqual(filterTicketsByType(tickets, { type: 'support', search: 'Mai' }).map(t => t.id), ['1']);
  assert.deepEqual(filterTicketsByType(tickets, { type: 'support', search: 'wifi' }), []);
});
test('category counts are independent', () => {
  assert.equal(countTicketsByType(tickets, 'support'), 2);
  assert.equal(countTicketsByType(tickets, 'equipment'), 2);
});
test('handles missing fields and absent ticket lists', () => {
  assert.deepEqual(filterTicketsByType(null, { type: 'equipment' }), []);
  assert.deepEqual(filterTicketsByType([{ type: 'support' }], { type: 'support', search: 'Mai' }), []);
});
