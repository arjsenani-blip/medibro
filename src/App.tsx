import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { parseLabel, SAMPLE_LABEL, type LabelFields } from './lib/parseLabel';
import { loadMedicines, loadPrefs, loadProfile, saveMedicines, savePrefs, saveProfile, type Medicine, type Prefs, type Profile } from './lib/store';
import { applyAccent } from './lib/theme';
import { plainLabel, spokenLines } from './lib/plain';
import { speakLines, stopSpeaking } from './lib/speech';
import { modelAvailable } from './lib/nativeReader';
import { supplyFromLabel } from './lib/refill';
import { onReminderTap, remindersSupported, syncReminders, type ReminderState } from './lib/reminders';
import LanguageSheet from './components/LanguageSheet';
import { Logo } from './components/ui';
import Welcome from './screens/Welcome';
import Setup from './screens/Setup';
import ProfileScreen from './screens/ProfileScreen';
import Assistant from './screens/Assistant';
import Home from './screens/Home';
import Scan from './screens/Scan';
import Capture from './screens/Capture';
import type { LabelKind } from './lib/extract';
import Review from './screens/Review';
import MedicineView from './screens/MedicineView';
import PillCheck from './screens/PillCheck';

type Screen =
  | { name: 'welcome' }
  | { name: 'setup' }
  | { name: 'profile' }
  | { name: 'assistant' }
  | { name: 'home' }
  | { name: 'capture'; kind: LabelKind; files: File[] }
  | { name: 'scan'; files: File[]; kind: LabelKind; prior: string; back: Screen } // `prior` = text from earlier photos of the same label
  | { name: 'review'; fields: LabelFields; raw: string; kind: LabelKind }
  | { name: 'med'; id: string; autoplay?: boolean }
  | { name: 'pill'; id: string };

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [screen, setScreen] = useState<Screen>(() => (profile.setupDone ? { name: 'home' } : { name: 'welcome' }));
  const [meds, setMeds] = useState<Medicine[]>(loadMedicines);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [langOpen, setLangOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderState>(remindersSupported() ? 'on' : 'unsupported');

  useEffect(() => void modelAvailable(), []); // check early, so the first scan doesn't wait
  useEffect(() => saveMedicines(meds), [meds]);
  // reschedule refill reminders whenever a medicine or its supply changes
  useEffect(() => {
    syncReminders(meds).then(setReminders, (e) => console.info('ReadRx: reminders not scheduled', e));
  }, [meds]);
  useEffect(() => onReminderTap((id) => setScreen({ name: 'med', id })), []);
  useEffect(() => {
    savePrefs(prefs);
    document.documentElement.dataset.size = prefs.large ? 'large' : 'normal';
    document.documentElement.lang = prefs.lang;
    applyAccent(prefs.accent);
  }, [prefs]);
  useEffect(() => saveProfile(profile), [profile]);
  const editProfile = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const editPrefs = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  useEffect(() => {
    stopSpeaking();
    window.scrollTo(0, 0);
  }, [screen]);

  const go = (s: Screen) => setScreen(s);
  const back = () => {
    if (screen.name === 'pill') go({ name: 'med', id: screen.id });
    else go({ name: 'home' });
  };

  const startReview = (raw: string) => go({ name: 'review', fields: parseLabel(raw).fields, raw, kind: 'bottle' });

  const save = (fields: LabelFields, raw: string) => {
    const med: Medicine = { id: crypto.randomUUID(), fields, raw, expected: null, supply: supplyFromLabel(fields), savedAt: new Date().toISOString() };
    setMeds((list) => [med, ...list]);
    go({ name: 'med', id: med.id, autoplay: true });
  };

  const med = 'id' in screen ? meds.find((m) => m.id === screen.id) : undefined;
  const lang = prefs.lang;

  const ambient = <div className={`ambient ${screen.name === 'welcome' ? 'hero' : ''}`} aria-hidden />;
  const sheet = langOpen && <LanguageSheet value={lang} onPick={(l) => editPrefs({ lang: l })} onClose={() => setLangOpen(false)} />;

  if (screen.name === 'welcome') {
    return (
      <>
        {ambient}
        <Welcome onStart={() => go({ name: 'setup' })} />
      </>
    );
  }

  const brand = screen.name === 'home' || screen.name === 'setup';
  return (
    <div className={`mx-auto flex min-h-dvh max-w-[30rem] flex-col px-4 ${screen.name === 'setup' ? 'safe-top' : ''}`}>
      {ambient}
      {screen.name !== 'setup' && (
      <header className="bar safe-top sticky top-0 z-20 -mx-4 flex min-h-[3.75rem] items-center gap-2 px-4 pb-2">
        {brand ? (
          <span className="flex items-center gap-2.5">
            <Logo className="size-9 shrink-0" />
            <span className="headline text-[1.25rem]">ReadRx</span>
          </span>
        ) : (
          <button type="button" onClick={back} className="btn btn-quiet btn-sm -ml-1 gap-1.5 pr-4 pl-3">
            <ArrowLeft className="size-5" aria-hidden /> Back
          </button>
        )}
      </header>
      )}

      <main className="flex flex-1 flex-col">
        {screen.name === 'setup' && (
          <Setup
            profile={profile}
            prefs={prefs}
            onProfile={editProfile}
            onPrefs={editPrefs}
            onLanguage={() => setLangOpen(true)}
            onBack={() => go({ name: 'welcome' })}
            onDone={() => {
              editProfile({ setupDone: true });
              go({ name: 'home' });
            }}
          />
        )}
        {screen.name === 'assistant' && <Assistant profile={profile} meds={meds} rate={prefs.rate} onLeave={() => go({ name: 'home' })} onProfile={() => go({ name: 'profile' })} />}
        {screen.name === 'profile' && <ProfileScreen profile={profile} prefs={prefs} onProfile={editProfile} onPrefs={editPrefs} onLanguage={() => setLangOpen(true)} onDone={() => go({ name: 'home' })} />}
        {screen.name === 'home' && (
          <Home
            meds={meds}
            lang={lang}
            profile={profile}
            onProfile={() => go({ name: 'profile' })}
            onAssistant={() => go({ name: 'assistant' })}
            onScan={(kind) => go({ name: 'capture', kind, files: [] })}
            onSample={() => startReview(SAMPLE_LABEL)}
            onOpen={(id) => go({ name: 'med', id })}
            onListen={(m) => speakLines(spokenLines(plainLabel(m.fields, m.raw, lang), lang), prefs.rate, () => {})}
          />
        )}
        {screen.name === 'capture' && (
          <Capture
            kind={screen.kind}
            files={screen.files}
            onChange={(files) => setScreen({ ...screen, files })}
            onRead={() => go({ name: 'scan', files: screen.files, kind: screen.kind, prior: '', back: screen })}
            onCancel={() => go({ name: 'home' })}
          />
        )}
        {screen.name === 'scan' && (
          <Scan
            files={screen.files}
            kind={screen.kind}
            prior={screen.prior}
            onDone={(raw, fields) => go({ name: 'review', fields, raw, kind: screen.kind })}
            onBack={() => go(screen.back)}
            onCancel={() => go({ name: 'home' })}
          />
        )}
        {screen.name === 'review' && (
          <Review
            key={screen.raw}
            fields={screen.fields}
            raw={screen.raw}
            lang={lang}
            onSave={(f) => save(f, screen.raw)}
            onAddPhoto={(file) => go({ name: 'scan', files: [file], kind: screen.kind, prior: screen.raw, back: screen })}
            onCancel={() => go({ name: 'home' })}
          />
        )}
        {screen.name === 'med' && med && (
          <MedicineView
            key={med.id + lang}
            med={med}
            lang={lang}
            rate={prefs.rate}
            autoplay={!!screen.autoplay}
            reminders={reminders}
            profile={profile}
            onRate={(rate) => setPrefs((p) => ({ ...p, rate }))}
            onSupply={(supply) => setMeds((list) => list.map((m) => (m.id === med.id ? { ...m, supply } : m)))}
            onCheckPill={() => go({ name: 'pill', id: med.id })}
            onRemove={() => {
              setMeds((list) => list.filter((m) => m.id !== med.id));
              go({ name: 'home' });
            }}
          />
        )}
        {screen.name === 'pill' && med && <PillCheck med={med} />}
        {'id' in screen && !med && (
          <p className="card mt-6 p-4 text-[1.05rem]">
            This medicine was removed.{' '}
            <button type="button" className="min-h-12 font-bold text-accent-deep underline underline-offset-4" onClick={() => go({ name: 'home' })}>
              Go to your medicines
            </button>
          </p>
        )}
      </main>

      {sheet}
    </div>
  );
}
