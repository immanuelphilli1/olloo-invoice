import { createPaystackClient } from './billing/paystack';
import type { Deps } from './context';
import { openDatabase } from './db/client';
import { env } from './env';
import { createMailer } from './providers/mail';
import { createSmsSender } from './providers/sms';
import { diskStorage } from './providers/storage';

export async function createDeps() {
  const database = await openDatabase({ databaseUrl: env.databaseUrl, dataDir: env.pgliteDir });
  const deps: Deps = {
    db: database.db,
    env,
    sms: createSmsSender(env),
    mailer: createMailer(env),
    storage: diskStorage(env.uploadDir),
    paystack: createPaystackClient(env.paystackSecretKey),
    now: () => new Date(),
  };
  return { deps, close: database.close };
}
