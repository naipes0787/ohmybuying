import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import {
  distinctListTypes,
  useLists,
  useListsStore,
} from '@/stores/listsStore';
import type { List } from '@/types';

interface ListEditModalProps {
  open: boolean;
  onClose: () => void;
  list: List | null;
  onUpdated?: (updated: List) => void;
}

export function ListEditModal({
  open,
  onClose,
  list,
  onUpdated,
}: ListEditModalProps) {
  const updateList = useListsStore((s) => s.updateList);
  const lists = useLists();
  const existingTypes = useMemo(() => distinctListTypes(lists), [lists]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync form fields whenever the target list changes (e.g. modal reopened).
  useEffect(() => {
    if (!list) return;
    setName(list.name);
    setDescription(list.description ?? '');
    setType(list.type ?? '');
    setError(null);
  }, [list]);

  const handleClose = useCallback(() => {
    if (isPending) return;
    setError(null);
    onClose();
  }, [isPending, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!list) return;
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await updateList(list.id, {
              name: name.trim(),
              description: description.trim() || null,
              type: type.trim() || null,
            });
            onUpdated?.({
              ...list,
              name: name.trim(),
              description: description.trim() || null,
              type: type.trim() || null,
            });
            onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to update list',
            );
          }
        })();
      });
    },
    [list, name, description, type, updateList, onClose, onUpdated],
  );

  return (
    <Modal open={open} onClose={handleClose} title="Edit list">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="grocery_run.exe"
          required
          maxLength={80}
          autoFocus
        />
        <Input
          label="Type (optional)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="groceries, movies, todo..."
          hint="Groups suggestions: items are only suggested across lists of the same type."
          maxLength={40}
          list="list-type-options-edit"
        />
        {existingTypes.length > 0 ? (
          <datalist id="list-type-options-edit">
            {existingTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        ) : null}
        <TextArea
          label="Notes (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="// budget cap, store, tips..."
          maxLength={500}
        />
        {error ? (
          <div className="font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1">
            ! {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
