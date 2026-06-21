import { memo, useCallback } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Bell, Check, GripVertical, Pencil } from 'lucide-react';
import type { ListItemWithDetail } from '@/types';

interface ItemRowProps {
  listItem: ListItemWithDetail;
  index: number;
  onRemove: (itemId: string) => void;
  onEdit: (itemId: string) => void;
}

export const ItemRow = memo(function ItemRow({
  listItem,
  index,
  onRemove,
  onEdit,
}: ItemRowProps) {
  const handleRemove = useCallback(() => {
    onRemove(listItem.item_id);
  }, [listItem.item_id, onRemove]);
  const handleEdit = useCallback(() => {
    onEdit(listItem.item_id);
  }, [listItem.item_id, onEdit]);

  return (
    <Draggable draggableId={listItem.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`panel transition-shadow ${
            snapshot.isDragging
              ? 'border-glow-cyan shadow-glow-cyan'
              : 'hover:border-retro-cyan/40'
          }`}
        >
          <div className="flex items-start gap-3 p-3 sm:p-4">
            <button
              {...provided.dragHandleProps}
              className="mt-0.5 text-retro-muted hover:text-retro-cyan cursor-grab active:cursor-grabbing transition-colors"
              aria-label="Drag handle"
              type="button"
            >
              <GripVertical size={16} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-retro-cyan/60 select-none w-5 shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h4 className="font-display text-base text-retro-text truncate">
                  {listItem.item.title}
                </h4>
                {listItem.item.reminder_enabled ? (
                  <span
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-retro-cyan"
                    title={`Reminder every ${listItem.item.reminder_interval_days ?? '?'} days`}
                  >
                    <Bell size={10} />
                    {listItem.item.reminder_interval_days
                      ? `${listItem.item.reminder_interval_days}d`
                      : ''}
                  </span>
                ) : null}
              </div>
              {listItem.item.description ? (
                <p className="mt-1 ml-7 font-mono text-xs text-retro-muted whitespace-pre-wrap break-words">
                  {listItem.item.description}
                </p>
              ) : null}
            </div>

            <button
              onClick={handleEdit}
              aria-label={`Edit ${listItem.item.title}`}
              className="text-retro-muted hover:text-retro-cyan transition-colors p-1 -m-1"
              type="button"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={handleRemove}
              aria-label={`Mark ${listItem.item.title} as done`}
              title="Mark as done"
              className="text-retro-muted hover:text-retro-green transition-colors p-1 -m-1"
              type="button"
            >
              <Check size={16} />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
});
