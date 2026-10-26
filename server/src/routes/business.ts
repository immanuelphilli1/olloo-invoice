import { businessInputSchema, countersSchema, sanitizeStyle, taxRatesSchema, usesProTemplates } from '@olloo/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import sharp from 'sharp';
import { requireBusiness, requireUser } from '../auth/session';
import type { AppEnv } from '../context';
import { businesses, counters, files, subscriptions } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { badRequest, HttpError } from '../lib/errors';
import { validate } from '../lib/validate';
import { DEFAULT_BUSINESS_SETTINGS, getPlan, toBusinessDto } from '../services/account';
import { buildMe } from '../services/me';
import { createDefaultCounters } from '../services/numbering';

const MAX_UPLOAD_BYTES = 1024 * 1024;
const ASSET_KINDS = ['logo', 'signature'] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

function assetKind(value: string): AssetKind {
  if (!(ASSET_KINDS as readonly string[]).includes(value)) throw badRequest('Unknown asset type');
  return value as AssetKind;
}

export function businessRoutes() {
  const app = new Hono<AppEnv>();

  // Onboarding: create the business for the logged-in owner.
  app.post('/', requireUser, validate('json', businessInputSchema), async (c) => {
    const { db } = c.var.deps;
    const user = c.var.user;
    const body = c.req.valid('json');
    const [existing] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerUserId, user.id));
    if (existing) throw new HttpError(409, 'You already have a business');

    await db.transaction(async (tx) => {
      const [business] = await tx
        .insert(businesses)
        .values({ ...body, ownerUserId: user.id, ...DEFAULT_BUSINESS_SETTINGS })
        .returning();
      await createDefaultCounters(tx, business!.id);
      await tx.insert(subscriptions).values({ businessId: business!.id, billingEmail: user.email });
    });
    return c.json(await buildMe(c.var.deps, user), 201);
  });

  app.use('*', requireBusiness);

  app.get('/', async (c) => c.json(await toBusinessDto(c.var.deps.db, c.var.business)));

  app.put('/', validate('json', businessInputSchema), async (c) => {
    const { db, now } = c.var.deps;
    const [row] = await db
      .update(businesses)
      .set({ ...c.req.valid('json'), updatedAt: now() })
      .where(eq(businesses.id, c.var.business.id))
      .returning();
    return c.json(await toBusinessDto(db, row!));
  });

  app.put('/style', async (c) => {
    const { db, now } = c.var.deps;
    const style = sanitizeStyle(await c.req.json().catch(() => null), c.var.business.style);
    const plan = await getPlan(db, c.var.business.id, now());
    if (usesProTemplates(style) && !plan.entitlements.templates) {
      throw new HttpError(402, 'Templates other than Classic Ink and Receipt Book are part of Pro.', 'pro_required');
    }
    const [row] = await db
      .update(businesses)
      .set({ style, updatedAt: now() })
      .where(eq(businesses.id, c.var.business.id))
      .returning();
    return c.json(await toBusinessDto(db, row!));
  });

  app.put('/taxes', validate('json', taxRatesSchema), async (c) => {
    const { db, now } = c.var.deps;
    const [row] = await db
      .update(businesses)
      .set({ taxRates: c.req.valid('json'), updatedAt: now() })
      .where(eq(businesses.id, c.var.business.id))
      .returning();
    return c.json(await toBusinessDto(db, row!));
  });

  app.put('/counters', validate('json', countersSchema), async (c) => {
    const { db } = c.var.deps;
    const body = c.req.valid('json');
    const businessId = c.var.business.id;
    await db.transaction(async (tx) => {
      for (const kind of ['invoice', 'receipt'] as const) {
        await tx
          .update(counters)
          .set(body[kind])
          .where(and(eq(counters.businessId, businessId), eq(counters.kind, kind)));
      }
    });
    return c.json(await toBusinessDto(db, c.var.business));
  });

  // Logo / signature: re-encoded to PNG so nothing but pixels is ever served back.
  app.post('/assets/:kind', async (c) => {
    const { db, storage, now } = c.var.deps;
    const kind = assetKind(c.req.param('kind'));
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw badRequest('Choose an image to upload');
    if (file.size > MAX_UPLOAD_BYTES) throw badRequest('Images must be 1 MB or smaller');

    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input)
      .metadata()
      .catch(() => null);
    // No SVG: it can carry scripts. sharp would happily rasterise it, so check the real format.
    if (!meta || !['png', 'jpeg', 'webp'].includes(meta.format ?? '')) {
      throw badRequest('Upload a PNG, JPG or WebP image');
    }
    const png = await sharp(input)
      .rotate()
      .resize({ width: kind === 'logo' ? 600 : 800, height: 400, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const key = `${randomToken(16)}.png`;
    await storage.save(key, png);
    await db.insert(files).values({ key, businessId: c.var.business.id, kind, mime: 'image/png' });
    // Old files are kept: issued documents still point at them through their snapshot.
    const [row] = await db
      .update(businesses)
      .set({ [kind === 'logo' ? 'logoKey' : 'signatureKey']: key, updatedAt: now() })
      .where(eq(businesses.id, c.var.business.id))
      .returning();
    return c.json(await toBusinessDto(db, row!));
  });

  app.delete('/assets/:kind', async (c) => {
    const { db, now } = c.var.deps;
    const kind = assetKind(c.req.param('kind'));
    const [row] = await db
      .update(businesses)
      .set({ [kind === 'logo' ? 'logoKey' : 'signatureKey']: null, updatedAt: now() })
      .where(eq(businesses.id, c.var.business.id))
      .returning();
    return c.json(await toBusinessDto(db, row!));
  });

  return app;
}

/** GET /api/files/:key — keys are 128-bit random, so the URL itself is the permission. */
export function fileRoutes() {
  return new Hono<AppEnv>().get('/:key', async (c) => {
    const key = c.req.param('key');
    if (!/^[A-Za-z0-9_-]{16,64}\.png$/.test(key)) throw new HttpError(404, 'Not found', 'not_found');
    const data = await c.var.deps.storage.read(key);
    if (!data) throw new HttpError(404, 'Not found', 'not_found');
    return c.body(new Uint8Array(data), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  });
}
