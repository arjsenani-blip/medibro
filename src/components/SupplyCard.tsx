import { useState } from 'react';
import { Bell, BellOff, CalendarClock } from 'lucide-react';
import type { LabelFields } from '../lib/parseLabel';
import { isoDate, parseLabelDate, REMIND_DAYS, refilled, supplyStatus, type Supply } from '../lib/refill';
import type { ReminderState } from '../lib/reminders';
import { Button, Field, inputClass } from './ui';

interface Props {
  supply: Supply | null;
  fields: LabelFields;
  reminders: ReminderState;
  onChange: (s: Supply | null) => void;
}

const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Days left before this runs out, refills left, and refill reminders. */
export default function SupplyCard({ supply, fields, reminders, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmRefill, setConfirmRefill] = useState(false);

  if (editing || !supply) {
    return <SupplyForm supply={supply} fields={fields} onSave={(s) => (onChange(s), setEditing(false))} onCancel={supply ? () => setEditing(false) : undefined} />;
  }

  const st = supplyStatus(supply);
  const tone = st.daysLeft <= 0 ? 'stop' : st.due ? 'amber' : 'ok';
  const color = { stop: 'text-stop', amber: 'text-amber', ok: 'text-ok' }[tone];
  const bar = { stop: 'bg-stop', amber: 'bg-amber', ok: 'bg-ok' }[tone];
  const share = Math.max(0, Math.min(1, st.daysLeft / supply.daysSupply));
  const refills = supply.refillsLeft == null ? 'Refills: not on the label' : supply.refillsLeft === 0 ? 'No refills left' : `${supply.refillsLeft} refill${supply.refillsLeft > 1 ? 's' : ''} left`;

  return (
    <section className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-rule" aria-labelledby="supply-title">
      <h2 id="supply-title" className="flex items-center gap-2 text-[0.95rem] font-bold text-muted">
        <CalendarClock className="size-5" aria-hidden /> Supply
      </h2>
      <p className={`mt-1 text-[2.4rem] leading-none font-extrabold ${color}`} aria-live="polite">
        {st.daysLeft > 1 ? `${st.daysLeft} days left` : st.daysLeft === 1 ? '1 day left' : st.daysLeft === 0 ? 'Runs out today' : 'Ran out'}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-rule" aria-hidden>
        <div className={`h-full ${bar}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-2.5 text-[1rem]">
        {st.daysLeft > 0 ? `Runs out about ${day(st.runOut)}.` : `Ran out about ${day(st.runOut)}.`} {st.daysLeft > supply.remindDays && `Refill by ${day(st.refillBy)}.`}
      </p>
      <p className={`mt-0.5 text-[1rem] font-bold ${supply.refillsLeft === 0 ? 'text-stop' : ''}`}>{refills}</p>

      {st.due && (
        <p className={`mt-3 rounded-xl p-3 text-[1rem] font-bold ${tone === 'stop' ? 'bg-stop-wash text-stop' : 'bg-amber-wash'}`}>
          {supply.refillsLeft === 0
            ? 'Time to refill, and there are no refills left. Call your pharmacy: they can ask your prescriber for a new prescription.'
            : 'Time to refill. Call your pharmacy to ask for it.'}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {confirmRefill ? (
          <div className="rounded-xl bg-ground p-3">
            <p className="text-[1rem]">
              Start a new {supply.daysSupply}-day count from today{supply.refillsLeft ? ` and use 1 refill (${supply.refillsLeft - 1} left after this)` : ''}?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button onClick={() => (onChange(refilled(supply)), setConfirmRefill(false))}>Yes, I picked it up</Button>
              <Button variant="quiet" onClick={() => setConfirmRefill(false)}>
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" onClick={() => setConfirmRefill(true)}>
            I picked up a refill
          </Button>
        )}

        {reminders !== 'unsupported' && (
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-1 text-[1rem]">
            {supply.reminders ? <Bell className="size-5 shrink-0 text-amber" aria-hidden /> : <BellOff className="size-5 shrink-0 text-muted" aria-hidden />}
            <span className="flex-1">
              <span className="block font-bold">Remind me to refill</span>
              <span className="block text-[0.9rem] text-muted">
                {supply.reminders ? `A notification ${supply.remindDays} days before it runs out, and the day before` : 'Off'}
              </span>
            </span>
            <input type="checkbox" className="size-6 accent-[var(--color-amber)]" checked={supply.reminders} onChange={(e) => onChange({ ...supply, reminders: e.target.checked })} />
          </label>
        )}
        {supply.reminders && reminders === 'denied' && (
          <p className="text-[0.9rem] text-stop">Notifications are turned off for ReadRx. To get reminders: Settings → Notifications → ReadRx → Allow Notifications.</p>
        )}

        <button type="button" className="min-h-12 text-[1rem] font-bold text-muted underline decoration-rule underline-offset-4" onClick={() => setEditing(true)}>
          Change days supply or refills
        </button>
      </div>
    </section>
  );
}

/** Asks for what the label didn't give, or lets the person correct it. */
function SupplyForm({ supply, fields, onSave, onCancel }: { supply: Supply | null; fields: LabelFields; onSave: (s: Supply) => void; onCancel?: () => void }) {
  const [days, setDays] = useState(String(supply?.daysSupply ?? ''));
  const [refills, setRefills] = useState(supply?.refillsLeft != null ? String(supply.refillsLeft) : /^\d+$/.test(fields.refills) ? fields.refills : '');
  const [start, setStart] = useState(supply?.start ?? parseLabelDate(fields.filled) ?? isoDate(new Date()));
  const n = Number(days);
  const valid = Number.isInteger(n) && n > 0 && n <= 400 && /^\d{4}-\d{2}-\d{2}$/.test(start);

  return (
    <section className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-rule" aria-labelledby="supply-form-title">
      <h2 id="supply-form-title" className="text-[1.1rem] font-extrabold">
        {supply ? 'Change supply' : 'Track how long this lasts'}
      </h2>
      {!supply && <p className="mt-1 text-[0.95rem] text-muted">ReadRx couldn’t work out the days supply from the label. Ask your pharmacy, or look for “days supply” on the label or receipt.</p>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Days supply">
          <input className={inputClass} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Refills left">
          <input className={inputClass} inputMode="numeric" value={refills} placeholder="Not sure" onChange={(e) => setRefills(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Picked up on">
          <input className={inputClass} type="date" value={start} max={isoDate(new Date())} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          disabled={!valid}
          onClick={() =>
            onSave({ daysSupply: n, start, refillsLeft: refills === '' ? null : Number(refills), remindDays: Math.min(REMIND_DAYS, Math.floor(n / 3)), reminders: supply?.reminders ?? true })
          }
        >
          {supply ? 'Save' : 'Start tracking'}
        </Button>
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
