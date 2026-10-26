import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

/** zValidator that answers 400 { error } with the first issue as a readable message. */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
      const message = issue ? (/^Invalid|^Too|^Expected/.test(issue.message) ? where + issue.message : issue.message) : 'Invalid request';
      return c.json({ error: message, code: 'invalid' as const }, 400);
    }
  });
}
