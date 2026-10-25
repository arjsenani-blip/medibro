import { Check } from 'lucide-react';
import { LANGUAGES, type Lang } from '../lib/sig';
import { hasVoice } from '../lib/speech';

export default function LanguageSheet({ value, onPick, onClose }: { value: Lang; onPick: (l: Lang) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 sm:items-center sm:justify-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="lang-title" className="safe-bottom w-full rounded-t-2xl bg-paper px-4 pt-4 sm:max-w-md sm:rounded-2xl">
        <h2 id="lang-title" className="text-[1.2rem] font-extrabold">Read labels in</h2>
        <p className="mt-0.5 text-[0.9rem] text-muted">Directions and warnings are rewritten in this language and read aloud.</p>
        <ul className="mt-3 divide-y divide-rule">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => {
                  onPick(l.code);
                  onClose();
                }}
                className="flex min-h-14 w-full items-center gap-3 text-left"
                lang={l.code}
              >
                <span className="flex-1">
                  <span className="block text-[1.1rem] font-bold">{l.name}</span>
                  {l.code !== 'en' && <span className="block text-[0.85rem] text-muted" lang="en">{l.english}{hasVoice(l.code) ? '' : ' — no voice installed on this device'}</span>}
                </span>
                {value === l.code && <Check className="size-6 text-amber" aria-label="Selected" />}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-2 min-h-12 w-full text-[1rem] font-bold text-muted">
          Close
        </button>
      </div>
    </div>
  );
}
