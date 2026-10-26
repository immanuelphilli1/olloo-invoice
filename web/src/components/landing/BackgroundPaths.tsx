/**
 * Flowing ribbon of lines behind the hero; the lines part around the cursor.
 * Adapted from Kokonut UI "Background Paths" v2 by @dorianbaffier (MIT)
 * https://github.com/kokonut-labs/kokonutui — colour comes from the CSS `color` of the canvas.
 */
import { useEffect, useRef, type ReactNode } from 'react';

const SAMPLES = 64;
/** Lines reach this far past each side, so their ends never show. */
const OVERSCAN = 0.06;
const DRAW_MS = 1400;
const DRAW_STAGGER_MS = 40;
const PART_RADIUS = 150;
const PART_PUSH = 56;

interface Layer {
  width: number;
  opacity: number;
  phase: number;
  pace: number;
  part: number;
}

const LAYERS: Layer[] = [
  { width: 1, opacity: 0.16, phase: 0.6, pace: 0.7, part: 0.45 },
  { width: 1.25, opacity: 0.26, phase: 0.3, pace: 0.85, part: 0.75 },
  { width: 1.5, opacity: 0.4, phase: 0, pace: 1, part: 1 },
];

interface Frame {
  width: number;
  height: number;
  time: number;
  drawn: number[];
  pointer: { x: number; y: number; amount: number; on: boolean };
}

interface Shape {
  count: number;
  spread: number;
  slope: number;
  interactive: boolean;
}

function lineY(s: number, u: number, layer: Layer, frame: Frame, shape: Shape, band: number) {
  const t = frame.time * layer.pace;
  const x = u * frame.width;
  const center =
    frame.height * 0.5 +
    shape.slope * (x - frame.width / 2) +
    band * 0.1 * Math.sin(Math.PI * 2 * (0.75 * u + 0.1) + layer.phase + t * 0.35);
  const turn = 0.22 + 0.09 * Math.sin(t * 0.21 + layer.phase);
  const breathe = 0.3 * Math.sin(t * 0.5 + s * 4 + layer.phase);
  const twist = Math.cos(Math.PI * (u - turn) + s * (0.6 + breathe) + layer.phase);
  return center + s * shape.spread * band * twist;
}

function part(x: number, y: number, frame: Frame, strength: number) {
  const { pointer } = frame;
  if (pointer.amount < 0.001) return y;
  const dx = x - pointer.x;
  const dy = y - pointer.y;
  const falloff = Math.exp(-(dx * dx + dy * dy) / (PART_RADIUS * PART_RADIUS));
  const side = dy / (Math.abs(dy) + 24);
  return y + side * falloff * PART_PUSH * strength * pointer.amount;
}

function drawLines(ctx: CanvasRenderingContext2D, frame: Frame, shape: Shape, color: string) {
  const { width, height } = frame;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const band = Math.min(height, width * 1.1);
  const perLayer = Math.max(1, Math.round(shape.count / LAYERS.length));
  const xs = new Float32Array(SAMPLES + 1);
  const ys = new Float32Array(SAMPLES + 1);

  LAYERS.forEach((layer, layerIndex) => {
    ctx.lineWidth = layer.width;
    for (let i = 0; i < perLayer; i++) {
      const drawn = frame.drawn[layerIndex * perLayer + i] ?? 1;
      if (drawn <= 0) continue;
      const s = perLayer === 1 ? 0 : i / (perLayer - 1) - 0.5;
      const last = Math.max(1, Math.ceil(SAMPLES * drawn));
      for (let k = 0; k <= last; k++) {
        const u = -OVERSCAN + (k / SAMPLES) * (1 + OVERSCAN * 2);
        const x = u * width;
        const y = lineY(s, u, layer, frame, shape, band);
        xs[k] = x;
        ys[k] = shape.interactive ? part(x, y, frame, layer.part) : y;
      }
      ctx.globalAlpha = layer.opacity * (0.45 + 0.55 * (1 - Math.abs(s) * 2));
      ctx.beginPath();
      ctx.moveTo(xs[0]!, ys[0]!);
      for (let k = 1; k < last; k++) {
        ctx.quadraticCurveTo(xs[k]!, ys[k]!, (xs[k]! + xs[k + 1]!) / 2, (ys[k]! + ys[k + 1]!) / 2);
      }
      ctx.lineTo(xs[last]!, ys[last]!);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function BackgroundPaths({
  className = '',
  children,
  count = 42,
  spread = 1,
  angle = -8,
  speed = 1,
  interactive = true,
}: {
  className?: string;
  children?: ReactNode;
  count?: number;
  spread?: number;
  angle?: number;
  speed?: number;
  interactive?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shape: Shape = { count, spread, slope: Math.tan((angle * Math.PI) / 180), interactive: interactive && !reduceMotion };
    const perLayer = Math.max(1, Math.round(count / LAYERS.length));
    const frame: Frame = {
      width: 0,
      height: 0,
      time: 40,
      drawn: new Array(perLayer * LAYERS.length).fill(reduceMotion ? 1 : 0),
      pointer: { x: 0, y: 0, amount: 0, on: false },
    };
    const color = getComputedStyle(canvas).color;
    let start = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    let onScreen = true;

    const paint = () => drawLines(ctx, frame, shape, color);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      frame.width = rect.width;
      frame.height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };
    const loop = (now: number) => {
      raf = 0;
      if (!start) {
        start = now;
        last = now;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame.time += dt * speed;
      const elapsed = now - start;
      for (let i = 0; i < frame.drawn.length; i++) {
        if (frame.drawn[i]! < 1) {
          frame.drawn[i] = easeOut(Math.min(Math.max((elapsed - (i % perLayer) * DRAW_STAGGER_MS) / DRAW_MS, 0), 1));
        }
      }
      const { pointer } = frame;
      pointer.amount += ((pointer.on ? 1 : 0) - pointer.amount) * 0.08;
      paint();
      const settling = frame.drawn.some((d) => d < 1) || pointer.amount > 0.001 || pointer.on;
      if (visible && (speed > 0 || settling)) raf = requestAnimationFrame(loop);
    };
    const play = () => {
      if (!raf && visible && !reduceMotion) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    canvas.style.opacity = '1';
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // Stop drawing when scrolled away or the tab is hidden.
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = !!entry?.isIntersecting;
      visible = onScreen && !document.hidden;
      if (visible) play();
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = onScreen && !document.hidden;
      if (visible) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !shape.interactive) return;
      const rect = canvas.getBoundingClientRect();
      frame.pointer.x = event.clientX - rect.left;
      frame.pointer.y = event.clientY - rect.top;
      frame.pointer.on = true;
      play();
    };
    const onLeave = () => {
      frame.pointer.on = false;
      play();
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    play();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [count, spread, angle, speed, interactive]);

  return (
    <div ref={rootRef} className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent), radial-gradient(ellipse 40% 32% at 50% 50%, rgb(0 0 0 / 0.3), #000)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full opacity-0 transition-opacity duration-500 ease-out" />
      </div>
      {children}
    </div>
  );
}
