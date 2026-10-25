import { useEffect, useMemo } from 'react';
import { Camera, X } from 'lucide-react';
import type { LabelKind } from '../lib/extract';
import { BottomBar, Button, PhotoButton } from '../components/ui';

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
    steps: [
      'Start with the medicine name facing you. Fill the photo with the label.',
      'Turn the bottle a little, about a quarter turn, so the next part of the label faces you. Keep a few words from the last photo in view.',
      'Turn it a little more and photograph the next part.',
    ],
    more: 'Keep turning until you’ve photographed the whole label, or read it now.',
  },
  box: {
    title: 'Scan a box',
    intro: 'For medicines that come in a box, like dissolving tablets. Take a photo of the pharmacy sticker and of the box itself.',
    min: 2,
    steps: ['The pharmacy sticker, with your name and the directions.', 'The front of the box, with the medicine name and strength.'],
    more: 'If you like, add other sides of the box. They can help with the strength and the maker.',
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
    <div className="flex min-h-full flex-col">
      <h1 className="mt-4 text-[1.6rem] font-extrabold">{g.title}</h1>
      <p className="mt-1 text-[1rem] text-muted">{g.intro}</p>

      {files.length < MAX && (
        <div className="mt-4 rounded-2xl bg-paper p-4 ring-1 ring-rule" aria-live="polite">
          <p className="text-[0.9rem] font-bold text-amber">
            {enough ? 'More photos (optional)' : `Photo ${n} of ${g.min}`}
          </p>
          <p className="mt-1 text-[1.15rem] leading-snug font-bold">{g.steps[files.length] ?? g.more}</p>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Photos taken">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover ring-1 ring-rule" />
              <span className="absolute bottom-1 left-1 rounded-md bg-ink/80 px-1.5 text-[0.85rem] font-bold text-white">{i + 1}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-ink/80 text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomBar>
        {enough ? (
          <>
            <Button onClick={onRead}>Read the label ({files.length} photos)</Button>
            {files.length < MAX && (
              <PhotoButton capture variant="quiet" onFile={add} icon={<Camera className="size-5" aria-hidden />}>
                Take another photo
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
