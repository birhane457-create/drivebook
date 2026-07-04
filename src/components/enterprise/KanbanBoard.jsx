import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function KanbanBoard({ columns: initial = [], onMove, className }) {
  const [columns, setColumns] = useState(initial);

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const srcCol = next.find((c) => c.id === source.droppableId);
      const dstCol = next.find((c) => c.id === destination.droppableId);
      const [moved] = srcCol.cards.splice(source.index, 1);
      dstCol.cards.splice(destination.index, 0, moved);
      return next;
    });
    onMove?.(result);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={cn('flex gap-4 overflow-x-auto pb-2', className)}>
        {columns.map((col) => (
          <Droppable key={col.id} droppableId={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  'w-72 flex-shrink-0 rounded-xl border bg-muted/30 flex flex-col min-h-[200px]',
                  snapshot.isDraggingOver && 'border-primary/50 bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', col.color || 'bg-muted-foreground')} />
                    <span className="text-sm font-semibold">{col.title}</span>
                  </div>
                  <Badge variant="secondary">{col.cards.length}</Badge>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {col.cards.map((card, idx) => (
                    <Draggable key={card.id} draggableId={card.id} index={idx}>
                      {(p, s) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                          className={cn(
                            'rounded-lg bg-card border p-3 shadow-sm cursor-grab active:cursor-grabbing',
                            s.isDragging && 'shadow-lg ring-2 ring-primary/40'
                          )}
                        >
                          <p className="text-sm font-medium leading-snug">{card.title}</p>
                          {card.subtitle && <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>}
                          {card.badges?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {card.badges.map((b, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{b}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}