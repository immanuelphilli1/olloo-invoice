import {
  normalizePhone,
  otpRequestSchema,
  otpVerifySchema,
  passwordLoginSchema,
  passwordSignupSchema,
  resetConfirmSchema,
  resetRequestSchema,
} from '@olloo/shared';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { endSession, requireUser, startSession } from '../auth/session';
import type { AppEnv } from '../context';
import { otpCodes, passwordResets, sessions, users } from '../db/schema';
import { hashPassword, hmacSha256, randomToken, safeEqual, sha256, sixDigitCode, verifyPassword } from '../lib/crypto';
import { badRequest, HttpError } from '../lib/errors';
import { RateLimiter } from '../lib/rateLimit';
import { validate } from '../lib/validate';
import { buildMe } from '../services/me';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60_000;

function clientIp(c: Context<AppEnv>): string {
  // Behind Caddy/nginx the first X-Forwarded-For hop is the client.
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function authRoutes() {
  const otpPerPhone = new RateLimiter(3, 10 * 60_000);
  const otpPerIp = new RateLimiter(20, 60 * 60_000);
  const loginPerIp = new RateLimiter(30, 15 * 60_000);
  const loginPerAccount = new RateLimiter(10, 15 * 60_000);

  const otpHash = (secret: string, phone: string, code: string) => hmacSha256(secret, `${phone}:${code}`);

  return new Hono<AppEnv>()
    .post('/otp/request', validate('json', otpRequestSchema), async (c) => {
      const { db, env, sms, now } = c.var.deps;
      const phone = normalizePhone(c.req.valid('json').phone);
      if (!phone) throw badRequest('Enter a valid phone number, e.g. 024 123 4567');
      otpPerIp.check(clientIp(c));
      otpPerPhone.check(phone);

      const code = sixDigitCode();
      await db.insert(otpCodes).values({
        target: phone,
        codeHash: otpHash(env.sessionSecret, phone, code),
        expiresAt: new Date(now().getTime() + OTP_TTL_MS),
      });
      await sms.send(phone, `Your olloo code is ${code}. It expires in 5 minutes.`);
      return c.json({ ok: true, phone });
    })

    .post('/otp/verify', validate('json', otpVerifySchema), async (c) => {
      const { db, env, now } = c.var.deps;
      const body = c.req.valid('json');
      const phone = normalizePhone(body.phone);
      if (!phone) throw badRequest('Enter a valid phone number');
      loginPerIp.check(clientIp(c));

      const [otp] = await db
        .select()
        .from(otpCodes)
        .where(and(eq(otpCodes.target, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, now())))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);
      if (!otp) throw badRequest('That code has expired. Request a new one.');
      if (otp.attempts >= OTP_MAX_ATTEMPTS) throw badRequest('Too many wrong attempts. Request a new code.');

      if (!safeEqual(otp.codeHash, otpHash(env.sessionSecret, phone, body.code))) {
        await db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, otp.id));
        throw badRequest('Wrong code. Check the SMS and try again.');
      }
      await db.update(otpCodes).set({ consumedAt: now() }).where(eq(otpCodes.id, otp.id));

      let [user] = await db.select().from(users).where(eq(users.phone, phone));
      if (!user) {
        [user] = await db.insert(users).values({ phone, name: body.name ?? '' }).returning();
      }
      const sessionUser = await startSession(c, user!);
      return c.json(await buildMe(c.var.deps, sessionUser));
    })

    .post('/signup', validate('json', passwordSignupSchema), async (c) => {
      const { db } = c.var.deps;
      const body = c.req.valid('json');
      const email = body.email.toLowerCase();
      loginPerIp.check(clientIp(c));
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (existing) throw new HttpError(409, 'An account with this email already exists. Log in instead.');
      const [user] = await db
        .insert(users)
        .values({ email, name: body.name, passwordHash: await hashPassword(body.password) })
        .returning();
      const sessionUser = await startSession(c, user!);
      return c.json(await buildMe(c.var.deps, sessionUser), 201);
    })

    .post('/login', validate('json', passwordLoginSchema), async (c) => {
      const { db } = c.var.deps;
      const body = c.req.valid('json');
      const email = body.email.toLowerCase();
      loginPerIp.check(clientIp(c));
      loginPerAccount.check(email);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
        throw new HttpError(401, 'Wrong email or password');
      }
      const sessionUser = await startSession(c, user);
      return c.json(await buildMe(c.var.deps, sessionUser));
    })

    .post('/logout', async (c) => {
      await endSession(c);
      return c.json({ ok: true });
    })

    .post('/password/reset-request', validate('json', resetRequestSchema), async (c) => {
      const { db, env, mailer, now } = c.var.deps;
      const email = c.req.valid('json').email.toLowerCase();
      loginPerIp.check(clientIp(c));
      loginPerAccount.check(`reset:${email}`);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      // Same answer either way, so this can't be used to find out who has an account.
      if (user) {
        const token = randomToken();
        await db.insert(passwordResets).values({
          id: sha256(token),
          userId: user.id,
          expiresAt: new Date(now().getTime() + RESET_TTL_MS),
        });
        await mailer.send({
          to: email,
          subject: 'Reset your olloo password',
          text: `Open this link within an hour to choose a new password:\n\n${env.appUrl}/reset-password?token=${token}\n\nIf you didn't ask for this, ignore this email.`,
        });
      }
      return c.json({ ok: true });
    })

    .post('/password/reset', validate('json', resetConfirmSchema), async (c) => {
      const { db, now } = c.var.deps;
      const body = c.req.valid('json');
      const [reset] = await db
        .select()
        .from(passwordResets)
        .where(
          and(eq(passwordResets.id, sha256(body.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now()))
        );
      if (!reset) throw badRequest('This reset link has expired. Request a new one.');
      const [user] = await db
        .update(users)
        .set({ passwordHash: await hashPassword(body.password) })
        .where(eq(users.id, reset.userId))
        .returning();
      await db.update(passwordResets).set({ usedAt: now() }).where(eq(passwordResets.id, reset.id));
      // Log out every other device.
      await db.delete(sessions).where(eq(sessions.userId, reset.userId));
      const sessionUser = await startSession(c, user!);
      return c.json(await buildMe(c.var.deps, sessionUser));
    })

    .get('/me', requireUser, async (c) => c.json(await buildMe(c.var.deps, c.var.user)));
}
