import type { PaystackClient } from './billing/paystack';
import type { Db } from './db/client';
import type { businesses, users } from './db/schema';
import type { Env } from './env';
import type { Mailer } from './providers/mail';
import type { SmsSender } from './providers/sms';
import type { FileStorage } from './providers/storage';

export interface Deps {
  db: Db;
  env: Env;
  sms: SmsSender;
  mailer: Mailer;
  storage: FileStorage;
  paystack: PaystackClient;
  now: () => Date;
}

export type UserRow = typeof users.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;

export type AppEnv = {
  Variables: {
    deps: Deps;
    user: UserRow;
    business: BusinessRow;
  };
};
