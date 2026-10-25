import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Check, CircleAlert, Mic, MicOff, OctagonX, Phone, Search, ShieldAlert, Square, Store, TriangleAlert, Volume2 } from 'lucide-react';
import type { Medicine, Profile } from '../lib/store';
import { acceptOtcConsent, hasOtcConsent, telHref } from '../lib/store';
import { DISCLAIMER, DISEASE_REPLY, NONE_REPLY, RX_REPLY, ageFrom, answer as answerFor, medicineText, spokenAnswer, type Answer, type Suggestion } from '../lib/otc/assistant';
import { LABEL_REMINDER } from '../lib/otc/otc-data';
import { canListen, listen, listensOnDevice, type Session } from '../lib/listen';
import { canSpeak, speakLines, stopSpeaking } from '../lib/speech';
import { Button, CallButton, Card, PageTitle, buttonClass } from '../components/ui';

interface Props {
  profile: Profile;
  meds: Medicine[];
  rate: number;
  onLeave: () => void; // declined the consent
  onProfile: () => void;
}

const EXAMPLES = ['Headache', 'Runny nose', 'Heartburn', 'Can’t sleep', 'Cough', 'Bug bite'];

/** Ask about a symptom: OTC suggestions from ReadRx's own offline list. */
export default function Assistant({ profile, meds, rate, onLeave, onProfile }: Props) {
  const [consented, setConsented] = useState(hasOtcConsent);
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const session = useRef<Session | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  const ctx = useMemo(() => ({ allergies: profile.allergies, medicines: meds.map(medicineText), age: ageFrom(profile.birthDate) }), [profile, meds]);
  const result: Answer | null = asked ? answerFor(asked, ctx) : null;

  useEffect(() => () => (session.current?.stop(), stopSpeaking()), []);
  useEffect(() => {
    if (asked) answerRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [asked]);

  const ask = (q: string) => {
    stopSpeaking();
    setSpeaking(false);
    setQuery(q);
    setAsked(q.trim());
  };

  const toggleMic = () => {
    if (listening) return session.current?.stop();
    setMicError('');
    setHeard('');
    stopSpeaking();
    const s = listen('en-US', setHeard);
    session.current = s;
    setListening(true);
    s.done
      .then((text) => text.trim() && ask(text))
      .catch((e: Error) => setMicError(e.message))
      .finally(() => setListening(false));
  };

  const readAloud = () => {
    if (!result) return;
    if (speaking) return (stopSpeaking(), setSpeaking(false));
    setSpeaking(true);
    speakLines(spokenAnswer(result).map((text) => ({ text, lang: 'en' as const })), rate, (i) => i === null && setSpeaking(false));
  };

  if (!consented) return <Consent onAccept={() => (acceptOtcConsent(), setConsented(true))} onDecline={onLeave} />;

  return (
    <div className="flex min-h-full flex-1 flex-col pb-8">
      <PageTitle sub="Say or type a symptom. ReadRx suggests over-the-counter medicines from its own list, on this phone.">Ask about a symptom</PageTitle>

      {/* persistent banner */}
      <div role="note" className="rise mt-3 flex gap-2.5 rounded-[14px] bg-amber-wash p-3.5 text-[1rem] text-amber shadow-[inset_0_0_0_1px_rgba(125,60,6,.45)]" style={{ '--i': 1 } as React.CSSProperties}>
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          <b>Not medical advice.</b> Over-the-counter symptom relief only. It doesn’t diagnose or treat disease. <b>In an emergency, call 911.</b>
        </p>
      </div>

      <Card i={2} className="mt-4 p-4">
        {canListen && (
          <div className="flex flex-col items-center pt-1 pb-3">
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Ask with your voice'}
              className={`btn relative size-24 rounded-full p-0 ${listening ? '' : 'btn-primary'}`}
            >
              {listening && <span className="pulse absolute inset-0 rounded-full shadow-[0_0_0_6px_rgba(var(--accent-rgb),.35)]" aria-hidden />}
              {listening ? <MicOff className="size-10" aria-hidden /> : <Mic className="size-10" aria-hidden />}
            </button>
            <p className="mt-2.5 text-[1.05rem] font-bold text-ink-strong" aria-live="polite">
              {listening ? 'Listening… tap to stop' : 'Tap to ask out loud'}
            </p>
            {heard && <p className="mt-1 text-center text-[1rem] text-muted">“{heard}”</p>}
            {micError && (
              <p role="alert" className="mt-2 text-center text-[1rem] font-bold text-stop">
                {micError}
              </p>
            )}
            {!listensOnDevice && <p className="mt-1 text-center text-[0.9rem] text-muted">In a web browser, the browser may send your voice to its own servers. Typing stays on this device.</p>}
          </div>
        )}
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
          <input id="otc-q" className="input" value={query} placeholder="For example: runny nose" enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className="btn btn-glass btn-sm shrink-0 gap-1.5" disabled={!query.trim()}>
            <Search className="size-5" aria-hidden /> Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => ask(ex)} className="btn btn-quiet min-h-12 rounded-full px-4 text-[1rem] font-semibold">
              {ex}
            </button>
          ))}
        </div>
      </Card>

      <div ref={answerRef} className="scroll-mt-24" aria-live="polite">
        {result && (
          <AnswerView key={asked} result={result} asked={asked} profile={profile} speaking={speaking} onRead={canSpeak ? readAloud : undefined} onProfile={onProfile} />
        )}
      </div>
    </div>
  );
}

