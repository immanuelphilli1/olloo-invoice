import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ReceiptDocument } from '../../documents';
import { ItemsDocument } from '../../documents/ItemsDocument';
import { sampleInvoiceProps, sampleReceipt } from '../../documents/sample';
import { Thumbnail } from '../TemplatePicker';
import { demoSnapshot } from './demo';

function Ticks() {
  return (
    <svg viewBox="0 0 16 11" className="inline h-3 w-4 text-sky-500" aria-hidden>
      <path d="M1 6l3 3 6-7M6 9l1 1 7-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bubble({ out, time, delay, children }: { out?: boolean; time: string; delay: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className={`max-w-[82%] rounded-xl px-2 pt-2 pb-1 text-[13px] leading-snug text-slate-800 shadow-sm ${
        out ? 'ml-auto rounded-tr-sm bg-[#d9fdd3]' : 'mr-auto rounded-tl-sm bg-white'
      }`}
    >
      {children}
      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-500">
        {time} {out && <Ticks />}
      </p>
    </motion.div>
  );
}

/** A WhatsApp chat where the invoice, the customer's reply and the receipt arrive in turn. */
export function WhatsAppChat() {
  return (
    <div className="flex h-full flex-col bg-[#efeae2]">
      <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-sm font-semibold">KM</div>
        <div>
          <p className="text-sm font-semibold">Kofi Mensah</p>
          <p className="text-xs text-white/80">online</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
        <Bubble out time="10:14" delay={0.2}>
          <div className="overflow-hidden rounded-lg">
            <Thumbnail scale={0.3} height={900}>
              <ItemsDocument {...sampleInvoiceProps(demoSnapshot())} />
            </Thumbnail>
          </div>
          <p className="mt-1.5 px-1">Invoice № INV-0042 · GH₵ 670.00</p>
        </Bubble>
        <Bubble time="10:21" delay={0.9}>
          <p className="px-1">Thanks! Sending 400 on MoMo now, balance on Friday 🙏🏾</p>
        </Bubble>
        <Bubble out time="10:23" delay={1.6}>
          <div className="overflow-hidden rounded-lg">
            <Thumbnail scale={0.3} height={640}>
              <ReceiptDocument receipt={sampleReceipt(demoSnapshot(), 'classic')} />
            </Thumbnail>
          </div>
          <p className="mt-1.5 px-1">Receipt № RCT-0017 · balance GH₵ 270.00</p>
        </Bubble>
      </div>
    </div>
  );
}
