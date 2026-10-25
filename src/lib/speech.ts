import { Capacitor, registerPlugin } from '@capacitor/core';
import { LANGUAGES, type Lang } from './sig';

/* Read aloud with the phone's built-in voices. Each line is spoken separately so the
   screen can highlight it.
   - In the iPhone app: native/ios/SpeechPlugin.swift (AVSpeechSynthesizer). The web
     view's own speech is unreliable there (silent-switch mute, dropped utterances).
   - In a browser: the Web Speech API. */

interface SpeechPlugin {
  speak(o: { text: string; lang: string; rate: number }): Promise<{ finished: boolean }>;
  stop(): Promise<void>;
  voices(): Promise<{ languages: string[] }>;
}
const Native = registerPlugin<SpeechPlugin>('Speech');
const native = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Speech');
const web = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const canSpeak = native || web;

const tagFor = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)!.speech;

// installed voice languages in the app (null until loaded)
let nativeLangs: string[] | null = null;
if (native) Native.voices().then((v) => (nativeLangs = v.languages)).catch(() => (nativeLangs = null));

function webVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const tag = tagFor(lang);
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang));
}

/** True when a voice exists — or when the voice list hasn't loaded yet (don't warn too early). */
export function hasVoice(lang: Lang): boolean {
  if (native) return nativeLangs === null || nativeLangs.some((l) => l.toLowerCase().startsWith(lang));
  if (!web) return false;
  if (speechSynthesis.getVoices().length === 0) return true;
  return !!webVoice(lang);
}

let run = 0; // bumps on every new read or stop, so an old read quietly ends

export function speakLines(lines: { text: string; lang: Lang }[], rate: number, onLine: (i: number | null) => void) {
  const my = ++run;
  if (native) {
    (async () => {
      await Native.stop().catch(() => {});
      for (let i = 0; i < lines.length; i++) {
        if (my !== run) return;
        onLine(i);
        const r = await Native.speak({ text: lines[i].text, lang: tagFor(lines[i].lang), rate }).catch(() => ({ finished: false }));
        if (my !== run) return;
        if (!r.finished) break;
      }
      onLine(null);
    })();
    return;
  }
  if (!web) return;
  speechSynthesis.cancel();
  lines.forEach(({ text, lang }, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tagFor(lang);
    const voice = webVoice(lang);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => my === run && onLine(i);
    u.onend = () => my === run && i === lines.length - 1 && onLine(null);
    u.onerror = () => my === run && onLine(null);
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  run++;
  if (native) Native.stop().catch(() => {});
  else if (web) speechSynthesis.cancel();
}

// voices load asynchronously in some browsers
if (web && !native) speechSynthesis.getVoices();
