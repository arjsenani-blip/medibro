import { useEffect, useState } from 'react';
import { Check, ChevronDown, MapPin, ScanSearch, Square, Volume2 } from 'lucide-react';
import { refillPharmacy, type Medicine, type Profile } from '../lib/store';
import type { Supply } from '../lib/refill';
import type { ReminderState } from '../lib/reminders';
import SupplyCard from '../components/SupplyCard';
import { LANGUAGES, type Lang } from '../lib/sig';
import { plainLabel, spokenLines, title, titleAddress } from '../lib/plain';
import { canSpeak, hasVoice, speakLines, stopSpeaking } from '../lib/speech';
import { BottomBar, Button, CallButton, Card, Spacer, buttonClass } from '../components/ui';

interface Props {
  med: Medicine;
  lang: Lang;
  rate: number;
  autoplay: boolean;
  reminders: ReminderState;
  profile: Profile;
  onRate: (r: number) => void;
  onSupply: (s: Supply | null) => void;
  onCheckPill: () => void;
  onRemove: () => void;
}

export default function MedicineView({ med, lang, rate, autoplay, reminders, profile, onRate, onSupply, onCheckPill, onRemove }: Props) {
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
    <div className="flex min-h-full flex-1 flex-col">
      {/* The label, rewritten: biggest type goes to what to do */}
      <Card as="article" className="mt-3 p-5" aria-labelledby="med-name">
        <h1 id="med-name" className={`headline text-[1.9rem] ${hl(0)}`}>
          {p.name}
        </h1>
        {p.purpose && <p className="mt-1 text-[1.05rem] text-muted">For {p.purpose}</p>}

        <p className={`mt-5 text-[1.6rem] leading-[1.25] font-bold text-ink-strong ${hl(1)}`} lang={p.translated ? lang : 'en'}>
          {p.directions || 'No directions saved.'}
        </p>
        {p.translated && lang !== 'en' && <p className="mt-2 text-[0.95rem] text-muted">{f.directions}</p>}
        {!p.translated && f.directions && (
          <p className="mt-2 text-[1rem] font-bold text-stop">
            Shown as printed{lang !== 'en' ? `, not in ${langName}` : ''}. Ask your pharmacist to explain.
          </p>
        )}

        {p.warnings.length > 0 && (
          <ul className="mt-5 space-y-2.5">
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

        {canSpeak && (
          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2.5">
            {speaking === null ? (
              <Button onClick={play} icon={<Volume2 className="size-6" aria-hidden />}>
                Listen
              </Button>
            ) : (
              <Button
                className="is-on"
                onClick={() => {
                  stopSpeaking();
                  setSpeaking(null);
                }}
                icon={<Square className="size-4 fill-current" aria-hidden />}
              >
                Stop
              </Button>
            )}
            <button type="button" aria-pressed={rate < 0.8} onClick={() => onRate(rate < 0.8 ? 0.9 : 0.65)} className={`btn min-h-14 px-4 ${rate < 0.8 ? '' : 'btn-quiet'}`}>
              {rate < 0.8 && <Check className="size-5" aria-hidden />}
              Slower
            </button>
          </div>
        )}
        {canSpeak && lang !== 'en' && !hasVoice(lang) && <p className="mt-2 text-[0.95rem] text-muted">No {langName} voice on this phone: Settings → Accessibility → Spoken Content → Voices.</p>}
      </Card>

      <SupplyCard supply={med.supply ?? null} fields={f} reminders={reminders} pharmacy={refillPharmacy(f, profile)} onChange={onSupply} />

      <details className="group rise mt-6" style={{ '--i': 3 } as React.CSSProperties}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[1.1rem] font-bold text-ink-strong">
          Label details
          <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 space-y-4">
          {facts.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[1rem]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-bold break-all text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {(f.pharmacy || f.pharmacyAddress) && (
            <div>
              {f.pharmacy && <p className="text-[1.1rem] font-bold text-ink-strong">{title(f.pharmacy)}</p>}
              {f.pharmacyAddress && <p className="text-[1rem]">{titleAddress(f.pharmacyAddress)}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {f.pharmacyPhone && <CallButton phone={f.pharmacyPhone} variant="glass">Call</CallButton>}
                {f.pharmacyAddress && (
                  <a href={`https://maps.apple.com/?q=${encodeURIComponent([f.pharmacy, f.pharmacyAddress].filter(Boolean).join(', '))}`} className={buttonClass('quiet')}>
                    <MapPin className="size-5" aria-hidden /> Map
                  </a>
                )}
              </div>
            </div>
          )}
          {confirmRemove ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="danger" onClick={onRemove}>
                Remove
              </Button>
              <Button variant="quiet" onClick={() => setConfirmRemove(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <button type="button" className="min-h-12 text-[1rem] font-bold text-ink-strong underline decoration-2 underline-offset-4" onClick={() => setConfirmRemove(true)}>
              Remove this medicine
            </button>
          )}
        </div>
      </details>

      <Spacer />
      <BottomBar>
        <Button onClick={onCheckPill} icon={<ScanSearch className="size-6" aria-hidden />}>
          Check a pill
        </Button>
      </BottomBar>
    </div>
  );
}
