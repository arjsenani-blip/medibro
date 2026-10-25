import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Medicine } from './store';
import { addDays, supplyStatus } from './refill';
import { title } from './plain';

/* Refill reminders, scheduled on the phone itself (no server, nothing leaves the
   phone). Rebuilt from the saved medicines whenever they change. */

export type ReminderState = 'on' | 'denied' | 'unsupported';

export const remindersSupported = () => Capacitor.isNativePlatform();

export async function syncReminders(meds: Medicine[], now = new Date()): Promise<ReminderState> {
  if (!remindersSupported()) return 'unsupported';
  const wanted = meds.filter((m) => m.supply?.reminders);

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!wanted.length) return 'on';

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'denied';

  const notifications = wanted.flatMap((m) => remindersFor(m, now));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return 'on';
}

/** The reminders for one medicine: when it's time to refill, and the day before it runs out. */
export function remindersFor(m: Medicine, now = new Date()) {
  const s = m.supply!;
  const f = m.fields;
  const st = supplyStatus(s, now);
  const name = [title(f.drug) || 'Your medicine', f.strength].filter(Boolean).join(' ');
  const noRefills = s.refillsLeft === 0;
  const pharmacy = f.pharmacy ? title(f.pharmacy) : 'your pharmacy';
  const askFor = noRefills
    ? `No refills left. Call ${pharmacy}: they can ask your prescriber for a new prescription.`
    : `Ask ${pharmacy} for a refill${s.refillsLeft ? ` (${s.refillsLeft} left)` : ''}.`;
  const at9 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0);
  const base = idFor(m.id);
  return [
    { id: base, at: at9(st.refillBy), title: `Time to refill ${name}`, body: `About ${s.remindDays} days left. ${askFor}` },
    { id: base + 1, at: at9(addDays(st.runOut, -1)), title: `${name} runs out tomorrow`, body: askFor },
  ]
    .filter((n) => n.at > now)
    .map(({ at, ...n }) => ({ ...n, schedule: { at, allowWhileIdle: true }, extra: { medId: m.id } }));
}

/** A stable notification id per medicine (iOS needs a 32-bit integer). */
function idFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 100_000_000) * 10;
}

/** Opens a medicine when its reminder is tapped. */
export function onReminderTap(open: (medId: string) => void) {
  if (!remindersSupported()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const id = a.notification.extra?.medId;
    if (typeof id === 'string') open(id);
  });
  return () => void handle.then((h) => h.remove());
}
