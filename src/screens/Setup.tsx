import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Prefs, Profile } from '../lib/store';
import ThemePicker from '../components/ThemePicker';
import { HealthFields, NameField, PharmacyFields, ReadingFields } from '../components/ProfileFields';
import { BottomBar, Button, Card, Spacer } from '../components/ui';

interface Props {
  profile: Profile;
  prefs: Prefs;
  onProfile: (patch: Partial<Profile>) => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onLanguage: () => void;
  onBack: () => void; // to the welcome screen
  onDone: () => void;
}

/** First-launch setup, one short step at a time. Only the name is needed. */
export default function Setup({ profile, prefs, onProfile, onPrefs, onLanguage, onBack, onDone }: Props) {
  const [step, setStep] = useState(0);
  const steps: { title: string; intro: string; body: ReactNode; filled: boolean; required?: boolean }[] = [
    { title: 'What’s your name?', intro: 'So ReadRx can greet you.', body: <NameField profile={profile} onChange={onProfile} autoFocus />, filled: !!profile.name.trim(), required: true },
    { title: 'Your main pharmacy', intro: 'Where you pick up your medicines. You can call them about refills from ReadRx.', body: <PharmacyFields profile={profile} onChange={onProfile} />, filled: !!(profile.pharmacyName || profile.pharmacyPhone) },
    {
      title: 'About you',
      intro: 'Handy when you call your pharmacy or doctor. All of this is optional.',
      body: <HealthFields profile={profile} onChange={onProfile} />,
      filled: !!(profile.birthDate || profile.doctorName || profile.doctorPhone || profile.allergies.length),
    },
    { title: 'Reading', intro: 'The language ReadRx reads your labels in, and how big the words are.', body: <ReadingFields prefs={prefs} onChange={onPrefs} onLanguage={onLanguage} />, filled: true },
    { title: 'Pick a color', intro: 'Your favorite color for the background and buttons. You can change it later.', body: <ThemePicker value={prefs.accent} onChange={(accent) => onPrefs({ accent })} />, filled: true },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  const next = () => (last ? onDone() : setStep(step + 1));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="rise mt-2 flex items-center gap-3" key={`head-${step}`}>
        <p className="flex-1 text-[1rem] font-bold text-ink-strong" aria-live="polite">
          Step {step + 1} of {steps.length}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={`h-2.5 rounded-full transition-[width] ${i === step ? 'w-7 bg-accent-deep' : i < step ? 'w-2.5 bg-accent-deep' : 'w-2.5 bg-paper shadow-[inset_0_0_0_1px_var(--color-rule)]'}`} />
          ))}
        </div>
      </div>
      <div key={step}>
        <h1 className="headline rise mt-4 text-[1.9rem]">{s.title}</h1>
        <p className="rise mt-1.5 text-[1.05rem] text-ink-strong" style={{ '--i': 1 } as React.CSSProperties}>
          {s.intro}
        </p>
        <Card as="div" i={2} className="mt-5 p-4">
          {s.body}
        </Card>
      </div>

      <Spacer />
      <BottomBar>
        <Button onClick={next} disabled={s.required && !s.filled} icon={last ? <Check className="size-6" aria-hidden /> : undefined} variant={s.filled ? 'primary' : 'glass'}>
          {last ? 'Finish' : s.filled || s.required ? 'Next' : 'Skip for now'}
        </Button>
        {s.required && !s.filled && <p className="text-center text-[1rem] text-ink-strong">Type your name to go on.</p>}
        <Button variant="quiet" onClick={() => (step ? setStep(step - 1) : onBack())} icon={<ArrowLeft className="size-5" aria-hidden />}>
          Back
        </Button>
      </BottomBar>
    </div>
  );
}
