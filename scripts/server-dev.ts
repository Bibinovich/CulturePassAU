import { app } from '../functions/src/app';

const port = Number(process.env.PORT ?? 5050);

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`[server:dev] listening on http://127.0.0.1:${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
