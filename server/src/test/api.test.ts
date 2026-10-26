import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runReminders } from '../jobs/reminders';
import { createHarness, sampleInvoice, type Harness } from './harness';

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});

describe('auth', () => {
  it('logs in with a phone OTP, rejecting wrong codes', async () => {
    const c = h.client();
    expect((await c.post('/api/auth/otp/request', { phone: '024 123 4567' })).status).toBe(200);
    const code = /code is (\d{6})/.exec(h.sms.at(-1)!.message)![1]!;
    expect(h.sms.at(-1)!.to).toBe('+233241234567');

    const wrong = await c.post('/api/auth/otp/verify', { phone: '0241234567', code: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);

    const ok = await c.post('/api/auth/otp/verify', { phone: '0241234567', code, name: 'Ama' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.phone).toBe('+233241234567');
    expect(ok.body.business).toBeNull();

    // Code is single-use
    expect((await h.client().post('/api/auth/otp/verify', { phone: '0241234567', code })).status).toBe(400);
    expect((await c.get('/api/auth/me')).status).toBe(200);
  });

  it('rate-limits OTP requests per phone', async () => {
    const c = h.client();
    for (let i = 0; i < 3; i++) expect((await c.post('/api/auth/otp/request', { phone: '0241234567' })).status).toBe(200);
    expect((await c.post('/api/auth/otp/request', { phone: '0241234567' })).status).toBe(429);
  });

  it('signs up, logs out, logs in and resets a password', async () => {
    const c = h.client();
    expect((await c.post('/api/auth/signup', { name: 'Esi', email: 'Esi@Example.com', password: 'password123' })).status).toBe(201);
    expect((await h.client().post('/api/auth/signup', { name: 'X', email: 'esi@example.com', password: 'password123' })).status).toBe(409);
    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).status).toBe(401);
    expect((await c.post('/api/auth/login', { email: 'esi@example.com', password: 'nope-nope' })).status).toBe(401);
    expect((await c.post('/api/auth/login', { email: 'esi@example.com', password: 'password123' })).status).toBe(200);

    await h.client().post('/api/auth/password/reset-request', { email: 'esi@example.com' });
    const token = /token=([\w-]+)/.exec(h.mail.at(-1)!.text)![1]!;
    const reset = await h.client().post('/api/auth/password/reset', { token, password: 'newpassword1' });
    expect(reset.status).toBe(200);
    // other sessions were logged out
    expect((await c.get('/api/auth/me')).status).toBe(401);
    expect((await h.client().post('/api/auth/password/reset', { token, password: 'again12345' })).status).toBe(400);
  });

  it('marks configured operators as super-admin', async () => {
    const c = h.client();
    const res = await c.post('/api/auth/signup', { name: 'Op', email: 'admin@olloo.app', password: 'password123' });
    expect(res.body.user.isSuperadmin).toBe(true);
    expect((await c.get('/api/admin/businesses')).status).toBe(200);
    const { client } = await h.owner('someone@example.com');
    expect((await client.get('/api/admin/businesses')).status).toBe(403);
  });
});

