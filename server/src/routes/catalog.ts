import { customerInputSchema, productInputSchema, type Customer, type Product } from '@olloo/shared';
import { and, asc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireBusiness } from '../auth/session';
import type { AppEnv } from '../context';
import { customers, products } from '../db/schema';
import { notFound } from '../lib/errors';
import { validate } from '../lib/validate';

const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  archived: z.enum(['true', 'false']).optional(),
});

function assertUuid(id: string, what: string) {
  if (!z.uuid().safeParse(id).success) throw notFound(`${what} not found`);
}

const toCustomer = (r: typeof customers.$inferSelect): Customer => ({
  id: r.id,
  name: r.name,
  address: r.address,
  phone: r.phone,
  email: r.email,
});

const toProduct = (r: typeof products.$inferSelect): Product => ({
  id: r.id,
  name: r.name,
  unitPrice: r.unitPrice,
  archived: r.archived,
});

export function customerRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireBusiness);

  app.get('/', validate('query', searchQuery), async (c) => {
    const { q } = c.req.valid('query');
    const where: SQL[] = [eq(customers.businessId, c.var.business.id)];
    if (q) where.push(or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`))!);
    const rows = await c.var.deps.db
      .select()
      .from(customers)
      .where(and(...where))
      .orderBy(asc(customers.name))
      .limit(1000);
    return c.json(rows.map(toCustomer));
  });

  app.post('/', validate('json', customerInputSchema), async (c) => {
    const [row] = await c.var.deps.db
      .insert(customers)
      .values({ ...c.req.valid('json'), businessId: c.var.business.id })
      .returning();
    return c.json(toCustomer(row!), 201);
  });

  app.put('/:id', validate('json', customerInputSchema), async (c) => {
    const id = c.req.param('id');
    assertUuid(id, 'Customer');
    const [row] = await c.var.deps.db
      .update(customers)
      .set(c.req.valid('json'))
      .where(and(eq(customers.id, id), eq(customers.businessId, c.var.business.id)))
      .returning();
    if (!row) throw notFound('Customer not found');
    return c.json(toCustomer(row));
  });

  // Documents keep their own copy of the customer's details, so deleting is safe.
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    assertUuid(id, 'Customer');
    const [row] = await c.var.deps.db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.businessId, c.var.business.id)))
      .returning({ id: customers.id });
    if (!row) throw notFound('Customer not found');
    return c.json({ ok: true });
  });

  return app;
}

export function productRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireBusiness);

  app.get('/', validate('query', searchQuery), async (c) => {
    const { q, archived } = c.req.valid('query');
    const where: SQL[] = [eq(products.businessId, c.var.business.id)];
    if (q) where.push(ilike(products.name, `%${q}%`));
    if (archived !== 'true') where.push(eq(products.archived, false));
    const rows = await c.var.deps.db
      .select()
      .from(products)
      .where(and(...where))
      .orderBy(asc(products.name))
      .limit(1000);
    return c.json(rows.map(toProduct));
  });

  app.post('/', validate('json', productInputSchema), async (c) => {
    const [row] = await c.var.deps.db
      .insert(products)
      .values({ ...c.req.valid('json'), businessId: c.var.business.id })
      .returning();
    return c.json(toProduct(row!), 201);
  });

  app.put('/:id', validate('json', productInputSchema), async (c) => {
    const id = c.req.param('id');
    assertUuid(id, 'Product');
    const [row] = await c.var.deps.db
      .update(products)
      .set(c.req.valid('json'))
      .where(and(eq(products.id, id), eq(products.businessId, c.var.business.id)))
      .returning();
    if (!row) throw notFound('Product not found');
    return c.json(toProduct(row));
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    assertUuid(id, 'Product');
    const [row] = await c.var.deps.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.businessId, c.var.business.id)))
      .returning({ id: products.id });
    if (!row) throw notFound('Product not found');
    return c.json({ ok: true });
  });

  return app;
}
