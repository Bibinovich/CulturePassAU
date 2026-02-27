import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const base = process.env.INTEGRATION_BASE_URL ?? 'http://127.0.0.1:5050';
const baseUrl = new URL(base);
const serverPort = baseUrl.port || '5050';

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start in time');
}

async function run() {
  const proc = spawn(npmCommand(), ['run', 'server:dev'], {
    stdio: 'ignore',
    env: { ...process.env, PORT: serverPort },
  });
  try {
    await waitForServer();

    const usersRes = await fetch(`${base}/api/users`);
    assert.equal(usersRes.ok, true);
    const users = await usersRes.json();
    assert.ok(Array.isArray(users) && users.length > 0);

    const userId = users[0].id;

    const ticketCreate = await fetch(`${base}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, eventId: 'e1', quantity: 2, totalPriceCents: 5000 }),
    });
    assert.equal(ticketCreate.status, 201);
    const ticket = await ticketCreate.json();
    assert.ok(ticket.id);

    const historyRes = await fetch(`${base}/api/tickets/${ticket.id}/history`);
    assert.equal(historyRes.ok, true);

    const walletRes = await fetch(`${base}/api/tickets/${ticket.id}/wallet/apple`);
    assert.equal(walletRes.ok, true);

    const rolloutRes = await fetch(`${base}/api/rollout/config?userId=${encodeURIComponent(userId)}`);
    assert.equal(rolloutRes.ok, true);

    const webhookRes = await fetch(`${base}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { metadata: { ticketId: ticket.id } } } }),
    });
    assert.equal(webhookRes.ok, true);

    console.log('integration api route checks passed');
  } finally {
    proc.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
