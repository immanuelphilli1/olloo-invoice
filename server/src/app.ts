import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { loadUser } from './auth/session';
import type { AppEnv, Deps } from './context';
import { HttpError } from './lib/errors';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { billingRoutes } from './routes/billing';
import { businessRoutes, fileRoutes } from './routes/business';
import { customerRoutes, productRoutes } from './routes/catalog';
import { dashboardRoutes } from './routes/dashboard';
import { invoiceRoutes } from './routes/invoices';
import { publicRoutes } from './routes/public';
import { receiptRoutes } from './routes/receipts';

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));
  app.use('/api/*', bodyLimit({ maxSize: 2 * 1024 * 1024 }));
  app.use('/api/*', loadUser);

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message, code: err.code }, err.status);
    console.error(err);
    return c.json({ error: 'Something went wrong. Please try again.' }, 500);
  });

  app.get('/api/health', (c) => c.json({ ok: true }));
  app.route('/api/auth', authRoutes());
  app.route('/api/business', businessRoutes());
  app.route('/api/files', fileRoutes());
  app.route('/api/invoices', invoiceRoutes());
  app.route('/api/receipts', receiptRoutes());
  app.route('/api/customers', customerRoutes());
  app.route('/api/products', productRoutes());
  app.route('/api/dashboard', dashboardRoutes());
  app.route('/api/billing', billingRoutes());
  app.route('/api/public', publicRoutes());
  app.route('/api/admin', adminRoutes());
  app.all('/api/*', (c) => c.json({ error: 'Not found', code: 'not_found' as const }, 404));

  // Optional: serve the built web app (SPA) when WEB_DIST is set.
  const webDist = deps.env.webDist;
  if (webDist && fs.existsSync(path.join(webDist, 'index.html'))) {
    const indexHtml = fs.readFileSync(path.join(webDist, 'index.html'), 'utf-8');
    app.use('/assets/*', serveStatic({ root: webDist }));
    app.use('*', serveStatic({ root: webDist }));
    app.get('*', (c) => c.html(indexHtml));
  }

  return app;
}
