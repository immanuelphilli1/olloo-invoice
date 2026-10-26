import { formatCedi, FREE_MONTHLY_DOC_LIMIT, PRO_PRICE, RECEIPT_TEMPLATES, TEMPLATES, type ReceiptTemplateId, type TemplateId } from '@olloo/shared';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundPaths } from '../components/landing/BackgroundPaths';
import { ContainerScroll } from '../components/landing/ContainerScroll';
import { demoSnapshot } from '../components/landing/demo';
import { CountUp, FaqItem, Marquee, Reveal, RotatingWord, SpotlightCard } from '../components/landing/effects';
import { WhatsAppChat } from '../components/landing/WhatsAppDemo';
import { Icon, Logo } from '../components/icons';
import { Thumbnail } from '../components/TemplatePicker';
import { ButtonLink } from '../components/ui';
import { ReceiptDocument } from '../documents';
import { ItemsDocument } from '../documents/ItemsDocument';
import { sampleInvoiceProps, sampleReceipt } from '../documents/sample';
import { TILL_WIDTH } from '../documents/TillReceipt';

const INK = '#1a3a8a';
const PAPER = '#f7f3e8';
const cedis = (p: number) => formatCedi(p).replace(/\.00$/, '');

const TRADES = [
  'Building materials',
  'Pharmacies',
  'Boutiques',
  'Phone & accessories',
  'Auto spare parts',
  'Caterers',
  'Printing presses',
  'Salons & barbers',
  'Private schools',
  'Mechanics',
  'Farm inputs',
  'Event rentals',
  'Cold stores',
  'Furniture makers',
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Header />
      <Hero />
      <TradesStrip />
      <ShowcaseScroll />
      <Features />
      <Steps />
      <Templates />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#faf7ef]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium">
          {[
            ['#features', 'Features'],
            ['#templates', 'Templates'],
            ['#pricing', 'Pricing'],
            ['#faq', 'FAQ'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 md:block">
              {label}
            </a>
          ))}
          <Link to="/login" className="rounded-lg px-3 py-2 text-slate-700 hover:bg-black/5">
            Log in
          </Link>
          <ButtonLink to="/signup" size="sm">
            Start free
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}

function Scribble() {
  return (
    <motion.svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full" aria-hidden preserveAspectRatio="none">
      <motion.path
        d="M3 14 C 60 4, 120 4, 170 10 S 260 18, 297 6"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.5, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

function Hero() {
  return (
    <BackgroundPaths className="bg-[#faf7ef] text-teal-700" count={36} angle={-6}>
      <section className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 lg:pt-24 lg:pb-28">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-teal-800"
        >
          
          Made for Ghanaian businesses · pay with MoMo
        </motion.p>
        <h1 className="mt-5 max-w-4xl xl:max-w-[46rem] font-display text-[2.6rem] leading-[1.05] font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
          Proper invoices & receipts for your{' '}
          <span className="relative inline-block font-hand text-[1.15em] font-semibold" style={{ color: INK }}>
            <RotatingWord words={['shop', 'pharmacy', 'boutique', 'workshop', 'school', 'salon']} />
            <Scribble />
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-600">
          Write them on your phone, send them on WhatsApp, and see who still owes you. Your logo, your signature, your receipt-book numbers —
          without the carbon paper.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/signup" className="px-6 py-3 text-base">
            Start free with your phone number
          </ButtonLink>
          <a href="#see-it" className="inline-flex items-center rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-black/5">
            See it in action ↓
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          {[`Free for ${FREE_MONTHLY_DOC_LIMIT} documents a month`, 'Nothing to install', 'Works on any phone'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[11px] text-white">✓</span>
              {t}
            </li>
          ))}
        </ul>

        {/* A real olloo invoice, slightly tossed on the desk */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 6 }}
          animate={{ opacity: 1, y: 0, rotate: 3 }}
          transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
          className="pointer-events-none absolute top-24 right-6 hidden w-[300px] xl:block"
          aria-hidden
        >
          <div className="rounded-sm shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)]">
            <Thumbnail scale={300 / 720} height={1010}>
              <ItemsDocument {...sampleInvoiceProps(demoSnapshot())} />
            </Thumbnail>
          </div>
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: -12 }}
            transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 12 }}
            className="absolute -bottom-6 -left-10 rounded-xl border-4 border-teal-600 bg-white/90 px-4 py-1 font-display text-2xl font-bold tracking-widest text-teal-700"
          >
            PAID
          </motion.div>
        </motion.div>
      </section>
    </BackgroundPaths>
  );
}

