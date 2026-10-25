/* The theme color. One accent drives the frame's mesh, the glass tint, rings and
   glows. Text in the accent color is never the accent itself: it's a deeper shade
   worked out per color so it reads at 7:1 or more (see legibleOn). The safety
   colors (ok, stop, amber) are fixed and never come from here. */

export type RGB = [number, number, number];

export const DEFAULT_ACCENT = '#22d3ee';

/** Presets. Red is left out on purpose: it means "stop" in ReadRx. */
export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
];

export const CARD: RGB = [251, 253, 254]; // #fbfdfe, floating cards
export const FRAME: RGB = [227, 240, 245]; // #e3f0f5, the darkest stop of the frame gradient
export const INK: RGB = [19, 33, 43]; // #13212b
export const INK_STRONG: RGB = [8, 19, 26]; // #08131a, headings and any text right on the frame
export const MUTED: RGB = [62, 79, 90]; // #3e4f5a

/** How strong the frame's four mesh blobs are (accent first). */
export const MESH_ALPHA = [0.3, 0.22, 0.17, 0.13];
/** Hue offsets of the other three blobs: neighbors of the accent, so every color
    gets a field in its own family (cyan: blue, indigo and teal). */
const MESH_HUES = [0, 30, 62, -32];
/** The strongest accent wash a control gets (pressed), over the card. */
export const TINT_ON_ALPHA = 0.3;

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export const rgbToHex = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** WCAG relative luminance. */
export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** a mixed toward b by t (0 = a, 1 = b). */
export const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

/** A color at `alpha` painted over an opaque background. */
export const over = (fg: RGB, alpha: number, bg: RGB): RGB => mix(bg, fg, alpha);

/**
 * The color mixed toward `toward` in 4% steps until it reaches `min` contrast
 * against every background. Cooky's legibleOn, with several backgrounds so a
 * pressed button is covered as well as the card.
 */
export function legibleOn(color: RGB, backgrounds: RGB[], min = 7, toward: RGB = [0, 0, 0]): RGB {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const c = mix(color, toward, Math.min(1, t)).map(Math.round) as RGB;
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255].map(Math.round) as RGB;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [ch(hh + 1 / 3), ch(hh), ch(hh - 1 / 3)].map((v) => Math.round(v * 255)) as RGB;
}

/**
 * A color someone picked with the custom picker, kept in the range where the
 * frame stays light enough for body text: very dark or very pale picks are
 * brought to a mid lightness. Presets already sit in this range.
 */
export function normalizeAccent(hex: string): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT)!;
  const [h, s, l] = rgbToHsl(rgb);
  let c = hslToRgb(h, s, Math.min(0.68, Math.max(0.45, l)));
  // deep blues stay dark at mid lightness; lift them until they glow like the presets
  for (let ll = Math.max(0.45, l); luminance(c) < 0.16 && ll < 0.75; ll += 0.02) c = hslToRgb(h, s, ll);
  return rgbToHex(c);
}

export interface AccentTheme {
  rgb: RGB;
  deep: RGB; // accent text on cards and on pressed buttons
  mesh: RGB[]; // the frame's four blobs
}

export function accentTheme(hex: string): AccentTheme {
  const rgb = hexToRgb(normalizeAccent(hex))!;
  const [h, s, l] = rgbToHsl(rgb);
  // the other blobs: the accent's neighbors on the color wheel
  const mesh = MESH_HUES.map((dh, i) => (i === 0 ? rgb : hslToRgb(h + dh, Math.max(0.6, s), Math.min(0.66, Math.max(0.55, l)))));
  const deep = legibleOn(rgb, [CARD, over(rgb, TINT_ON_ALPHA, CARD)], 7);
  return { rgb, deep, mesh };
}

/** The darkest the frame can get behind text: every blob stacked at full strength. */
export function worstFrame(t: AccentTheme): RGB {
  return t.mesh.reduce((bg, c, i) => over(c, MESH_ALPHA[i], bg), FRAME);
}

/** Writes the theme into CSS custom properties on <html>. */
export function applyAccent(hex: string, root: HTMLElement = document.documentElement) {
  const t = accentTheme(hex);
  const triple = (c: RGB) => c.join(', ');
  root.style.setProperty('--accent-rgb', triple(t.rgb));
  root.style.setProperty('--accent', rgbToHex(t.rgb));
  root.style.setProperty('--accent-deep', rgbToHex(t.deep));
  t.mesh.forEach((c, i) => root.style.setProperty(`--mesh-${i + 1}`, triple(c)));
}
