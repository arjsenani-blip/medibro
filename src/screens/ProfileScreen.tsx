import type { ReactNode } from 'react';
import type { Prefs, Profile } from '../lib/store';
import ThemePicker from '../components/ThemePicker';
import { AllergyField, BirthField, DoctorFields, LanguageField, NameField, PharmacyFields, SizeField } from '../components/ProfileFields';
import { BottomBar, Button, Spacer } from '../components/ui';

interface Props {
  profile: Profile;
  prefs: Prefs;
  onProfile: (patch: Partial<Profile>) => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onLanguage: () => void;
  onDone: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rise mt-8">
      <h2 className="mb-3 text-[1.15rem] font-extrabold text-ink-strong">{title}</h2>
      {children}
    </section>
  );
}

/** Everything from setup, to change later. Saved as you type, on this phone only. */
export default function ProfileScreen({ profile, prefs, onProfile, onPrefs, onLanguage, onDone }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <h1 className="headline rise mt-4 text-[2rem]">Settings</h1>

      <Section title="Reading">
        <div className="space-y-3">
          <LanguageField prefs={prefs} onLanguage={onLanguage} />
          <SizeField prefs={prefs} onChange={onPrefs} />
        </div>
      </Section>
      <Section title="Color">
        <ThemePicker value={prefs.accent} onChange={(accent) => onPrefs({ accent })} />
      </Section>
      <Section title="You">
        <div className="space-y-4">
          <NameField profile={profile} onChange={onProfile} />
          <BirthField profile={profile} onChange={onProfile} />
          <AllergyField profile={profile} onChange={onProfile} />
        </div>
      </Section>
      <Section title="Care">
        <div className="space-y-4">
          <PharmacyFields profile={profile} onChange={onProfile} />
          <DoctorFields profile={profile} onChange={onProfile} />
        </div>
      </Section>

      <p className="mt-8 text-[1rem] text-ink-strong">Saved on this phone only.</p>
      <Spacer />
      <BottomBar>
        <Button onClick={onDone}>Done</Button>
      </BottomBar>
    </div>
  );
}
