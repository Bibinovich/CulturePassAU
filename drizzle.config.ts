// drizzle-kit Config type varies by version — use a cast so the runtime
// values (dialect, dbCredentials) aren't constrained by stale TS typings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineConfig } = require('drizzle-kit') as { defineConfig: (c: Record<string, unknown>) => unknown };

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — ensure the database is provisioned');
}

export default defineConfig({
  out: './migrations',
  // Drizzle table definitions live in server/db/schema.ts.
  // shared/schema.ts holds the TypeScript interfaces used by the client bundle.
  schema: './server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
