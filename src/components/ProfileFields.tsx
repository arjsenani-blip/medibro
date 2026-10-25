import { useState } from 'react';
import { Languages, Plus, X } from 'lucide-react';
import { addAllergies, type Prefs, type Profile } from '../lib/store';
import { LANGUAGES } from '../lib/sig';
import { isoDate } from '../lib/refill';
import { Field, Segmented, inputClass } from './ui';

/* The pieces of the profile form, shared by first-launch setup and the
   Profile screen. Each one edits the profile or prefs as you type. */

type EditProfile = (patch: Partial<Profile>) => void;
type EditPrefs = (patch: Partial<Prefs>) => void;

export function NameField({ profile, onChange, autoFocus }: { profile: Profile; onChange: EditProfile; autoFocus?: boolean }) {
  return (
    <Field label="Your name" hint="ReadRx uses it to say hello. It stays on this phone.">
      <input className={inputClass} value={profile.name} autoComplete="name" autoCapitalize="words" autoFocus={autoFocus} onChange={(e) => onChange({ name: e.target.value })} />
    </Field>
  );
}

export function PharmacyFields({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <div className="space-y-4">
      <Field label="Pharmacy name" optional>
        <input className={inputClass} value={profile.pharmacyName} placeholder="For example: Main Street Pharmacy" autoCapitalize="words" onChange={(e) => onChange({ pharmacyName: e.target.value })} />
      </Field>
      <Field label="Pharmacy phone" optional hint="So you can call about refills with one tap.">
        <input className={inputClass} type="tel" inputMode="tel" autoComplete="off" value={profile.pharmacyPhone} onChange={(e) => onChange({ pharmacyPhone: e.target.value })} />
      </Field>
    </div>
  );
}

export function HealthFields({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  return (
    <div className="space-y-4">
      <Field label="Date of birth" optional hint="Pharmacies often ask for it when you call.">
        <input className={inputClass} type="date" value={profile.birthDate} max={isoDate(new Date())} onChange={(e) => onChange({ birthDate: e.target.value })} />
      </Field>
      <Field label="Doctor’s name" optional>
        <input className={inputClass} value={profile.doctorName} autoCapitalize="words" onChange={(e) => onChange({ doctorName: e.target.value })} />
      </Field>
      <Field label="Doctor’s phone" optional>
        <input className={inputClass} type="tel" inputMode="tel" autoComplete="off" value={profile.doctorPhone} onChange={(e) => onChange({ doctorPhone: e.target.value })} />
      </Field>
      <Allergies profile={profile} onChange={onChange} />
    </div>
  );
}

function Allergies({ profile, onChange }: { profile: Profile; onChange: EditProfile }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange({ allergies: addAllergies(profile.allergies, text) });
    setText('');
  };
  return (
    <div>
      <Field label="Allergies" optional hint="Medicines or foods you’re allergic to. Separate several with commas.">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={text}
            placeholder="For example: penicillin"
            enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            onBlur={add}
          />
          <button type="button" onClick={add} className="btn btn-glass btn-sm shrink-0 gap-1.5" aria-label="Add allergy">
            <Plus className="size-5" aria-hidden /> Add
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

export function ReadingFields({ prefs, onChange, onLanguage }: { prefs: Prefs; onChange: EditPrefs; onLanguage: () => void }) {
  const lang = LANGUAGES.find((l) => l.code === prefs.lang)!;
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-[0.95rem] font-bold text-ink">Read labels in</p>
        <button type="button" onClick={onLanguage} className="btn btn-glass min-h-14 w-full justify-start gap-3 px-4" aria-label={`Language: ${lang.name}. Change`}>
          <Languages className="size-6 shrink-0" aria-hidden />
          <span className="flex-1 text-left" lang={lang.code}>
            {lang.name}
          </span>
          <span className="text-[0.95rem] text-ink">Change</span>
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-[0.95rem] font-bold text-ink" id="size-label">
          Text size
        </p>
        <Segmented
          label="Text size"
          value={prefs.large ? 'large' : 'normal'}
          onChange={(v) => onChange({ large: v === 'large' })}
          options={[
            { value: 'normal', label: <span className="text-[1rem]">Normal</span> },
            { value: 'large', label: <span className="text-[1.2rem]">Large</span> },
          ]}
        />
      </div>
    </div>
  );
}
