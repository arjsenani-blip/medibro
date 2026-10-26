import { ChevronRight, MessageCircle, Package, Phone, PillBottle, Settings, Volume2 } from 'lucide-react';
import type { LabelKind } from '../lib/extract';
import { telHref, type Medicine, type Profile } from '../lib/store';
import type { Lang } from '../lib/sig';
import { plainLabel } from '../lib/plain';
import { supplyStatus } from '../lib/refill';
import { BottomBar, Card, Spacer } from '../components/ui';

interface Props {
  meds: Medicine[];
  lang: Lang;
  profile: Profile;
  onScan: (kind: LabelKind) => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onListen: (m: Medicine) => void;
  onProfile: () => void;
  onAssistant: () => void;
}

export default function Home({ meds, lang, profile, onScan, onSample, onOpen, onListen, onProfile, onAssistant }: Props) {
  const firstName = profile.name.trim().split(/\s+/)[0];
  const pharmacyTel = telHref(profile.pharmacyPhone);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="rise mt-4 flex items-center gap-2">
        <h1 className="headline min-w-0 flex-1 text-[2.2rem] break-words">{firstName ? `Hi, ${firstName}` : 'Hi'}</h1>
        {pharmacyTel && (
          <a href={pharmacyTel} className="btn btn-glass btn-icon size-13 shrink-0 rounded-full p-0" aria-label={`Call ${profile.pharmacyName || 'your pharmacy'}`}>
            <Phone className="size-6" aria-hidden />
          </a>
        )}
        <button type="button" onClick={onProfile} className="btn btn-glass btn-icon size-13 shrink-0 rounded-full p-0" aria-label="Settings">
          <Settings className="size-6" aria-hidden />
        </button>
      </div>

      {meds.length ? (
        <Card as="ul" i={1} className="mt-6 overflow-hidden" aria-label="Your medicines">
          {meds.map((m, i) => {
            const p = plainLabel(m.fields, m.raw, lang);
            const st = m.supply ? supplyStatus(m.supply) : null;
            return (
              <li key={m.id} className={`flex items-center ${i ? 'border-t border-divider' : ''}`}>
                <button type="button" onClick={() => onOpen(m.id)} className="flex min-h-18 min-w-0 flex-1 items-center gap-2 py-3.5 pr-1 pl-4 text-left active:bg-[rgba(19,33,43,.055)]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.2rem] font-extrabold text-ink-strong">{p.name}</span>
                    {st && (st.due || st.daysLeft <= 0) ? (
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[0.95rem] font-bold shadow-[inset_0_0_0_1px_currentColor] ${st.daysLeft <= 0 ? 'bg-stop-wash text-stop' : 'bg-amber-wash text-amber'}`}>
                        {st.daysLeft <= 0 ? 'Refill now' : `Refill · ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}`}
                      </span>
                    ) : st ? (
                      <span className="mt-0.5 block text-[1rem] text-muted">{st.daysLeft} days left</span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-6 shrink-0 text-muted" aria-hidden />
                </button>
                <button type="button" onClick={() => onListen(m)} aria-label={`Read ${p.name} aloud`} className="btn btn-glass btn-icon mr-3 size-13 shrink-0 rounded-full p-0">
                  <Volume2 className="size-6" aria-hidden />
                </button>
              </li>
            );
          })}
        </Card>
      ) : (
        <div className="rise mt-3" style={{ '--i': 1 } as React.CSSProperties}>
          <p className="max-w-[28ch] text-[1.2rem] leading-snug text-ink-strong">Scan a prescription label and MediBro reads it to you.</p>
          <button type="button" onClick={onSample} className="mt-2 min-h-12 text-[1.05rem] font-bold text-accent-deep underline decoration-2 underline-offset-4">
            Try a sample label
          </button>
        </div>
      )}

      <Spacer />
      <BottomBar>
        <div className="grid grid-cols-2 gap-3">
          <BigAction icon={<PillBottle className="size-8" aria-hidden />} label="Scan" primary onClick={() => onScan('bottle')} />
          <BigAction icon={<MessageCircle className="size-8" aria-hidden />} label="Ask" onClick={onAssistant} hint="about a symptom" />
        </div>
        <button type="button" onClick={() => onScan('box')} className="flex min-h-12 w-full items-center justify-center gap-2 text-[1.05rem] font-bold text-ink-strong">
          <Package className="size-5" aria-hidden /> Scan a box instead
        </button>
      </BottomBar>
    </div>
  );
}

function BigAction({ icon, label, hint, primary, onClick }: { icon: React.ReactNode; label: string; hint?: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`btn ${primary ? 'btn-primary' : 'btn-glass'} min-h-28 flex-col gap-1.5 rounded-[20px]`} aria-label={hint ? `${label} ${hint}` : undefined}>
      {icon}
      <span className="text-[1.25rem]">{label}</span>
    </button>
  );
}
