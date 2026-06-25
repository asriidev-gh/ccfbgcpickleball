"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type QueueDndZoneId = "next-up" | "waiting";

type QueueDndContextValue = {
  isDragging: boolean;
  dropZone: QueueDndZoneId | null;
};

const QueueDndContext = createContext<QueueDndContextValue>({
  isDragging: false,
  dropZone: null,
});

function queueZoneForIndex(index: number, nextUpCount: number): QueueDndZoneId {
  return index < nextUpCount ? "next-up" : "waiting";
}

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

export type QueueDragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

type SortableQueueListProps = {
  entryIds: string[];
  enabled: boolean;
  onReorder: (orderedEntryIds: string[]) => void;
  /** How many top positions count as the "next on court" drop zone. Defaults to 4 (doubles). */
  nextUpCount?: number;
  children: ReactNode;
};

export function SortableQueueList({
  entryIds,
  enabled,
  onReorder,
  nextUpCount = 4,
  children,
}: SortableQueueListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [isDragging, setIsDragging] = useState(false);
  const [dropZone, setDropZone] = useState<QueueDndZoneId | null>(null);

  const clearDragState = () => {
    setIsDragging(false);
    setDropZone(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    const activeIndex = entryIds.indexOf(String(event.active.id));
    if (activeIndex >= 0) {
      setDropZone(queueZoneForIndex(activeIndex, nextUpCount));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    if (!overId) {
      setDropZone(null);
      return;
    }
    const overIndex = entryIds.indexOf(String(overId));
    if (overIndex >= 0) {
      setDropZone(queueZoneForIndex(overIndex, nextUpCount));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearDragState();

    if (!over || active.id === over.id) return;

    const oldIndex = entryIds.indexOf(String(active.id));
    const newIndex = entryIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(entryIds, oldIndex, newIndex));
  };

  if (!enabled || entryIds.length < 2) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <QueueDndContext.Provider value={{ isDragging, dropZone }}>
        <div className={cn("queue-dnd-root", isDragging && "queue-dnd-root--dragging")}>
          <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      </QueueDndContext.Provider>
    </DndContext>
  );
}

type QueueDndZoneProps = {
  zone: QueueDndZoneId;
  className?: string;
  children: ReactNode;
};

/** Wraps a queue section; highlights while dragging and when it is the drop target. */
export function QueueDndZone({ zone, className, children }: QueueDndZoneProps) {
  const { isDragging, dropZone } = useContext(QueueDndContext);

  return (
    <div
      className={cn(
        className,
        isDragging && "queue-dnd-zone--dragging",
        isDragging && dropZone === zone && "queue-dnd-zone--over",
      )}
    >
      {children}
    </div>
  );
}

type SortableQueueItemProps = {
  id: string;
  enabled: boolean;
  children: (drag?: QueueDragHandleProps) => ReactNode;
};

export function SortableQueueItem({ id, enabled, children }: SortableQueueItemProps) {
  if (!enabled) {
    return <>{children(undefined)}</>;
  }

  return <SortableQueueItemInner id={id}>{children}</SortableQueueItemInner>;
}

function SortableQueueItemInner({
  id,
  children,
}: {
  id: string;
  children: (drag?: QueueDragHandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, animateLayoutChanges });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("queue-sortable-item", isDragging && "queue-sortable-item--dragging")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

export function QueueDragHandle({
  attributes,
  listeners,
  label,
  slot,
}: QueueDragHandleProps & { label: string; slot?: number }) {
  return (
    <button
      type="button"
      className={cn(
        "queue-drag-handle",
        slot != null && "queue-drag-handle--with-rank",
      )}
      aria-label={
        slot != null ? `Queue position ${slot}. ${label}` : label
      }
      {...attributes}
      {...listeners}
    >
      {slot != null ? <span className="queue-rank">{slot}</span> : null}
      <GripVertical
        className={cn("queue-drag-handle-grip", slot == null && "h-4 w-4")}
        aria-hidden
      />
    </button>
  );
}
