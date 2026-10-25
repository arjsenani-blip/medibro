import { Palette, Store, Type, UserRound, HeartPulse } from 'lucide-react';
import type { Prefs, Profile } from '../lib/store';
import ThemePicker from '../components/ThemePicker';
import { HealthFields, NameField, PharmacyFields, ReadingFields } from '../components/ProfileFields';
import { BottomBar, Button, Card, CardTitle, PageTitle, Spacer } from '../components/ui';

interface Props {
  profile: Profile;
  prefs: Prefs;
  onProfile: (patch: Partial<Profile>) => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onLanguage: () => void;
  onDone: () => void;
}

/** Everything from setup, to change later. Changes are saved as you type. */
export default function ProfileScreen({ profile, prefs, onProfile, onPrefs, onLanguage, onDone }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageTitle sub="Changes are saved on this phone as you make them. Nothing is uploaded.">Profile and settings</PageTitle>

      <Card i={1} className="mt-4 p-4" aria-labelledby="p-you">
        <CardTitle id="p-you" icon={<UserRound className="size-5" aria-hidden />}>
          You
        </CardTitle>
        <div className="mt-4">
          <NameField profile={profile} onChange={onProfile} />
        </div>
      </Card>

      <Card i={2} className="mt-4 p-4" aria-labelledby="p-pharmacy">
        <CardTitle id="p-pharmacy" icon={<Store className="size-5" aria-hidden />}>
          Main pharmacy
        </CardTitle>
        <div className="mt-4">
          <PharmacyFields profile={profile} onChange={onProfile} />
        </div>
      </Card>

      <Card i={3} className="mt-4 p-4" aria-labelledby="p-health">
        <CardTitle id="p-health" icon={<HeartPulse className="size-5" aria-hidden />}>
          Health details
        </CardTitle>
        <div className="mt-4">
          <HealthFields profile={profile} onChange={onProfile} />
        </div>
      </Card>

      <Card i={4} className="mt-4 p-4" aria-labelledby="p-reading">
        <CardTitle id="p-reading" icon={<Type className="size-5" aria-hidden />}>
          Reading
        </CardTitle>
        <div className="mt-4">
          <ReadingFields prefs={prefs} onChange={onPrefs} onLanguage={onLanguage} />
        </div>
      </Card>

      <Card i={5} className="mt-4 p-4" aria-labelledby="p-color">
        <CardTitle id="p-color" icon={<Palette className="size-5" aria-hidden />}>
          Theme color
        </CardTitle>
        <div className="mt-4">
          <ThemePicker value={prefs.accent} onChange={(accent) => onPrefs({ accent })} />
        </div>
      </Card>

      <Spacer />
      <BottomBar>
        <Button onClick={onDone}>Done</Button>
      </BottomBar>
    </div>
  );
}
