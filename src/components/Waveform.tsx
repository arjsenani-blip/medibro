import { useEffect, useRef, type ReactNode } from 'react';
import { smoothLevel } from '../lib/level';

const BARS = 28;
// taller in the middle, like a voice print
const ENVELOPE = Array.from({ length: BARS }, (_, i) => 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / BARS));

/**
 * The mic button with a halo that breathes with the voice, and a row of bars
 * under it that follow the real input level. Purely decorative (aria-hidden):
 * the screen says "Listening…" in words. Each frame writes only transform and
 * opacity, straight to the elements, so React doesn't re-render. With reduced
 * motion, the bars are hidden and only the halo's opacity follows the level.
 */
export default function Waveform({ active, level, children }: { active: boolean; level: { current: number }; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const halo = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let smooth = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      smooth = smoothLevel(smooth, level.current, dt);
      const t = now / 1000;
      if (halo.current) {
        halo.current.style.opacity = String(0.2 + 0.7 * smooth);
        if (!reduce) halo.current.style.transform = `scale(${1 + smooth * 0.45})`;
      }
      if (!reduce) {
        if (button.current) button.current.style.transform = `scale(${1 + smooth * 0.07})`;
        bars.current.forEach((el, i) => {
          if (!el) return;
          const wobble = 0.72 + 0.28 * Math.sin(t * 7 + i * 0.9);
          el.style.transform = `scaleY(${Math.max(0.08, Math.min(1, smooth * ENVELOPE[i] * wobble * 1.25))})`;
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (button.current) button.current.style.transform = '';
      if (halo.current) halo.current.style.transform = '';
    };
  }, [active, level]);

  return (
    <div ref={root} className="wave flex flex-col items-center" data-on={active}>
      <div className="relative grid place-items-center">
        <span ref={halo} className="wave-halo pointer-events-none absolute inset-[-14px] rounded-full" aria-hidden />
        <div ref={button} className="relative">
          {children}
        </div>
      </div>
      <div className="wave-bars mt-4 flex h-14 items-center gap-[3px]" aria-hidden>
        {ENVELOPE.map((_, i) => (
          <span key={i} ref={(el) => void (bars.current[i] = el)} className="wave-bar h-full w-[5px] rounded-full" />
        ))}
      </div>
    </div>
  );
}
