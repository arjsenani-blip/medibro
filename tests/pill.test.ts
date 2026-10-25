import { describe, expect, it } from 'vitest';
import { analyzePixels, nameColor } from '../src/lib/pillImage';

/** A synthetic photo: an ellipse of `fill` color on a dark background. */
function photo(w: number, h: number, rx: number, ry: number, fill: [number, number, number], bg: [number, number, number] = [35, 38, 40]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = ((x - w / 2) / rx) ** 2 + ((y - h / 2) / ry) ** 2 <= 1;
      const c = inside ? fill : bg;
      const i = (y * w + x) * 4;
      d[i] = c[0] + ((x * 7 + y * 3) % 5); // a little sensor noise
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  return d;
}

describe('pill photo analysis', () => {
  it('names colors the way pill labels do', () => {
    expect(nameColor([245, 243, 238])).toBe('white');
    expect(nameColor([238, 225, 196])).toBe('white'); // white pill under warm light
    expect(nameColor([236, 160, 180])).toBe('pink');
    expect(nameColor([240, 200, 60])).toBe('yellow');
    expect(nameColor([60, 110, 200])).toBe('blue');
    expect(nameColor([200, 40, 40])).toBe('red');
    expect(nameColor([120, 70, 40])).toBe('brown');
  });
  it('finds a round pink pill', () => {
    const r = analyzePixels(photo(200, 200, 40, 40, [236, 160, 180]), 200, 200);
    expect(typeof r).toBe('object');
    if (typeof r === 'object') {
      expect(r.color).toBe('pink');
      expect(r.shape).toBe('round');
    }
  });
  it('finds an oblong white pill', () => {
    const r = analyzePixels(photo(240, 200, 70, 28, [244, 242, 236]), 240, 200);
    if (typeof r !== 'object') throw new Error(r);
    expect(r.color).toBe('white');
    expect(['oblong', 'capsule']).toContain(r.shape);
  });
  it('says so when there is no pill or the background is busy', () => {
    expect(analyzePixels(photo(100, 100, 0.1, 0.1, [200, 200, 200]), 100, 100)).toBe('no-pill');
    const busy = new Uint8ClampedArray(100 * 100 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 97) % 255));
    expect(analyzePixels(busy, 100, 100)).toBe('busy-background');
  });
});
