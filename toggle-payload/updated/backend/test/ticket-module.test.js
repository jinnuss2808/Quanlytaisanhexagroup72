import test from 'node:test';
import assert from 'node:assert/strict';
import { isTicketModuleEnabled } from '../src/ticket-module.js';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const frontend = fs.readFileSync(new URL('../../frontend/src/App.jsx', import.meta.url), 'utf8');
const scheduler = fs.readFileSync(new URL('../../firebase/functions/worker/remind.js', import.meta.url), 'utf8');

test('ticket module defaults ON for existing projects', () => {
  assert.equal(isTicketModuleEnabled(undefined), true);
  assert.equal(isTicketModuleEnabled(null), true);
  assert.equal(isTicketModuleEnabled(true), true);
  assert.equal(isTicketModuleEnabled(false), false);
});
test('only manager can change ticket module flag via settings API', () => {
  assert.match(app, /app\.patch\('\/api\/settings', requireIT, requireManager/);
  assert.match(app, /typeof body\.ticketEnabled !== 'boolean'/);
});
test('new ticket and status/comment writes are blocked while disabled', () => {
  assert.match(app, /app\.post\('\/api\/public\/tickets', publicLimiter, requireTicketEnabled/);
  assert.match(app, /app\.patch\('\/api\/tickets\/:id\/status', requireIT, requireTicketEnabled/);
  assert.match(app, /app\.post\('\/api\/tickets\/:id\/comments', requireIT, requireTicketEnabled/);
});
test('website still has asset management and manager settings', () => {
  assert.match(frontend, /<AssetManagement user=\{user\}/);
  assert.match(frontend, /<TicketModuleSettings/);
  assert.match(frontend, /ticketEnabled &&/);
});
test('scheduled reminders pause while ticket module is OFF', () => {
  assert.match(scheduler, /settings\/ticketEnabled/);
  assert.match(scheduler, /async function runReminderSweep\(\)/);
});
