import { Check, Palette } from 'lucide-react';
import { ACCENTS, normalizeAccent } from '../lib/theme';

/** Theme color: presets as swatches, plus a custom picker on a rainbow ring. */
export default function ThemePicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const preset = ACCENTS.find((a) => a.hex.toLowerCase() === value.toLowerCase());
  const chosenName = preset?.name ?? 'Your own color';
  return (
    <div>
      <div role="radiogroup" aria-label="Theme color" className="grid grid-cols-3 gap-x-2 gap-y-3">
        {ACCENTS.map((a) => {
          const on = a === preset;
          return (
            <button
              key={a.hex}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(a.hex)}
              className={`flex min-h-12 flex-col items-center gap-1.5 rounded-[14px] py-1.5 text-[0.95rem] ${on ? 'font-extrabold text-ink-strong' : 'text-ink'}`}
            >
              <span className="swatch" data-on={on} style={{ background: a.hex, '--sw-glow': `${a.hex}aa` } as React.CSSProperties}>
                {on && <Check className="size-6 text-ink-strong drop-shadow-[0_1px_0_rgba(255,255,255,.6)]" strokeWidth={3} aria-hidden />}
              </span>
              {a.name}
            </button>
          );
        })}
        <label className={`relative flex min-h-12 cursor-pointer flex-col items-center gap-1.5 rounded-[14px] py-1.5 text-[0.95rem] focus-within:outline-3 focus-within:outline-accent-deep ${preset ? 'text-ink' : 'font-extrabold text-ink-strong'}`}>
          <span className="swatch swatch-custom" data-on={!preset} style={{ '--sw': preset ? undefined : value, '--sw-glow': '#8b5cf6aa' } as React.CSSProperties}>
            {preset ? <Palette className="relative size-5 text-ink" aria-hidden /> : <Check className="relative size-6 text-ink-strong" strokeWidth={3} aria-hidden />}
          </span>
          Your own
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={value}
            aria-label="Pick your own theme color"
            onChange={(e) => onChange(normalizeAccent(e.target.value))}
          />
        </label>
      </div>
      <p className="mt-3 text-[1rem] text-muted" aria-live="polite">
        Chosen: <b className="text-ink-strong">{chosenName}</b>
      </p>
    </div>
  );
}
