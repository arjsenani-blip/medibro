import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { LabelFields } from '../lib/parseLabel';
import type { Lang } from '../lib/sig';
import { plainLabel } from '../lib/plain';
import { BottomBar, Button, Field, PhotoButton, inputClass } from '../components/ui';

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
    <div className="flex min-h-full flex-col">
      <h1 className="mt-4 text-[1.6rem] font-extrabold">Check what ReadRx read</h1>
      <p className="mt-1 text-[1rem] text-muted">Compare with the bottle and fix anything that’s wrong. Cameras misread curved labels.</p>

      {missing.length > 0 && (
        <p className="mt-3 flex gap-2 rounded-xl bg-amber-wash p-3 text-[0.95rem]">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden />
          <span>
            Couldn’t find the {missing.join(' or ')}. Type {missing.length > 1 ? 'them' : 'it'} from the label, or add another photo of that side of the bottle.
          </span>
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          {MAIN.map((m) => (
            <Field key={m.key} label={m.label}>
              <input className={inputClass} value={f[m.key]} onChange={set(m.key)} autoCapitalize="characters" />
            </Field>
          ))}
        </div>

        <Field label="Directions, as printed">
          <textarea className={`${inputClass} min-h-24 resize-y`} value={f.directions} onChange={set('directions')} autoCapitalize="characters" />
        </Field>

        {/* live result, so the person sees exactly what will be read aloud */}
        {f.directions && (
          <div className={`rounded-xl p-3.5 ${preview.translated ? 'bg-paper ring-1 ring-rule' : 'bg-stop-wash'}`}>
            {preview.translated ? (
              <>
                <p className="text-[0.85rem] font-bold text-muted">ReadRx will say</p>
                <p className="mt-0.5 text-[1.15rem] font-bold" lang={lang}>
                  {preview.directions}
                </p>
              </>
            ) : (
              <p className="text-[0.95rem] text-stop">
                <b>ReadRx won’t rewrite these directions</b> because it doesn’t understand every word
                {preview.unknown.length ? ` (${preview.unknown.filter((u) => !u.startsWith('(')).slice(0, 4).join(', ') || preview.unknown[0]})` : ''}. They’ll be read exactly as printed. If they look garbled, correct them above.
              </p>
            )}
          </div>
        )}

        <details className="group rounded-xl bg-paper ring-1 ring-rule">
          <summary className="cursor-pointer list-none px-3.5 py-3 text-[1rem] font-bold">More details from the label</summary>
          <div className="space-y-4 border-t border-rule px-3.5 pt-3 pb-4">
            {MORE.map((m) => (
              <Field key={m.key} label={m.label}>
                <input className={inputClass} value={f[m.key]} onChange={set(m.key)} type={m.type ?? 'text'} />
              </Field>
            ))}
          </div>
        </details>

        <details className="rounded-xl bg-paper ring-1 ring-rule">
          <summary className="cursor-pointer list-none px-3.5 py-3 text-[1rem] font-bold">Text the camera read</summary>
          <pre className="border-t border-rule px-3.5 py-3 font-sans text-[0.9rem] whitespace-pre-wrap text-muted">{raw}</pre>
        </details>
      </div>

      <BottomBar>
        <Button onClick={() => onSave(f)} disabled={!f.drug && !f.directions}>
          Save medicine
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <PhotoButton capture variant="quiet" onFile={onAddPhoto}>
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
