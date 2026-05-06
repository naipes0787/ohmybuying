import { useCallback, useState, useTransition } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { useListsStore } from '@/stores/listsStore';
import { useUserId } from '@/stores/authStore';

interface ListCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (listId: string) => void;
}

export function ListCreateModal({
  open,
  onClose,
  onCreated,
}: ListCreateModalProps) {
  const userId = useUserId();
  const createList = useListsStore((s) => s.createList);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    if (isPending) return;
    setName('');
    setDescription('');
    setError(null);
    onClose();
  }, [isPending, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!userId) return;
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            const list = await createList(
              { name: name.trim(), description: description.trim() || null },
              userId,
            );
            setName('');
            setDescription('');
            onCreated?.(list.id);
            onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to create list',
            );
          }
        })();
      });
    },
    [name, description, userId, createList, onClose, onCreated],
  );

  return (
    <Modal open={open} onClose={handleClose} title="New list">
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
          <Button
            type="submit"
            loading={isPending}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
