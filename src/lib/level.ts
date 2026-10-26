/* Microphone level for the listening waveform. The native plugin and the web
   analyser both send a raw 0–1 level; the screen smooths it so it reads as a
   voice: quick to rise, slower to fall. */

export const FLOOR_DB = -50;

/** Root-mean-square of audio samples (-1…1). */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Decibels (FLOOR_DB…0) to a 0–1 level. Anything below the floor is silence. */
export function dbToLevel(db: number, floor = FLOOR_DB): number {
  if (!Number.isFinite(db)) return 0;
  return clamp01((db - floor) / -floor);
}

/** An RMS amplitude straight to a 0–1 level. */
export const rmsToLevel = (r: number) => (r > 0 ? dbToLevel(20 * Math.log10(r)) : 0);

/**
 * One smoothing step. Moves `prev` toward `target` with a short time constant
 * when rising (attack) and a longer one when falling (release). `dt` in seconds.
 */
export function smoothLevel(prev: number, target: number, dt: number, attack = 0.05, release = 0.35): number {
  const t = clamp01(target);
  const tau = t > prev ? attack : release;
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  const next = prev + (t - prev) * k;
  return next < 0.002 ? 0 : clamp01(next);
}

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
