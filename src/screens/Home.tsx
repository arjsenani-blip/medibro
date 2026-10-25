import { ChevronRight, Package, PillBottle, Plus, Stethoscope, Store, TriangleAlert, UserRound, Volume2 } from 'lucide-react';
import type { LabelKind } from '../lib/extract';
import type { Medicine, Profile } from '../lib/store';
import type { Lang } from '../lib/sig';
import { parseSig, writeSig } from '../lib/sig';
import { plainLabel } from '../lib/plain';
import { supplyStatus } from '../lib/refill';
import { BottomBar, Button, CallButton, Card, CardTitle, Spacer } from '../components/ui';

interface Props {
  meds: Medicine[];
  lang: Lang;
  profile: Profile;
  onScan: (kind: LabelKind) => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onListen: (m: Medicine) => void;
  onProfile: () => void;
}

const EXAMPLE = parseSig('TAKE 1 TAB PO BID').sig!;

export default function Home({ meds, lang, profile, onScan, onSample, onOpen, onListen, onProfile }: Props) {
  const firstName = profile.name.trim().split(/\s+/)[0];
  const greeting = (
    <div className="rise mt-4 flex items-center gap-3">
      <h1 className="headline min-w-0 flex-1 text-[1.9rem] break-words">{firstName ? `Hello, ${firstName}` : 'Hello'}</h1>
      <button type="button" onClick={onProfile} className="btn btn-glass btn-sm shrink-0 gap-2 rounded-full pr-4 pl-3" aria-label="Your profile and settings">
        <UserRound className="size-5" aria-hidden />
        Profile
      </button>
    </div>
  );

  if (!meds.length) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        {greeting}
        <p className="rise mt-2 max-w-[34ch] text-[1.1rem] leading-snug text-ink-strong" style={{ '--i': 1 } as React.CSSProperties}>
          Take a photo of a prescription label. ReadRx reads it out loud in your language, and helps you check a pill before you take it.
        </p>

        {/* the product in one glance: shorthand in, plain words out */}
        <Card as="figure" i={2} className="mt-6 overflow-hidden">
          <div className="px-4 pt-4">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.9rem] font-bold text-accent-deep shadow-[inset_0_0_0_1px_var(--tint-ring)] [background:var(--tint)]">
              <span className="size-2 rounded-full bg-accent shadow-[0_0_6px_rgba(var(--accent-rgb),.9)]" aria-hidden /> On the bottle
            </span>
            <p className="pt-2.5 pb-4 text-[1.35rem] font-bold tracking-wide">TAKE 1 TAB PO BID</p>
          </div>
          <div className="border-t border-divider bg-paper px-4 pt-3 pb-4">
            <p className="text-[0.95rem] font-bold text-muted">ReadRx says</p>
            <p className="mt-1 text-[1.4rem] leading-snug font-bold text-ink-strong" lang={lang}>
              {writeSig(EXAMPLE, lang)}
            </p>
          </div>
        </Card>

        <p className="rise mt-4 text-[1rem] text-ink-strong" style={{ '--i': 3 } as React.CSSProperties}>
          Your photos and medicines stay on this phone.
        </p>

        <Spacer />
        <BottomBar>
          <ScanButtons onScan={onScan} />
          <button type="button" onClick={onSample} className="min-h-12 w-full text-[1rem] font-bold text-ink-strong underline decoration-[rgba(var(--accent-rgb),.7)] decoration-2 underline-offset-4">
            Try it with a sample label
          </button>
        </BottomBar>
      </div>
    );
  }

  const due = meds.filter((m) => m.supply && supplyStatus(m.supply).due).length;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {greeting}
      <h2 className="rise mt-5 text-[1.15rem] font-bold text-ink-strong" style={{ '--i': 1 } as React.CSSProperties}>
        Your medicines
      </h2>
      <Card as="ul" i={1} className="mt-2.5 overflow-hidden">
        {meds.map((m, i) => {
          const p = plainLabel(m.fields, m.raw, lang);
          const st = m.supply ? supplyStatus(m.supply) : null;
          return (
            <li key={m.id} className={`flex items-stretch ${i ? 'border-t border-divider' : ''}`}>
              <button type="button" onClick={() => onOpen(m.id)} className="flex min-w-0 flex-1 items-center gap-2 py-3.5 pr-1 pl-4 text-left active:bg-[rgba(19,33,43,.055)]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.15rem] font-extrabold text-ink-strong">{p.name}</span>
                  <span className="mt-0.5 block text-[1rem] leading-snug text-muted" lang={p.translated ? lang : 'en'}>
                    {p.directions || 'No directions saved'}
                  </span>
                  {st && (
                    <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[0.95rem] font-bold shadow-[inset_0_0_0_1px_currentColor] ${st.daysLeft <= 0 ? 'bg-stop-wash text-stop' : st.due ? 'bg-amber-wash text-amber' : 'bg-ok-wash text-ok'}`}>
                      {st.daysLeft <= 0 ? 'Ran out: refill now' : `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left${st.due ? ' · refill now' : ''}`}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-6 shrink-0 text-muted" aria-hidden />
              </button>
              <div className="grid shrink-0 place-items-center border-l border-divider px-2.5">
                <button type="button" onClick={() => onListen(m)} aria-label={`Read ${p.name} aloud`} className="btn btn-glass btn-icon min-h-13 min-w-13 rounded-full">
                  <Volume2 className="size-6" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </Card>

      <CareCard profile={profile} due={due} onProfile={onProfile} />

      <Spacer />
      <BottomBar>
        <ScanButtons onScan={onScan} />
      </BottomBar>
    </div>
  );
}

/** The person's pharmacy and doctor, with call buttons; or an offer to add them. */
function CareCard({ profile, due, onProfile }: { profile: Profile; due: number; onProfile: () => void }) {
  const hasPharmacy = !!(profile.pharmacyName || profile.pharmacyPhone);
  const hasDoctor = !!(profile.doctorName || profile.doctorPhone);
  return (
    <Card i={2} className="mt-4 p-4" aria-labelledby="care-title">
      <CardTitle id="care-title" icon={<Store className="size-5" aria-hidden />}>
        Your pharmacy
      </CardTitle>
      {due > 0 && (
        <p className="mt-3 flex gap-2 rounded-[14px] bg-amber-wash p-3 text-[1rem] font-bold text-amber shadow-[inset_0_0_0_1px_currentColor]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {due === 1 ? '1 medicine needs a refill.' : `${due} medicines need a refill.`}
        </p>
      )}
      {hasPharmacy ? (
        <>
          <p className="mt-3 text-[1.2rem] font-extrabold text-ink-strong">{profile.pharmacyName || 'Your pharmacy'}</p>
          {profile.pharmacyPhone && (
            <CallButton phone={profile.pharmacyPhone} variant={due ? 'primary' : 'glass'} className="mt-3">
              Call about refills
            </CallButton>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-[1rem] text-muted">Add your pharmacy and its phone number, so you can call about refills from here.</p>
          <Button variant="glass" className="mt-3" onClick={onProfile} icon={<Plus className="size-5" aria-hidden />}>
            Add your pharmacy
          </Button>
        </>
      )}
      {hasDoctor && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-divider pt-4">
          <Stethoscope className="size-5 shrink-0 text-muted" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="block text-[0.9rem] text-muted">Your doctor</span>
            <span className="block text-[1.05rem] font-bold">{profile.doctorName || 'Doctor'}</span>
          </p>
          {profile.doctorPhone && (
            <CallButton phone={profile.doctorPhone} variant="glass" className="!w-auto">
              Call
            </CallButton>
          )}
        </div>
      )}
    </Card>
  );
}

function ScanButtons({ onScan }: { onScan: (kind: LabelKind) => void }) {
  return (
    <div className="space-y-2.5">
      <Button onClick={() => onScan('bottle')} icon={<PillBottle className="size-6" aria-hidden />}>
        Scan a bottle
      </Button>
      <Button variant="glass" onClick={() => onScan('box')} icon={<Package className="size-6" aria-hidden />}>
        Scan a box
      </Button>
    </div>
  );
}
