import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Prefs, Profile } from '../lib/store';
import ThemePicker from '../components/ThemePicker';
import { AllergyField, BirthField, DoctorFields, LanguageField, NameField, PharmacyFields, SizeField } from '../components/ProfileFields';
import { Button, Spacer } from '../components/ui';

interface Props {
  profile: Profile;
  prefs: Prefs;
  onProfile: (patch: Partial<Profile>) => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onLanguage: () => void;
  onBack: () => void; // to the welcome screen
  onDone: () => void;
}

/** First-launch setup: one question per screen. Only the name is needed. */
export default function Setup({ profile, prefs, onProfile, onPrefs, onLanguage, onBack, onDone }: Props) {
  const [step, setStep] = useState(0);
  const steps: { title: string; note?: string; body: ReactNode; optional?: boolean; ready?: boolean }[] = [
    { title: 'Your name', note: 'Everything you enter stays on this phone.', body: <NameField profile={profile} onChange={onProfile} autoFocus label="First name" />, ready: !!profile.name.trim() },
    { title: 'Your pharmacy', body: <PharmacyFields profile={profile} onChange={onProfile} />, optional: true },
    { title: 'Your doctor', body: <DoctorFields profile={profile} onChange={onProfile} />, optional: true },
    { title: 'Birthday', body: <BirthField profile={profile} onChange={onProfile} />, optional: true },
    { title: 'Allergies', body: <AllergyField profile={profile} onChange={onProfile} label="Medicines or foods" />, optional: true },
    { title: 'Label language', body: <LanguageField prefs={prefs} onLanguage={onLanguage} /> },
    { title: 'Text size', body: <SizeField prefs={prefs} onChange={onPrefs} /> },
    { title: 'Pick a color', body: <ThemePicker value={prefs.accent} onChange={(accent) => onPrefs({ accent })} /> },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  const next = () => (last ? onDone() : setStep(step + 1));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={() => (step ? setStep(step - 1) : onBack())} className="btn btn-quiet btn-icon -ml-1 rounded-full" aria-label="Back">
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <div className="flex flex-1 justify-end gap-1.5" role="img" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-[width] ${i === step ? 'w-6 bg-accent-deep' : i < step ? 'w-2 bg-accent-deep' : 'w-2 bg-[rgba(19,33,43,.18)]'}`} />
          ))}
        </div>
      </div>
      <div key={step} className="rise mt-8">
        <h1 className="headline text-[2.1rem]">{s.title}</h1>
        {s.note && <p className="mt-2 text-[1.05rem] text-ink-strong">{s.note}</p>}
        <div className="mt-6">{s.body}</div>
      </div>

      <Spacer />
      <div className="safe-bottom space-y-1 pt-6">
        <Button onClick={next} disabled={s.ready === false} icon={last ? <Check className="size-6" aria-hidden /> : undefined} className="min-h-16 text-[1.2rem]">
          {last ? 'Done' : 'Next'}
        </Button>
        {s.optional && (
          <button type="button" onClick={next} className="min-h-12 w-full text-[1.05rem] font-bold text-ink-strong">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
