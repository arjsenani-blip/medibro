import { parseSig, type SigResult } from './sig';
import { findWarnings, type WarningId } from './warnings';

/* Pulls the fields a patient needs out of the text read from a label.
   Every field may be missing or wrong (OCR on a curved bottle is imperfect),
   so the app always shows the result for the person to check and correct. */

export interface LabelFields {
  drug: string;
  strength: string;
  form: string;
  directions: string; // as printed
  rxNumber: string;
  quantity: string;
  refills: string;
  filled: string;
  prescriber: string;
  daysSupply: string; // "DAYS SUPPLY: 30" when the pharmacy prints it
  pharmacy: string;
  pharmacyPhone: string;
  pharmacyAddress: string; // "563 MASSACHUSETTS AVE ACTON MA 01720"
  ndc: string;
  manufacturer: string;
  appearance: string; // "PINK ROUND TABLET IMPRINT L 10" when the pharmacy prints it
}

export interface ParsedLabel {
  fields: LabelFields;
  sig: SigResult;
  warnings: WarningId[];
}

export const DIRECTION_START = /^(TAKE|GIVE|APPLY|RUB|INHALE|INSTILL|PUT|USE|SPRAY|INJECT|PLACE|INSERT|CHEW|DISSOLVE)\b/;
const FIELD_START = /^(QTY|QUANTITY|REFILL|RX|DR\b|DR\.|PRESCRIBER|MFG|MFR|NDC|DATE|FILLED|DISCARD|DESC|DESCRIPTION|USE BEFORE|EXP)/;
const STRENGTH = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(MG\/ML|MG\/5\s?ML|MCG\/ACT|MG|MCG|G|ML|%|UNITS\/ML|UNIT\/ML|MEQ)\b/;
const FORMS: [RegExp, string][] = [
  [/\b(ORALLY DISINTEGRATING|ODT)\b/, 'orally disintegrating tablet'],
  [/\b(TABLETS?|TABS?)\b/, 'tablet'],
  [/\b(CAPSULES?|CAPS?)\b/, 'capsule'],
  [/\b(SOLUTION|SOLN)\b/, 'solution'],
  [/\b(SUSPENSION|SUSP)\b/, 'suspension'],
  [/\b(CREAM)\b/, 'cream'],
  [/\b(OINTMENT|OINT)\b/, 'ointment'],
  [/\b(INHALER|AEROSOL|HFA)\b/, 'inhaler'],
  [/\b(DROPS?|OPHTH)\b/, 'drops'],
  [/\b(PATCH)\b/, 'patch'],
];

/** Lines that mention a strength but don't name the medicine. */
const NOT_NAME = /^(QTY|NDC|RX|DESC|EACH|CONTAINS|USUAL|DOSAGE|STORE|SEE|KEEP|WARNING|INACTIVE|ACTIVE)\b/;
/** "ORALLY DISINTEGRATING TABLETS USP" after a name on a box */
const FORM_WORDS = /\s*\b(ORALLY DISINTEGRATING|ODT|EXTENDED[- ]RELEASE|DELAYED[- ]RELEASE|TABLETS?|CAPSULES?|ORAL|SOLUTION|SUSPENSION|USP)\b.*$/;
const lettersOnly = (s: string) => s.replace(/[^A-Z\- /]/g, ' ').replace(/\s+/g, ' ').trim();

export const EMPTY_FIELDS: LabelFields = {
  drug: '', strength: '', form: '', directions: '', rxNumber: '', quantity: '', refills: '', filled: '',
  prescriber: '', daysSupply: '', pharmacyAddress: '', pharmacy: '', pharmacyPhone: '', ndc: '', manufacturer: '', appearance: '',
};

