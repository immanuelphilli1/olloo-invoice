import { entitlementsFor, type Me } from '@olloo/shared';
import { eq } from 'drizzle-orm';
import type { Deps, UserRow } from '../context';
import { businesses } from '../db/schema';
import { docsThisMonth, getPlan, subscriptionDto, toBusinessDto, toUserDto } from './account';

export async function buildMe(deps: Deps, user: UserRow): Promise<Me> {
  const { db, now } = deps;
  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, user.id));
  if (!business) {
    return {
      user: toUserDto(user),
      business: null,
      subscription: subscriptionDto(null, now()),
      entitlements: entitlementsFor(false),
      usage: { docsThisMonth: 0 },
    };
  }
  const [dto, plan, used] = await Promise.all([
    toBusinessDto(db, business),
    getPlan(db, business.id, now()),
    docsThisMonth(db, business.id, now()),
  ]);
  return {
    user: toUserDto(user),
    business: dto,
    subscription: subscriptionDto(plan.subscription, now()),
    entitlements: plan.entitlements,
    usage: { docsThisMonth: used },
  };
}
