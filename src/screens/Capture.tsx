import { useEffect, useMemo } from 'react';
import { Camera, X } from 'lucide-react';
import type { LabelKind } from '../lib/extract';
import { BottomBar, Button, Card, PageTitle, PhotoButton, Spacer } from '../components/ui';

interface Props {
  kind: LabelKind;
  files: File[];
  onChange: (files: File[]) => void;
  onRead: () => void;
  onCancel: () => void;
}

const MAX = 8;

const GUIDE: Record<LabelKind, { title: string; intro: string; min: number; steps: string[]; more: string }> = {
  bottle: {
    title: 'Scan a bottle',
    intro: 'The label wraps around the bottle, so take at least 3 photos as you turn it. ReadRx puts them together.',
    min: 3,
    steps: ['Medicine name facing you. Fill the photo with the label.', 'Turn the bottle a quarter turn. Keep a few words from the last photo in view.', 'Turn it a little more.'],
    more: 'Add more photos, or read it now.',
  },
  box: {
    title: 'Scan a box',
    intro: 'For medicines that come in a box, like dissolving tablets. Take a photo of the pharmacy sticker and of the box itself.',
    min: 2,
    steps: ['The pharmacy sticker.', 'The front of the box.'],
    more: 'Add other sides, or read it now.',
  },
};

/** Takes the photos of one label, one step at a time. */
export default function Capture({ kind, files, onChange, onRead, onCancel }: Props) {
  const g = GUIDE[kind];
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const n = files.length + 1;
  const enough = files.length >= g.min;
  const add = (f: File) => onChange([...files, f]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageTitle>{g.title}</PageTitle>

      {files.length < MAX && (
        <Card as="div" i={1} key={files.length} className="mt-4 p-4" aria-live="polite">
          <p className="flex items-center gap-2.5 text-[1rem] font-bold text-accent-deep">
            <span className="glyph size-9 text-[1rem]">{enough ? '+' : n}</span>
            {enough ? 'More photos (optional)' : `Photo ${n} of ${g.min}`}
          </p>
          {!enough && (
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {Array.from({ length: g.min }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < files.length ? 'bg-accent-deep' : i === files.length ? 'bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),.8)]' : 'bg-surface shadow-[inset_0_0_0_1px_var(--color-rule)]'}`} />
              ))}
            </div>
          )}
          <p className="mt-3 text-[1.2rem] leading-snug font-bold text-ink-strong">{g.steps[files.length] ?? g.more}</p>
        </Card>
      )}

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Photos taken">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-[14px] object-cover shadow-[var(--shadow-md)]" />
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink-strong/85 px-2 text-[0.9rem] font-bold text-white">{i + 1}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -top-1 -right-1 grid size-12 place-items-center rounded-full"
              >
                <span className="grid size-9 place-items-center rounded-full bg-ink-strong/85 text-white shadow-[0_0_0_2px_var(--color-card)]">
                  <X className="size-5" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Spacer />
      <BottomBar>
        {enough ? (
          <>
            <Button onClick={onRead}>Read it ({files.length} photos)</Button>
            {files.length < MAX && (
              <PhotoButton capture variant="glass" onFile={add} icon={<Camera className="size-5" aria-hidden />}>
                Another photo
              </PhotoButton>
            )}
          </>
        ) : (
          <PhotoButton capture onFile={add} icon={<Camera className="size-5" aria-hidden />}>
            Take photo {n}
          </PhotoButton>
        )}
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </BottomBar>
    </div>
  );
}
