import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { LabelFields } from '../lib/parseLabel';
import type { Lang } from '../lib/sig';
import { plainLabel } from '../lib/plain';
import { BottomBar, Button, Card, Field, PageTitle, PhotoButton, Spacer, inputClass } from '../components/ui';

interface Props {
  fields: LabelFields;
  raw: string;
  lang: Lang;
  onSave: (f: LabelFields) => void;
  onAddPhoto: (f: File) => void;
  onCancel: () => void;
}

const MAIN: { key: keyof LabelFields; label: string }[] = [
  { key: 'drug', label: 'Medicine' },
  { key: 'strength', label: 'Strength' },
];
const MORE: { key: keyof LabelFields; label: string; type?: string }[] = [
  { key: 'appearance', label: 'Pill description on the label' },
  { key: 'rxNumber', label: 'Rx number' },
  { key: 'refills', label: 'Refills left' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'daysSupply', label: 'Days supply' },
  { key: 'filled', label: 'Date filled' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'pharmacyPhone', label: 'Pharmacy phone', type: 'tel' },
  { key: 'pharmacyAddress', label: 'Pharmacy address' },
  { key: 'prescriber', label: 'Prescriber' },
  { key: 'manufacturer', label: 'Maker' },
  { key: 'ndc', label: 'NDC number' },
];

export default function Review({ fields, raw, lang, onSave, onAddPhoto, onCancel }: Props) {
  const [f, setF] = useState<LabelFields>(fields);
  const set = (k: keyof LabelFields) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const preview = useMemo(() => plainLabel(f, raw, lang), [f, raw, lang]);
  const missing = MAIN.filter((m) => !f[m.key]).map((m) => m.label.toLowerCase());
  if (!f.directions) missing.push('directions');

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageTitle sub="Compare with the bottle and fix anything that’s wrong. Cameras misread curved labels.">Check what ReadRx read</PageTitle>

      {missing.length > 0 && (
        <p className="rise mt-3 flex gap-2.5 rounded-[14px] bg-amber-wash p-3.5 text-[1rem] text-amber shadow-[inset_0_0_0_1px_rgba(125,60,6,.45)]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="font-bold">
            Couldn’t find the {missing.join(' or ')}. Type {missing.length > 1 ? 'them' : 'it'} from the label, or add another photo of that side of the bottle.
          </span>
        </p>
      )}

      <Card as="div" i={1} className="mt-4 space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          {MAIN.map((m) => (
            <Field key={m.key} label={m.label} wide={m.key === 'drug'}>
              <input className={inputClass} value={f[m.key]} onChange={set(m.key)} autoCapitalize="characters" />
            </Field>
          ))}
        </div>

        <Field label="Directions, as printed">
          <textarea className={`${inputClass} min-h-24 resize-y`} value={f.directions} onChange={set('directions')} autoCapitalize="characters" />
        </Field>

        {/* live result, so the person sees exactly what will be read aloud */}
        {f.directions && (
          <div className={`rounded-[14px] p-3.5 ${preview.translated ? 'shadow-[inset_0_0_0_1.5px_var(--tint-ring)] [background:var(--tint),var(--color-card)]' : 'bg-stop-wash shadow-[inset_0_0_0_1px_rgba(152,32,26,.45)]'}`}>
            {preview.translated ? (
              <>
                <p className="text-[0.95rem] font-bold text-accent-deep">ReadRx will say</p>
                <p className="mt-0.5 text-[1.2rem] font-bold text-ink-strong" lang={lang}>
                  {preview.directions}
                </p>
              </>
            ) : (
              <p className="text-[1rem] text-stop">
                <b>ReadRx won’t rewrite these directions</b> because it doesn’t understand every word
                {preview.unknown.length ? ` (${preview.unknown.filter((u) => !u.startsWith('(')).slice(0, 4).join(', ') || preview.unknown[0]})` : ''}. They’ll be read exactly as printed. If they look garbled, correct them above.
              </p>
            )}
          </div>
        )}

      </Card>

      <div className="mt-4 space-y-3">
        <details className="card-sm group rise" style={{ '--i': 2 } as React.CSSProperties}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 text-[1.05rem] font-bold text-ink-strong">
            <span className="flex-1">More details from the label</span>
            <span className="text-accent-deep transition-transform group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <div className="space-y-4 border-t border-divider px-4 pt-3 pb-4">
            {MORE.map((m) => (
              <Field key={m.key} label={m.label}>
                <input className={inputClass} value={f[m.key]} onChange={set(m.key)} type={m.type ?? 'text'} />
              </Field>
            ))}
          </div>
        </details>

        <details className="card-sm group rise" style={{ '--i': 3 } as React.CSSProperties}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 text-[1.05rem] font-bold text-ink-strong">
            <span className="flex-1">Text the camera read</span>
            <span className="text-accent-deep transition-transform group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <pre className="border-t border-divider px-4 py-3 font-sans text-[0.95rem] whitespace-pre-wrap text-muted">{raw}</pre>
        </details>
      </div>

      <Spacer />
      <BottomBar>
        <Button onClick={() => onSave(f)} disabled={!f.drug && !f.directions}>
          Save medicine
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <PhotoButton capture variant="glass" onFile={onAddPhoto}>
            Add photo
          </PhotoButton>
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </BottomBar>
    </div>
  );
}
