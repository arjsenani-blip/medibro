import { describe, expect, it } from 'vitest';
import { clamp01, dbToLevel, rms, rmsToLevel, smoothLevel } from '../src/lib/level';

describe('dB to level', () => {
  it('maps -50 dB to 0 and 0 dB to 1', () => {
    expect(dbToLevel(-50)).toBe(0);
    expect(dbToLevel(0)).toBe(1);
    expect(dbToLevel(-25)).toBeCloseTo(0.5);
  });
  it('clamps outside the range and handles silence', () => {
    expect(dbToLevel(-90)).toBe(0);
    expect(dbToLevel(6)).toBe(1);
    expect(dbToLevel(-Infinity)).toBe(0);
    expect(dbToLevel(NaN)).toBe(0);
    expect(rmsToLevel(0)).toBe(0);
    expect(rmsToLevel(1)).toBe(1);
    expect(rmsToLevel(0.1)).toBeCloseTo(0.6); // -20 dB
  });
  it('computes RMS', () => {
    expect(rms([])).toBe(0);
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
  });
});

describe('smoothing', () => {
  const run = (from: number, to: number, seconds: number, step = 1 / 60) => {
    let v = from;
    for (let t = 0; t < seconds; t += step) v = smoothLevel(v, to, step);
    return v;
  };
  it('rises fast (attack)', () => {
    expect(run(0, 1, 0.1)).toBeGreaterThan(0.8);
  });
  it('falls slower than it rises (release)', () => {
    const up = run(0, 1, 0.1);
    const down = 1 - run(1, 0, 0.1);
    expect(up).toBeGreaterThan(down * 2);
  });
  it('decays to exactly 0 in silence', () => {
    expect(run(1, 0, 3)).toBe(0);
  });
  it('stays within 0–1 whatever comes in', () => {
    expect(smoothLevel(0.5, 7, 1)).toBeLessThanOrEqual(1);
    expect(smoothLevel(0.5, -3, 1)).toBeGreaterThanOrEqual(0);
    expect(smoothLevel(0.5, -3, 1)).toBeLessThan(0.05);
    expect(smoothLevel(0.5, NaN, 0.016)).toBeGreaterThanOrEqual(0);
    expect(smoothLevel(0.5, 0.5, -1)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
});
