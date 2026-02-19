"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { AdminButton } from "@/components/admin/admin-button";
import { reorderCategories } from "@/app/(admin)/admin/kategorie/actions";

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

type CategoriesDndManagerProps = {
  categories: CategoryRow[];
};

export function CategoriesDndManager({ categories }: CategoriesDndManagerProps) {
  const [items, setItems] = useState(() =>
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  );
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const categoryOptions = useMemo(
    () => items.map((item) => ({ id: item.id, name: item.name })),
    [items]
  );

  const depthMap = useMemo(() => {
    const parentById = new Map(items.map((item) => [item.id, item.parentId]));
    const getDepth = (id: string) => {
      const seen = new Set<string>();
      let current = parentById.get(id);
      let depth = 0;
      while (current && !seen.has(current)) {
        seen.add(current);
        depth += 1;
        current = parentById.get(current);
      }
      return depth;
    };
    return new Map(items.map((item) => [item.id, getDepth(item.id)]));
  }, [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const saveOrder = () => {
    startTransition(async () => {
      try {
        const counters = new Map<string, number>();
        const payload = items.map((item) => {
          const key = item.parentId ?? "__root__";
          const current = counters.get(key) ?? 0;
          counters.set(key, current + 1);
          return {
            id: item.id,
            parentId: item.parentId,
            sortOrder: current,
          };
        });
        await reorderCategories({ items: payload });
        toast.success("Poradie kategórií bolo uložené.");
      } catch (error) {
        console.error("Category reorder failed:", error);
        toast.error("Nepodarilo sa uložiť poradie kategórií.");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Potiahnutím zmeňte poradie, prípadne upravte nadradenú kategóriu.
        </p>
        <AdminButton size="sm" onClick={saveOrder} disabled={isPending}>
          {isPending ? "Ukladám..." : "Uložiť poradie"}
        </AdminButton>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableCategoryRow
                key={item.id}
                item={item}
                depth={depthMap.get(item.id) ?? 0}
                categoryOptions={categoryOptions}
                onParentChange={(parentId) =>
                  setItems((prev) =>
                    prev.map((entry) => (entry.id === item.id ? { ...entry, parentId } : entry))
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableCategoryRow({
  item,
  depth,
  categoryOptions,
  onParentChange,
}: {
  item: CategoryRow;
  depth: number;
  categoryOptions: Array<{ id: string; name: string }>;
  onParentChange: (parentId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_1fr_220px] items-center gap-3 rounded-md border bg-card px-3 py-2"
    >
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label={`Presunúť ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        {depth > 0 ? <span className="text-xs text-muted-foreground" style={{ marginLeft: `${(depth - 1) * 10}px` }}>↳</span> : null}
        <span className="text-sm font-medium">{item.name}</span>
      </div>
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={item.parentId ?? "none"}
        onChange={(event) => onParentChange(event.target.value === "none" ? null : event.target.value)}
      >
        <option value="none">Bez nadradenej</option>
        {categoryOptions
          .filter((option) => option.id !== item.id)
          .map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
      </select>
    </div>
  );
}

