import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { rms, rmsToLevel } from './level';

/* Hears a spoken question, on the device.
   - In the iPhone app: native/ios/ListenPlugin.swift (Apple's speech recognizer with
     on-device recognition required, so the audio never leaves the phone).
   - In a browser: the Web Speech API, where the browser supports it. Some browsers
     send audio to their own servers, so the screen says so; typing always works.
   Both also report the microphone level (0–1) for the waveform. */

interface ListenPlugin {
  available(o: { lang: string }): Promise<{ available: boolean }>;
  start(o: { lang: string }): Promise<{ text: string }>;
  stop(): Promise<void>;
  addListener(event: 'partial', cb: (d: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'level', cb: (d: { value: number }) => void): Promise<PluginListenerHandle>;
}
const Native = registerPlugin<ListenPlugin>('Listen');
const native = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Listen');

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const WebRecognition: (new () => Recognition) | undefined =
  typeof window === 'undefined' ? undefined : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined;

const fakeMic = () => import.meta.env.DEV && typeof window !== 'undefined' && !!(window as unknown as { __readrxFakeMic?: boolean }).__readrxFakeMic;
export const canListen = native || !!WebRecognition || fakeMic();
export const listensOnDevice = native;

export interface Session {
  done: Promise<string>; // the final words heard ('' if nothing)
  stop: () => void;
}

/** Starts listening. `onPartial` gets the words so far, `onLevel` the raw mic level.
    Rejects with a readable message. */
export function listen(lang: string, onPartial: (text: string) => void, onLevel: (level: number) => void = () => {}): Session {
  if (fakeMic()) return fakeSession(onPartial, onLevel);
  if (native) {
    const handles: Promise<PluginListenerHandle>[] = [Native.addListener('partial', (d) => onPartial(d.text)), Native.addListener('level', (d) => onLevel(d.value))];
    const done = Native.start({ lang })
      .then((r) => r.text)
      .finally(() => handles.forEach((h) => h.then((x) => x.remove())));
    return { done, stop: () => void Native.stop() };
  }
  if (!WebRecognition) return { done: Promise.reject(new Error('This browser can’t listen. Type your question instead.')), stop: () => {} };
  const rec = new WebRecognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  let text = '';
  const done = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      text = Array.from(e.results, (r) => r[0].transcript).join(' ');
      onPartial(text);
    };
    rec.onerror = (e) => (e.error === 'no-speech' || e.error === 'aborted' ? resolve(text) : reject(new Error(e.error === 'not-allowed' ? 'The microphone isn’t allowed. Type your question instead.' : 'Couldn’t hear that. Try again, or type your question.')));
    rec.onend = () => resolve(text);
  });
  const meter = webMeter(onLevel);
  done.finally(() => meter.then((stop) => stop())).catch(() => {});
  rec.start();
  return { done, stop: () => rec.stop() };
}

/** Mic level in the browser: an AnalyserNode on its own getUserMedia stream.
    Resolves to a function that stops it and releases the microphone. */
async function webMeter(onLevel: (level: number) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) return () => {};
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return () => {}; // the waveform just stays flat
  }
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    onLevel(rmsToLevel(rms(buf)));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    onLevel(0);
  };
}

/** Development only: a pretend microphone that "speaks" in bursts, for screenshots. */
function fakeSession(onPartial: (text: string) => void, onLevel: (level: number) => void): Session {
  const t0 = performance.now();
  let said = '';
  let stop = () => {};
  const done = new Promise<string>((resolve) => {
    const id = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const syllables = Math.max(0, Math.sin(t * 9)) * (0.55 + 0.45 * Math.sin(t * 1.3));
      // talks for about 2 s, then goes quiet, so end-of-speech detection can be seen working
      const fixed = (window as unknown as { __readrxFakeLevel?: number }).__readrxFakeLevel;
      onLevel(fixed ?? (t < 2 ? Math.max(0, Math.min(1, 0.15 + 0.8 * syllables)) : 0.03));
      const words = t > 1.6 ? 'I have a headache' : t > 0.8 ? 'I have a' : '';
      if (words && words !== said) onPartial((said = words));
    }, 40);
    stop = () => (clearInterval(id), onLevel(0), resolve(said));
  });
  return { done, stop: () => stop() };
}
