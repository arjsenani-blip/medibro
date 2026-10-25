import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, CircleHelp, LoaderCircle, OctagonX, X } from 'lucide-react';
import type { Medicine } from '../lib/store';
import { appearanceFromDescription, compareColor, compareShape, type Appearance, type ColorName, type Match } from '../lib/appearance';
import { lookupAppearance, type FdaResult } from '../lib/fda';
import { analyzePhoto, type PillError, type PillReading } from '../lib/pillImage';
import { plainLabel } from '../lib/plain';
import { CallButton, Card, PageTitle, PhotoButton } from '../components/ui';

const SWATCH: Record<ColorName, string> = {
  white: '#f7f7f5', yellow: '#f2d35c', orange: '#ee9440', pink: '#f0a5b9', red: '#c8352e', purple: '#8b5fbf',
  blue: '#4c7fd0', green: '#4f9a5c', brown: '#8a5a3b', gray: '#9aa1a6', black: '#222',
};
const SHAPE_WORD = { round: 'round', oval: 'oval', oblong: 'long and narrow', capsule: 'capsule-shaped', other: 'an unusual shape' } as const;
const shapeLine = (shape: keyof typeof SHAPE_WORD) => (shape === 'other' ? 'Has an unusual shape' : `Looks ${SHAPE_WORD[shape]}`);

const READ_ERROR: Record<PillError, string> = {
  'no-pill': 'ReadRx couldn’t find a pill in the photo. Put the pill in the middle and move the camera closer.',
  'too-big': 'The pill fills the whole photo. Move the camera back a little so the background shows around it.',
  'busy-background': 'The background is too busy. Put the pill on a plain, dark surface like a dark towel or table.',
};

type Imprint = 'yes' | 'no' | 'unsure' | null;

function Swatch({ color }: { color: ColorName }) {
  return <span className="inline-block size-5 rounded-full align-[-0.2em] ring-1 ring-ink/25" style={{ background: SWATCH[color] }} aria-hidden />;
}

function Mark({ m }: { m: Match }) {
  // an icon and a word, so the result never depends on color
  if (m === 'match')
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok-wash px-2.5 py-1 text-[0.95rem] font-bold text-ok shadow-[inset_0_0_0_1px_currentColor]">
        <Check className="size-5" aria-hidden /> Matches
      </span>
    );
  if (m === 'mismatch')
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-stop-wash px-2.5 py-1 text-[0.95rem] font-bold text-stop shadow-[inset_0_0_0_1px_currentColor]">
        <X className="size-5" aria-hidden /> Doesn’t match
      </span>
    );
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[0.95rem] font-bold text-muted shadow-[inset_0_0_0_1px_currentColor]">
      <CircleHelp className="size-5" aria-hidden /> Close
    </span>
  );
}

