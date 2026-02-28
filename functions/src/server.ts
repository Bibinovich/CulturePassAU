/**
 * CulturePassAU — Standalone HTTP server entry point
 *
 * Used by Firebase App Hosting (Cloud Run) to serve the Express app.
 * Cloud Run injects PORT; falls back to 8080 per Cloud Run convention.
 *
 * NOTE: TypeScript compiles to functions/lib/functions/src/server.js (not
 * functions/lib/src/server.js) because the @shared/* path alias in
 * functions/tsconfig.json causes TypeScript to infer the workspace root as
 * the implicit rootDir, preserving the full relative directory structure.
 */

import { app } from './app';

const port = Number(process.env.PORT ?? 8080);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[server] API listening on port ${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