describe('invoices', () => {
  it('computes totals on the server with discount and enabled taxes', async () => {
    const { client, me } = await h.owner('a@example.com');
    await client.put('/api/business/taxes', me.business!.taxRates.map((t) => ({ ...t, enabled: t.id !== 'getfund' })));
    const res = await client.post(
      '/api/invoices',
      sampleInvoice({ discount: { type: 'percent', value: 1000 }, total: 1, subtotal: 1 })
    );
    expect(res.status).toBe(201);
    const inv = res.body;
    expect(inv.number).toBe('INV-0001');
    expect(inv.subtotal).toBe(20050);
    expect(inv.discountAmount).toBe(2005);
    expect(inv.taxes.map((t: { name: string; amount: number }) => [t.name, t.amount])).toEqual([
      ['VAT', 2707], // 18045 × 15% = 2706.75
      ['NHIL', 451], // 18045 × 2.5% = 451.125
    ]);
    expect(inv.total).toBe(18045 + 2707 + 451);
    expect(inv.status).toBe('issued');
    expect(inv.snapshot.company.name).toBe('Test Traders');
    expect(inv.snapshot.watermark).toBe(true);
  });

  it('gives 20 concurrent creates unique sequential numbers', async () => {
    const { client, me } = await h.owner('a@example.com');
    await h.makePro(me.business!.id);
    const results = await Promise.all(Array.from({ length: 20 }, () => client.post('/api/invoices', sampleInvoice())));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.number).sort();
    expect(new Set(numbers).size).toBe(20);
    expect(numbers[0]).toBe('INV-0001');
    expect(numbers[19]).toBe('INV-0020');
  });

  it('keeps businesses apart', async () => {
    const a = await h.owner('a@example.com', 'A Ltd');
    const b = await h.owner('b@example.com', 'B Ltd');
    const inv = (await a.client.post('/api/invoices', sampleInvoice())).body;

    expect((await b.client.get(`/api/invoices/${inv.id}`)).status).toBe(404);
    expect((await b.client.put(`/api/invoices/${inv.id}`, sampleInvoice())).status).toBe(404);
    expect((await b.client.post(`/api/invoices/${inv.id}/payments`, { amount: 100, date: '2026-03-10', method: 'cash' })).status).toBe(404);
    expect((await b.client.post(`/api/invoices/${inv.id}/void`, { reason: 'x' })).status).toBe(404);
    expect((await b.client.get('/api/invoices')).body).toHaveLength(0);
    // b's own numbering starts at 1
    expect((await b.client.post('/api/invoices', sampleInvoice())).body.number).toBe('INV-0001');
    // a customer id from another business is dropped
    const cust = (await a.client.post('/api/customers', { name: 'Shared?' })).body;
    expect((await b.client.post('/api/invoices', sampleInvoice({ customerId: cust.id }))).body.customerId).toBeNull();
    expect((await b.client.put(`/api/customers/${cust.id}`, { name: 'hijack' })).status).toBe(404);
  });

  it('records part and full payments, locks editing, and voids receipts back', async () => {
    const { client } = await h.owner('a@example.com');
    const inv = (await client.post('/api/invoices', sampleInvoice())).body; // total 20050

    const tooMuch = await client.post(`/api/invoices/${inv.id}/payments`, { amount: 20051, date: '2026-03-11', method: 'cash' });
    expect(tooMuch.status).toBe(400);

    const p1 = await client.post(`/api/invoices/${inv.id}/payments`, { amount: 5000, date: '2026-03-11', method: 'momo', reference: 'MP123' });
    expect(p1.status).toBe(201);
    expect(p1.body.receipt.number).toBe('RCT-0001');
    expect(p1.body.receipt.balanceAfter).toBe(15050);
    expect(p1.body.receipt.paymentFor).toBe('Payment for invoice № INV-0001');
    expect(p1.body.invoice.status).toBe('part_paid');

    expect((await client.put(`/api/invoices/${inv.id}`, sampleInvoice())).status).toBe(400);
    expect((await client.post(`/api/invoices/${inv.id}/void`, { reason: 'mistake' })).status).toBe(400);

    const p2 = await client.post(`/api/invoices/${inv.id}/payments`, { amount: 15050, date: '2026-03-12', method: 'cash' });
    expect(p2.body.invoice.status).toBe('paid');
    expect(p2.body.invoice.balance).toBe(0);
    expect((await client.post(`/api/invoices/${inv.id}/payments`, { amount: 1, date: '2026-03-12', method: 'cash' })).status).toBe(400);

    const voided = await client.post(`/api/receipts/${p2.body.receipt.id}/void`, { reason: 'bounced cheque' });
    expect(voided.body.status).toBe('void');
    const after = (await client.get(`/api/invoices/${inv.id}`)).body;
    expect(after.invoice.status).toBe('part_paid');
    expect(after.invoice.amountPaid).toBe(5000);
    expect(after.receipts).toHaveLength(2);
  });

  it('keeps the number of a voided invoice and never reuses it', async () => {
    const { client } = await h.owner('a@example.com');
    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    const voided = await client.post(`/api/invoices/${inv.id}/void`, { reason: 'duplicate' });
    expect(voided.body).toMatchObject({ status: 'void', number: 'INV-0001', voidReason: 'duplicate', balance: 0 });
    expect((await client.post('/api/invoices', sampleInvoice())).body.number).toBe('INV-0002');

    // Moving the counter back onto a used number is refused at create time
    const me = (await client.get('/api/auth/me')).body;
    await client.put('/api/business/counters', { ...me.business.counters, invoice: { prefix: 'INV-', nextNumber: 1, pad: 4 } });
    expect((await client.post('/api/invoices', sampleInvoice())).status).toBe(409);
  });

  it('allows edits before payment', async () => {
    const { client } = await h.owner('a@example.com');
    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    const edited = await client.put(
      `/api/invoices/${inv.id}`,
      sampleInvoice({ customerName: 'Kofi M.', items: [{ description: 'Cement', amount: 10000 }] })
    );
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ number: 'INV-0001', customerName: 'Kofi M.', total: 10000 });
  });
});

