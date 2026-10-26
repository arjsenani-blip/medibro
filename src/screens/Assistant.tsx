import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, CircleAlert, Info, Keyboard, OctagonX, Phone, Search, Square, Store, TriangleAlert, Volume2 } from 'lucide-react';
import type { Medicine, Profile } from '../lib/store';
import { acceptOtcConsent, hasOtcConsent, telHref } from '../lib/store';
import { DISEASE_REPLY, NONE_REPLY, RX_REPLY, ageFrom, answer as answerFor, medicineText, spokenAnswer, type Answer, type Suggestion } from '../lib/otc/assistant';
import { canListen, listen, listensOnDevice, type Session } from '../lib/listen';
import { canSpeak, speakLines, stopSpeaking } from '../lib/speech';
import Orb, { type OrbState } from '../components/Orb';
import { Button, CallButton, Card, buttonClass } from '../components/ui';

interface Props {
  profile: Profile;
  meds: Medicine[];
  rate: number;
  onLeave: () => void; // declined the consent
  onProfile: () => void;
}

const CHIPS = ['Headache', 'Runny nose', 'Heartburn', 'Can’t sleep'];
const CARD_NOTE = 'Not medical advice. Follow the package label.';

/** Ask about a symptom: OTC suggestions from ReadRx's own offline list. */
export default function Assistant({ profile, meds, rate, onLeave, onProfile }: Props) {
  const [consented, setConsented] = useState(hasOtcConsent);
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState(!canListen);
  const [info, setInfo] = useState(false);
  const [micError, setMicError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const session = useRef<Session | null>(null);
  const level = useRef(0); // raw mic level, 0–1, read by the orb each frame
  const answerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ctx = useMemo(() => ({ allergies: profile.allergies, medicines: meds.map(medicineText), age: ageFrom(profile.birthDate) }), [profile, meds]);
  const result: Answer | null = asked ? answerFor(asked, ctx) : null;

  useEffect(() => () => (session.current?.stop(), stopSpeaking(), clearTimeout(timer.current)), []);
  useEffect(() => {
    if (asked) answerRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [asked]);

  const ask = (q: string) => {
    if (!q.trim()) return;
    stopSpeaking();
    setSpeaking(false);
    setQuery(q);
    setAsked('');
    setThinking(true);
    clearTimeout(timer.current);
    // a short beat so the orb shows it's working; the answer itself is instant
    timer.current = setTimeout(() => (setThinking(false), setAsked(q.trim())), 450);
  };

  const toggleMic = () => {
    if (!canListen) return setTyping(true);
    if (listening) return session.current?.stop();
    setMicError('');
    setHeard('');
    stopSpeaking();
    level.current = 0;
    const s = listen('en-US', setHeard, (v) => (level.current = v));
    session.current = s;
    setListening(true);
    s.done
      .then((text) => text.trim() && ask(text))
      .catch((e: Error) => (setMicError(e.message), setTyping(true)))
      .finally(() => {
        level.current = 0;
        setListening(false);
      });
  };

  const readAloud = () => {
    if (!result) return;
    if (speaking) return (stopSpeaking(), setSpeaking(false));
    setSpeaking(true);
    speakLines(spokenAnswer(result).map((text) => ({ text, lang: 'en' as const })), rate, (i) => i === null && setSpeaking(false));
  };

  if (!consented) return <Consent onAccept={() => (acceptOtcConsent(), setConsented(true))} onDecline={onLeave} />;

  const orbState: OrbState = listening ? 'listening' : thinking || speaking ? 'thinking' : 'idle';
  const status = listening ? 'Listening… tap to stop' : thinking ? 'Thinking…' : canListen ? 'Tap to talk' : 'Type your question';

  return (
    <div className="flex min-h-full flex-1 flex-col pb-8">
      <p className="rise mt-1 flex flex-wrap items-center justify-center gap-x-2 text-center text-[0.95rem] text-ink-strong">
        <span>Not medical advice · OTC relief only</span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          Emergency?
          {/* on its own wash: red text on the gradient alone would be under 7:1 */}
          <a href="tel:911" className="inline-flex min-h-12 items-center">
            <span className="rounded-full bg-stop-wash px-3 py-1 font-bold text-stop">Call 911</span>
          </a>
        </span>
      </p>

      <div className="rise mt-6 flex flex-col items-center" style={{ '--i': 1 } as React.CSSProperties}>
        <Orb state={orbState} level={level} label={listening ? 'Stop listening' : 'Start listening'} onPress={toggleMic} />
        <p className="mt-8 text-[1.2rem] font-bold text-ink-strong" aria-live="polite">
          {status}
        </p>
        {heard && <p className="mt-1 max-w-[26ch] text-center text-[1.1rem] text-ink">“{heard}”</p>}
        {micError && (
          <p role="alert" className="mt-2 text-center text-[1rem] font-bold text-stop">
            {micError}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1">
          {canListen && !typing && (
            <button type="button" onClick={() => setTyping(true)} className="flex min-h-12 items-center gap-2 px-3 text-[1.05rem] font-bold text-accent-deep">
              <Keyboard className="size-5" aria-hidden /> Type instead
            </button>
          )}
          {canListen && !listensOnDevice && (
            <button type="button" onClick={() => setInfo(!info)} aria-expanded={info} aria-label="About voice in the browser" className="grid size-12 place-items-center rounded-full text-muted">
              <Info className="size-5" aria-hidden />
            </button>
          )}
        </div>
        {info && <p className="card-sm fade-in max-w-[30ch] p-3 text-center text-[0.95rem]">In a web browser, your voice may be sent to the browser’s servers. Typing stays on this device.</p>}
      </div>

      {typing && (
        <div className="fade-in mt-4">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              ask(query);
            }}
            className="flex gap-2"
          >
            <label className="sr-only" htmlFor="otc-q">
              Type a symptom
            </label>
            <input id="otc-q" className="input min-h-14 text-[1.1rem]" value={query} placeholder="A symptom" enterKeyHint="search" autoFocus={canListen} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-icon min-h-14 min-w-14 shrink-0" disabled={!query.trim()} aria-label="Ask">
              <Search className="size-6" aria-hidden />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => ask(c)} className="btn btn-quiet min-h-12 rounded-full px-4 text-[1rem] font-semibold">
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={answerRef} className="scroll-mt-20" aria-live="polite">
        {result && <AnswerView key={asked} result={result} profile={profile} speaking={speaking} onRead={canSpeak ? readAloud : undefined} onProfile={onProfile} />}
      </div>
    </div>
  );
}

function AnswerView({ result, profile, speaking, onRead, onProfile }: { result: Answer; profile: Profile; speaking: boolean; onRead?: () => void; onProfile: () => void }) {
  const actions = (
    <div className="mt-5 grid grid-cols-2 gap-2.5">
      {onRead ? (
        <Button variant="glass" className={speaking ? 'is-on' : ''} onClick={onRead} icon={speaking ? <Square className="size-4 fill-current" aria-hidden /> : <Volume2 className="size-6" aria-hidden />}>
          {speaking ? 'Stop' : 'Listen'}
        </Button>
      ) : (
        <span />
      )}
      <PharmacistButton profile={profile} onProfile={onProfile} />
    </div>
  );

  // emergencies stay big and loud
  if (result.kind === 'emergency') {
    return (
      <div className="mt-6 space-y-3">
        {result.flags.map((f) => (
          <section key={f.id} role="alert" className="verdict verdict-stop sheet-in p-5">
            <p className="headline flex items-center gap-2 text-[1.4rem] !text-stop">
              <OctagonX className="size-7 shrink-0" aria-hidden /> {f.title}
            </p>
            <p className="mt-2 text-[1.1rem] font-bold text-ink-strong">{f.message}</p>
            <div className="mt-4 space-y-2.5">
              {f.calls.map((c, i) => (
                <a key={c.number} href={`tel:${c.number}`} className={buttonClass(i === 0 ? 'danger' : 'quiet', 'min-h-16 text-[1.2rem]')}>
                  <Phone className="size-6" aria-hidden /> {c.label}
                </a>
              ))}
            </div>
          </section>
        ))}
        {onRead && (
          <Button variant="quiet" onClick={onRead} icon={<Volume2 className="size-6" aria-hidden />}>
            {speaking ? 'Stop' : 'Listen'}
          </Button>
        )}
      </div>
    );
  }

  if (result.kind !== 'suggest') {
    const text = result.kind === 'rx' ? RX_REPLY : result.kind === 'disease' ? DISEASE_REPLY : NONE_REPLY;
    return (
      <Card i={0} className="mt-6 p-5" aria-label="Answer">
        <p className="flex gap-2.5 text-[1.1rem] font-bold text-ink-strong">
          <CircleAlert className="mt-0.5 size-6 shrink-0 text-accent-deep" aria-hidden /> {text}
        </p>
        {actions}
      </Card>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="headline text-[1.5rem]">{result.symptoms.map((s) => s.label).join(' · ')}</h2>

      {result.notes.map((n) => (
        <p key={n} className="mt-3 flex gap-2.5 rounded-[14px] bg-amber-wash p-3.5 text-[1rem] font-bold text-amber">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {n}
        </p>
      ))}

      <div className="mt-4 space-y-3">
        {result.suggestions.map((s, i) => (
          <SuggestionCard key={s.ingredient.id} s={s} i={i} />
        ))}
      </div>

      {result.leftOut.length > 0 && (
        <p className="mt-4 flex gap-2 text-[1rem] text-ink-strong">
          <OctagonX className="mt-0.5 size-5 shrink-0 text-stop" aria-hidden />
          <span>
            <b>Left out (allergy):</b> {result.leftOut.map((l) => l.ingredient.name).join(', ')}
          </span>
        </p>
      )}

      <div className="mt-5 space-y-1">
        <Fold title="Ask a pharmacist first if">
          <ul className="list-disc space-y-1 pl-5">
            {result.checkFirst.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Fold>
        {result.symptoms.map((s) => (
          <Fold key={s.id} title={`Tips: ${s.label.toLowerCase()}`}>
            <p>{s.selfCare}</p>
            <p className="mt-2 font-bold">{s.seeDoctor}</p>
          </Fold>
        ))}
      </div>

      {actions}
    </div>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[1.05rem] font-bold text-ink-strong">
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-3 text-[1rem] text-ink-strong">{children}</div>
    </details>
  );
}

function SuggestionCard({ s, i }: { s: Suggestion; i: number }) {
  const ing = s.ingredient;
  return (
    <Card as="article" i={i} className="p-5" aria-label={ing.name}>
      <h3 className="headline text-[1.4rem]">{ing.name}</h3>
      <p className="mt-1 text-[1rem] text-muted">
        {ing.brands.join(', ')}
        {ing.form ? ` · ${ing.form}` : ''}
        {ing.behindCounter ? ' · ask at the counter' : ''}
      </p>
      <p className="mt-3 text-[1.05rem] text-ink-strong">{ing.helps}</p>

      {s.warnings.map((w) => (
        <p key={w.text} className={`mt-3 flex gap-2.5 rounded-[14px] p-3 text-[1rem] font-bold ${w.level === 'stop' ? 'bg-stop-wash text-stop' : 'bg-amber-wash text-amber'}`}>
          {w.level === 'stop' ? <OctagonX className="mt-0.5 size-5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />}
          <span>
            <span className="sr-only">{w.level === 'stop' ? 'Warning: ' : 'Caution: '}</span>
            {w.text}
          </span>
        </p>
      ))}

      <details className="group mt-2">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[1rem] font-bold text-accent-deep">
          Cautions
          <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="list-disc space-y-1 pb-1 pl-5 text-[1rem]">
          {ing.cautions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>
      <p className="mt-1 text-[0.95rem] text-muted">{CARD_NOTE}</p>
    </Card>
  );
}

function PharmacistButton({ profile, onProfile }: { profile: Profile; onProfile: () => void }) {
  if (telHref(profile.pharmacyPhone)) {
    return (
      <CallButton phone={profile.pharmacyPhone} variant="glass">
        Pharmacist
      </CallButton>
    );
  }
  return (
    <Button variant="quiet" onClick={onProfile} icon={<Store className="size-5" aria-hidden />}>
      Pharmacy
    </Button>
  );
}

/** Must be accepted once before the assistant can be used. */
function Consent({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const points = ['Not medical advice. It doesn’t diagnose or treat disease.', 'Over-the-counter symptom relief only.', 'Always follow the Drug Facts label.', 'Ask your pharmacist or doctor. Emergency? Call 911.'];
  return (
    <div className="flex min-h-full flex-1 flex-col pb-6" role="dialog" aria-labelledby="consent-title">
      <h1 id="consent-title" className="headline rise mt-6 text-[2rem]">
        Before you ask
      </h1>
      <ul className="rise mt-6 space-y-4" style={{ '--i': 1 } as React.CSSProperties}>
        {points.map((p, i) => (
          <li key={p} className="flex gap-3 text-[1.15rem] leading-snug text-ink-strong">
            <span className="glyph size-8 text-[0.95rem] font-extrabold">{i + 1}</span>
            {p}
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      <div className="safe-bottom mt-8 space-y-1">
        <Button onClick={onAccept} className="min-h-16 text-[1.2rem]">
          I understand
        </Button>
        <button type="button" onClick={onDecline} className="min-h-12 w-full text-[1.05rem] font-bold text-ink-strong">
          Not now
        </button>
      </div>
    </div>
  );
}
