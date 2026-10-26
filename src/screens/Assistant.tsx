import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChevronDown, CircleAlert, Info, Keyboard, MapPin, OctagonX, Phone, Search, Shield, Square, Store, TriangleAlert, Volume2 } from 'lucide-react';
import type { Medicine, Profile } from '../lib/store';
import { acceptOtcConsent, hasOtcConsent, telHref } from '../lib/store';
import { DISEASE_REPLY, NONE_REPLY, RX_REPLY, ageFrom, answer as answerFor, medicineText, shortSpoken, spokenAnswer, type Answer, type Suggestion } from '../lib/otc/assistant';
import { IDLE, TIMING, step, type Effect, type Event, type Phase, type Turn } from '../lib/voiceTurn';
import { canListen, listen, listensOnDevice, type Session } from '../lib/listen';
import { canSpeak, speakLines, stopSpeaking } from '../lib/speech';
import { plainLabel } from '../lib/plain';
import { DISPOSAL_NOTE, SPECIAL, STEPS, disposalActions, yesNo, type Action } from '../lib/disposal';
import Orb, { type OrbState } from '../components/Orb';
import { Button, CallButton, Card, buttonClass } from '../components/ui';

interface Props {
  profile: Profile;
  meds: Medicine[];
  rate: number;
  onLeave: () => void; // declined the consent
  onProfile: (focus?: 'police') => void;
}

const CHIPS: [string, string][] = [
  ['Headache', 'Headache'],
  ['Runny nose', 'Runny nose'],
  ['Heartburn', 'Heartburn'],
  ['Can’t sleep', 'Can’t sleep'],
  ['Old medicines', 'How do I get rid of old medicines?'],
];
const CARD_NOTE = 'Not medical advice. Follow the package label.';

/** Ask about a symptom: OTC suggestions from MediBro's own offline list.
    One tap to talk; it hears when you've finished, answers on screen and out loud
    (src/lib/voiceTurn.ts runs the turn). */
