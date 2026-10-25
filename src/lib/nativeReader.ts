import { Capacitor, registerPlugin } from '@capacitor/core';
import type { LabelKind } from './extract';

/* The iPhone app's own label reader (native/ios/LabelReader.swift): Apple Vision for
   the text and Apple's on-device language model for the fields. Nothing is uploaded.
   Not there in the browser version, which uses Tesseract and the rules in parseLabel. */

interface LabelReaderPlugin {
  recognizeText(o: { image: string }): Promise<{ text: string }>;
  modelStatus(): Promise<{ available: boolean; reason: string }>;
  extractFields(o: { text: string; kind: LabelKind }): Promise<{ fields: Record<string, string> }>;
}

const LabelReader = registerPlugin<LabelReaderPlugin>('LabelReader');

export const hasNativeReader = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LabelReader');

/** Reads the text in a photo with Apple Vision. */
export async function nativeRecognize(file: File): Promise<string> {
  const t0 = performance.now(); // ZZDEBUG
  console.log(`ZZDEBUG file ${file.name} ${file.type} ${file.size}`); // ZZDEBUG
  const image = await toJpeg(file);
  console.log(`ZZDEBUG jpeg ready ${image.length} after ${Math.round(performance.now() - t0)}ms`); // ZZDEBUG
  const { text } = await LabelReader.recognizeText({ image });
  console.log(`ZZDEBUG text ${text.length} chars after ${Math.round(performance.now() - t0)}ms`); // ZZDEBUG
  return text;
}

let status: Promise<boolean> | null = null;
/** Whether the on-device model can run (iOS 26+ with Apple Intelligence on). */
export function modelAvailable(): Promise<boolean> {
  status ??= hasNativeReader()
    ? LabelReader.modelStatus()
        .then((s) => {
          console.info(s.available ? 'ReadRx: on-device model ready' : `ReadRx: on-device model not available (${s.reason}); using the built-in rules`);
          return s.available;
        })
        .catch(() => false)
    : Promise.resolve(false);
  return status;
}

/** Asks the on-device model for the label fields. Every value still has to be checked against the text. */
export async function modelFields(text: string, kind: LabelKind): Promise<Record<string, string>> {
  const { fields } = await LabelReader.extractFields({ text, kind });
  return fields;
}

/** The photo as a base64 JPEG, upright and no bigger than Vision needs. */
async function toJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  console.log(`ZZDEBUG bitmap ${bitmap.width}x${bitmap.height}`); // ZZDEBUG
  const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
}
