import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { LabelFields } from '../lib/parseLabel';
import { isoDate, parseLabelDate, REMIND_DAYS, refilled, supplyStatus, type Supply } from '../lib/refill';
import type { ReminderState } from '../lib/reminders';
import { Button, CallButton, Card, Field, inputClass } from './ui';

interface Props {
  supply: Supply | null;
  fields: LabelFields;
  reminders: ReminderState;
  pharmacy: { name: string; phone: string; main: boolean } | null; // who to call for refills
  onChange: (s: Supply | null) => void;
}

const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Days left before this runs out, refills left, and refill reminders. */
export default function SupplyCard({ supply, fields, reminders, pharmacy, onChange }: Props) {
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
  const refills = supply.refillsLeft == null ? 'Refills unknown' : supply.refillsLeft === 0 ? 'No refills left' : `${supply.refillsLeft} refill${supply.refillsLeft > 1 ? 's' : ''} left`;

  return (
    <Card i={2} className="mt-4 p-5" aria-labelledby="supply-title">
      <h2 id="supply-title" className="sr-only">
        Supply
      </h2>
      <p className={`headline text-[2.2rem] leading-none ${color}`} aria-live="polite">
        {st.daysLeft > 1 ? `${st.daysLeft} days left` : st.daysLeft === 1 ? '1 day left' : st.daysLeft === 0 ? 'Runs out today' : 'Ran out'}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-2.5 text-[1rem] text-muted">
        {st.daysLeft > 0 ? `Until ${day(st.runOut)}` : `Since ${day(st.runOut)}`} · <span className={supply.refillsLeft === 0 ? 'font-bold text-stop' : ''}>{refills}</span>
      </p>

      {st.due && (
        <div className={`mt-4 rounded-[14px] p-3.5 ${tone === 'stop' ? 'bg-stop-wash text-stop' : 'bg-amber-wash text-amber'}`}>
          <p className="text-[1.05rem] font-bold">{supply.refillsLeft === 0 ? 'Time to refill. No refills left: your pharmacy can ask your prescriber.' : 'Time to refill.'}</p>
          {pharmacy?.phone && (
            <CallButton phone={pharmacy.phone} className="mt-3">
              Call {pharmacy.name}
            </CallButton>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {confirmRefill ? (
          <div className="rounded-[14px] bg-surface p-3">
            <p className="text-[1rem] font-bold text-ink-strong">Start a new {supply.daysSupply}-day count today?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button onClick={() => (onChange(refilled(supply)), setConfirmRefill(false))}>Yes</Button>
              <Button variant="quiet" onClick={() => setConfirmRefill(false)}>
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="glass" onClick={() => setConfirmRefill(true)}>
            I picked up a refill
          </Button>
        )}

        {reminders !== 'unsupported' && (
          <label className="flex min-h-14 cursor-pointer items-center gap-3 px-1 text-[1.05rem]">
            {supply.reminders ? <Bell className="size-6 shrink-0 text-accent-deep" aria-hidden /> : <BellOff className="size-6 shrink-0 text-muted" aria-hidden />}
            <span className="flex-1 font-bold text-ink-strong">Refill reminders</span>
            <input type="checkbox" className="size-7 accent-[var(--accent-deep)]" checked={supply.reminders} onChange={(e) => onChange({ ...supply, reminders: e.target.checked })} />
          </label>
        )}
        {supply.reminders && reminders === 'denied' && <p className="text-[1rem] text-stop">Notifications are off: Settings → Notifications → MediBro.</p>}

        <button type="button" className="min-h-12 text-[1rem] font-bold text-ink-strong underline decoration-2 underline-offset-4" onClick={() => setEditing(true)}>
          Edit supply
        </button>
      </div>
    </Card>
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
    <Card i={2} className="mt-4 p-4" aria-labelledby="supply-form-title">
      <h2 id="supply-form-title" className="headline text-[1.2rem]">
        {supply ? 'Edit supply' : 'How long it lasts'}
      </h2>
      {!supply && <p className="mt-1 text-[1rem] text-muted">Not on the label. Ask your pharmacy.</p>}
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
    </Card>
  );
}
