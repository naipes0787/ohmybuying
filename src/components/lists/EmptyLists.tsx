import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyListsProps {
  onCreate: () => void;
}

export function EmptyLists({ onCreate }: EmptyListsProps) {
  return (
    <div className="panel border-glow-cyan p-8 sm:p-12 text-center">
      <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center border border-retro-cyan text-retro-cyan animate-glow-pulse">
        <span className="font-display text-2xl">∅</span>
      </div>
      <h3 className="font-display text-xl uppercase tracking-[0.2em] text-retro-text mb-2">
        No lists yet
      </h3>
      <p className="font-mono text-sm text-retro-muted mb-6">
        // create your first list to start collecting items
      </p>
      <Button onClick={onCreate} iconLeft={<Plus size={14} />}>
        New list
      </Button>
    </div>
  );
}
