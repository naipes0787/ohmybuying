import { useCallback, useEffect, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ItemForm } from './ItemForm';
import { useItemsStore, type ItemFormPayload } from '@/stores/itemsStore';
import type { Item } from '@/types';

interface ItemEditModalProps {
  open: boolean;
  onClose: () => void;
  item: Item | null;
}

export function ItemEditModal({ open, onClose, item }: ItemEditModalProps) {
  const updateItem = useItemsStore((s) => s.updateItem);
  const deleteItem = useItemsStore((s) => s.deleteItem);

  const [payload, setPayload] = useState<ItemFormPayload | null>(null);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setError(null);
      setConfirmingDelete(false);
    }
  }, [open]);

  const handleChange = useCallback(
    (next: ItemFormPayload, nextValid: boolean) => {
      setPayload(next);
      setValid(nextValid);
    },
    [],
  );

  const handleSave = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!item || !payload || !valid) return;
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await updateItem(item.id, payload);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
          }
        })();
      });
    },
    [item, payload, valid, updateItem, onClose],
  );

  const handleDelete = useCallback(() => {
    if (!item) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await deleteItem(item.id);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete');
        }
      })();
    });
  }, [item, deleteItem, onClose]);

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit "${item.title}"`}>
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <ItemForm
          initial={item}
          onChange={handleChange}
          autoFocusTitle
          lastUsedAt={item.last_used_at}
        />

        {error ? (
          <div className="font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1">
            ! {error}
          </div>
        ) : null}

        <div className="border-t border-retro-border pt-4 flex flex-col gap-3">
          {confirmingDelete ? (
            <div className="flex flex-col gap-2 panel border-glow-magenta p-3">
              <p className="font-mono text-xs text-retro-text">
                Permanently delete <span className="text-retro-magenta">{item.title}</span>?
                It will be removed from every list.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={isPending}
                  onClick={handleDelete}
                  iconLeft={<Trash2 size={12} />}
                >
                  Delete forever
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="self-start inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-retro-muted hover:text-retro-magenta transition-colors"
            >
              <Trash2 size={12} /> Delete item permanently
            </button>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!valid}>
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
