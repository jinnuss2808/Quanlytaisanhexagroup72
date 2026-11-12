import test from 'node:test';
import assert from 'node:assert/strict';
import { transactExistingTicket } from '../src/ticket-transaction.js';

/** Fake Firebase REST ETags: any concurrent write changes the ETag. */
function mockDatabase(initial) {
  let state = structuredClone(initial);
  let version = 1;
  const calls = [];
  let beforePut = null;
  const response = (status, body, etag = `"${version}"`) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: key => key.toLowerCase() === 'etag' ? etag : null },
    json: async () => structuredClone(body)
  });
  return {
    calls,
    ref: { toString: () => 'https://test-default-rtdb.firebaseio.com/tickets/-abc123' },
    options: {
      getToken: async () => 'mock-service-token',
      fetchImpl: async (endpoint, opts) => {
        const parsed = new URL(endpoint);
        assert.equal(parsed.searchParams.get('access_token'), 'mock-service-token');
        calls.push({ method: opts.method, headers: opts.headers });
        if (opts.method === 'GET') {
          assert.equal(opts.headers['X-Firebase-ETag'], 'true');
          return response(200, state);
        }
        assert.equal(opts.method, 'PUT');
        if (beforePut) {
          const action = beforePut;
          beforePut = null;
          action();
        }
        if (opts.headers['if-match'] !== `"${version}"`) return response(412, state);
        state = JSON.parse(opts.body);
        version += 1;
        return response(200, state);
      }
    },
    read: () => structuredClone(state),
    set: data => { state = structuredClone(data); version += 1; },
    beforeNextPut: fn => { beforePut = fn; }
  };
}

const base = { id: '-abc123', status: 'new', assignedTo: null, code: 'IT-000001' };

test('admin assigns ticket created immediately before action', async () => {
  const db = mockDatabase(base);
  const result = await transactExistingTicket(db.ref, ticket => ({ ...ticket, assignedTo: 'it-b' }), db.options);
  assert.equal(result.committed, true);
  assert.equal(result.snapshot.val().assignedTo, 'it-b');
  assert.equal(db.read().assignedTo, 'it-b');
  assert.deepEqual(db.calls.map(c => c.method), ['GET', 'PUT']);
});

test('manager changes status in RTDB and receives committed result', async () => {
  const db = mockDatabase(base);
  const r = await transactExistingTicket(db.ref, ticket => ({ ...ticket, status: 'in_progress' }), db.options);
  assert.equal(r.committed, true);
  assert.equal(db.read().status, 'in_progress');
});

test('absent ticket never recreated', async () => {
  const db = mockDatabase(null);
  const r = await transactExistingTicket(db.ref, ticket => ({ ...ticket, status: 'closed' }), db.options);
  assert.equal(r.committed, false);
  assert.equal(db.calls.some(c => c.method === 'PUT'), false);
  assert.equal(db.read(), null);
});

test('concurrent manager write causes retry with fresh server data', async () => {
  const db = mockDatabase(base);
  db.beforeNextPut(() => db.set({ ...base, status: 'on_hold' }));
  const r = await transactExistingTicket(db.ref, ticket => ({ ...ticket, assignedTo: 'it-b' }), db.options);
  assert.equal(r.committed, true);
  assert.equal(db.read().status, 'on_hold');
  assert.equal(db.read().assignedTo, 'it-b');
  assert.deepEqual(db.calls.map(c => c.method), ['GET','PUT','GET','PUT']);
});

test('deletion between GET and PUT cannot recreate ticket', async () => {
  const db = mockDatabase(base);
  db.beforeNextPut(() => db.set(null));
  const r = await transactExistingTicket(db.ref, ticket => ({ ...ticket, status: 'resolved' }), db.options);
  assert.equal(r.committed, false);
  assert.equal(db.read(), null);
  assert.deepEqual(db.calls.map(c => c.method), ['GET', 'PUT', 'GET']);
});

test('no-op abort does not PUT and does not report missing ticket', async () => {
  const db = mockDatabase(base);
  const r = await transactExistingTicket(db.ref, () => undefined, db.options);
  assert.equal(r.committed, false);
  assert.equal(r.snapshot.val().code, base.code);
  assert.deepEqual(db.calls.map(c => c.method), ['GET']);
});

test('update callback cannot change ticket identity', async () => {
  const db = mockDatabase(base);
  await assert.rejects(() => transactExistingTicket(db.ref, ticket => ({ ...ticket, id: 'other' }), db.options), /định danh/);
  assert.equal(db.calls.some(c => c.method === 'PUT'), false);
});

test('bounded ETag conflicts give 409 without overwriting', async () => {
  const db = mockDatabase(base);
  const originalFetch = db.options.fetchImpl;
  db.options.fetchImpl = async (url, options) => {
    if (options.method === 'PUT') db.set({ ...db.read(), updatedAt: (db.read().updatedAt || 0) + 1 });
    return originalFetch(url, options);
  };
  await assert.rejects(
    () => transactExistingTicket(db.ref, ticket => ({ ...ticket, status: 'closed' }), { ...db.options, maxAttempts: 3 }),
    err => err.status === 409
  );
  assert.equal(db.read().status, 'new');
});
