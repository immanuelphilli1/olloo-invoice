import path from 'node:path';

const e = process.env;
const isProduction = e.NODE_ENV === 'production';

function required(name: string, devDefault: string): string {
  const value = e[name];
  if (value) return value;
  if (isProduction) throw new Error(`Missing required env var ${name}`);
  return devDefault;
}

export const env = {
  isProduction,
  port: Number(e.PORT || 8787),
  /** Postgres connection string. When unset, an embedded PGlite database is used (dev/tests). */
  databaseUrl: e.DATABASE_URL || '',
  pgliteDir: e.PGLITE_DIR || path.resolve('.data/pglite'),
  uploadDir: e.UPLOAD_DIR || path.resolve('.data/uploads'),
  /** Public URL of the web app, used in links (password reset, Paystack callback, reminders). */
  appUrl: (e.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  sessionSecret: required('SESSION_SECRET', 'dev-only-secret-change-me'),
  /** Optional: serve the built web app from this directory (single-process deploys). */
  webDist: e.WEB_DIST || '',

  paystackSecretKey: e.PAYSTACK_SECRET_KEY || '',
  paystackPlanMonthly: e.PAYSTACK_PLAN_MONTHLY || '',
  paystackPlanYearly: e.PAYSTACK_PLAN_YEARLY || '',

  smsProvider: (e.SMS_PROVIDER || 'console') as 'console' | 'arkesel' | 'hubtel',
  smsApiKey: e.SMS_API_KEY || '',
  smsApiSecret: e.SMS_API_SECRET || '',
  smsSenderId: e.SMS_SENDER_ID || 'olloo',

  mailProvider: (e.MAIL_PROVIDER || 'console') as 'console' | 'resend',
  mailApiKey: e.MAIL_API_KEY || '',
  mailFrom: e.MAIL_FROM || 'olloo <no-reply@olloo.app>',

  /** Comma-separated emails / phone numbers that get the super-admin screen. */
  superadmins: (e.SUPERADMINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

export type Env = typeof env;
