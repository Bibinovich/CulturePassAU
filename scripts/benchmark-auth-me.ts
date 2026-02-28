import { app } from '../functions/src/app';
import { authAdmin, db } from '../functions/src/admin';

// Trust proxy for testing X-Forwarded-For
app.set('trust proxy', 1);

// Mock authAdmin.verifyIdToken to return a fixed user for testing
const originalVerify = authAdmin.verifyIdToken.bind(authAdmin);
(authAdmin as any).verifyIdToken = async (token: string) => {
  if (token === 'test-token') {
    return {
      uid: 'u1',
      email: 'alex@example.com',
      role: 'user',
    };
  }
  return originalVerify(token);
};

// Mock db.collection for /api/auth/me to avoid actual Firestore calls when testing
const originalCollection = db.collection.bind(db);
(db as any).collection = (path: string) => {
  if (path === 'users') {
    return {
      doc: (id: string) => ({
        get: async () => {
          // Simulate some network delay for the baseline so we can see an improvement
          await new Promise(r => setTimeout(r, 20));
          return {
            exists: true,
            data: () => ({
              displayName: 'Alex Mock',
              email: 'alex@example.com',
              role: 'user',
            })
          };
        }
      })
    };
  }
  return originalCollection(path);
};

const port = 5051;
const server = app.listen(port, '127.0.0.1', async () => {
  console.log(`[benchmark] listening on http://127.0.0.1:${port}`);

  try {
    const url = `http://127.0.0.1:${port}/api/auth/me`;

    // Warm up
    for (let i = 0; i < 5; i++) {
      await fetch(url, { headers: { Authorization: 'Bearer test-token', 'X-Forwarded-For': `10.0.0.${i}` } });
    }

    console.log('Starting benchmark...');
    const ITERATIONS = 50;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const res = await fetch(url, { headers: { Authorization: 'Bearer test-token', 'X-Forwarded-For': `10.1.0.${i}` } });
      if (!res.ok) {
         throw new Error(`Failed: ${res.status}`);
      }
      await res.json();
    }
    const end = performance.now();

    const avg = (end - start) / ITERATIONS;
    console.log(`Average response time: ${avg.toFixed(2)} ms/req`);

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
