/* One spoken turn with the assistant, as a small state machine:

     idle ──tap──▶ listening ──(1.3 s quiet after words, or 15 s cap, or recognizer ends)──▶ ending
       ▲              │ no words for 6 s: "I didn't catch that"                               │ recognizer stopped
       │              ▼                                                                       ▼
       └──── speaking ◀────────────── thinking (a short beat, then the answer) ◀────────────────┘
               │ tap stops the speech
               └─ after the disposal answer only: listens once more (5 s) for yes / no

   `step` is pure: it returns the next state and the effects to run (start or stop
   the microphone, think, speak). The screen runs the effects; tests drive it with
   made-up times. */

export type Phase = 'idle' | 'listening' | 'ending' | 'thinking' | 'speaking';

export interface Turn {
  phase: Phase;
  startedAt: number; // listening began
  lastActiveAt: number; // last new words, or the voice still loud
  heard: string; // words so far
  waitMs: number; // how long to wait for the first words
  followUp: boolean; // this listen is the yes/no after the disposal answer
  askAgain: boolean; // after speaking, listen once for yes/no
  lastTapAt: number;
}

export const TIMING = {
  silenceMs: 1300, // quiet after words → the turn is over
  noSpeechMs: 6000, // no words at all → "I didn't catch that"
  followUpMs: 5000, // waiting for yes / no
  capMs: 15000, // longest a turn can listen
  endingMs: 2500, // longest to wait for the recognizer to hand back the words
  tapDebounceMs: 400,
  quietLevel: 0.12, // mic level below this counts as silence
  thinkMs: 300,
};

export const NO_SPEECH = 'I didn’t catch that. Tap the orb and try again.';

export const IDLE: Turn = { phase: 'idle', startedAt: 0, lastActiveAt: 0, heard: '', waitMs: TIMING.noSpeechMs, followUp: false, askAgain: false, lastTapAt: -Infinity };

export type Event =
  | { type: 'tap'; at: number }
  | { type: 'typed'; text: string } // a typed question or a chip
  | { type: 'partial'; text: string; at: number }
  | { type: 'level'; value: number; at: number }
  | { type: 'tick'; at: number }
  | { type: 'heard'; text: string; at: number } // the recognizer stopped and gave its final words
  | { type: 'error'; message: string }
  | { type: 'answered'; lines: string[]; askAgain: boolean }
  | { type: 'spoken'; at: number }; // finished speaking

export type Effect =
  | { type: 'listen' }
  | { type: 'endListening' } // stop and keep the words
  | { type: 'cancelListening' } // stop and drop them
  | { type: 'think'; text: string; followUp: boolean }
  | { type: 'speak'; lines: string[] }
  | { type: 'stopSpeaking' };

type Result = { turn: Turn; effects: Effect[] };
const stay = (turn: Turn): Result => ({ turn, effects: [] });

function startListening(t: Turn, at: number, followUp: boolean): Result {
  return { turn: { ...t, phase: 'listening', startedAt: at, lastActiveAt: at, heard: '', waitMs: followUp ? TIMING.followUpMs : TIMING.noSpeechMs, followUp, askAgain: false }, effects: [{ type: 'listen' }] };
}

function think(t: Turn, text: string): Result {
  return { turn: { ...t, phase: 'thinking', heard: text }, effects: [{ type: 'think', text, followUp: t.followUp }] };
}

/** Nothing was said: after a question, say so; after the yes/no, just go quiet. */
function nothingHeard(t: Turn, effects: Effect[] = []): Result {
  if (t.followUp) return { turn: { ...t, phase: 'idle', followUp: false }, effects };
  return { turn: { ...t, phase: 'speaking', followUp: false, askAgain: false }, effects: [...effects, { type: 'speak', lines: [NO_SPEECH] }] };
}

export function step(t: Turn, e: Event): Result {
  // taps: debounced, and ignored while the machine is between states
  if (e.type === 'tap') {
    if (e.at - t.lastTapAt < TIMING.tapDebounceMs) return stay(t);
    const tapped = { ...t, lastTapAt: e.at };
    switch (t.phase) {
      case 'idle':
        return startListening(tapped, e.at, false);
      case 'listening':
        // finish now with what was heard, or cancel if nothing yet
        return tapped.heard.trim() ? { turn: { ...tapped, phase: 'ending', lastActiveAt: e.at }, effects: [{ type: 'endListening' }] } : { turn: { ...tapped, phase: 'idle', followUp: false }, effects: [{ type: 'cancelListening' }] };
      case 'speaking':
        return { turn: { ...tapped, phase: 'idle', askAgain: false, followUp: false }, effects: [{ type: 'stopSpeaking' }] };
      default:
        return stay(t); // ending, thinking: transitioning
    }
  }

  if (e.type === 'typed') {
    if (!e.text.trim()) return stay(t);
    const pre: Effect[] = t.phase === 'listening' || t.phase === 'ending' ? [{ type: 'cancelListening' }] : t.phase === 'speaking' ? [{ type: 'stopSpeaking' }] : [];
    const r = think({ ...t, followUp: t.followUp && t.phase === 'listening' }, e.text.trim());
    return { turn: r.turn, effects: [...pre, ...r.effects] };
  }

  switch (t.phase) {
    case 'listening':
      // only new words count; a recognizer repeating the same text isn't the person talking
      if (e.type === 'partial') return stay(e.text.trim() && e.text !== t.heard ? { ...t, heard: e.text, lastActiveAt: e.at } : t);
      if (e.type === 'level') return stay(t.heard.trim() && e.value >= TIMING.quietLevel ? { ...t, lastActiveAt: e.at } : t);
      if (e.type === 'tick') {
        const talking = t.heard.trim().length > 0;
        if (talking && (e.at - t.lastActiveAt >= TIMING.silenceMs || e.at - t.startedAt >= TIMING.capMs)) return { turn: { ...t, phase: 'ending', lastActiveAt: e.at }, effects: [{ type: 'endListening' }] };
        if (!talking && (e.at - t.startedAt >= t.waitMs || e.at - t.startedAt >= TIMING.capMs)) return nothingHeard(t, [{ type: 'cancelListening' }]);
        return stay(t);
      }
      if (e.type === 'heard') return (e.text || t.heard).trim() ? think(t, (e.text || t.heard).trim()) : nothingHeard(t);
      if (e.type === 'error') return { turn: { ...t, phase: 'speaking', followUp: false, askAgain: false }, effects: [{ type: 'speak', lines: [e.message] }] };
      return stay(t);

    case 'ending':
      if (e.type === 'heard') return (e.text || t.heard).trim() ? think(t, (e.text || t.heard).trim()) : nothingHeard(t);
      if (e.type === 'error') return t.heard.trim() ? think(t, t.heard.trim()) : nothingHeard(t);
      // the recognizer never answered: go on with what we have
      if (e.type === 'tick' && e.at - t.lastActiveAt >= TIMING.endingMs) return t.heard.trim() ? think(t, t.heard.trim()) : nothingHeard(t);
      return stay(t);

    case 'thinking':
      if (e.type === 'answered') return { turn: { ...t, phase: 'speaking', followUp: false, askAgain: e.askAgain }, effects: [{ type: 'speak', lines: e.lines }] };
      return stay(t);

    case 'speaking':
      if (e.type === 'spoken') return t.askAgain ? startListening({ ...t, askAgain: false }, e.at, true) : { turn: { ...t, phase: 'idle' }, effects: [] };
      return stay(t);

    default:
      return stay(t);
  }
}
