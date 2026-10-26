import { Check } from 'lucide-react';
import { LANGUAGES, type Lang } from '../lib/sig';
import { hasVoice } from '../lib/speech';

export default function LanguageSheet({ value, onPick, onClose }: { value: Lang; onPick: (l: Lang) => void; onClose: () => void }) {
  return (
    <div className="backdrop fade-in fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="lang-title" className="card sheet-in safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-b-none px-4 pt-5 shadow-[var(--shadow-sheet)] sm:max-w-md sm:rounded-b-[20px]">
        <h2 id="lang-title" className="headline text-[1.4rem]">
          Read labels in
        </h2>
        <ul className="mt-4 space-y-2" role="radiogroup" aria-labelledby="lang-title">
          {LANGUAGES.map((l) => {
            const on = value === l.code;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    onPick(l.code);
                    onClose();
                  }}
                  className={`btn min-h-15 w-full justify-start gap-3 px-4 text-left ${on ? '' : 'btn-quiet'}`}
                  lang={l.code}
                >
                  <span className="flex-1">
                    <span className="block text-[1.1rem]">{l.name}</span>
                    {l.code !== 'en' && (
                      <span className={`block text-[0.9rem] font-normal ${on ? 'text-ink' : 'text-muted'}`} lang="en">
                        {l.english}
                        {hasVoice(l.code) ? '' : ' — no voice installed on this device'}
                      </span>
                    )}
                  </span>
                  {on && (
                    <span className="flex items-center gap-1 text-[0.95rem]" lang="en">
                      <Check className="size-6" aria-hidden /> Chosen
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onClose} className="btn btn-quiet mt-4 min-h-14 w-full">
          Close
        </button>
      </div>
    </div>
  );
}
