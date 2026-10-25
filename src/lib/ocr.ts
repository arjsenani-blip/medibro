import { hasNativeReader, nativeRecognize } from './nativeReader';

/* Reads text from a label photo on the device: Apple Vision in the iPhone app,
   Tesseract OCR in the browser. The photo is never uploaded anywhere. */

export async function prepareForOcr(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  // OCR works best around 1600–2000px on the long side
  const scale = Math.min(2, 1800 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // grayscale + contrast stretch: helps with glossy, curved labels
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - lo) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function readLabel(file: File, onProgress: (p: number) => void): Promise<string> {
  if (hasNativeReader()) {
    try {
      return await nativeRecognize(file);
    } catch (e) {
      console.info('ReadRx: Apple Vision failed; using Tesseract', e);
    }
  }
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  try {
    const canvas = await prepareForOcr(file);
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
