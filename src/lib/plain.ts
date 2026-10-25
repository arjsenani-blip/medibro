import type { LabelFields } from './parseLabel';
import { parseSig, writeSig, type Lang } from './sig';
import { findWarnings, WARNING_TEXT, type WarningId } from './warnings';

export interface PlainLabel {
  name: string; // "Lisinopril 10 mg tablet"
  directions: string; // in the chosen language, or exactly as printed
  translated: boolean; // false = we could not safely rewrite it
  unknown: string[];
  purpose: string | null; // as printed
  warnings: { id: WarningId; text: string }[];
}

/** "METFORMIN HCL ER" → "Metformin HCl ER" (keeps chemistry and release abbreviations). */
const KEEP: Record<string, string> = { HCL: 'HCl', HBR: 'HBr', ER: 'ER', XR: 'XR', SR: 'SR', CR: 'CR', DR: 'DR', XL: 'XL', ODT: 'ODT', HCT: 'HCT', HCTZ: 'HCTZ', USP: 'USP' };
export const title = (s: string) => s.split(/(\s+|-|\/)/).map((w) => KEEP[w.toUpperCase()] ?? w.toLowerCase().replace(/^[a-z]/, (c) => c.toUpperCase())).join('');
/** "563 MASSACHUSETTS AVE, ACTON, MA 01720" → "563 Massachusetts Ave, Acton, MA 01720" */
export const titleAddress = (s: string) => title(s).replace(/, ([A-Z][a-z])\b(?=( \d{5}|$))/, (_m, st: string) => `, ${st.toUpperCase()}`);

export function plainLabel(f: LabelFields, raw: string, lang: Lang): PlainLabel {
  const r = parseSig(f.directions);
  const translated = !!r.sig && r.unknown.length === 0;
  const fromSig: WarningId[] = r.sig?.food === 'with' ? ['food'] : r.sig?.food === 'empty' ? ['empty'] : [];
  const ids = findWarnings(raw.toUpperCase().replace(f.directions.toUpperCase(), ' '), fromSig);
  return {
    name: [title(f.drug), f.strength, lang === 'en' ? f.form : ''].filter(Boolean).join(' '),
    directions: translated ? writeSig(r.sig!, lang) : f.directions,
    translated,
    unknown: r.unknown,
    purpose: r.purpose ? r.purpose.toLowerCase() : null,
    warnings: ids.map((id) => ({ id, text: WARNING_TEXT[id][lang] })),
  };
}

export interface SpokenLine {
  text: string;
  lang: Lang;
}

/** What gets read aloud, line by line. Untranslated directions are read in English. */
export function spokenLines(p: PlainLabel, lang: Lang): SpokenLine[] {
  return [
    { text: p.name, lang },
    { text: p.translated ? p.directions : p.directions.toLowerCase(), lang: p.translated ? lang : ('en' as Lang) },
    ...p.warnings.map((w) => ({ text: w.text, lang })),
  ].filter((l) => l.text);
}
