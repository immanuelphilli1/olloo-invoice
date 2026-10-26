# olloo invoice

Invoices and receipts for Ghanaian businesses: your own branding, WhatsApp sharing, PDF, payments tracking, and a Paystack subscription.

```
shared/   types, money maths (integer pesewas), totals, amount-in-words, plans, request schemas — used by both sides
server/   Hono API + Drizzle (Postgres in production, embedded PGlite in dev/tests)
web/      React 19 + Vite + Tailwind 4
deploy/   Caddyfile, systemd unit, backup script
```

## Run it locally

```bash
npm install
npm run dev          # API on :8787 (PGlite in server/.data), web on :5173 with /api proxied
```

No database or keys needed in development: SMS codes and emails are printed in the API log
(`[sms → +233…] Your olloo code is 123456`). To make yourself admin, start the API with
`SUPERADMINS=you@example.com` (or your phone in +233 form).

If 8787/5173 are taken: `PORT=8899 npm run dev -w server` and `API_PORT=8899 npx vite --port 5199` in `web/`.

```bash
npm test             # shared unit tests + API integration tests (in-memory PGlite)
npm run lint         # eslint + typecheck for web, typecheck for server/shared
npm run build        # web/dist + server/dist
```

After changing `server/src/db/schema.ts`: `npm run db:generate` and commit the new file in `server/drizzle/`.
Migrations run automatically when the API starts.

## How it works

- **Accounts** — phone + SMS code or email + password; one owner per business (v1). Sessions are httpOnly cookies; the API and web app share one origin.
- **Tenancy** — every business route takes the business from the session, never from the request.
- **Money** — integer pesewas end to end. The server recomputes sub-total → discount → taxes (each on the discounted base) → total on every save.
- **Numbering** — `INV-0001` / `RCT-0001` per business, allocated with a row lock inside the create transaction. Prefix and next number are editable; a number is never issued twice.
- **Invoices** — editable until the first payment. "Record payment" issues a classic receipt and updates the balance (Unpaid → Part-paid → Paid). Nothing is deleted: invoices and receipts are voided with a reason; voiding a payment receipt gives the amount back to the invoice.
- **Snapshots** — each document stores the company details and style it was issued with, so changing your branding later doesn't alter old documents.
- **Plans** — Free: 10 documents/month (invoices + receipts), Classic Ink template, watermark. Pro: unlimited, all templates, no watermark, share links. Pro is active while `current_period_end` is in the future (or `comp`); every successful Paystack charge extends it by a month/year from the later of now and the current end. Upgrading lifts the watermark from older documents too.
- **MoMo vs card** — Paystack can only re-charge cards. Mobile Money subscribers get an SMS/email reminder 3 days before Pro ends (hourly job in the API; also `npm run reminders -w server`). If they don't pay they drop to Free and keep everything.

## Deploy (VPS)

1. Install Node 22+, Postgres 16+, Caddy. Create a database and an `olloo` system user.
2. `git clone` to `/opt/olloo-invoice`, then `npm ci && npm run build`.
3. `cp server/.env.example server/.env` and fill it in (`SESSION_SECRET`, `DATABASE_URL`, `APP_URL`, Paystack, SMS, mail).
4. `deploy/olloo-invoice.service` → `/etc/systemd/system/`, then `systemctl enable --now olloo-invoice`.
5. `deploy/Caddyfile` → `/etc/caddy/Caddyfile` (change the domain), `systemctl reload caddy`.
6. Schedule `deploy/backup.sh` nightly and copy the backups off the server.

### Paystack setup

1. Dashboard → Plans: create **Pro monthly** (GHS 50, monthly) and **Pro yearly** (GHS 500, annually). Put the plan codes in `PAYSTACK_PLAN_MONTHLY` / `PAYSTACK_PLAN_YEARLY`.
2. Settings → API Keys & Webhooks: webhook URL `https://<your domain>/api/billing/webhook`.
3. Test with `sk_test_` keys and Paystack's test card / test MoMo numbers first. For local webhook testing, expose port 8787 with `cloudflared tunnel --url http://localhost:8787`.
4. If you change prices, update the Paystack plans **and** `PRO_PRICE` in `shared/src/plans.ts` (shown in the app, and used to reject undersized charges).

### SMS

`SMS_PROVIDER=arkesel` (or `hubtel`) with an API key and a registered sender ID. Check the request format against your provider's current docs before going live (`server/src/providers/sms.ts`).
