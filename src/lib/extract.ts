import { cleanOcr, DIRECTION_START, formatStrength, formOf, parseLabel, type LabelFields } from './parseLabel';
import { appearanceFromDescription } from './appearance';
import { modelAvailable, modelFields } from './nativeReader';

/** What was photographed: a round bottle, or a box with a pharmacy sticker (like ondansetron ODT). */
export type LabelKind = 'bottle' | 'box';

/* Picks the label fields. On an iPhone with Apple Intelligence, the on-device model
   reads them, because it copes with real labels: names and strengths on separate lines,
   directions split around other text. A model can also make things up, so each value
   it gives is kept only if every word of it is in the text the camera read. Anything
   it misses or can't back up comes from the built-in rules in parseLabel. */

export async function readFields(raw: string, kind: LabelKind = 'bottle'): Promise<LabelFields> {
  const rules = parseLabel(raw).fields;
  if (!(await modelAvailable())) return rules;
  try {
    return mergeFields(rules, await modelFields(raw, kind), raw);
  } catch (e) {
    console.info('ReadRx: on-device model failed; using the built-in rules', e);
    return rules;
  }
}

export function mergeFields(rules: LabelFields, model: Record<string, string>, raw: string): LabelFields {
  const text = cleanOcr(raw);
  const known = textWords(text);
  const out = { ...rules };
  for (const key of Object.keys(rules) as (keyof LabelFields)[]) {
    const value = tidy(key, model[key] ?? '');
    if (!value || !fits(key, value) || (key === 'form' && rules.form)) continue;
    const backed =
      key === 'form' ? text.split('\n').some((l) => formOf(l) === value)
      : key === 'refills' && value === '0' ? /\b(NO|NONE|0)\b[^\n]*\bREFILL|\bREFILLS?\b[^\n]*\b(NO|NONE|0)\b/.test(text)
      : grounded(value, known);
    if (backed) out[key] = value;
  }
  return out;
}

/** Words that are on the label can still be in the wrong field ("SEE PACKAGE INSERT" as
    the directions, "EACH TABLET CONTAINS 4 MG" as the pill's look), so check the kind of value. */
function fits(key: keyof LabelFields, v: string): boolean {
  if (key === 'directions') return DIRECTION_START.test(v);
  if (key === 'appearance') {
    const a = appearanceFromDescription(v);
    return !!a && (a.colors.length > 0 || a.shape != null);
  }
  return true;
}

/** Puts the model's answer in the same shape the rules produce. */
function tidy(key: keyof LabelFields, v: string): string {
  v = v.toUpperCase().replace(/\s+/g, ' ').trim();
  if (/^(NONE|N\/A|NOT (PRINTED|SHOWN|LISTED))$/.test(v) && key !== 'refills') return '';
  switch (key) {
    case 'drug': {
      // "LISINOPRIL 10MG TABLET" → "LISINOPRIL"
      const name = v.replace(/\s*\d.*$/, '').replace(/\b(TABLETS?|TABS?|CAPSULES?|CAPS?)$/, '');
      return name.replace(/[^A-Z\- /]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    case 'strength':
      return formatStrength(v);
    case 'form':
      return formOf(v);
    case 'prescriber':
      return v.replace(/^DR\.?\s+/, '');
    case 'refills':
      return /^(NONE|NO|NO REFILLS)$/.test(v) ? '0' : (/^\d+$/.exec(v)?.[0] ?? '');
    case 'daysSupply':
    case 'quantity':
      return /^\d+(\.\d+)?/.exec(v)?.[0] ?? '';
    default:
      return v;
  }
}

const split = (s: string) => s.split(/[^A-Z0-9]+/).filter(Boolean);
/** "10MG" → ["10", "MG"] */
const pieces = (w: string) => w.split(/(?<=\d)(?=[A-Z])|(?<=[A-Z])(?=\d)/);

function textWords(text: string): Set<string> {
  const set = new Set<string>();
  for (const w of split(text)) {
    set.add(w);
    for (const p of pieces(w)) set.add(p);
  }
  return set;
}

/** Every word of the value is in the text. Longer words may be one letter off, so the
    model can fix an OCR slip ("LISINOPR1L"); numbers must match exactly. */
function grounded(value: string, known: Set<string>): boolean {
  const has = (w: string) => known.has(w) || (w.length >= 5 && !/\d/.test(w) && [...known].some((k) => oneEditApart(w, k)));
  return split(value).every((w) => has(w) || pieces(w).every(has));
}

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