function TradesStrip() {
  return (
    <section className="border-y border-black/5 bg-white py-6">
      <p className="mb-4 text-center text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">Built for the businesses on your street</p>
      <div className="space-y-3">
        <Marquee duration={45}>
          {TRADES.map((t) => (
            <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm whitespace-nowrap text-slate-700">
              {t}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function ShowcaseScroll() {
  return (
    <section id="see-it" className="overflow-hidden bg-gradient-to-b from-white to-slate-50">
      <ContainerScroll
        titleComponent={
          <>
            <p className="font-hand text-2xl" style={{ color: INK }}>
              10:14 — invoice sent. 10:23 — paid.
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
              From your counter to their WhatsApp
            </h2>
            <p className="mx-auto mt-4 mb-16 max-w-xl text-slate-600">
              olloo turns each invoice and receipt into a clean image or PDF and opens your customer's chat. Record a part payment and the receipt shows
              what's still owed.
            </p>
          </>
        }
      >
        <div className="grid h-full md:grid-cols-[1.25fr_1fr]">
          <div className="hidden overflow-hidden bg-[#f1ede2] p-6 md:block">
            <div className="mx-auto max-w-[460px] rotate-[-1.5deg] shadow-xl">
              <Thumbnail scale={460 / 720} height={1010}>
                <ItemsDocument {...sampleInvoiceProps(demoSnapshot())} />
              </Thumbnail>
            </div>
          </div>
          <WhatsAppChat />
        </div>
      </ContainerScroll>
    </section>
  );
}

function PaymentsMini() {
  return (
    <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">INV-0042 · Kofi Mensah</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Part-paid</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-teal-500"
          initial={{ width: '0%' }}
          whileInView={{ width: '60%' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Paid GH₵ 400.00</span>
        <span className="font-semibold text-amber-700">Balance GH₵ 270.00</span>
      </div>
      <ul className="divide-y divide-slate-200 rounded-lg bg-white">
        {[
          ['RCT-0017', 'Mobile Money', '400.00'],
          ['RCT-0021', 'Cash · due Friday', '270.00'],
        ].map(([n, m, a], i) => (
          <li key={n} className={`flex justify-between px-3 py-2 ${i === 1 ? 'text-slate-400' : ''}`}>
            <span>
              {n} <span className="text-xs">· {m}</span>
            </span>
            <span className="tabular-nums">GH₵ {a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignatureMini() {
  return (
    <div className="mt-5 flex items-end justify-between gap-4 rounded-xl border border-slate-200 p-4" style={{ background: PAPER }}>
      <div className="flex gap-2">
        {[INK, '#0f766e', '#111111', '#9a3412'].map((c) => (
          <span key={c} className="h-7 w-7 rounded-full border-2 border-white shadow" style={{ background: c }} />
        ))}
      </div>
      <svg viewBox="0 0 160 60" className="h-14 w-36" aria-hidden>
        <motion.path
          d="M8 42 C 20 10, 32 10, 30 38 S 48 52, 58 22 S 74 6, 76 34 S 96 54, 104 24 C 108 14, 116 14, 118 30 S 136 46, 152 18"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  );
}

function TaxesMini() {
  const rows: Array<[string, string]> = [
    ['Sub-total', '1,000.00'],
    ['Discount (5%)', '−50.00'],
    ['VAT (15%)', '142.50'],
    ['NHIL (2.5%)', '23.75'],
    ['GETFund (2.5%)', '23.75'],
  ];
  return (
    <dl className="mt-5 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <dt className="text-slate-500">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold">
        <dt>Total GH₵</dt>
        <dd>1,140.00</dd>
      </div>
    </dl>
  );
}

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="font-hand text-2xl" style={{ color: INK }}>
            everything the receipt book does…
          </p>
          <h2 className="max-w-2xl font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">…and the sums it never could.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
          <Reveal className="md:col-span-2">
            <SpotlightCard className="h-full">
              <h3 className="text-lg font-semibold text-slate-900">Part payments, sorted</h3>
              <p className="mt-1 max-w-md text-sm text-slate-600">
                Record what the customer paid today. olloo issues the receipt, shows the balance on it, and moves the invoice from Unpaid to Part-paid to
                Paid.
              </p>
              <PaymentsMini />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.1}>
            <SpotlightCard className="h-full">
              <h3 className="text-lg font-semibold text-slate-900">Know who owes you</h3>
              <p className="mt-1 text-sm text-slate-600">Your dashboard adds up what's outstanding, so you don't have to flip pages.</p>
              <p className="mt-6 text-sm text-slate-500">Outstanding</p>
              <p className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
                GH₵ <CountUp to={1248000} format="cedis" />
              </p>
              <p className="mt-1 text-sm text-amber-700">
                <CountUp to={7} /> unpaid invoices
              </p>
            </SpotlightCard>
          </Reveal>
          <Reveal>
            <SpotlightCard className="h-full">
              <h3 className="text-lg font-semibold text-slate-900">Your brand on every page</h3>
              <p className="mt-1 text-sm text-slate-600">Logo, colours, fonts — and your signature, drawn once with your finger.</p>
              <SignatureMini />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.1}>
            <SpotlightCard className="h-full">
              <h3 className="text-lg font-semibold text-slate-900">VAT, NHIL & GETFund</h3>
              <p className="mt-1 text-sm text-slate-600">Switch on the taxes you charge; olloo works them out after any discount.</p>
              <TaxesMini />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.2}>
            <SpotlightCard className="h-full">
              <h3 className="text-lg font-semibold text-slate-900">Numbers you can trust</h3>
              <p className="mt-1 text-sm text-slate-600">
                Carry on from your paper book's numbers. Mistakes get voided with a reason — never torn out — so the sequence stays whole.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 font-mono text-sm">
                {['INV-0129', 'INV-0130', 'INV-0131'].map((n, i) => (
                  <span key={n} className={`rounded-md border px-2 py-1 ${i === 1 ? 'border-red-200 bg-red-50 text-red-600 line-through' : 'border-slate-200 bg-white'}`}>
                    {n}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                {(['whatsapp', 'download', 'printer', 'link'] as const).map((icon, i) => (
                  <span key={icon} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                    <Icon name={icon} className="h-3.5 w-3.5" />
                    {['WhatsApp', 'PDF', 'Print', 'Share link'][i]}
                  </span>
                ))}
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    ['Sign up with your phone', "We text you a code. No email needed, nothing to download — olloo runs in your phone's browser."],
    ['Add your logo & signature', 'Type your business details once. Snap your logo, draw your signature, pick your look.'],
    ['Send your first invoice', "Pick the customer, add the items, tap WhatsApp. When they pay, tap 'Record payment' for the receipt."],
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Set up before your next customer walks in</h2>
        </Reveal>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map(([title, body], i) => (
            <Reveal key={title} delay={i * 0.12}>
              <li className="relative border-t-2 border-dashed border-slate-200 pt-6">
                <span className="absolute -top-7 left-0 bg-white pr-3 font-hand text-5xl font-semibold" style={{ color: INK }}>
                  {i + 1}.
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-slate-600">{body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Templates() {
  const [tab, setTab] = useState<'invoices' | 'receipts'>('invoices');
  return (
    <section id="templates" className="overflow-hidden py-20 sm:py-28" style={{ background: PAPER }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Pick a look that feels like you</h2>
            <p className="mt-3 max-w-xl text-slate-600">
              Classic Ink feels like the book you already use. Pro adds clean modern pages, a mono style, and a till slip for shop sales.
            </p>
          </Reveal>
          <div className="flex rounded-full bg-white p-1 text-sm font-medium shadow-sm" role="tablist">
            {(['invoices', 'receipts'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-full px-5 py-2 capitalize transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className={`mt-12 grid items-end gap-6 ${tab === 'invoices' ? 'sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {tab === 'invoices'
            ? (Object.keys(TEMPLATES) as TemplateId[]).map((id, i) => (
                <TemplateCard key={id} name={TEMPLATES[id].name} pro={id !== 'classic-ink'} tilt={(i - 1) * 1.5}>
                  <Thumbnail scale={0.42} height={id === 'classic-ink' ? 1010 : 640}>
                    <ItemsDocument {...sampleInvoiceProps(demoSnapshot(id))} />
                  </Thumbnail>
                </TemplateCard>
              ))
            : (Object.keys(RECEIPT_TEMPLATES) as ReceiptTemplateId[]).map((id, i) => (
                <TemplateCard key={id} name={RECEIPT_TEMPLATES[id].name} pro={id !== 'receipt-book'} tilt={(i - 1.5) * 1.2}>
                  <Thumbnail {...(id === 'till' ? { scale: 0.62, width: TILL_WIDTH, height: 560 } : { scale: 0.3, height: 700 })}>
                    <ReceiptDocument receipt={sampleReceipt(demoSnapshot('classic-ink', id), id === 'till' ? 'itemized' : 'classic')} />
                  </Thumbnail>
                </TemplateCard>
              ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ name, pro, tilt, children }: { name: string; pro: boolean; tilt: number; children: ReactNode }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 30, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -8 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
      className="mx-auto w-full"
    >
      <div className="overflow-hidden rounded-md">{children}</div>
      <figcaption className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
        {name}
        {pro && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-amber-800 uppercase">Pro</span>}
      </figcaption>
    </motion.figure>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Less than a receipt book a month</h2>
          <p className="mt-3 text-slate-600">Pay with Mobile Money or card. Stop any time — your documents stay yours.</p>
          <div className="mt-6 inline-flex rounded-full bg-slate-100 p-1 text-sm font-medium">
            {[false, true].map((y) => (
              <button
                key={String(y)}
                type="button"
                onClick={() => setYearly(y)}
                className={`rounded-full px-4 py-1.5 transition ${yearly === y ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                {y ? 'Yearly · 2 months free' : 'Monthly'}
              </button>
            ))}
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-slate-200 p-7">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-3 font-display text-5xl font-bold">GH₵ 0</p>
              <p className="text-sm text-slate-500">forever</p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                <li>✓ {FREE_MONTHLY_DOC_LIMIT} invoices + receipts a month</li>
                <li>✓ Classic Ink invoices & Receipt Book receipts</li>
                <li>✓ Your logo and signature</li>
                <li>✓ WhatsApp, PDF and print</li>
                <li className="text-slate-400">· Small "Made with olloo" mark</li>
              </ul>
              <ButtonLink to="/signup" variant="secondary" className="mt-8 w-full">
                Start free
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative h-full rounded-2xl bg-slate-900 p-7 text-white shadow-xl">
              <span className="absolute -top-3 right-6 rotate-3 rounded-md bg-amber-300 px-2 py-0.5 font-hand text-lg text-slate-900">unlimited documents</span>
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-3 font-display text-5xl font-bold">
                GH₵ {cedis(yearly ? PRO_PRICE.yearly : PRO_PRICE.monthly)}
                <span className="font-sans text-base font-medium text-slate-400"> / {yearly ? 'year' : 'month'}</span>
              </p>
              <p className="text-sm text-slate-400">{yearly ? `about GH₵ ${cedis(Math.round(PRO_PRICE.yearly / 12))} a month` : 'cancel any time'}</p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                <li>✓ Unlimited invoices and receipts</li>
                <li>✓ All invoice & receipt templates, incl. till slip</li>
                <li>✓ No watermark</li>
                <li>✓ Share links customers open in any browser</li>
              </ul>
              <Link
                to="/signup"
                className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-teal-400"
              >
                Start free, upgrade when ready
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900">Questions people ask us</h2>
          <p className="mt-3 text-slate-600">
            Something else? <Link to="/signup" className="font-medium text-teal-700 hover:underline">Try it free</Link> — it takes two minutes.
          </p>
        </Reveal>
        <div>
          <FaqItem question="Do I need to download an app?">
            No. olloo works in the browser on any smartphone, tablet or computer. On Android or iPhone you can add it to your home screen so it opens like
            an app.
          </FaqItem>
          <FaqItem question="I already have a receipt book. Can I continue the numbers?">
            Yes. In Settings → Numbering, set the next invoice and receipt number and your own prefix, so olloo picks up where your book stopped.
          </FaqItem>
          <FaqItem question="My customer pays in instalments. Does that work?">
            Yes. Record each payment on the invoice — every one gets its own receipt showing the balance left, and the invoice is marked Paid when it's
            cleared.
          </FaqItem>
          <FaqItem question="How do I pay for Pro?">
            Through Paystack, with MTN MoMo, Telecel Cash, AirtelTigo Money or a card. Card payments renew automatically; for Mobile Money we text you a
            reminder a few days before your plan ends.
          </FaqItem>
          <FaqItem question="What happens if I stop paying?">
            You go back to the Free plan. Every invoice and receipt you made stays in your account — you can still view, share and download them.
          </FaqItem>
          <FaqItem question="Can I add VAT, NHIL and GETFund?">
            Yes. Turn on the taxes you charge and set their rates in Settings → Taxes. They're added after any discount and shown line by line.
          </FaqItem>
          <FaqItem question="Who can see my invoices?">
            Only you, when logged in to your account — unless you create a share link for a document to send to your customer.
          </FaqItem>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-20 text-white sm:py-24" style={{ background: INK }}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 34px)' }}
      />
      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="font-hand text-3xl text-amber-200">Your next customer is on their way.</p>
        <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Send them a proper invoice.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100">
            Create my free account
          </Link>
          <Link to="/login" className="rounded-lg px-6 py-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
            Log in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
        <Logo />
        <p>© {new Date().getFullYear()} olloo · Made in Ghana</p>
      </div>
    </footer>
  );
}