describe('receipts', () => {
  it('issues classic and itemized standalone receipts', async () => {
    const { client } = await h.owner('a@example.com');
    const classic = await client.post('/api/receipts', {
      layout: 'classic',
      customerName: 'Walk-in',
      date: '2026-03-10',
      amount: 50050,
      method: 'cash',
      paymentFor: 'School fees',
    });
    expect(classic.status).toBe(201);
    expect(classic.body).toMatchObject({ number: 'RCT-0001', amount: 50050, invoiceId: null, balanceAfter: null });

    const itemized = await client.post('/api/receipts', {
      layout: 'itemized',
      customerName: 'Walk-in',
      date: '2026-03-10',
      method: 'momo',
      items: [{ qty: '3', description: 'Rice bag', unitPrice: 30000, amount: 90000 }],
      discount: { type: 'fixed', value: 5000 },
    });
    expect(itemized.body).toMatchObject({ number: 'RCT-0002', subtotal: 90000, discountAmount: 5000, amount: 85000 });
  });
});

describe('plan limits', () => {
  it('stops the 11th document of the month on Free and resets next month', async () => {
    const { client, me } = await h.owner('a@example.com');
    for (let i = 0; i < 9; i++) expect((await client.post('/api/invoices', sampleInvoice())).status).toBe(201);
    const inv = (await client.get('/api/invoices')).body[0];
    // a payment receipt is the 10th document
    expect((await client.post(`/api/invoices/${inv.id}/payments`, { amount: 100, date: '2026-03-10', method: 'cash' })).status).toBe(201);

    const blocked = await client.post('/api/invoices', sampleInvoice());
    expect(blocked.status).toBe(402);
    expect(blocked.body.code).toBe('limit_reached');
    expect((await client.post('/api/receipts', { layout: 'classic', customerName: 'x', date: '2026-03-10', amount: 100, method: 'cash' })).status).toBe(402);

    h.setNow(new Date('2026-04-01T00:00:01Z'));
    expect((await client.post('/api/invoices', sampleInvoice())).status).toBe(201);

    h.setNow(new Date('2026-03-20T00:00:00Z'));
    await h.makePro(me.business!.id);
    expect((await client.post('/api/invoices', sampleInvoice())).status).toBe(201);
  });

  it('keeps Free on Classic Ink and lifts the watermark after upgrading', async () => {
    const { client, me } = await h.owner('a@example.com');
    const style = { ...me.business!.style, template: 'modern' };
    expect((await client.put('/api/business/style', style)).status).toBe(402);
    expect((await client.put('/api/business/style', { ...me.business!.style, ink: '#123456', rowsPerPage: 18 })).status).toBe(200);

    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    expect(inv.snapshot.watermark).toBe(true);
    expect(inv.snapshot.style.ink).toBe('#123456');
    expect((await client.post(`/api/invoices/${inv.id}/share`)).status).toBe(402);

    await h.makePro(me.business!.id);
    expect((await client.get(`/api/invoices/${inv.id}`)).body.invoice.snapshot.watermark).toBe(false);
    expect((await client.put('/api/business/style', style)).status).toBe(200);
  });

  it('makes receipt templates Pro and freezes the choice into each receipt', async () => {
    const { client, me } = await h.owner('a@example.com');
    expect(me.business!.style.receiptTemplate).toBe('receipt-book');
    const till = { ...me.business!.style, receiptTemplate: 'till' };
    const refused = await client.put('/api/business/style', till);
    expect(refused.status).toBe(402);
    expect(refused.body.code).toBe('pro_required');

    await h.makePro(me.business!.id);
    expect((await client.put('/api/business/style', till)).body.style.receiptTemplate).toBe('till');
    const receipt = (
      await client.post('/api/receipts', { layout: 'classic', customerName: 'Walk-in', date: '2026-03-10', amount: 500, method: 'cash' })
    ).body;
    expect(receipt.snapshot.style.receiptTemplate).toBe('till');

    // Changing the template later doesn't restyle receipts already issued
    await client.put('/api/business/style', { ...till, receiptTemplate: 'modern' });
    expect((await client.get(`/api/receipts/${receipt.id}`)).body.snapshot.style.receiptTemplate).toBe('till');
  });
});

describe('share links', () => {
  it('serves a read-only document by token without login', async () => {
    const { client, me } = await h.owner('a@example.com');
    await h.makePro(me.business!.id);
    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    const { shareToken } = (await client.post(`/api/invoices/${inv.id}/share`)).body;
    expect(shareToken).toHaveLength(22);

    const pub = await h.client().get(`/api/public/${shareToken}`);
    expect(pub.status).toBe(200);
    expect(pub.body.kind).toBe('invoice');
    expect(pub.body.invoice.number).toBe('INV-0001');

    await client.del(`/api/invoices/${inv.id}/share`);
    expect((await h.client().get(`/api/public/${shareToken}`)).status).toBe(404);
  });
});

