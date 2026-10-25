import { ChevronRight, Package, PillBottle, Volume2 } from 'lucide-react';
import type { LabelKind } from '../lib/extract';
import type { Medicine } from '../lib/store';
import type { Lang } from '../lib/sig';
import { parseSig, writeSig } from '../lib/sig';
import { plainLabel } from '../lib/plain';
import { supplyStatus } from '../lib/refill';
import { BottomBar, Button } from '../components/ui';

interface Props {
  meds: Medicine[];
  lang: Lang;
  onScan: (kind: LabelKind) => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onListen: (m: Medicine) => void;
}

const EXAMPLE = parseSig('TAKE 1 TAB PO BID').sig!;

export default function Home({ meds, lang, onScan, onSample, onOpen, onListen }: Props) {
  if (!meds.length) {
    return (
      <div className="flex min-h-full flex-col">
        <h1 className="mt-6 text-[2rem] leading-[1.12] font-extrabold tracking-[-0.01em]">Hear exactly what your prescription label says.</h1>
        <p className="mt-3 max-w-[34ch] text-[1.05rem] text-muted">
          Take a photo of the label. ReadRx reads the directions out loud in your language, and helps you check a pill before you take it.
        </p>

        {/* the product in one glance: shorthand in, plain words out */}
        <figure className="mt-7 overflow-hidden rounded-2xl bg-paper ring-1 ring-rule">
          <div className="bg-amber px-4 py-2 text-[0.85rem] font-bold text-white">On the bottle</div>
          <p className="px-4 pt-3 pb-4 text-[1.35rem] font-bold tracking-wide">TAKE 1 TAB PO BID</p>
          <div className="border-t border-rule px-4 pt-3 pb-4">
            <p className="text-[0.85rem] font-bold text-muted">ReadRx says</p>
            <p className="mt-1 text-[1.35rem] leading-snug font-bold" lang={lang}>
              {writeSig(EXAMPLE, lang)}
            </p>
          </div>
        </figure>

        <p className="mt-4 text-[0.9rem] text-muted">Your photos and medicines stay on this phone.</p>

        <BottomBar>
          <ScanButtons onScan={onScan} />
          <button type="button" onClick={onSample} className="min-h-12 w-full text-[1rem] font-bold text-ink underline decoration-rule underline-offset-4">
            Try it with a sample label
          </button>
        </BottomBar>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="mt-4 text-[1.6rem] font-extrabold">Your medicines</h1>
      <ul className="mt-3 overflow-hidden rounded-2xl bg-paper ring-1 ring-rule">
        {meds.map((m, i) => {
          const p = plainLabel(m.fields, m.raw, lang);
          const st = m.supply ? supplyStatus(m.supply) : null;
          return (
            <li key={m.id} className={`flex items-stretch ${i ? 'border-t border-rule' : ''}`}>
              <button type="button" onClick={() => onOpen(m.id)} className="flex min-w-0 flex-1 items-center gap-2 py-3.5 pr-1 pl-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.15rem] font-extrabold">{p.name}</span>
                  <span className="mt-0.5 block text-[0.95rem] leading-snug text-muted" lang={p.translated ? lang : 'en'}>
                    {p.directions || 'No directions saved'}
                  </span>
                  {st && (
                    <span className={`mt-1 inline-block rounded-md px-1.5 text-[0.9rem] font-bold ${st.daysLeft <= 0 ? 'bg-stop-wash text-stop' : st.due ? 'bg-amber-wash text-amber' : 'bg-ok-wash text-ok'}`}>
                      {st.daysLeft <= 0 ? 'Ran out: refill now' : `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left${st.due ? ' · refill now' : ''}`}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
              </button>
              <button type="button" onClick={() => onListen(m)} aria-label={`Read ${p.name} aloud`} className="grid w-16 shrink-0 place-items-center border-l border-rule text-amber active:bg-amber-wash">
                <Volume2 className="size-6" />
              </button>
            </li>
          );
        })}
      </ul>
      <BottomBar>
        <ScanButtons onScan={onScan} />
      </BottomBar>
    </div>
  );
}

function ScanButtons({ onScan }: { onScan: (kind: LabelKind) => void }) {
  return (
    <div className="space-y-2">
      <Button onClick={() => onScan('bottle')} icon={<PillBottle className="size-5" aria-hidden />}>
        Scan a bottle
      </Button>
      <Button variant="quiet" onClick={() => onScan('box')} icon={<Package className="size-5" aria-hidden />}>
        Scan a box
      </Button>
    </div>
  );
}
