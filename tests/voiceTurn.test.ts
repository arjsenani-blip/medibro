import { describe, expect, it } from 'vitest';
import { IDLE, NO_SPEECH, TIMING, step, type Effect, type Event, type Turn } from '../src/lib/voiceTurn';

/** Runs events in order; returns the final turn and every effect. */
function run(events: Event[], from: Turn = IDLE) {
  let t = from;
  const effects: Effect[] = [];
  for (const e of events) {
    const r = step(t, e);
    t = r.turn;
    effects.push(...r.effects);
  }
  return { t, effects, types: effects.map((x) => x.type) };
}

/** A whole spoken question: tap, words, quiet, recognizer stops, answer, speech ends. */
function cycle(start: number, words = 'I have a headache'): Event[] {
  return [
    { type: 'tap', at: start },
    { type: 'partial', text: 'I have', at: start + 500 },
    { type: 'partial', text: words, at: start + 900 },
    { type: 'tick', at: start + 900 + TIMING.silenceMs },
    { type: 'heard', text: words, at: start + 900 + TIMING.silenceMs + 100 },
    { type: 'answered', lines: ['Acetaminophen.'], askAgain: false },
    { type: 'spoken', at: start + 5000 },
  ];
}

describe('voice turn', () => {
  it('one tap starts listening', () => {
    const { t, types } = run([{ type: 'tap', at: 1000 }]);
    expect(t.phase).toBe('listening');
    expect(types).toEqual(['listen']);
  });

  it('ends the turn after 1.3 s with no new words, then thinks, speaks and returns to idle', () => {
    const events = cycle(0);
    const r1 = run(events.slice(0, 3));
    expect(r1.t.phase).toBe('listening');
    // just before the silence window: still listening
    expect(run([{ type: 'tick', at: 900 + TIMING.silenceMs - 50 }], r1.t).t.phase).toBe('listening');
    const r2 = run(events.slice(3, 4), r1.t);
    expect(r2.t.phase).toBe('ending');
    expect(r2.types).toEqual(['endListening']);
    const r3 = run(events.slice(4, 5), r2.t);
    expect(r3.t.phase).toBe('thinking');
    expect(r3.effects).toEqual([{ type: 'think', text: 'I have a headache', followUp: false }]);
    const r4 = run(events.slice(5, 6), r3.t);
    expect(r4.t.phase).toBe('speaking');
    expect(r4.effects).toEqual([{ type: 'speak', lines: ['Acetaminophen.'] }]);
    expect(run(events.slice(6), r4.t).t.phase).toBe('idle');
  });

  it('doesn’t count the same words repeated as new talking', () => {
    const { t } = run([{ type: 'tap', at: 0 }, { type: 'partial', text: 'cough', at: 500 }, { type: 'partial', text: 'cough', at: 1700 }, { type: 'tick', at: 500 + TIMING.silenceMs }]);
    expect(t.phase).toBe('ending');
  });

  it('keeps listening while the voice is still loud', () => {
    const { t } = run([
      { type: 'tap', at: 0 },
      { type: 'partial', text: 'my head', at: 500 },
      { type: 'level', value: 0.6, at: 1600 },
      { type: 'tick', at: 2000 }, // 1.5 s after the last words, but only 0.4 s after loud audio
    ]);
    expect(t.phase).toBe('listening');
  });

  it('ignores loudness before any words (background noise doesn’t extend the wait forever)', () => {
    const { t, types } = run([{ type: 'tap', at: 0 }, { type: 'level', value: 0.9, at: 5000 }, { type: 'tick', at: TIMING.noSpeechMs }]);
    expect(t.phase).toBe('speaking');
    expect(types).toEqual(['listen', 'cancelListening', 'speak']);
  });

  it('says “I didn’t catch that” after 6 s with no words', () => {
    const { t, effects } = run([{ type: 'tap', at: 0 }, { type: 'tick', at: TIMING.noSpeechMs - 100 }]);
    expect(t.phase).toBe('listening');
    const r = run([{ type: 'tick', at: TIMING.noSpeechMs }], t);
    expect(r.t.phase).toBe('speaking');
    expect(r.effects).toEqual([{ type: 'cancelListening' }, { type: 'speak', lines: [NO_SPEECH] }]);
    expect(run([{ type: 'spoken', at: 9000 }], r.t).t.phase).toBe('idle');
    expect(effects).toEqual([{ type: 'listen' }]);
  });

  it('stops at the 15 s cap even if words keep coming', () => {
    const events: Event[] = [{ type: 'tap', at: 0 }];
    for (let at = 500; at < TIMING.capMs; at += 500) events.push({ type: 'partial', text: `word ${at}`, at }, { type: 'tick', at: at + 1 });
    const r = run(events);
    expect(r.t.phase).toBe('listening');
    const end = run([{ type: 'tick', at: TIMING.capMs }], r.t);
    expect(end.t.phase).toBe('ending');
    expect(end.types).toEqual(['endListening']);
  });

  it('goes on with the words so far if the recognizer never hands them back', () => {
    const r = run([{ type: 'tap', at: 0 }, { type: 'partial', text: 'heartburn', at: 500 }, { type: 'tick', at: 2000 }]);
    expect(r.t.phase).toBe('ending');
    const t = run([{ type: 'tick', at: 2000 + TIMING.endingMs }], r.t);
    expect(t.effects).toEqual([{ type: 'think', text: 'heartburn', followUp: false }]);
  });

  it('finishes when the recognizer ends on its own (isFinal / onend)', () => {
    const { t, effects } = run([{ type: 'tap', at: 0 }, { type: 'heard', text: 'runny nose', at: 2000 }]);
    expect(t.phase).toBe('thinking');
    expect(effects.at(-1)).toEqual({ type: 'think', text: 'runny nose', followUp: false });
  });

  it('a tap while speaking stops the speech and returns to idle', () => {
    const r = run(cycle(0).slice(0, 6));
    expect(r.t.phase).toBe('speaking');
    const s = run([{ type: 'tap', at: 9000 }], r.t);
    expect(s.t.phase).toBe('idle');
    expect(s.types).toEqual(['stopSpeaking']);
    // a late "spoken" from the stopped speech changes nothing
    expect(run([{ type: 'spoken', at: 9100 }], s.t).t.phase).toBe('idle');
  });

  it('a tap while listening with no words cancels; with words, finishes now', () => {
    expect(run([{ type: 'tap', at: 0 }, { type: 'tap', at: 1000 }]).types).toEqual(['listen', 'cancelListening']);
    const r = run([{ type: 'tap', at: 0 }, { type: 'partial', text: 'gas', at: 500 }, { type: 'tap', at: 1000 }]);
    expect(r.t.phase).toBe('ending');
    expect(r.types).toEqual(['listen', 'endListening']);
  });

  it('debounces double taps and ignores taps while thinking or ending', () => {
    expect(run([{ type: 'tap', at: 0 }, { type: 'tap', at: 150 }]).t.phase).toBe('listening');
    const thinking = run(cycle(0).slice(0, 5)).t;
    expect(thinking.phase).toBe('thinking');
    expect(run([{ type: 'tap', at: 9000 }], thinking).types).toEqual([]);
    const ending = run(cycle(0).slice(0, 4)).t;
    expect(run([{ type: 'tap', at: 9000 }], ending).types).toEqual([]);
  });

  it('runs five questions in a row', () => {
    let t = IDLE;
    for (let i = 0; i < 5; i++) {
      const r = run(cycle(i * 10_000, `question ${i}`), t);
      expect(r.types, `cycle ${i}`).toEqual(['listen', 'endListening', 'think', 'speak']);
      expect(r.t.phase).toBe('idle');
      t = r.t;
    }
  });

  it('after the disposal answer, listens once for yes or no, then stops', () => {
    const asked = run([...cycle(0, 'get rid of old pills').slice(0, 5), { type: 'answered', lines: ['Steps…', 'Do you want to call your police station?'], askAgain: true }]);
    const r = run([{ type: 'spoken', at: 6000 }], asked.t);
    expect(r.t.phase).toBe('listening');
    expect(r.t.followUp).toBe(true);
    expect(r.types).toEqual(['listen']);
    // answering yes is marked as the follow-up
    const yes = run([{ type: 'partial', text: 'yes', at: 6500 }, { type: 'heard', text: 'yes', at: 7000 }], r.t);
    expect(yes.effects).toEqual([{ type: 'think', text: 'yes', followUp: true }]);
    // silence on the follow-up: 5 s, then idle without nagging
    const quiet = run([{ type: 'tick', at: 6000 + TIMING.followUpMs }], r.t);
    expect(quiet.t.phase).toBe('idle');
    expect(quiet.types).toEqual(['cancelListening']);
    // and it doesn't ask again after the reply is spoken
    const after = run([{ type: 'answered', lines: ['Okay.'], askAgain: false }, { type: 'spoken', at: 9000 }], yes.t);
    expect(after.t.phase).toBe('idle');
  });

  it('speaks a microphone error instead of failing silently', () => {
    const { t, effects } = run([{ type: 'tap', at: 0 }, { type: 'error', message: 'Speech recognition on this phone isn’t available for this language.' }]);
    expect(t.phase).toBe('speaking');
    expect(effects.at(-1)).toEqual({ type: 'speak', lines: ['Speech recognition on this phone isn’t available for this language.'] });
  });

  it('a typed question interrupts whatever is happening', () => {
    const listening = run([{ type: 'tap', at: 0 }]).t;
    expect(run([{ type: 'typed', text: 'cough' }], listening).types).toEqual(['cancelListening', 'think']);
    const speaking = run(cycle(0).slice(0, 6)).t;
    expect(run([{ type: 'typed', text: 'cough' }], speaking).types).toEqual(['stopSpeaking', 'think']);
    expect(run([{ type: 'typed', text: 'cough' }]).types).toEqual(['think']);
  });
});