function AnswerView({ result, asked, profile, speaking, onRead, onProfile }: { result: Answer; asked: string; profile: Profile; speaking: boolean; onRead?: () => void; onProfile: () => void }) {
  const footer = (
    <>
      {onRead && (
        <Button className={`mt-4 ${speaking ? 'is-on' : ''}`} variant="glass" onClick={onRead} icon={speaking ? <Square className="size-4 fill-current" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}>
          {speaking ? 'Stop reading' : 'Read the answer aloud'}
        </Button>
      )}
      <PharmacistButton profile={profile} onProfile={onProfile} />
    </>
  );

  if (result.kind === 'emergency') {
    return (
      <div className="mt-4 space-y-3">
        {result.flags.map((f) => (
          <section key={f.id} role="alert" className="verdict verdict-stop sheet-in p-4">
            <p className="headline flex items-center gap-2 text-[1.35rem] !text-stop">
              <OctagonX className="size-7 shrink-0" aria-hidden /> {f.title}
            </p>
            <p className="mt-2 text-[1.1rem] font-bold text-ink-strong">{f.message}</p>
            <div className="mt-3 space-y-2.5">
              {f.calls.map((c, i) => (
                <a key={c.number} href={`tel:${c.number}`} className={buttonClass(i === 0 ? 'danger' : 'quiet', 'min-h-16 text-[1.2rem]')}>
                  <Phone className="size-6" aria-hidden /> {c.label}
                </a>
              ))}
            </div>
            <p className="mt-3 text-[0.95rem] text-ink">ReadRx doesn’t suggest medicines when you mention signs like these.</p>
          </section>
        ))}
        {onRead && (
          <Button variant="glass" onClick={onRead} icon={<Volume2 className="size-5" aria-hidden />}>
            {speaking ? 'Stop reading' : 'Read this aloud'}
          </Button>
        )}
      </div>
    );
  }

  if (result.kind !== 'suggest') {
    const text = result.kind === 'rx' ? RX_REPLY : result.kind === 'disease' ? DISEASE_REPLY : NONE_REPLY;
    return (
      <Card i={0} className="mt-4 p-4" aria-label="Answer">
        <p className="flex gap-2.5 text-[1.1rem] font-bold text-ink-strong">
          <CircleAlert className="mt-0.5 size-6 shrink-0 text-accent-deep" aria-hidden /> {text}
        </p>
        <DisclaimerLine />
        {footer}
      </Card>
    );
  }

  return (
    <div className="mt-5">
      <h2 className="headline text-[1.4rem]">
        For {result.symptoms.map((s) => s.label.toLowerCase()).join(' and ')}
      </h2>
      <p className="mt-0.5 text-[0.95rem] text-ink-strong">You asked: “{asked}”</p>

      {result.notes.map((n) => (
        <p key={n} className="mt-3 flex gap-2.5 rounded-[14px] bg-amber-wash p-3.5 text-[1rem] font-bold text-amber shadow-[inset_0_0_0_1px_currentColor]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {n}
        </p>
      ))}

      <div className="mt-3 space-y-3">
        {result.suggestions.map((s, i) => (
          <SuggestionCard key={s.ingredient.id} s={s} i={i} />
        ))}
      </div>

      {result.leftOut.length > 0 && (
        <Card i={1} className="mt-3 p-4">
          <h3 className="text-[1.05rem] font-extrabold text-ink-strong">Left out because of your allergies</h3>
          <ul className="mt-2 space-y-1.5 text-[1rem]">
            {result.leftOut.map((l) => (
              <li key={l.ingredient.id} className="flex gap-2">
                <OctagonX className="mt-0.5 size-5 shrink-0 text-stop" aria-hidden />
                <span>
                  <b>{l.ingredient.name}.</b> {l.reason}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card i={2} className="mt-3 p-4">
        <h3 className="text-[1.05rem] font-extrabold text-ink-strong">Check with your pharmacist first if</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[1rem]">
          {result.checkFirst.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Card>

      {result.symptoms.map((s) => (
        <Card key={s.id} i={3} className="mt-3 p-4">
          <h3 className="text-[1.05rem] font-extrabold text-ink-strong">{s.label}: things that help</h3>
          <p className="mt-1 text-[1rem]">{s.selfCare}</p>
          <p className="mt-2 rounded-[12px] bg-surface p-3 text-[1rem]">
            <b>Get help:</b> {s.seeDoctor}
          </p>
        </Card>
      ))}

      <Card i={4} className="mt-3 p-4">
        <DisclaimerLine first />
        {footer}
      </Card>
    </div>
  );
}

function SuggestionCard({ s, i }: { s: Suggestion; i: number }) {
  const ing = s.ingredient;
  const stop = s.warnings.some((w) => w.level === 'stop');
  return (
    <Card as="article" i={i} className="p-4" aria-label={ing.name}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="headline text-[1.3rem]">{ing.name}</h3>
        {ing.form && <span className="text-[0.95rem] text-muted">{ing.form}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2.5 py-0.5 text-[0.9rem] font-bold text-accent-deep shadow-[inset_0_0_0_1px_var(--tint-ring)] [background:var(--tint),var(--color-card)]">Over the counter</span>
        {ing.behindCounter && <span className="rounded-full bg-surface px-2.5 py-0.5 text-[0.9rem] font-bold text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]">Ask at the pharmacy counter</span>}
      </div>
      <p className="mt-2 text-[1rem] text-muted">
        Examples: <span className="font-bold text-ink">{ing.brands.join(', ')}</span>
      </p>
      <p className="mt-2 text-[1.05rem] text-ink-strong">{ing.helps}</p>

      {s.warnings.map((w) => (
        <p key={w.text} className={`mt-3 flex gap-2.5 rounded-[14px] p-3 text-[1rem] font-bold shadow-[inset_0_0_0_1px_currentColor] ${w.level === 'stop' ? 'bg-stop-wash text-stop' : 'bg-amber-wash text-amber'}`}>
          {w.level === 'stop' ? <OctagonX className="mt-0.5 size-5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />}
          <span>
            <span className="sr-only">{w.level === 'stop' ? 'Warning: ' : 'Caution: '}</span>
            {w.text}
          </span>
        </p>
      ))}

      <h4 className="mt-3 text-[0.95rem] font-bold text-muted">Cautions</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[1rem]">
        {ing.cautions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-3 flex gap-2 border-t border-divider pt-3 text-[1rem] font-bold text-ink-strong">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-accent-deep" aria-hidden /> {LABEL_REMINDER} Read the Drug Facts label.
      </p>
      <p className="mt-1.5 text-[0.9rem] text-muted">
        {stop ? 'Don’t use this until you’ve asked your pharmacist. ' : ''}Not medical advice. Doesn’t treat any disease.
      </p>
    </Card>
  );
}

function DisclaimerLine({ first }: { first?: boolean }) {
  return (
    <p className={`flex gap-2 text-[0.95rem] text-ink ${first ? '' : 'mt-3 border-t border-divider pt-3'}`}>
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden /> {DISCLAIMER}
    </p>
  );
}

function PharmacistButton({ profile, onProfile }: { profile: Profile; onProfile: () => void }) {
  if (telHref(profile.pharmacyPhone)) {
    return (
      <CallButton phone={profile.pharmacyPhone} className="mt-2.5">
        Talk to your pharmacist{profile.pharmacyName ? ` at ${profile.pharmacyName}` : ''}
      </CallButton>
    );
  }
  return (
    <Button variant="quiet" className="mt-2.5" onClick={onProfile} icon={<Store className="size-5" aria-hidden />}>
      Add your pharmacy’s phone to call them
    </Button>
  );
}

/** Must be accepted once before the assistant can be used. */
function Consent({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [checked, setChecked] = useState(false);
  const points = [
    'This is not medical advice, and it is not a doctor or pharmacist.',
    'It does not diagnose, treat, cure or prevent any disease.',
    'It only suggests over-the-counter medicines for short-term relief of everyday symptoms. It never suggests prescription medicines.',
    'Always read and follow the Drug Facts label on the package.',
    'Ask your pharmacist or doctor before taking anything new, especially if you take other medicines, are pregnant or breastfeeding, or have a health condition.',
    'In an emergency, call 911. It can’t help in an emergency.',
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col pb-6">
      <PageTitle sub="Please read this before you use the symptom assistant.">Before you ask</PageTitle>
      <Card i={1} className="mt-4 p-4" role="dialog" aria-labelledby="consent-title">
        <h2 id="consent-title" className="flex items-center gap-2.5 text-[1.15rem] font-extrabold text-ink-strong">
          <ShieldAlert className="size-6 shrink-0 text-amber" aria-hidden /> Important
        </h2>
        <ul className="mt-3 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[1.05rem] text-ink-strong">
              <Check className="mt-1 size-5 shrink-0 text-accent-deep" aria-hidden /> {p}
            </li>
          ))}
        </ul>
        <label className="mt-4 flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] bg-surface p-3 text-[1.05rem] font-bold text-ink-strong">
          <input type="checkbox" className="size-7 shrink-0 accent-[var(--accent-deep)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I understand this is not medical advice.
        </label>
      </Card>
      <div className="mt-4 space-y-2.5">
        <Button disabled={!checked} onClick={onAccept}>
          I agree, continue
        </Button>
        <Button variant="quiet" onClick={onDecline}>
          Not now
        </Button>
      </div>
    </div>
  );
}
