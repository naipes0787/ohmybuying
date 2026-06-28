import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import type { Item } from '@/types';
import type { ItemFormPayload } from '@/stores/itemsStore';

interface ItemFormProps {
  initial?: Pick<
    Item,
    'title' | 'description' | 'reminder_enabled' | 'reminder_interval_days'
  > | null;
  onChange: (payload: ItemFormPayload, isValid: boolean) => void;
  autoFocusTitle?: boolean;
  titlePlaceholder?: string;
  /**
   * When the item was last marked done. The reminder countdown starts from
   * this moment, so a null value means the timer hasn't started yet.
   */
  lastUsedAt?: string | null;
}

const DEFAULT_INTERVAL = 14;

export function ItemForm({
  initial,
  onChange,
  autoFocusTitle = false,
  titlePlaceholder = 'oat_milk',
  lastUsedAt = null,
}: ItemFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminder_enabled ?? false,
  );
  const [intervalDays, setIntervalDays] = useState<string>(
    initial?.reminder_interval_days?.toString() ?? String(DEFAULT_INTERVAL),
  );

  // Re-emit on any field change so parent always has the current payload.
  useEffect(() => {
    const trimmedTitle = title.trim();
    const parsedInterval = Number.parseInt(intervalDays, 10);
    const intervalValid =
      !reminderEnabled ||
      (Number.isFinite(parsedInterval) &&
        parsedInterval >= 1 &&
        parsedInterval <= 365);
    const valid = trimmedTitle.length > 0 && intervalValid;

    onChange(
      {
        title: trimmedTitle,
        description: description.trim() || null,
        reminder_enabled: reminderEnabled,
        reminder_interval_days: reminderEnabled
          ? Number.isFinite(parsedInterval)
            ? parsedInterval
            : null
          : null,
      },
      valid,
    );
  }, [title, description, reminderEnabled, intervalDays, onChange]);

  const toggleReminder = useCallback(() => {
    setReminderEnabled((v) => !v);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={titlePlaceholder}
        required
        maxLength={120}
        autoFocus={autoFocusTitle}
      />
      <TextArea
        label="Notes (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="// brand, qty, tips..."
        maxLength={400}
      />

      <div className="border-t border-retro-border pt-3 mt-1 flex flex-col gap-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <span
            role="checkbox"
            aria-checked={reminderEnabled}
            tabIndex={0}
            onClick={toggleReminder}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleReminder();
              }
            }}
            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center border transition-all ${
              reminderEnabled
                ? 'border-retro-cyan bg-retro-cyan text-retro-bg shadow-glow-cyan'
                : 'border-retro-border bg-transparent text-transparent hover:border-retro-cyan/60'
            }`}
          >
            <span className="font-mono text-[10px] leading-none">×</span>
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-retro-text">
              <Bell size={12} className="text-retro-cyan" /> Reminder
            </span>
            <span className="block font-mono text-[11px] text-retro-muted mt-0.5">
              // remind me after the item is removed from a list
            </span>
          </span>
        </label>

        {reminderEnabled ? (
          <div className="pl-7 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <label
                htmlFor="reminder-interval"
                className="font-mono text-xs text-retro-muted"
              >
                every
              </label>
              <input
                id="reminder-interval"
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                className="input-terminal w-20 text-center"
                aria-label="Reminder interval in days"
              />
              <span className="font-mono text-xs text-retro-muted">days</span>
            </div>
            {lastUsedAt === null ? (
              <p className="font-mono text-[11px] text-retro-cyan/80 border-l-2 border-retro-cyan/50 pl-2 py-0.5">
                ⏳ the countdown starts once you mark this item as done — no
                reminder fires before then
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
