import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { telHref } from '../lib/store';

/* Tinted-glass controls and floating cards (see src/index.css and
   design/DESIGN-LANGUAGE.md). Every control is at least 48px tall. */

type Variant = 'primary' | 'glass' | 'quiet' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  glass: 'btn-glass',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

export const buttonClass = (variant: Variant = 'primary', extra = '') => `btn ${VARIANT[variant]} min-h-14 w-full ${extra}`;

export function Button({ variant = 'primary', icon, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button type="button" {...rest} className={buttonClass(variant, className)}>
      {icon}
      {children}
    </button>
  );
}

/** A file picker styled as a button. `capture` opens the camera directly on phones. */
export function PhotoButton({ onFile, capture, variant = 'primary', icon, children }: { onFile: (f: File) => void; capture?: boolean; variant?: Variant; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className={buttonClass(variant, 'focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent-deep')}>
      {icon}
      {children}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

/** A call button, or nothing when the number can't be dialed. */
export function CallButton({ phone, variant = 'primary', children, className = '' }: { phone: string; variant?: Variant; children?: ReactNode; className?: string }) {
  const href = telHref(phone);
  if (!href) return null;
  return (
    <a href={href} className={buttonClass(variant, className)}>
      <Phone className="size-5 shrink-0" aria-hidden />
      {children ?? (
        <>
          Call <span className="whitespace-nowrap">{phone}</span>
        </>
      )}
    </a>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="bar safe-bottom sticky bottom-0 z-10 -mx-4 mt-auto px-4 pt-3 shadow-[0_-1px_0_var(--hairline)]">
      <div className="space-y-2.5 pt-0">{children}</div>
    </div>
  );
}

/** Space above the bottom bar, so the last card isn't pressed against it. */
export const Spacer = () => <div className="min-h-6 flex-1" aria-hidden />;

/** A floating card. `i` staggers its entrance. */
export function Card({ children, className = '', i, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; i?: number; as?: 'section' | 'div' | 'article' | 'figure' | 'ul' } & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  return (
    <Tag {...rest} className={`card rise ${className}`} style={{ '--i': i ?? 0 } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** A card's small heading: an icon in a glass tile, then sentence-case words. */
export function CardTitle({ icon, children, id }: { icon?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-[1rem] font-bold text-muted">
      {icon && <span className="glyph">{icon}</span>}
      {children}
    </h2>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rise mt-4 mb-1">
      <h1 className="headline text-[1.75rem]">{children}</h1>
      {sub && <p className="mt-1.5 text-[1.05rem] text-ink-strong">{sub}</p>}
    </div>
  );
}

export function Field({ label, hint, optional, children }: { label: string; hint?: ReactNode; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.95rem] font-bold text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[0.9rem] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = 'input';

/** Two or three choices; the chosen one is glass, bold, and marked for screen readers. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className="btn btn-sm">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The capsule mark. */
export function Logo({ className = 'size-9' }: { className?: string }) {
  return <img src="/icon-192.png" alt="" aria-hidden className={`${className} rounded-[26%] shadow-[var(--shadow-sm)]`} />;
}
