import { formatCedi } from '@olloo/shared';
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

/** Cycles through words with a spring drop-in (in the spirit of 21st.dev "Animated Hero"). */
export function RotatingWord({ words, interval = 2200, className = '' }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval, reduceMotion]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <span className={`relative inline-grid align-bottom ${className}`}>
      {/* invisible longest word reserves the width so the line doesn't jump */}
      <span className="invisible col-start-1 row-start-1">{longest}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[index]}
          className="col-start-1 row-start-1"
          initial={{ y: '-60%', opacity: 0, rotate: -4 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: '60%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Endless horizontal scroll; pauses on hover. */
export function Marquee({ children, reverse, duration = 40 }: { children: ReactNode; reverse?: boolean; duration?: number }) {
  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className="marquee-track flex shrink-0 items-center gap-3 pr-3 group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${duration}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

/** Card with a soft light that follows the cursor (in the spirit of 21st.dev "Spotlight Card"). */
export function SpotlightCard({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-teal-300 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), rgb(20 184 166 / 0.13), transparent 70%)' }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

const FORMATS = {
  plain: (n: number) => String(Math.round(n)),
  /** pesewas → "1,234.50" */
  cedis: (n: number) => formatCedi(Math.round(n)),
};

/** Number that counts up the first time it scrolls into view. */
export function CountUp({ to, format = 'plain', duration = 1.4 }: { to: number; format?: keyof typeof FORMATS; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const fmt = FORMATS[format];
    if (reduceMotion) {
      el.textContent = fmt(to);
      return;
    }
    const controls = animate(0, to, { duration, ease: 'easeOut', onUpdate: (v) => (el.textContent = fmt(v)) });
    return () => controls.stop();
  }, [inView, to, duration, format, reduceMotion]);
  return (
    <span ref={ref} className="tabular-nums">
      {FORMATS[format](0)}
    </span>
  );
}

/** Accordion item with an animated height. */
export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-6 py-5 text-left">
        <span className="font-semibold text-slate-900">{question}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-2xl leading-none font-light text-teal-700" aria-hidden>
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pb-5 text-slate-600">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fades and lifts children in when they scroll into view. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
