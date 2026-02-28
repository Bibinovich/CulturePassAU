import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5050';
const baseUrl = new URL(base);
const serverPort = baseUrl.port || '5050';

async function isServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    if (await isServerHealthy()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start in time');
}

async function run() {
  const alreadyRunning = await isServerHealthy();
  const proc = alreadyRunning
    ? null
    : spawn('npm', ['run', 'server:dev'], {
        stdio: 'ignore',
        shell: true,
        env: { ...process.env, PORT: serverPort },
      });

  try {
    await waitForServer();

    // Flow 1: saved -> event detail -> ticket create -> tickets list -> community/profile
    type EventsResponse = { events?: Array<{ id?: string }>; };
    const eventsPayload = await (await fetch(`${base}/api/events`)).json() as EventsResponse | Array<{ id?: string }>;
    const events = Array.isArray(eventsPayload) ? eventsPayload : eventsPayload.events ?? [];
    const event = events[0];
    assert.ok(event?.id);

    const eventDetail = await fetch(`${base}/api/events/${event.id}`);
    assert.equal(eventDetail.ok, true);

    const users = await (await fetch(`${base}/api/users`)).json();
    const userId = users[0].id;

    const createTicketRes = await fetch(`${base}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, eventId: event.id, quantity: 1, totalPriceCents: 2500 }),
    });
    assert.equal(createTicketRes.status, 201);
    const createdTicket = await createTicketRes.json();

    const ticketsRes = await fetch(`${base}/api/tickets/${userId}`);
    assert.equal(ticketsRes.ok, true);

    const communities = await (await fetch(`${base}/api/communities`)).json();
    const community = communities[0];
    assert.ok(community?.id);
    const communityRes = await fetch(`${base}/api/communities/${community.id}`);
    assert.equal(communityRes.ok, true);

    // Flow 2: scanner -> CPID lookup -> user profile
    const cpid = users[0].culturePassId;
    const lookupRes = await fetch(`${base}/api/cpid/lookup/${encodeURIComponent(cpid)}`);
    assert.equal(lookupRes.ok, true);
    const lookup = await lookupRes.json();
    const userRes = await fetch(`${base}/api/users/${lookup.targetId}`);
    assert.equal(userRes.ok, true);

    // Flow 3: scan ticket once and verify duplicate blocked
    const scanOk = await fetch(`${base}/api/tickets/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketCode: createdTicket.ticketCode, scannedBy: 'qa-gate' }),
    });
    assert.equal(scanOk.ok, true);

    const scanDupe = await fetch(`${base}/api/tickets/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketCode: createdTicket.ticketCode, scannedBy: 'qa-gate' }),
    });
    assert.equal(scanDupe.ok, false);

    console.log('e2e critical smoke checks passed');
  } finally {
    proc?.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
