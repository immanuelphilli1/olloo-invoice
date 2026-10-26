import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDeps } from './deps';
import { env } from './env';
import { scheduleReminders } from './jobs/reminders';

const { deps, close } = await createDeps();
const app = createApp(deps);
const stopReminders = scheduleReminders(deps);

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`olloo API on http://localhost:${info.port}`);
  console.log(`Database: ${env.databaseUrl ? 'Postgres (DATABASE_URL)' : `PGlite at ${env.pgliteDir}`}`);
  console.log(`SMS: ${env.smsProvider} · Mail: ${env.mailProvider} · Paystack: ${env.paystackSecretKey ? 'on' : 'off'}`);
});

async function shutdown() {
  stopReminders();
  server.close();
  await close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
