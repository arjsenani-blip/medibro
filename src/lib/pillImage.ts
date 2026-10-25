import type { ColorName, ShapeName } from './appearance';

/* Looks at a photo of one pill on a plain background and estimates its color
   and outline. No machine learning: we separate the pill from the background,
   take its typical color, and measure its proportions. That makes the result
   explainable — and honest about when it can't tell. */

export interface PillReading {
  color: ColorName;
  rgb: [number, number, number];
  shape: ShapeName;
  aspect: number; // long side / short side
  coverage: number; // share of the photo the pill fills
}

export type PillError = 'no-pill' | 'too-big' | 'busy-background';

/** RGB → named color (hue bins tuned for pill photos). */
export function nameColor([r, g, b]: [number, number, number]): ColorName {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;

  if (l > 0.82 && s < 0.6) return 'white'; // includes white pills under warm indoor light
  if (s < 0.14) return l < 0.22 ? 'black' : l > 0.72 ? 'white' : 'gray';
  if (l < 0.12) return 'black';
  if ((h < 45 || h >= 340) && l < 0.38) return 'brown';
  if (h >= 340 || h < 12) return l > 0.62 ? 'pink' : 'red';
  if (h < 40) return l > 0.7 ? 'pink' : 'orange';
  if (h < 70) return 'yellow';
  if (h < 165) return 'green';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

export function shapeFrom(aspect: number, fill: number): ShapeName {
  if (aspect < 1.18) return 'round';
  if (fill > 0.84 && aspect > 1.9) return 'capsule';
  if (aspect > 1.6) return 'oblong';
  return 'oval';
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Core analysis on raw RGBA pixels (exported for tests). */
export function analyzePixels(data: Uint8ClampedArray, w: number, h: number): PillReading | PillError {
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as [number, number, number];
  };
  // background = median of the border
  const border: [number, number, number][] = [];
  for (let x = 0; x < w; x += 2) border.push(px(x, 0), px(x, h - 1));
  for (let y = 0; y < h; y += 2) border.push(px(0, y), px(w - 1, y));
  const bg: [number, number, number] = [median(border.map((p) => p[0])), median(border.map((p) => p[1])), median(border.map((p) => p[2]))];
  const dist = (p: [number, number, number]) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
  const borderSpread = median(border.map(dist));
  if (borderSpread > 40) return 'busy-background';

  const threshold = Math.max(45, borderSpread * 3);
  const xs: number[] = [];
  const ys: number[] = [];
  const fg: [number, number, number][] = [];
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const p = px(x, y);
      if (dist(p) > threshold) {
        xs.push(x);
        ys.push(y);
        fg.push(p);
      }
    }
  const sampled = Math.ceil(w / 2) * Math.ceil(h / 2);
  const coverage = fg.length / sampled;
  if (coverage < 0.01) return 'no-pill';
  if (coverage > 0.7) return 'too-big';

  // trim stray pixels (shadows, specks): use the 3rd–97th percentile box
  const sx = [...xs].sort((a, b) => a - b);
  const sy = [...ys].sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * f))];
  const bw = q(sx, 0.97) - q(sx, 0.03) + 2;
  const bh = q(sy, 0.97) - q(sy, 0.03) + 2;
  const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
  const fill = fg.length / ((bw / 2) * (bh / 2));

  // typical color = median of the pill's pixels, ignoring the brightest glare
  const lum = (p: [number, number, number]) => p[0] + p[1] + p[2];
  const sorted = [...fg].sort((a, b) => lum(a) - lum(b));
  const body = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.9)));
  const rgb: [number, number, number] = [median(body.map((p) => p[0])), median(body.map((p) => p[1])), median(body.map((p) => p[2]))];

  return { color: nameColor(rgb), rgb, shape: shapeFrom(aspect, Math.min(1, fill)), aspect: Math.round(aspect * 100) / 100, coverage };
}

/** Load a photo, shrink it, and analyze it in the browser. Nothing is uploaded. */
export async function analyzePhoto(file: File): Promise<PillReading | PillError> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return analyzePixels(ctx.getImageData(0, 0, w, h).data, w, h);
}
