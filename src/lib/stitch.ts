/* Joins the text read from several photos of one label into one text.

   A bottle's label wraps around it, so each photo shows part of the same lines:
   "TAKE ONE TABLET BY MO" in one photo, "TABLET BY MOUTH EVERY DAY" in the next.
   Lines that overlap by at least two words are joined, lines already seen are kept
   once, and anything new is kept in the order it was seen. This works on the text,
   not the pictures, because a curved label doesn't line up as flat images. */

interface Line {
  text: string;
  words: string[]; // normalised, for comparing
}

const norm = (w: string) => w.toUpperCase().replace(/[^A-Z0-9]/g, '');
const toLine = (text: string): Line => ({ text, words: text.split(/\s+/).map(norm).filter(Boolean) });

/** `joinFragments`: join partial lines (bottles). Boxes have flat, separate sides, so only repeats are removed. */
export function stitchTexts(texts: string[], joinFragments = true): string {
  const out: Line[] = [];
  for (const text of texts) {
    let at = -1; // where this photo's previous line landed, so new lines stay in reading order
    for (const raw of text.split('\n')) {
      const line = toLine(raw.trim());
      if (!line.words.length) continue;
      const m = bestMatch(out, line, at, joinFragments);
      if (m) {
        out[m.index] = m.line;
        at = m.index;
      } else {
        out.splice(at + 1, 0, line);
        at += 1;
      }
    }
  }
  return out.map((l) => l.text).join('\n');
}

function bestMatch(out: Line[], line: Line, at: number, joinFragments: boolean): { index: number; line: Line; score: number } | null {
  let best: { index: number; line: Line; score: number } | null = null;
  const consider = (index: number, merged: Line, score: number) => {
    // ties go to the line right after the previous one
    if (!best || score > best.score || (score === best.score && index > at && (best.index <= at || index < best.index))) best = { index, line: merged, score };
  };
  out.forEach((o, i) => {
    if (within(line.words, o.words)) {
      // seen already, but it may finish a word the photo edge cut off ("CHOLESTERO")
      const longer = join(o.text, line.text);
      consider(i, longer ? toLine(longer.text) : o, 100 + line.words.length);
    }
    else if (within(o.words, line.words)) consider(i, line, 100 + o.words.length); // a fuller copy of a line seen already
    else if (joinFragments) {
      const after = join(o.text, line.text);
      if (after) consider(i, toLine(after.text), after.score);
      const before = join(line.text, o.text);
      if (before) consider(i, toLine(before.text), before.score);
    }
  });
  return best;
}

/** Joins `a` and `b` when the end of `a` is the start of `b`. The words at the seam may
    be cut off by the edge of the photo ("MO" for "MOUTH"), and one leftover scrap on
    either side is dropped. */
function join(aText: string, bText: string): { text: string; score: number } | null {
  const a = aText.split(/\s+/).filter((w) => norm(w));
  const b = bText.split(/\s+/).filter((w) => norm(w));
  let best: { text: string; score: number } | null = null;
  for (const dropA of [0, 1]) {
    for (const dropB of [0, 1]) {
      const A = a.slice(0, a.length - dropA).map(norm);
      const B = b.slice(dropB).map(norm);
      for (let k = Math.min(A.length, B.length); k >= 1; k--) {
        let whole = 0;
        let wholeChars = 0;
        let longWord = false;
        let ok = true;
        for (let j = 0; j < k && ok; j++) {
          const x = A[A.length - k + j];
          const y = B[j];
          if (sameWord(x, y)) {
            whole++;
            wholeChars += x.length;
            longWord ||= x.length >= 6; // "REFILLS", "09152026"
          } else if (j === 0 && y.length >= 2 && x.endsWith(y)) {
            /* b starts mid-word */
          } else if (j === k - 1 && x.length >= 2 && y.startsWith(x)) {
            /* a ends mid-word */
          } else ok = false;
        }
        if (!ok || wholeChars < 5) continue;
        // one shared word is enough when it's long ("REFILLS:", a date)
        if (whole < 2 && !longWord) continue;
        const score = whole * 2 - dropA - dropB;
        if (!best || score > best.score) {
          // where they overlap, keep the copy of each word that wasn't at the edge of its
          // photo (edges cut and blur words); if both were, the longer one
          const start = a.length - dropA - k;
          const seam = Array.from({ length: k }, (_, j) => {
            const x = a[start + j];
            const y = b[dropB + j];
            const xEdge = start + j === a.length - 1;
            const yEdge = dropB + j === 0;
            if (xEdge !== yEdge) return xEdge ? y : x;
            return norm(y).length > norm(x).length ? y : x;
          });
          const text = [...a.slice(0, start), ...seam, ...b.slice(dropB + k)].join(' ');
          best = { text, score };
        }
        break;
      }
    }
  }
  return best;
}

/** `part` appears in `whole`, maybe cut off by the photo's edge at either end ("OLESTEROL"). */
function within(part: string[], whole: string[]): boolean {
  for (let i = 0; i + part.length <= whole.length; i++) {
    const ok = part.every((w, j) => {
      const x = whole[i + j];
      if (sameWord(x, w)) return true;
      const first = j === 0 && x.endsWith(w);
      const last = j === part.length - 1 && x.startsWith(w);
      return w.length >= 2 && (first || last);
    });
    if (ok) return true;
  }
  return false;
}

function sameWord(x: string, y: string): boolean {
  if (x === y) return true;
  if (x.length < 5 || /\d/.test(x + y) || Math.abs(x.length - y.length) > 1) return false;
  // one letter off: a misread in one of the photos
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  if (x.length === y.length) return x.slice(i + 1) === y.slice(i + 1);
  return x.length > y.length ? x.slice(i + 1) === y.slice(i) : x.slice(i) === y.slice(i + 1);
}
