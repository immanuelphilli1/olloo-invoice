import { formatDisplayDate, RENEWAL_REMINDER_DAYS } from '@olloo/shared';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import type { Deps } from '../context';
import { businesses, subscriptions, users } from '../db/schema';

/**
 * Pro ends by itself when current_period_end passes (isPro checks the date),
 * so this job only warns people whose Pro won't renew automatically:
 * MoMo payers (Paystack can't re-charge MoMo) and cards that failed or were cancelled.
 */
export async function runReminders(deps: Deps): Promise<number> {
  const { db, env, sms, mailer, now } = deps;
  const soon = new Date(now().getTime() + RENEWAL_REMINDER_DAYS * 86_400_000);

  const due = await db
    .select({ sub: subscriptions, business: businesses, owner: users })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .innerJoin(users, eq(users.id, businesses.ownerUserId))
    .where(
      and(
        eq(subscriptions.comp, false),
        gt(subscriptions.currentPeriodEnd, now()),
        lte(subscriptions.currentPeriodEnd, soon),
        or(eq(subscriptions.autoRenew, false), eq(subscriptions.paymentFailed, true)),
        isNull(subscriptions.lastReminderAt)
      )
    );

  let sent = 0;
  for (const { sub, business, owner } of due) {
    const ends = formatDisplayDate(sub.currentPeriodEnd!.toISOString().slice(0, 10));
    const link = `${env.appUrl}/billing`;
    const text = `olloo: Pro for ${business.name} ends on ${ends}. Renew to keep unlimited invoices and receipts: ${link}`;
    try {
      if (owner.phone) await sms.send(owner.phone, text);
      const email = sub.billingEmail ?? owner.email;
      if (email) await mailer.send({ to: email, subject: 'Your olloo Pro plan is ending soon', text });
      await db
        .update(subscriptions)
        .set({ lastReminderAt: now() })
        .where(eq(subscriptions.businessId, sub.businessId));
      sent += 1;
    } catch (err) {
      console.error(`[reminders] ${business.id}:`, err);
    }
  }
  return sent;
}

/** Check hourly; each period gets one reminder (lastReminderAt resets on payment). */
export function scheduleReminders(deps: Deps): () => void {
  const tick = () => runReminders(deps).catch((err) => console.error('[reminders]', err));
  const first = setTimeout(tick, 30_000);
  const timer = setInterval(tick, 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
