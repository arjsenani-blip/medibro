import { useEffect, useState } from 'react';
import { MapPin, Phone, ScanSearch, Square, Store, Volume2 } from 'lucide-react';
import type { Medicine } from '../lib/store';
import type { Supply } from '../lib/refill';
import type { ReminderState } from '../lib/reminders';
import SupplyCard from '../components/SupplyCard';
import { LANGUAGES, type Lang } from '../lib/sig';
import { plainLabel, spokenLines, title, titleAddress } from '../lib/plain';
import { canSpeak, hasVoice, speakLines, stopSpeaking } from '../lib/speech';
import { BottomBar, Button } from '../components/ui';

interface Props {
  med: Medicine;
  lang: Lang;
  rate: number;
  autoplay: boolean;
  reminders: ReminderState;
  onRate: (r: number) => void;
  onSupply: (s: Supply | null) => void;
  onCheckPill: () => void;
  onRemove: () => void;
}

export default function MedicineView({ med, lang, rate, autoplay, reminders, onRate, onSupply, onCheckPill, onRemove }: Props) {
  const f = med.fields;
  const p = plainLabel(f, med.raw, lang);
  const lines = spokenLines(p, lang);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const play = () => speakLines(lines, rate, setSpeaking);
  useEffect(() => {
    if (autoplay) play();
    return () => stopSpeaking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // index of each visible line within `lines` (name 0, directions 1, warnings 2…)
  const hl = (i: number) => (speaking === i ? 'speaking' : '');
  const langName = LANGUAGES.find((l) => l.code === lang)!.english;

  const facts: [string, string][] = [
    ['Quantity', f.quantity],
    ['Filled', f.filled],
    ['Prescriber', f.prescriber],
    ['Rx number', f.rxNumber],
    ['NDC', f.ndc],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex min-h-full flex-col">
      {/* The label, rewritten: biggest type goes to what to do */}
      <article className="mt-4 overflow-hidden rounded-2xl bg-paper ring-1 ring-rule" aria-labelledby="med-name">
        <header className="flex items-baseline justify-between gap-3 bg-amber px-4 py-2.5 text-white">
          <span className="truncate text-[0.95rem] font-bold">{f.pharmacy ? title(f.pharmacy) : 'Prescription'}</span>
          {f.rxNumber && <span className="shrink-0 text-[0.9rem]">Rx {f.rxNumber}</span>}
        </header>
        <div className="px-4 pt-4 pb-5">
          <h1 id="med-name" className={`text-[1.75rem] leading-tight font-extrabold ${hl(0)}`}>
            {p.name}
          </h1>
          {p.purpose && <p className="mt-0.5 text-[1rem] text-muted">For {p.purpose}</p>}

          <p className={`mt-4 text-[1.6rem] leading-[1.25] font-bold ${hl(1)}`} lang={p.translated ? lang : 'en'}>
            {p.directions || 'No directions saved.'}
          </p>
          {p.translated && lang !== 'en' && <p className="mt-2 text-[0.9rem] text-muted">On the label: {f.directions}</p>}
          {!p.translated && f.directions && (
            <p className="mt-2 text-[0.9rem] text-stop">
              Shown as printed{lang !== 'en' ? `, not in ${langName}` : ''}: ReadRx couldn’t understand every word, so it won’t rewrite these directions. Ask your pharmacist to explain them.
            </p>
          )}

          {p.warnings.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-rule pt-4">
              {p.warnings.map((w, i) => (
                <li key={w.id} className={`flex gap-2.5 text-[1.1rem] leading-snug font-bold ${hl(2 + i)}`} lang={lang}>
                  <span className="mt-[0.2em] grid size-5 shrink-0 place-items-center rounded-full bg-amber text-[0.75rem] font-extrabold text-white" aria-hidden>
                    !
                  </span>
                  {w.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      {/* Read aloud */}
      {canSpeak && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          {speaking === null ? (
            <Button variant="accent" onClick={play} icon={<Volume2 className="size-5" aria-hidden />}>
              Read aloud
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={() => {
                stopSpeaking();
                setSpeaking(null);
              }}
              icon={<Square className="size-4 fill-current" aria-hidden />}
            >
              Stop
            </Button>
          )}
          <button
            type="button"
            aria-pressed={rate < 0.8}
            onClick={() => onRate(rate < 0.8 ? 0.9 : 0.65)}
            className={`min-h-14 rounded-xl px-4 text-[1rem] font-bold ring-1 ${rate < 0.8 ? 'bg-ink text-white ring-ink' : 'bg-paper text-ink ring-rule'}`}
          >
            Slower
          </button>
        </div>
      )}
      {canSpeak && lang !== 'en' && !hasVoice(lang) && (
        <p className="mt-2 text-[0.9rem] text-muted">This phone has no {langName} voice installed, so it may read with an accent. On iPhone: Settings → Accessibility → Spoken Content → Voices.</p>
      )}

      <SupplyCard supply={med.supply ?? null} fields={f} reminders={reminders} onChange={onSupply} />

      {(f.pharmacy || f.pharmacyPhone || f.pharmacyAddress) && (
        <section className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-rule" aria-labelledby="pharmacy-title">
          <h2 id="pharmacy-title" className="flex items-center gap-2 text-[0.95rem] font-bold text-muted">
            <Store className="size-5" aria-hidden /> Pharmacy
          </h2>
          {f.pharmacy && <p className="mt-1 text-[1.2rem] font-extrabold">{title(f.pharmacy)}</p>}
          {f.pharmacyAddress && <p className="mt-0.5 text-[1rem]">{titleAddress(f.pharmacyAddress)}</p>}
          <div className="mt-3 space-y-2">
            {f.pharmacyPhone && (
              <a href={`tel:${f.pharmacyPhone.replace(/[^\d]/g, '')}`} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[1.05rem] font-bold text-white">
                <Phone className="size-5" aria-hidden /> Call <span className="whitespace-nowrap">{f.pharmacyPhone}</span>
              </a>
            )}
            {f.pharmacyAddress && (
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent([f.pharmacy, f.pharmacyAddress].filter(Boolean).join(', '))}`}
                className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-paper px-5 text-[1.05rem] font-bold ring-1 ring-rule"
              >
                <MapPin className="size-5" aria-hidden /> Directions
              </a>
            )}
          </div>
        </section>
      )}

      {/* Details */}
      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[1rem]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5">
        {confirmRemove ? (
          <div className="flex items-center gap-3 text-[1rem]">
            <span className="flex-1">Remove {p.name} from this phone?</span>
            <button type="button" className="min-h-12 px-3 font-bold text-stop" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="min-h-12 px-3 font-bold" onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="min-h-12 text-[1rem] font-bold text-muted underline decoration-rule underline-offset-4" onClick={() => setConfirmRemove(true)}>
            Remove this medicine
          </button>
        )}
      </div>

      <BottomBar>
        <Button onClick={onCheckPill} icon={<ScanSearch className="size-5" aria-hidden />}>
          Check a pill before taking it
        </Button>
      </BottomBar>
    </div>
  );
}
