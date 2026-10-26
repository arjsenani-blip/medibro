import { useState } from 'react';
import { ChevronRight, Languages, Plus, X } from 'lucide-react';
import { addAllergies, type Prefs, type Profile } from '../lib/store';
import { LANGUAGES } from '../lib/sig';
import { isoDate } from '../lib/refill';
import { Field, Segmented, inputClass } from './ui';

/* The pieces of the profile form, shared by first-launch setup (one per screen)
   and the Profile screen. Each edits the profile or prefs as you type. */

type EditProfile = (patch: Partial<Profile>) => void;
type EditPrefs = (patch: Partial<Prefs>) => void;
const big = `${inputClass} min-h-15 text-[1.2rem]`;

export function NameField({ profile, onChange, autoFocus, label = 'Name' }: { profile: Profile; onChange: EditProfile; autoFocus?: boolean; label?: string }) {
  return (
    <Field label={label}>
      <input className={big} value={profile.name} autoComplete="name" autoCapitalize="words" autoFocus={autoFocus} onChange={(e) => onChange({ name: e.target.value })} />
    </Field>
  );
}

export function PharmacyFields({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <div className="space-y-4">
      <Field label="Pharmacy">
        <input className={big} value={profile.pharmacyName} autoCapitalize="words" onChange={(e) => onChange({ pharmacyName: e.target.value })} />
      </Field>
      <Field label="Pharmacy phone">
        <input className={big} type="tel" inputMode="tel" autoComplete="off" value={profile.pharmacyPhone} onChange={(e) => onChange({ pharmacyPhone: e.target.value })} />
      </Field>
    </div>
  );
}

export function DoctorFields({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <div className="space-y-4">
      <Field label="Doctor">
        <input className={big} value={profile.doctorName} autoCapitalize="words" onChange={(e) => onChange({ doctorName: e.target.value })} />
      </Field>
      <Field label="Doctor’s phone">
        <input className={big} type="tel" inputMode="tel" autoComplete="off" value={profile.doctorPhone} onChange={(e) => onChange({ doctorPhone: e.target.value })} />
      </Field>
    </div>
  );
}

export function PoliceFields({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <div className="space-y-4">
      <Field label="Local police (non-emergency)" hint="For dropping off old medicines. Never for emergencies.">
        <input className={big} value={profile.policeName} placeholder="Station name" autoCapitalize="words" onChange={(e) => onChange({ policeName: e.target.value })} />
      </Field>
      <Field label="Police non-emergency phone">
        <input className={big} type="tel" inputMode="tel" autoComplete="off" value={profile.policePhone} onChange={(e) => onChange({ policePhone: e.target.value })} />
      </Field>
    </div>
  );
}

export function BirthField({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <Field label="Date of birth">
      <input className={big} type="date" value={profile.birthDate} max={isoDate(new Date())} onChange={(e) => onChange({ birthDate: e.target.value })} />
    </Field>
  );
}

export function AllergyField({ profile, onChange, label = 'Allergies' }: { profile: Profile; onChange: EditProfile; label?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange({ allergies: addAllergies(profile.allergies, text) });
    setText('');
  };
  return (
    <div>
      <Field label={label}>
        <div className="flex gap-2">
          <input
            className={big}
            value={text}
            placeholder="Penicillin"
            enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            onBlur={add}
          />
          <button type="button" onClick={add} className="btn btn-glass btn-icon min-h-15 min-w-15 shrink-0" aria-label="Add allergy">
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
      </Field>
      {profile.allergies.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your allergies">
          {profile.allergies.map((a) => (
            <li key={a} className="flex min-h-12 items-center gap-1 rounded-full bg-paper pl-4 text-[1.05rem] font-bold text-ink-strong shadow-[var(--shadow-sm)]">
              {a}
              <button type="button" onClick={() => onChange({ allergies: profile.allergies.filter((x) => x !== a) })} aria-label={`Remove ${a}`} className="grid size-12 place-items-center rounded-full text-muted">
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LanguageField({ prefs, onLanguage }: { prefs: Prefs; onLanguage: () => void }) {
  const lang = LANGUAGES.find((l) => l.code === prefs.lang)!;
  return (
    <button type="button" onClick={onLanguage} className="btn btn-quiet min-h-15 w-full justify-start gap-3 px-4" aria-label={`Label language: ${lang.name}. Change`}>
      <Languages className="size-6 shrink-0 text-accent-deep" aria-hidden />
      <span className="flex-1 text-left text-[1.15rem]" lang={lang.code}>
        {lang.name}
      </span>
      <ChevronRight className="size-6 text-muted" aria-hidden />
    </button>
  );
}

export function SizeField({ prefs, onChange }: { prefs: Prefs; onChange: EditPrefs }) {
  return (
    <Segmented
      label="Text size"
      value={prefs.large ? 'large' : 'normal'}
      onChange={(v) => onChange({ large: v === 'large' })}
      options={[
        { value: 'normal', label: <span className="text-[1rem]">Aa Normal</span> },
        { value: 'large', label: <span className="text-[1.25rem]">Aa Large</span> },
      ]}
    />
  );
}
