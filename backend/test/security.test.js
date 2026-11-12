import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8')).rules;

test('Realtime Database denies read/write by default and all direct client writes', () => {
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
  assert.equal(Object.keys(rules).includes('tickets'), true);
});
test('Agent ticket list must query assignedTo equal to authenticated UID', () => {
  assert.match(rules.tickets['.read'], /query\.orderByChild === 'assignedTo'/);
  assert.match(rules.tickets['.read'], /query\.equalTo === auth\.uid/);
  assert.ok(rules.tickets['.indexOn'].includes('assignmentDeadline'));
});
test('Notifications list is only readable by its owner', () => {
  assert.match(rules.notifications.$uid['.read'], /auth\.uid === \$uid/);
});
