import { and, eq, gt } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, UserRow } from '../context';
import { businesses, sessions, users } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';
import { HttpError } from '../lib/errors';

export const SESSION_COOKIE = 'olloo_session';
const SESSION_DAYS = 30;

export async function startSession(c: Context<AppEnv>, user: UserRow): Promise<UserRow> {
  const { db, env, now } = c.var.deps;
  const token = randomToken();
  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId: user.id, expiresAt });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith('https://'),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });

  // Operators listed in SUPERADMINS get the admin screen on their next login.
  const ids = [user.email, user.phone].filter(Boolean).map((s) => s!.toLowerCase());
  if (!user.isSuperadmin && ids.some((id) => env.superadmins.includes(id))) {
    const [updated] = await db.update(users).set({ isSuperadmin: true }).where(eq(users.id, user.id)).returning();
    return updated ?? user;
  }
  return user;
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.var.deps.db.delete(sessions).where(eq(sessions.id, sha256(token)));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/** Sets c.var.user when the session cookie is valid. Never rejects. */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const { db, now } = c.var.deps;
    const [row] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, now())));
    if (row) c.set('user', row.user);
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!(c.var.user as UserRow | undefined)) throw new HttpError(401, 'Please log in', 'unauthenticated');
  await next();
});

/** Every business route scopes its queries by c.var.business.id — never by a client-supplied id. */
export const requireBusiness = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user as UserRow | undefined;
  if (!user) throw new HttpError(401, 'Please log in', 'unauthenticated');
  const [business] = await c.var.deps.db.select().from(businesses).where(eq(businesses.ownerUserId, user.id));
  if (!business) throw new HttpError(409, 'Set up your business first');
  c.set('business', business);
  await next();
});

export const requireSuperadmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user as UserRow | undefined;
  if (!user) throw new HttpError(401, 'Please log in', 'unauthenticated');
  if (!user.isSuperadmin) throw new HttpError(403, 'Admins only');
  await next();
});