export default function Assistant({ profile, meds, rate, onLeave, onProfile }: Props) {
  const [consented, setConsented] = useState(hasOtcConsent);
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [heard, setHeard] = useState('');
  const [typing, setTyping] = useState(!canListen);
  const [info, setInfo] = useState(false);
  const [micError, setMicError] = useState('');
  const [confirmMaps, setConfirmMaps] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [followUp, setFollowUp] = useState(false);
  const turn = useRef<Turn>(IDLE);
  const session = useRef<Session | null>(null);
  const stopped = useRef<Promise<unknown>>(Promise.resolve()); // resolves once the microphone is fully off
  const level = useRef(0); // raw mic level, 0–1, read by the orb each frame
  const answerRef = useRef<HTMLDivElement>(null);
  const actions = useMemo(() => disposalActions(profile, Capacitor.isNativePlatform()), [profile]);

  const ctx = useMemo(() => ({ allergies: profile.allergies, medicines: meds.map(medicineText), names: meds.map((m) => plainLabel(m.fields, m.raw, 'en').name), age: ageFrom(profile.birthDate) }), [profile, meds]);
  const result: Answer | null = asked ? answerFor(asked, ctx) : null;

  // the latest versions, for effects that run after an await
  const latest = useRef({ ctx, actions, rate });
  latest.current = { ctx, actions, rate };

  const dispatch = (e: Event) => {
    const r = step(turn.current, e);
    turn.current = r.turn;
    setPhase(r.turn.phase);
    setFollowUp(r.turn.followUp);
    r.effects.forEach(runEffect);
  };
  const now = () => performance.now();

  function runEffect(fx: Effect) {
    switch (fx.type) {
      case 'listen': {
        stopSpeaking();
        setMicError('');
        setHeard('');
        level.current = 0;
        const s = listen(
          'en-US',
          (text) => (setHeard(text), dispatch({ type: 'partial', text, at: now() })),
          (v) => {
            level.current = v;
            // only matters once words have been heard; doesn't re-render
            if (v >= TIMING.quietLevel && turn.current.heard) turn.current = step(turn.current, { type: 'level', value: v, at: now() }).turn;
          },
        );
        session.current = s;
        stopped.current = s.done.catch(() => '');
        s.done.then(
          (text) => session.current === s && dispatch({ type: 'heard', text, at: now() }),
          (err: Error) => {
            if (session.current !== s) return;
            setMicError(err.message);
            setTyping(true);
            dispatch({ type: 'error', message: err.message });
          },
        );
        break;
      }
      case 'endListening':
        session.current?.stop();
        break;
      case 'cancelListening':
        session.current?.stop();
        session.current = null; // its words are dropped
        level.current = 0;
        break;
      case 'think':
        setTimeout(() => answerQuestion(fx.text, fx.followUp), TIMING.thinkMs);
        break;
      case 'speak':
        void speakAfterMic(fx.lines);
        break;
      case 'stopSpeaking':
        stopSpeaking();
        break;
    }
  }

  // never talk while the microphone is still on: it would hear itself
  async function speakAfterMic(lines: string[]) {
    await stopped.current;
    level.current = 0;
    if (!canSpeak) return dispatch({ type: 'spoken', at: now() });
    const mine = turn.current;
    speakLines(lines.map((text) => ({ text, lang: 'en' as const })), latest.current.rate, (i) => i === null && turn.current === mine && dispatch({ type: 'spoken', at: now() }));
  }

  function answerQuestion(text: string, isFollowUp: boolean) {
    setConfirmMaps(false);
    // the reply to "Do you want to call your police station?"
    if (isFollowUp) {
      const yn = yesNo(text);
      if (yn === 'no') return dispatch({ type: 'answered', lines: ['Okay.'], askAgain: false });
      if (yn === 'yes') {
        const police = latest.current.actions.find((a) => a.id === 'police');
        if (police) {
          window.location.href = police.href; // iOS still asks before calling
          return dispatch({ type: 'answered', lines: ['Calling your police station.'], askAgain: false });
        }
        setConfirmMaps(true);
        return dispatch({ type: 'answered', lines: ['I don’t have their number yet. Tap Find nearby police to search the map.'], askAgain: false });
      }
    }
    setQuery(text);
    setAsked(text);
    const a = answerFor(text, latest.current.ctx);
    dispatch({ type: 'answered', lines: shortSpoken(a), askAgain: a.kind === 'dispose' && canListen });
  }

  const ask = (q: string) => dispatch({ type: 'typed', text: q });
  const tapOrb = () => (canListen ? dispatch({ type: 'tap', at: now() }) : setTyping(true));

  // the clock for silence and timeouts, only while listening
  useEffect(() => {
    if (phase !== 'listening' && phase !== 'ending') return;
    const id = setInterval(() => dispatch({ type: 'tick', at: now() }), 100);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      session.current?.stop();
      stopSpeaking();
    },
    [],
  );
  // no auto-scroll: the orb stays in view so a tap can stop the speech; the answer appears under it

  const speaking = phase === 'speaking';
  const readAloud = () => {
    if (!result) return;
    if (speaking) return dispatch({ type: 'tap', at: now() });
    if (phase !== 'idle') return; // never over an open microphone
    // reading the full answer again: same path, so the orb and the tap-to-stop work
    turn.current = { ...turn.current, phase: 'thinking', followUp: false };
    dispatch({ type: 'answered', lines: spokenAnswer(result), askAgain: false });
  };

  if (!consented) return <Consent onAccept={() => (acceptOtcConsent(), setConsented(true))} onDecline={onLeave} />;

  const orbState: OrbState = phase === 'listening' || phase === 'ending' ? 'listening' : phase === 'thinking' ? 'thinking' : speaking ? 'speaking' : 'idle';
  const status = { idle: canListen ? 'Tap to talk' : 'Type your question', listening: followUp ? 'Listening… yes or no?' : 'Listening…', ending: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking… tap to stop' }[phase];
  const orbLabel = { idle: 'Start listening', listening: 'Listening. Tap to finish', ending: 'Finishing', thinking: 'Thinking', speaking: 'Stop speaking' }[phase];

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

      <div className="rise mt-3 flex flex-col items-center" style={{ '--i': 1 } as React.CSSProperties}>
        <Orb state={orbState} level={level} label={orbLabel} onPress={tapOrb} />
        <p className="mt-1 text-[1.2rem] font-bold text-ink-strong" aria-live="polite">
          {status}
        </p>
        {heard && <p className="mt-1 max-w-[26ch] text-center text-[1.1rem] text-ink">“{heard}”</p>}
        {micError && (
          <p role="alert" className="mt-2 text-center text-[1rem] font-bold text-stop">
            {micError}
          </p>
        )}

        <div className="mt-1 flex items-center gap-1">
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
            {CHIPS.map(([label, q]) => (
              <button key={label} type="button" onClick={() => ask(q)} className="btn btn-quiet min-h-12 rounded-full px-4 text-[1rem] font-semibold">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={answerRef} className="scroll-mt-20" aria-live="polite">
        {result && <AnswerView key={asked} result={result} profile={profile} speaking={speaking} onRead={canSpeak ? readAloud : undefined} onProfile={onProfile} actions={actions} confirmMaps={confirmMaps} />}
      </div>
    </div>
  );
}

function AnswerView({ result, profile, speaking, onRead, onProfile, actions: disposal, confirmMaps }: { result: Answer; profile: Profile; speaking: boolean; onRead?: () => void; onProfile: (focus?: 'police') => void; actions: Action[]; confirmMaps: boolean }) {
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

  if (result.kind === 'dispose') return <DisposalView saved={result.saved} actions={disposal} speaking={speaking} onRead={onRead} onSaveNumber={() => onProfile('police')} confirmMaps={confirmMaps} />;

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

function PharmacistButton({ profile, onProfile }: { profile: Profile; onProfile: (focus?: 'police') => void }) {
  if (telHref(profile.pharmacyPhone)) {
    return (
      <CallButton phone={profile.pharmacyPhone} variant="glass">
        Pharmacist
      </CallButton>
    );
  }
  return (
    <Button variant="quiet" onClick={() => onProfile()} icon={<Store className="size-5" aria-hidden />}>
      Pharmacy
    </Button>
  );
}

/** Old medicines: the FDA steps, and who to call. Never 911. */
function DisposalView({ saved, actions, speaking, onRead, onSaveNumber, confirmMaps }: { saved: { name: string; flush: boolean }[]; actions: Action[]; speaking: boolean; onRead?: () => void; onSaveNumber: () => void; confirmMaps: boolean }) {
  const [first, ...rest] = actions;
  const icon = (a: Action) => (a.id === 'find-police' ? <MapPin className="size-6" aria-hidden /> : a.id === 'takeback' ? <Search className="size-5" aria-hidden /> : a.id === 'police' ? <Shield className="size-6" aria-hidden /> : <Phone className="size-5" aria-hidden />);
  const external = (a: Action) => (a.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {});
  return (
    <div className="mt-8">
      <h2 className="headline text-[1.5rem]">Old medicines</h2>
      {saved.map((m) => (
        <p key={m.name} className={`mt-3 rounded-[14px] p-3.5 text-[1.05rem] font-bold ${m.flush ? 'bg-amber-wash text-amber' : 'bg-surface text-ink-strong'}`}>
          {m.flush ? `${m.name} is on the FDA flush list. Take-back is best; if none is open soon, you may flush it.` : `${m.name} isn’t on the flush list. Don’t flush it.`}
        </p>
      ))}
      <Card i={0} className="mt-4 p-5">
        <ol className="space-y-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="glyph size-8 text-[0.95rem] font-extrabold">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[1.15rem] font-extrabold text-ink-strong">{s.title}</h3>
                <ul className="mt-1 space-y-1 text-[1.02rem] text-ink-strong">
                  {s.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <details className="group mt-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[1rem] font-bold text-accent-deep">
            Patches, inhalers, needles
            <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-2 pb-1 text-[1rem]">
            {SPECIAL.map((x) => (
              <li key={x.item}>
                <b>{x.item}:</b> {x.how}
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-2 text-[0.95rem] text-muted">{DISPOSAL_NOTE}</p>
      </Card>

      <div className="mt-5 space-y-2.5">
        <a href={first.href} {...external(first)} className={buttonClass('primary', `min-h-16 text-[1.15rem] ${confirmMaps && first.id === 'find-police' ? 'is-on' : ''}`)}>
          {icon(first)} {first.id === 'police' ? 'Call police station' : first.label}
        </a>
        {first.id === 'find-police' && (
          <button type="button" onClick={onSaveNumber} className="min-h-12 w-full text-[1rem] font-bold text-ink-strong underline decoration-2 underline-offset-4">
            Save their number
          </button>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {rest.map((a) => (
            <a key={a.id} href={a.href} {...external(a)} aria-label={a.label} className={buttonClass(a.id === 'pharmacy' ? 'glass' : 'quiet', 'px-3 text-[1rem]')}>
              {icon(a)} {a.id === 'pharmacy' ? 'Call pharmacy' : 'Take-back sites'}
            </a>
          ))}
          {onRead && (
            <Button variant="quiet" className={`${rest.length % 2 ? '' : 'col-span-2'} ${speaking ? 'is-on' : ''}`} onClick={onRead} icon={speaking ? <Square className="size-4 fill-current" aria-hidden /> : <Volume2 className="size-6" aria-hidden />}>
              {speaking ? 'Stop' : 'Listen'}
            </Button>
          )}
        </div>
      </div>
    </div>
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