// "DR" is left out: on labels it's far more often the prescriber than a drive
const STREET = /\b\d{1,6} (?:[A-Z0-9.'-]+ ){1,5}?(ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|DRIVE|LN|LANE|WAY|HWY|HIGHWAY|PKWY|PL|PLACE|CT|COURT|SQ|PLAZA|TPKE|CIR)\b\.?/;
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '));
/** "ACTON, MA 01720" or "BOSTON MA" right after the street */
const CITY = /^,?\s*([A-Z][A-Z .'-]{1,30}?),?\s+([A-Z]{2})\b(?:,?\s+(\d{5}(?:-\d{4})?))?/;

/** The pharmacy's street address, with the city, state and ZIP when they follow it. */
function findAddress(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const m = STREET.exec(lines[i]);
    if (!m) continue;
    const street = m[0].replace(/\.$/, '');
    const city = (t: string) => {
      const c = CITY.exec(t);
      return c && STATES.has(c[2]) ? `${c[1].trim()}, ${c[2]}${c[3] ? ` ${c[3]}` : ''}` : '';
    };
    const place = city(lines[i].slice(m.index + m[0].length)) || city(lines[i + 1] ?? '');
    return place ? `${street}, ${place}` : street;
  }
  return '';
}

/** "10MG" → "10 mg"; the strength regex match, or text to find it in. */
export function formatStrength(m: RegExpExecArray | string): string {
  const match = typeof m === 'string' ? STRENGTH.exec(m.toUpperCase()) : m;
  if (!match) return '';
  return `${match[1].replace(/\s/g, '')} ${match[2].replace(/\s/g, '').toLowerCase().replace('ml', 'mL').replace('meq', 'mEq')}`;
}

/** "TABLETS" → "tablet" */
export const formOf = (text: string) => FORMS.find(([re]) => re.test(text.toUpperCase()))?.[1] ?? '';

/** Normalise common OCR slips in the parts of a label we care about. */
export function cleanOcr(text: string): string {
  return text
    .toUpperCase()
    .replace(/[|]/g, 'I')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\b(\d+)\s*M\s*G\b/g, '$1MG')
    .replace(/\bTAB1ET/g, 'TABLET')
    .replace(/\bTABIET/g, 'TABLET')
    .replace(/\b0NCE\b/g, 'ONCE')
    .replace(/\bM0UTH\b/g, 'MOUTH')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

export function parseLabel(raw: string): ParsedLabel {
  const text = cleanOcr(raw);
  const lines = text.split('\n');
  const f: LabelFields = { ...EMPTY_FIELDS };

  // Directions: from the first "TAKE …" line until the next labelled field
  const start = lines.findIndex((l) => DIRECTION_START.test(l));
  if (start >= 0) {
    const parts: string[] = [];
    for (let i = start; i < lines.length && parts.length < 4; i++) {
      const l = lines[i];
      if (i > start && (FIELD_START.test(l) || STRENGTH.test(l) || /\b(WARNING|CAUTION)\b/.test(l))) break;
      parts.push(l);
    }
    f.directions = parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Drug name + strength: the first line with a strength that isn't directions.
  // On boxes the strength often sits under the name ("ONDANSETRON / ORALLY
  // DISINTEGRATING TABLETS USP / 4 MG"), so then the name comes from the lines above.
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (DIRECTION_START.test(l) || NOT_NAME.test(l)) continue;
    const m = STRENGTH.exec(l);
    if (!m) continue;
    let name = lettersOnly(l.slice(0, m.index));
    let source = l;
    if (name.length < 3) {
      const above = lines.slice(Math.max(0, i - 2), i).filter((a) => !NOT_NAME.test(a) && !DIRECTION_START.test(a) && !/\d/.test(a) && !/PHARMACY/.test(a));
      source = [...above, l].join(' ');
      name = lettersOnly(above.join(' ')).replace(FORM_WORDS, '').trim();
    }
    if (name.length < 3) continue;
    f.drug = name;
    f.strength = formatStrength(m);
    f.form = formOf(source);
    break;
  }

  const grab = (re: RegExp) => re.exec(text)?.[1]?.trim() ?? '';
  f.rxNumber = grab(/\bRX\s*(?:#|NO\.?|NUMBER)?\s*:?\s*(\d{5,10})\b/);
  f.quantity = grab(/\b(?:QTY|QUANTITY)\s*:?\s*(\d+(?:\.\d+)?)/);
  const refills = grab(/\bREFILLS?\s*(?:LEFT|REMAINING)?\s*:?\s*(\d+|NONE|NO)\b/);
  f.refills = refills === 'NONE' || refills === 'NO' ? '0' : refills;
  f.filled = grab(/\b(?:DATE(?: FILLED)?|FILLED|FILL DATE)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  f.prescriber = grab(/\b(?:DR\.?|PRESCRIBER\s*:?)\s+([A-Z][A-Z .'-]{2,30}?)(?=\s{2,}|\s+(?:QTY|REFILL|RX|MFG|NDC)|$|\n)/m);
  f.daysSupply = grab(/\b(?:DAYS?'? ?SUPPLY|DAY SUPPLY|DS)\s*:?\s*(\d{1,3})\b/);
  f.ndc = grab(/\bNDC\s*:?\s*#?\s*(\d{4,5}-\d{3,4}-\d{1,2}|\d{11})\b/);
  f.manufacturer = grab(/\b(?:MFG|MFR|MANUFACTURER)\s*:?\s*([A-Z][A-Z &.-]{1,30}?)(?=\s{2,}|\s+NDC|$|\n)/m);
  f.appearance = grab(/\b(?:DESC(?:RIPTION)?|THIS (?:MEDICINE|MEDICATION) IS(?: A)?)\s*:?\s*([^\n]{6,80})/);
  f.pharmacyAddress = findAddress(lines);
  f.pharmacyPhone = grab(/(\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4})/);
  f.pharmacy = lines.find((l) => /PHARMACY|DRUG|APOTHECARY|CHEMIST/.test(l) && !STRENGTH.test(l))?.replace(/\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4}/, '').trim() ?? '';

  const sig = parseSig(f.directions);
  const fromSig: WarningId[] = sig.sig?.food === 'with' ? ['food'] : sig.sig?.food === 'empty' ? ['empty'] : [];
  // look for warnings outside the directions line so "with food" isn't repeated
  const warnings = findWarnings(text.replace(f.directions, ' '), fromSig);
  return { fields: f, sig, warnings };
}

/** A built-in, clearly fictional label for trying the app without a bottle. */
export const SAMPLE_LABEL = `MAIN STREET PHARMACY
12 MAIN ST ACTON MA (978) 555-0142
RX# 6024817 DATE: 09/28/2026
TAKE 1 TABLET BY MOUTH ONCE DAILY
FOR BLOOD PRESSURE
LISINOPRIL 10MG TABLETS
QTY: 30 REFILLS: 2 DR. A PATEL
MFG: SAMPLE LABS
DESC: PINK ROUND TABLET IMPRINT RX 10
MAY CAUSE DIZZINESS
DO NOT DRINK ALCOHOL`;
