import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ItemRow } from './ItemRow';
import type { ListItemWithDetail } from '@/types';

interface ItemListProps {
  items: ListItemWithDetail[];
  onReorder: (result: DropResult) => void;
  onRemove: (itemId: string) => void;
  onEdit: (itemId: string) => void;
}

export function ItemList({ items, onReorder, onRemove, onEdit }: ItemListProps) {
  return (
    <DragDropContext onDragEnd={onReorder}>
      <Droppable droppableId="list-items">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 transition-colors ${
              snapshot.isDraggingOver ? 'opacity-95' : ''
            }`}
          >
            {items.map((listItem, index) => (
              <ItemRow
                key={listItem.id}
                listItem={listItem}
                index={index}
                onRemove={onRemove}
                onEdit={onEdit}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
