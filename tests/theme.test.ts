import { describe, expect, it } from 'vitest';
import { ACCENTS, CARD, INK_STRONG, MUTED, TINT_ON_ALPHA, accentTheme, contrast, hexToRgb, legibleOn, normalizeAccent, over, rgbToHex, worstFrame } from '../src/lib/theme';

const SAFETY = [
  ['#115a37', '#e4f1e9'],
  ['#98201a', '#fbe9e7'],
  ['#7d3c06', '#f6ebe0'],
] as const;

describe('contrast helper', () => {
  it('matches known WCAG ratios', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBe(1);
    expect(contrast(hexToRgb('#767676')!, [255, 255, 255])).toBeCloseTo(4.54, 1);
  });
  it('parses and writes hex', () => {
    expect(hexToRgb('#22d3ee')).toEqual([34, 211, 238]);
    expect(hexToRgb('fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToHex([34, 211, 238])).toBe('#22d3ee');
  });
  it('deepens a color until it passes', () => {
    const c = legibleOn([34, 211, 238], [CARD], 7);
    expect(contrast(c, CARD)).toBeGreaterThanOrEqual(7);
    // and stops as soon as it passes: one step lighter fails
    expect(contrast(legibleOn([34, 211, 238], [CARD], 4.5), CARD)).toBeLessThan(7);
  });
});

describe('theme colors', () => {
  const picks = [...ACCENTS.map((a) => a.hex), '#000000', '#ffffff', '#ffff00', '#808080', '#ff0000', '#00ff00', '#000080'];
  it.each(picks)('accent text for %s reads at 7:1 on cards and pressed buttons', (hex) => {
    const t = accentTheme(hex);
    expect(contrast(t.deep, CARD)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.deep, over(t.rgb, TINT_ON_ALPHA, CARD))).toBeGreaterThanOrEqual(7);
  });
  it.each(picks)('text on the frame stays at 7:1 on the darkest part of the %s frame', (hex) => {
    const bg = worstFrame(accentTheme(hex));
    expect(contrast(INK_STRONG, bg)).toBeGreaterThanOrEqual(7);
  });
  it('keeps muted text at 7:1 on cards', () => {
    expect(contrast(MUTED, CARD)).toBeGreaterThanOrEqual(7);
  });
  it('keeps custom picks at a mid lightness', () => {
    expect(normalizeAccent('#22d3ee')).toBe('#22d3ee');
    expect(normalizeAccent('#000000')).not.toBe('#000000');
    expect(normalizeAccent('#ffffff')).not.toBe('#ffffff');
    expect(normalizeAccent('garbage')).toBe('#22d3ee');
  });
  it('presets are left as they are', () => {
    for (const a of ACCENTS) expect(normalizeAccent(a.hex)).toBe(a.hex);
  });
  it('gives cyan the deep shade from the design doc', () => {
    expect(contrast(accentTheme('#22d3ee').deep, CARD)).toBeGreaterThanOrEqual(7);
  });
  it.each(SAFETY)('safety color %s reads at 7:1 on its wash', (text, wash) => {
    expect(contrast(hexToRgb(text)!, hexToRgb(wash)!)).toBeGreaterThanOrEqual(7);
  });
});