describe('uploads', () => {
  it('accepts PNG signatures and rejects SVG', async () => {
    const { client } = await h.owner('a@example.com');
    const svg = new FormData();
    svg.append('file', new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 's.svg', { type: 'image/svg+xml' }));
    expect((await client.post('/api/business/assets/signature', svg)).status).toBe(400);

    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: '#1a3a8a' } }).png().toBuffer();
    const form = new FormData();
    form.append('file', new File([new Uint8Array(png)], 'sig.png', { type: 'image/png' }));
    const res = await client.post('/api/business/assets/signature', form);
    expect(res.status).toBe(200);
    expect(res.body.signatureUrl).toMatch(/^\/api\/files\/[\w-]+\.png$/);
    const file = await h.app.request(res.body.signatureUrl);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
  });
});

describe('billing', () => {
  it('rejects webhooks with a bad signature', async () => {
    const res = await h.app.request('/api/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({ event: 'charge.success', data: {} }),
      headers: { 'x-paystack-signature': 'nope' },
    });
    expect(res.status).toBe(401);
  });

  it('extends Pro once per charge, whether via verify or webhook', async () => {
    const { client, me } = await h.owner('owner@example.com');
    const checkout = await client.post('/api/billing/checkout', { interval: 'monthly' });
    expect(checkout.status).toBe(200);
    const reference = checkout.body.reference;

    const verified = await client.get(`/api/billing/verify?reference=${reference}`);
    expect(verified.body.subscription.plan).toBe('pro');
    expect(verified.body.subscription.currentPeriodEnd).toBe('2026-04-10T09:00:00.000Z');

    const charge = await h.deps.paystack.verify(reference);
    const webhook = { event: 'charge.success', data: charge };
    expect((await h.signedWebhook(webhook)).status).toBe(200);
    expect((await h.signedWebhook(webhook)).status).toBe(200);
    let sub = (await client.get('/api/auth/me')).body.subscription;
    expect(sub.currentPeriodEnd).toBe('2026-04-10T09:00:00.000Z');

    // Card subscription created → auto-renew on; renewal charge has no metadata, matched by customer code
    await h.signedWebhook({
      event: 'subscription.create',
      data: { subscription_code: 'SUB_1', email_token: 'tok', customer: { customer_code: 'CUS_1', email: 'owner@example.com' } },
    });
    await h.signedWebhook({
      event: 'charge.success',
      data: { reference: 'renewal_1', status: 'success', amount: 5000, customer: { customer_code: 'CUS_1' }, plan: { plan_code: 'PLN_monthly' } },
    });
    sub = (await client.get('/api/auth/me')).body.subscription;
    expect(sub).toMatchObject({ plan: 'pro', autoRenew: true, currentPeriodEnd: '2026-05-10T09:00:00.000Z' });

    // Another business can't claim this payment
    const other = await h.owner('other@example.com');
    expect((await other.client.get(`/api/billing/verify?reference=${reference}`)).status).toBe(400);
    expect(me.business).not.toBeNull();
  });

  it('drops to Free at period end and keeps documents', async () => {
    const { client } = await h.owner('owner@example.com');
    const { reference } = (await client.post('/api/billing/checkout', { interval: 'monthly' })).body;
    await client.get(`/api/billing/verify?reference=${reference}`);
    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    expect(inv.snapshot.watermark).toBe(false);

    // 2 days before the end: one reminder for a non-renewing (MoMo) plan
    h.setNow(new Date('2026-04-08T09:00:00Z'));
    expect(await runReminders(h.deps)).toBe(1);
    expect(await runReminders(h.deps)).toBe(0);
    expect(h.mail.at(-1)!.subject).toMatch(/ending soon/);

    h.setNow(new Date('2026-04-11T00:00:00Z'));
    // the 30-day session has expired by now
    expect((await client.get('/api/auth/me')).status).toBe(401);
    const me = (await client.post('/api/auth/login', { email: 'owner@example.com', password: 'password123' })).body;
    expect(me.subscription.plan).toBe('free');
    const still = await client.get(`/api/invoices/${inv.id}`);
    expect(still.status).toBe(200);
    expect(still.body.invoice.snapshot.watermark).toBe(false); // issued on Pro → stays clean
  });
});

describe('dashboard', () => {
  it('sums billed, collected and outstanding', async () => {
    const { client } = await h.owner('a@example.com');
    const inv = (await client.post('/api/invoices', sampleInvoice())).body;
    await client.post(`/api/invoices/${inv.id}/payments`, { amount: 5000, date: '2026-03-11', method: 'cash' });
    await client.post('/api/invoices', sampleInvoice({ date: '2026-02-20' }));
    const d = (await client.get('/api/dashboard')).body;
    expect(d.billedThisMonth).toBe(20050);
    expect(d.collectedThisMonth).toBe(5000);
    expect(d.outstanding).toBe(15050 + 20050);
    expect(d.unpaidCount).toBe(2);
    expect(d.recent[0].kind).toBe('invoice');
  });
});
