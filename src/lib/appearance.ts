/* What a pill should look like, read from text: either the description line a
   pharmacy prints ("PINK ROUND TABLET IMPRINT L 10") or the "How supplied"
   section of the FDA drug label. */

export type ColorName = 'white' | 'yellow' | 'orange' | 'pink' | 'red' | 'purple' | 'blue' | 'green' | 'brown' | 'gray' | 'black';
export type ShapeName = 'round' | 'oval' | 'oblong' | 'capsule' | 'other';

export interface Appearance {
  colors: ColorName[];
  shape: ShapeName | null;
  imprint: string | null;
  text: string; // the sentence it came from
}

const COLOR_WORDS: [RegExp, ColorName][] = [
  [/\b(WHITE|OFF-WHITE|OFF WHITE|CREAM|IVORY)\b/, 'white'],
  [/\b(YELLOW|LIGHT YELLOW|PALE YELLOW)\b/, 'yellow'],
  [/\b(ORANGE|PEACH)\b/, 'orange'],
  [/\b(PINK|ROSE|SALMON)\b/, 'pink'],
  [/\b(RED|MAROON)\b/, 'red'],
  [/\b(PURPLE|LAVENDER|VIOLET)\b/, 'purple'],
  [/\b(BLUE|LIGHT BLUE|TURQUOISE)\b/, 'blue'],
  [/\b(GREEN)\b/, 'green'],
  [/\b(BROWN|TAN|BEIGE)\b/, 'brown'],
  [/\b(GRAY|GREY)\b/, 'gray'],
  [/\b(BLACK)\b/, 'black'],
];

const SHAPE_WORDS: [RegExp, ShapeName][] = [
  [/\bCAPSULE-SHAPED|CAPLET\b/, 'oblong'],
  [/\b(HARD|SOFT)?\s?(GELATIN )?CAPSULES?\b/, 'capsule'],
  [/\b(ROUND|CIRCULAR)\b/, 'round'],
  [/\b(OVAL|ELLIPTICAL)\b/, 'oval'],
  [/\b(OBLONG|ELONGATED|RECTANGULAR)\b/, 'oblong'],
  [/\b(TRIANGULAR|TRIANGLE|DIAMOND|PENTAGON|PENTAGONAL|HEXAGON|HEXAGONAL|SQUARE|HEART|OCTAGON)\b/, 'other'],
];

function colorsIn(s: string): ColorName[] {
  const out: ColorName[] = [];
  for (const [re, c] of COLOR_WORDS) if (re.test(s) && !out.includes(c)) out.push(c);
  return out;
}

function shapeIn(s: string): ShapeName | null {
  return SHAPE_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
}

/** "debossed with "L" on one side and "10" on the other" → "L 10" */
function imprintIn(s: string): string | null {
  const m = /(DEBOSSED|ENGRAVED|IMPRINTED|PRINTED|EMBOSSED|MARKED|IMPRINT|IMPRINTS)\b(.*)$/.exec(s);
  if (!m) return null;
  const tail = m[2];
  const quoted = [...tail.matchAll(/["'“”]([^"'“”]{1,12})["'“”]/g)].map((q) => q[1].trim()).filter(Boolean);
  if (quoted.length) return quoted.join(' ');
  const plain = /^\s*(?:WITH|:)?\s*(?:IN [A-Z ]+ INK )?([A-Z0-9][A-Z0-9 \-/]{0,14}?)(?=\s+ON\b|\s*[,.;]|\s+AND\b|$)/.exec(tail);
  return plain ? plain[1].trim() : null;
}

/** From a short pharmacy description line. */
export function appearanceFromDescription(desc: string): Appearance | null {
  const s = desc.toUpperCase();
  const a: Appearance = { colors: colorsIn(s), shape: shapeIn(s), imprint: imprintIn(s), text: desc };
  return a.colors.length || a.shape || a.imprint ? a : null;
}

/**
 * From FDA "How supplied" text: the sentences that mention this strength.
 * Returns every distinct appearance found (different packages can differ).
 */
export function appearancesFromLabel(text: string, strength: string): Appearance[] {
  const num = strength.match(/[\d.]+/)?.[0];
  const unit = (strength.match(/[a-zA-Zµ%]+/)?.[0] ?? 'mg').toUpperCase();
  const flat = text.replace(/\s+/g, ' ');
  const sentences = flat.split(/(?<=\.)\s+(?=[A-Z0-9])/);
  const strengthRe = num ? new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}\\s*${unit}\\b`, 'i') : null;
  const out: Appearance[] = [];
  for (const raw of sentences) {
    if (strengthRe && !strengthRe.test(raw)) continue;
    const s = raw.toUpperCase();
    const a: Appearance = { colors: colorsIn(s), shape: shapeIn(s), imprint: imprintIn(s), text: raw.trim() };
    if (!a.colors.length && !a.imprint) continue;
    if (!out.some((o) => o.imprint === a.imprint && o.colors.join() === a.colors.join())) out.push(a);
  }
  return out.slice(0, 4);
}

/** Colors that photos commonly confuse (warm indoor light turns white to cream/yellow). */
const NEAR: Partial<Record<ColorName, ColorName[]>> = {
  white: ['yellow', 'gray'],
  yellow: ['white', 'orange'],
  orange: ['yellow', 'pink', 'brown', 'red'],
  pink: ['red', 'orange', 'purple'],
  red: ['pink', 'orange', 'brown'],
  purple: ['pink', 'blue'],
  blue: ['purple', 'green', 'gray'],
  green: ['blue', 'yellow'],
  brown: ['orange', 'red'],
  gray: ['white', 'black', 'blue'],
  black: ['gray'],
};

export type Match = 'match' | 'close' | 'mismatch';

export function compareColor(seen: ColorName, expected: ColorName[]): Match {
  if (!expected.length) return 'close';
  if (expected.includes(seen)) return 'match';
  if (expected.some((e) => NEAR[e]?.includes(seen))) return 'close';
  return 'mismatch';
}

export function compareShape(seen: ShapeName, expected: ShapeName | null): Match {
  if (!expected || expected === 'other') return 'close';
  if (seen === expected) return 'match';
  const longish: ShapeName[] = ['oval', 'oblong', 'capsule'];
  if (longish.includes(seen) && longish.includes(expected)) return 'close';
  return 'mismatch';
}
