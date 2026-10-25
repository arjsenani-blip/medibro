import { useEffect, useState } from 'react';
import { ArrowLeft, Languages } from 'lucide-react';
import { parseLabel, SAMPLE_LABEL, type LabelFields } from './lib/parseLabel';
import { LANGUAGES } from './lib/sig';
import { loadMedicines, loadPrefs, saveMedicines, savePrefs, type Medicine, type Prefs } from './lib/store';
import { plainLabel, spokenLines } from './lib/plain';
import { speakLines, stopSpeaking } from './lib/speech';
import { modelAvailable } from './lib/nativeReader';
import { supplyFromLabel } from './lib/refill';
import { onReminderTap, remindersSupported, syncReminders, type ReminderState } from './lib/reminders';
import LanguageSheet from './components/LanguageSheet';
import Home from './screens/Home';
import Scan from './screens/Scan';
import Capture from './screens/Capture';
import type { LabelKind } from './lib/extract';
import Review from './screens/Review';
import MedicineView from './screens/MedicineView';
import PillCheck from './screens/PillCheck';

type Screen =
  | { name: 'home' }
  | { name: 'capture'; kind: LabelKind; files: File[] }
  | { name: 'scan'; files: File[]; kind: LabelKind; prior: string; back: Screen } // `prior` = text from earlier photos of the same label
  | { name: 'review'; fields: LabelFields; raw: string; kind: LabelKind }
  | { name: 'med'; id: string; autoplay?: boolean }
  | { name: 'pill'; id: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
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
  }, [prefs]);
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
  const langName = LANGUAGES.find((l) => l.code === lang)!.name;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[30rem] flex-col px-4">
      <header className="safe-top sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-ground px-4 pb-2">
        {screen.name === 'home' ? (
          <span className="flex-1 text-[1.25rem] font-extrabold tracking-[-0.01em]">ReadRx</span>
        ) : (
          <button type="button" onClick={back} className="-ml-2 inline-flex min-h-12 flex-1 items-center gap-1.5 px-2 text-[1.05rem] font-bold">
            <ArrowLeft className="size-5" aria-hidden /> Back
          </button>
        )}
        <button
          type="button"
          onClick={() => setPrefs((p) => ({ ...p, large: !p.large }))}
          aria-pressed={prefs.large}
          aria-label="Larger text"
          className={`inline-flex min-h-12 min-w-12 items-baseline justify-center rounded-xl px-2 pt-2.5 text-[1.15rem] leading-none font-extrabold ring-1 ${prefs.large ? 'bg-ink text-white ring-ink' : 'bg-paper ring-rule'}`}
        >
          <span className="text-[0.7em]">A</span>A
        </button>
        <button type="button" onClick={() => setLangOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-paper px-3 text-[1rem] font-bold ring-1 ring-rule" aria-label={`Language: ${langName}. Change`}>
          <Languages className="size-5" aria-hidden />
          <span lang={lang}>{langName}</span>
        </button>
      </header>

      <main className="flex flex-1 flex-col">
        {screen.name === 'home' && (
          <Home
            meds={meds}
            lang={lang}
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
          <p className="mt-6 text-[1.05rem]">
            This medicine was removed.{' '}
            <button type="button" className="font-bold underline" onClick={() => go({ name: 'home' })}>
              Go to your medicines
            </button>
          </p>
        )}
      </main>

      {langOpen && <LanguageSheet value={lang} onPick={(l) => setPrefs((p) => ({ ...p, lang: l }))} onClose={() => setLangOpen(false)} />}
    </div>
  );
}
