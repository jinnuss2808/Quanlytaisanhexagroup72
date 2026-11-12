import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8')).rules;

test('Rules: mac dinh chan doc/ghi du lieu truc tiep', () => {
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
  assert.ok(rules.tickets);
});

test('Ticket chung: IT active (manager/agent) co the doc toan bo ticket', () => {
  const list = rules.tickets['.read'];
  const item = rules.tickets.$ticketId['.read'];
  for (const expression of [list, item]) {
    assert.match(expression, /=== 'manager'/);
    assert.match(expression, /=== 'agent'/);
    assert.match(expression, /child\('active'\)\.val\(\) === true/);
  }
  assert.match(rules.activities.$ticketId['.read'], /=== 'agent'/);
});

test('Nguoi gui chi duoc doc ticket cua minh khi bat che do tai khoan', () => {
  const list = rules.tickets['.read'];
  assert.match(list, /requesterWorkflowEnabled/);
  assert.match(list, /query\.orderByChild === 'requesterUid'/);
  assert.match(list, /query\.equalTo === auth\.uid/);
  assert.match(rules.tickets.$ticketId['.read'], /data\.child\('requesterUid'\)\.val\(\) === auth\.uid/);
  assert.ok(rules.tickets['.indexOn'].includes('requesterUid'));
});

test('Thong bao chi duoc doc boi nguoi nhan', () => {
  assert.match(rules.notifications.$uid['.read'], /auth\.uid === \$uid/);
});
