import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/* Hears a spoken question, on the device.
   - In the iPhone app: native/ios/ListenPlugin.swift (Apple's speech recognizer with
     on-device recognition required, so the audio never leaves the phone).
   - In a browser: the Web Speech API, where the browser supports it. Some browsers
     send audio to their own servers, so the screen says so; typing always works. */

interface ListenPlugin {
  available(o: { lang: string }): Promise<{ available: boolean }>;
  start(o: { lang: string }): Promise<{ text: string }>;
  stop(): Promise<void>;
  addListener(event: 'partial', cb: (d: { text: string }) => void): Promise<PluginListenerHandle>;
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

export const canListen = native || !!WebRecognition;
export const listensOnDevice = native;

export interface Session {
  done: Promise<string>; // the final words heard ('' if nothing)
  stop: () => void;
}

/** Starts listening. `onPartial` gets the words so far. Rejects with a readable message. */
export function listen(lang: string, onPartial: (text: string) => void): Session {
  if (native) {
    let handle: PluginListenerHandle | undefined;
    Native.addListener('partial', (d) => onPartial(d.text)).then((h) => (handle = h));
    const done = Native.start({ lang })
      .then((r) => r.text)
      .finally(() => handle?.remove());
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
  rec.start();
  return { done, stop: () => rec.stop() };
}
