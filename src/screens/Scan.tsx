import { useEffect, useMemo, useState } from 'react';
import { readLabel } from '../lib/ocr';
import { readFields, type LabelKind } from '../lib/extract';
import { stitchTexts } from '../lib/stitch';
import type { LabelFields } from '../lib/parseLabel';
import { Button, Card, PageTitle } from '../components/ui';

interface Props {
  files: File[];
  kind: LabelKind;
  prior: string; // text from earlier photos of the same label
  onDone: (raw: string, fields: LabelFields) => void;
  onBack: () => void; // to the photos, to retake or add some
  onCancel: () => void;
}

/** Shows the photos while the label is read on the device. */
export default function Scan({ files, kind, prior, onDone, onBack, onCancel }: Props) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  useEffect(() => {
    let alive = true;
    setError(null);
    setProgress(0);
    setFinding(false);
    (async () => {
      const texts: string[] = [];
      for (const [i, file] of files.entries()) {
        const text = await readLabel(file, (p) => alive && setProgress((i + p) / files.length));
        if (!alive) return;
        if (text.replace(/\s/g, '').length >= 12) texts.push(text);
        setProgress((i + 1) / files.length);
      }
      if (!texts.length) {
        setError(`MediBro couldn’t find any writing in ${files.length > 1 ? 'these photos' : 'this photo'}. Hold the ${kind} closer, in good light, with the label facing the camera.`);
        return;
      }
      setFinding(true);
      // a bottle's photos show parts of the same lines; a box's sides are separate
      const raw = stitchTexts(prior ? [prior, ...texts] : texts, kind === 'bottle');
      const fields = await readFields(raw, kind);
      if (alive) onDone(raw, fields);
    })().catch(() => alive && setError('The text reader didn’t load. Check your internet connection the first time you use MediBro, then try again.'));
    return () => {
      alive = false;
    };
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PageTitle>{error ? 'Try other photos' : 'Reading the label'}</PageTitle>
      <ul className={`mt-4 grid gap-2 ${urls.length > 1 ? 'grid-cols-3' : ''}`} aria-label="Your photos of the label">
        {urls.map((u, i) => (
          <li key={u}>
            <img src={u} alt={`Photo ${i + 1}`} className={`w-full rounded-[14px] shadow-[var(--shadow-md)] ${urls.length > 1 ? 'aspect-square object-cover' : 'max-h-[46vh] object-contain'}`} />
          </li>
        ))}
      </ul>
      {!error ? (
        <Card as="div" i={1} className="mt-5 p-4" role="status" aria-live="polite">
          <div className="h-3 overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--hairline)]">
            <div className="progress-bar h-full rounded-full bg-accent shadow-[0_0_12px_rgba(var(--accent-rgb),.8)]" style={{ width: `${finding ? 100 : Math.max(6, progress * 100)}%` }} />
          </div>
          <p className="mt-3 flex items-center gap-2.5 text-[1rem] text-ink">
            <span className="pulse size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),.9)]" aria-hidden />
            {finding
              ? 'Finding the medicine, strength and directions…'
              : `Reading the text on this phone${files.length > 1 ? `, photo ${Math.min(files.length, Math.floor(progress * files.length) + 1)} of ${files.length}` : ''}… ${Math.round(progress * 100)}%`}
          </p>
        </Card>
      ) : (
        <>
          <Card as="div" i={1} className="mt-4 p-4">
            <p role="alert" className="text-[1.05rem] text-ink-strong">
              {error}
            </p>
          </Card>
          <div className="mt-5 space-y-2.5">
            <Button onClick={onBack}>Retake photos</Button>
            <Button variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
