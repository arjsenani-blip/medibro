import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'quiet' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-white active:bg-black',
  accent: 'bg-amber text-white active:brightness-90',
  quiet: 'bg-paper text-ink ring-1 ring-rule active:bg-ground',
  danger: 'bg-stop text-white active:brightness-90',
};

export function Button({ variant = 'primary', icon, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[1.05rem] font-bold disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/** A file picker styled as a button. `capture` opens the camera directly on phones. */
export function PhotoButton({ onFile, capture, variant = 'primary', icon, children }: { onFile: (f: File) => void; capture?: boolean; variant?: Variant; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className={`inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-5 text-[1.05rem] font-bold focus-within:outline-2 focus-within:outline-amber ${VARIANT[variant]}`}>
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

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="safe-bottom sticky bottom-0 z-10 -mx-4 mt-6 border-t border-rule bg-ground px-4 pt-3">
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.9rem] font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.85rem] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-[1rem] text-ink outline-none focus:border-ink';