export default function PillCheck({ med }: { med: Medicine }) {
  const f = med.fields;
  const name = plainLabel(f, med.raw, 'en').name;
  const fromLabel = useMemo(() => (f.appearance ? appearanceFromDescription(f.appearance) : null), [f.appearance]);
  const [fda, setFda] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; result?: FdaResult | null; message?: string }>({ status: 'idle' });
  const [reading, setReading] = useState<PillReading | PillError | null>(null);
  const [busy, setBusy] = useState(false);
  const [imprint, setImprint] = useState<Imprint>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [photo, setPhoto] = useState('');

  // what the pill should look like: the pharmacy's own description first, else the FDA label
  useEffect(() => {
    if (fromLabel || !f.drug) return;
    const ctrl = new AbortController();
    setFda({ status: 'loading' });
    lookupAppearance({ drug: f.drug, strength: f.strength, ndc: f.ndc, manufacturer: f.manufacturer }, ctrl.signal).then(
      (result) => setFda({ status: 'done', result }),
      (e: Error) => !ctrl.signal.aborted && setFda({ status: 'error', message: e.message }),
    );
    return () => ctrl.abort();
  }, [fromLabel, f.drug, f.strength, f.ndc, f.manufacturer]);

  const expected: Appearance[] = fromLabel ? [fromLabel] : (fda.result?.appearances ?? []);
  const source = fromLabel ? 'your pharmacy label' : fda.result ? `the FDA drug label${fda.result.manufacturer ? ` (${fda.result.manufacturer})` : ''}` : '';

  const onPhoto = async (file: File) => {
    setBusy(true);
    setImprint(null);
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    try {
      setReading(await analyzePhoto(file));
    } finally {
      setBusy(false);
    }
  };

  // compare the photo with every possible appearance; keep the closest
  const score = (m: Match) => (m === 'match' ? 2 : m === 'close' ? 1 : 0);
  const compared =
    reading && typeof reading === 'object'
      ? expected
          .map((a) => ({ a, color: compareColor(reading.color, a.colors), shape: compareShape(reading.shape, a.shape) }))
          .sort((x, y) => score(y.color) + score(y.shape) - (score(x.color) + score(x.shape)))
      : [];
  const best = compared[0];
  const imprints = [...new Set(compared.filter((c) => c.color !== 'mismatch' && c.shape !== 'mismatch' && c.a.imprint).map((c) => c.a.imprint!))];

  let verdict: 'ok' | 'stop' | 'unsure' | 'partial' | null = null;
  if (best) {
    if (best.color === 'mismatch' || best.shape === 'mismatch' || imprint === 'no') verdict = 'stop';
    else if (imprints.length === 0) verdict = 'partial';
    else if (imprint === 'yes') verdict = 'ok';
    else if (imprint === 'unsure') verdict = 'unsure';
  }

  const call = f.pharmacyPhone ? (
    <CallButton phone={f.pharmacyPhone} className="mt-3">
      Call your pharmacy
    </CallButton>
  ) : null;

  return (
    <div className="flex min-h-full flex-col pb-8">
      <PageTitle sub={name}>Check a pill</PageTitle>

      {/* 1. What it should look like */}
      <Card i={1} className="mt-4 p-4" aria-labelledby="should">
        <h2 id="should" className="headline text-[1.2rem]">
          It should look like
        </h2>
        {fda.status === 'loading' && (
          <p className="mt-2 flex items-center gap-2 text-[1rem] text-muted">
            <LoaderCircle className="size-5 animate-spin" aria-hidden /> Looking it up in the FDA drug database…
          </p>
        )}
        {expected.length > 0 && (
          <>
            {expected.length > 1 && <p className="mt-1 text-[1rem] text-muted">This medicine looks different depending on who made it. Yours should match one of these.</p>}
            <ul className="mt-2 divide-y divide-divider">
              {expected.map((a, i) => (
                <li key={i} className="py-2.5">
                  <p className="flex flex-wrap items-center gap-x-2 text-[1.15rem] font-bold">
                    {a.colors.map((c) => (
                      <Swatch key={c} color={c} />
                    ))}
                    <span>{[a.colors.join(' or '), a.shape ? (a.shape === 'other' ? 'unusual shape' : SHAPE_WORD[a.shape]) : ''].filter(Boolean).join(', ') || 'Appearance not listed'}</span>
                  </p>
                  {a.imprint && (
                    <p className="mt-1 text-[1rem]">
                      Stamped <span className="rounded-lg bg-surface px-2 py-0.5 shadow-[inset_0_0_0_1px_var(--color-rule)] text-[1.15rem] font-extrabold tracking-wider">{a.imprint}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[0.9rem] text-muted">
              From {source}.{' '}
              {fda.result?.url && (
                <a href={fda.result.url} target="_blank" rel="noreferrer" className="font-bold text-accent-deep underline underline-offset-2">
                  See the full label
                </a>
              )}
            </p>
          </>
        )}
        {(fda.status === 'error' || (fda.status === 'done' && !fda.result)) && !fromLabel && (
          <p className="mt-2 text-[1rem]">
            {fda.message ?? `ReadRx couldn’t find what ${name} should look like.`} Ask your pharmacist to describe the pill, or add the description from your label on the review screen.
          </p>
        )}
      </Card>

      {/* 2. Photo of the pill */}
      <Card i={2} className="mt-4 p-4" aria-labelledby="photo">
        <h2 id="photo" className="headline text-[1.2rem]">
          Take a photo of one pill
        </h2>
        <p className="mt-1 text-[1rem] text-muted">Put it on a plain, dark surface. Hold the phone straight above it, in daylight if you can.</p>
        {photo && <img src={photo} alt="Your photo of the pill" className="mt-3 h-44 w-full rounded-[14px] bg-ink-strong object-contain" />}
        <div className="mt-3">
          <PhotoButton capture variant={reading ? 'glass' : 'primary'} onFile={onPhoto} icon={busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}>
            {reading ? 'Take another photo' : 'Take photo of pill'}
          </PhotoButton>
        </div>
        {typeof reading === 'string' && (
          <p role="alert" className="mt-3 rounded-[14px] bg-amber-wash p-3 text-[1rem] font-bold text-amber shadow-[inset_0_0_0_1px_currentColor]">
            {READ_ERROR[reading]}
          </p>
        )}
      </Card>

      {/* 3. Comparison */}
      {reading && typeof reading === 'object' && (
        <Card i={3} className="mt-4" aria-labelledby="compare" aria-live="polite">
          <h2 id="compare" className="sr-only">
            Comparison
          </h2>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="inline-block size-8 shrink-0 rounded-full ring-1 ring-ink/25" style={{ background: `rgb(${reading.rgb.join(',')})` }} aria-hidden />
            <p className="flex-1 text-[1.05rem]">
              Looks <b>{reading.color}</b>
            </p>
            {best && <Mark m={best.color} />}
          </div>
          <div className="flex items-center gap-3 border-t border-divider px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center" aria-hidden>
              <span className="block bg-muted" style={{ width: 28, height: Math.max(10, 28 / reading.aspect), borderRadius: 99 }} />
            </span>
            <p className="flex-1 text-[1.05rem]">
              <b>{shapeLine(reading.shape)}</b>
            </p>
            {best && <Mark m={best.shape} />}
          </div>
          {best && imprints.length > 0 && best.color !== 'mismatch' && best.shape !== 'mismatch' && (
            <div className="border-t border-divider px-4 py-3">
              <p className="text-[1.05rem] font-bold text-ink-strong">Look closely at the pill. What is stamped on it?</p>
              <p className="text-[0.95rem] text-muted">Check both sides. A camera can’t read stamps reliably, so this step is yours.</p>
              <div className="mt-2.5 grid gap-2">
                {imprints.map((im) => (
                  <button
                    key={im}
                    type="button"
                    aria-pressed={imprint === 'yes' && chosen === im}
                    onClick={() => {
                      setImprint('yes');
                      setChosen(im);
                    }}
                    className={`btn min-h-14 justify-start px-4 text-left ${imprint === 'yes' && chosen === im ? 'choice-ok' : 'btn-quiet'}`}
                  >
                    {imprint === 'yes' && chosen === im && <Check className="size-5 shrink-0" aria-hidden />}
                    It says {im}
                  </button>
                ))}
                <button type="button" aria-pressed={imprint === 'no'} onClick={() => setImprint('no')} className={`btn min-h-14 justify-start px-4 text-left ${imprint === 'no' ? 'choice-stop' : 'btn-quiet'}`}>
                  {imprint === 'no' && <Check className="size-5 shrink-0" aria-hidden />}
                  It says something else
                </button>
                <button type="button" aria-pressed={imprint === 'unsure'} onClick={() => setImprint('unsure')} className={`btn min-h-14 justify-start px-4 text-left ${imprint === 'unsure' ? 'choice-neutral' : 'btn-quiet'}`}>
                  {imprint === 'unsure' && <Check className="size-5 shrink-0" aria-hidden />}
                  I can’t read it
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 4. Verdict */}
      {verdict === 'stop' && (
        <section role="alert" className="verdict verdict-stop sheet-in mt-4 p-4">
          <p className="headline flex items-center gap-2 text-[1.35rem] !text-stop">
            <OctagonX className="size-7 shrink-0" aria-hidden /> Don’t take this pill yet.
          </p>
          <p className="mt-1 text-[1.05rem]">It doesn’t match what {name} should look like. It may be a different medicine or a different maker. Check with your pharmacist before taking it.</p>
          {call}
        </section>
      )}
      {verdict === 'ok' && (
        <section role="status" className="verdict verdict-ok sheet-in mt-4 p-4">
          <p className="headline flex items-center gap-2 text-[1.35rem] !text-ok">
            <Check className="size-7 shrink-0" aria-hidden /> This pill matches {name}.
          </p>
          <p className="mt-1 text-[1rem]">Color, shape and stamp all match the description. If anything still seems different from last time, ask your pharmacist.</p>
        </section>
      )}
      {verdict === 'partial' && (
        <section role="status" className="card sheet-in mt-4 p-4">
          <p className="headline text-[1.25rem]">Color and shape look right.</p>
          <p className="mt-1 text-[1rem]">ReadRx doesn’t know what should be stamped on this pill, so it can’t fully confirm it. Ask your pharmacist if you’re not sure.</p>
          {call}
        </section>
      )}
      {verdict === 'unsure' && (
        <section role="status" className="card sheet-in mt-4 p-4">
          <p className="headline flex items-center gap-2 text-[1.25rem]">
            <CircleHelp className="size-6 shrink-0" aria-hidden /> ReadRx can’t confirm this pill.
          </p>
          <p className="mt-1 text-[1rem]">The stamp is how pharmacists tell look-alike pills apart. Try a magnifier or brighter light, or ask your pharmacist.</p>
          {call}
        </section>
      )}

      <p className="mt-6 text-[0.95rem] text-ink-strong">ReadRx is a reading aid, not a pharmacist. It can be wrong. When in doubt, don’t take the pill and call your pharmacy.</p>
    </div>
  );
}
