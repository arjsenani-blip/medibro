import { useEffect, useRef } from 'react';
import { smoothLevel } from '../lib/level';

export type OrbState = 'idle' | 'listening' | 'thinking';

/**
 * The assistant's control: Cooky's glass orb, tinted by the theme. It is the
 * button (tap to start or stop listening).
 * - idle: slow breathing (scale 1 → 1.03 over 4s), faint glow
 * - listening: scale (up to about 1.15), glow size and brightness follow the smoothed
 *   mic level; the inner color fields spin faster while it hears speech
 * - thinking / answering: a soft shimmer sweeps across
 * Each frame writes only transform and opacity. With reduced motion nothing
 * scales or spins; only the glow's opacity follows the voice.
 */
export default function Orb({ state, level, label, onPress }: { state: OrbState; level: { current: number }; label: string; onPress: () => void }) {
  const body = useRef<HTMLSpanElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const fieldA = useRef<HTMLSpanElement>(null);
  const fieldB = useRef<HTMLSpanElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let smooth = 0;
    let a = 0;
    let b = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const listening = stateRef.current === 'listening';
      smooth = smoothLevel(smooth, listening ? level.current : 0, dt);
      const t = now / 1000;
      if (glow.current) glow.current.style.opacity = String(Math.min(1, (listening ? 0.6 : 0.45) + 0.4 * smooth));
      if (!reduce) {
        const breathe = 0.015 * (1 - Math.cos((2 * Math.PI * t) / 4)); // 0 → 0.03 → 0 every 4s
        a += dt * (10 + 160 * smooth);
        b -= dt * (7 + 110 * smooth);
        if (body.current) body.current.style.transform = `scale(${1 + breathe + 0.12 * smooth})`; // at most ~1.15×
        if (glow.current) glow.current.style.transform = `scale(${1 + breathe * 2 + 0.45 * smooth})`;
        if (fieldA.current) fieldA.current.style.transform = `rotate(${a}deg)`;
        if (fieldB.current) fieldB.current.style.transform = `rotate(${b}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  return (
    <button type="button" onClick={onPress} aria-label={label} aria-pressed={state === 'listening'} className="orb-btn relative grid size-[150px] place-items-center rounded-full" data-state={state}>
      <span ref={glow} className="orb-glow" aria-hidden />
      <span ref={body} className="orb" aria-hidden>
        <span ref={fieldA} className="orb-field orb-field-a" />
        <span ref={fieldB} className="orb-field orb-field-b" />
        <span className="orb-sheen" />
        <span className="orb-shimmer" />
      </span>
    </button>
  );
}
