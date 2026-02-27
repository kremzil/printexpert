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
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
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

const getNormalizedParentById = (items: CategoryRow[]) => {
  const itemById = new Set(items.map((item) => item.id));
  return new Map(
    items.map((item) => [
      item.id,
      item.parentId && item.parentId !== item.id && itemById.has(item.parentId)
        ? item.parentId
        : null,
    ])
  );
};

const getDepthMap = (parentById: Map<string, string | null>) => {
  const getDepth = (id: string) => {
    const seen = new Set<string>();
    let current = parentById.get(id);
    let depth = 0;
    while (current && !seen.has(current)) {
      seen.add(current);
      depth += 1;
      current = parentById.get(current) ?? null;
    }
    return depth;
  };

  return new Map(Array.from(parentById.keys()).map((id) => [id, getDepth(id)]));
};

const orderItemsAsTree = (items: CategoryRow[]) => {
  const parentById = getNormalizedParentById(items);
  const indexById = new Map(items.map((item, index) => [item.id, index]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const childrenByParentId = new Map<string | null, CategoryRow[]>();

  for (const item of items) {
    const key = parentById.get(item.id) ?? null;
    const siblings = childrenByParentId.get(key) ?? [];
    siblings.push(item);
    childrenByParentId.set(key, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort(
      (left, right) =>
        (indexById.get(left.id) ?? 0) - (indexById.get(right.id) ?? 0)
    );
  }

  const ordered: CategoryRow[] = [];
  const visited = new Set<string>();

  const visit = (item: CategoryRow, lineage: Set<string>) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    ordered.push(item);

    const nextLineage = new Set(lineage);
    nextLineage.add(item.id);

    const children = childrenByParentId.get(item.id) ?? [];
    for (const child of children) {
      if (nextLineage.has(child.id)) continue;
      visit(child, nextLineage);
    }
  };

  const roots = childrenByParentId.get(null) ?? [];
  for (const root of roots) {
    visit(root, new Set<string>());
  }

  for (const item of items) {
    if (!visited.has(item.id)) {
      const fallback = itemById.get(item.id);
      if (fallback) {
        visit(fallback, new Set<string>());
      }
    }
  }

  return ordered;
};

const wouldCreateCycle = (
  categoryId: string,
  nextParentId: string,
  parentById: Map<string, string | null>
) => {
  if (categoryId === nextParentId) return true;

  const seen = new Set<string>();
  let current: string | null = nextParentId;
  while (current && !seen.has(current)) {
    if (current === categoryId) return true;
    seen.add(current);
    current = parentById.get(current) ?? null;
  }
  return false;
};

const moveWithinSiblingGroup = (
  items: CategoryRow[],
  activeId: string,
  overId: string
) => {
  const parentById = getNormalizedParentById(items);
  const activeParentId = parentById.get(activeId) ?? null;
  const overParentId = parentById.get(overId) ?? null;

  // Restrict drag sorting to the same level/sibling group.
  if (activeParentId !== overParentId) {
    return items;
  }

  const ordered = orderItemsAsTree(items);
  const siblingIds = ordered
    .filter((item) => (parentById.get(item.id) ?? null) === activeParentId)
    .map((item) => item.id);

  const oldIndex = siblingIds.indexOf(activeId);
  const newIndex = siblingIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return items;
  }

  const nextSiblingIds = arrayMove(siblingIds, oldIndex, newIndex);
  const siblingIdSet = new Set(siblingIds);
  const nextOrderedIds: string[] = [];
  let siblingsInserted = false;

  for (const item of ordered) {
    if (siblingIdSet.has(item.id)) {
      if (!siblingsInserted) {
        nextOrderedIds.push(...nextSiblingIds);
        siblingsInserted = true;
      }
      continue;
    }
    nextOrderedIds.push(item.id);
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  return nextOrderedIds
    .map((id) => itemById.get(id))
    .filter((item): item is CategoryRow => Boolean(item));
};

export function CategoriesDndManager({ categories }: CategoriesDndManagerProps) {
  const [items, setItems] = useState(() =>
    [...categories].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    )
  );
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const parentById = useMemo(() => getNormalizedParentById(items), [items]);
  const depthMap = useMemo(() => getDepthMap(parentById), [parentById]);
  const orderedItems = useMemo(() => orderItemsAsTree(items), [items]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | null, CategoryRow[]>();
    for (const item of orderedItems) {
      const key = parentById.get(item.id) ?? null;
      const siblings = map.get(key) ?? [];
      siblings.push(item);
      map.set(key, siblings);
    }
    return map;
  }, [orderedItems, parentById]);

  const rootCandidates = childrenByParentId.get(null) ?? [];
  const rootItems = rootCandidates.length > 0 ? rootCandidates : orderedItems;

  const categoryOptions = useMemo(
    () =>
      orderedItems.map((item) => ({
        id: item.id,
        name: item.name,
        depth: depthMap.get(item.id) ?? 0,
      })),
    [depthMap, orderedItems]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) =>
      moveWithinSiblingGroup(prev, String(active.id), String(over.id))
    );
  };

  const handleParentChange = (categoryId: string, nextParentId: string | null) => {
    setItems((prev) => {
      const prevParentById = getNormalizedParentById(prev);
      if (
        nextParentId &&
        wouldCreateCycle(categoryId, nextParentId, prevParentById)
      ) {
        return prev;
      }

      return prev.map((entry) =>
        entry.id === categoryId ? { ...entry, parentId: nextParentId } : entry
      );
    });

    if (nextParentId) {
      setExpandedById((prev) => ({ ...prev, [nextParentId]: true }));
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedById((prev) => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? false),
    }));
  };

  const saveOrder = () => {
    startTransition(async () => {
      try {
        const sortedItems = orderItemsAsTree(items);
        const normalizedParentById = getNormalizedParentById(sortedItems);
        const counters = new Map<string, number>();

        const payload = sortedItems.map((item) => {
          const parentId = normalizedParentById.get(item.id) ?? null;
          const key = parentId ?? "__root__";
          const current = counters.get(key) ?? 0;
          counters.set(key, current + 1);
          return {
            id: item.id,
            parentId,
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
          Potiahnutím zmeňte poradie rodičov alebo podkategórií v rozbalenej vetve.
        </p>
        <AdminButton size="sm" onClick={saveOrder} disabled={isPending}>
          {isPending ? "Ukladám..." : "Uložiť poradie"}
        </AdminButton>
      </div>

      <DndContext
        id="admin-categories-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rootItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {rootItems.map((item) => (
              <CategoryBranch
                key={item.id}
                item={item}
                depth={0}
                lineage={[]}
                childrenByParentId={childrenByParentId}
                parentById={parentById}
                categoryOptions={categoryOptions}
                expandedById={expandedById}
                onToggleExpanded={toggleExpanded}
                onParentChange={handleParentChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CategoryBranch({
  item,
  depth,
  lineage,
  childrenByParentId,
  parentById,
  categoryOptions,
  expandedById,
  onToggleExpanded,
  onParentChange,
}: {
  item: CategoryRow;
  depth: number;
  lineage: string[];
  childrenByParentId: Map<string | null, CategoryRow[]>;
  parentById: Map<string, string | null>;
  categoryOptions: Array<{ id: string; name: string; depth: number }>;
  expandedById: Record<string, boolean>;
  onToggleExpanded: (categoryId: string) => void;
  onParentChange: (categoryId: string, parentId: string | null) => void;
}) {
  const lineageSet = new Set(lineage);
  const children = (childrenByParentId.get(item.id) ?? []).filter(
    (child) => !lineageSet.has(child.id)
  );
  const hasChildren = children.length > 0;
  const isExpanded = expandedById[item.id] ?? false;

  return (
    <div className="space-y-2">
      <SortableCategoryRow
        item={item}
        depth={depth}
        parentById={parentById}
        categoryOptions={categoryOptions}
        onParentChange={(parentId) => onParentChange(item.id, parentId)}
      />

      {hasChildren ? (
        <div className="ml-8 rounded-md border-l border-border/70 pl-3">
          <button
            type="button"
            className="mb-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => onToggleExpanded(item.id)}
            aria-label={isExpanded ? "Zbaliť podkategórie" : "Rozbaliť podkategórie"}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Podkategórie ({children.length})
          </button>

          {isExpanded ? (
            <SortableContext
              items={children.map((child) => child.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 pb-2">
                {children.map((child) => (
                  <CategoryBranch
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    lineage={[...lineage, item.id]}
                    childrenByParentId={childrenByParentId}
                    parentById={parentById}
                    categoryOptions={categoryOptions}
                    expandedById={expandedById}
                    onToggleExpanded={onToggleExpanded}
                    onParentChange={onParentChange}
                  />
                ))}
              </div>
            </SortableContext>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SortableCategoryRow({
  item,
  depth,
  categoryOptions,
  parentById,
  onParentChange,
}: {
  item: CategoryRow;
  depth: number;
  categoryOptions: Array<{ id: string; name: string; depth: number }>;
  parentById: Map<string, string | null>;
  onParentChange: (parentId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

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
        {depth > 0 ? (
          <span
            className="text-xs text-muted-foreground"
            style={{ marginLeft: `${(depth - 1) * 10}px` }}
          >
            ↳
          </span>
        ) : null}
        <span className="text-sm font-medium">{item.name}</span>
      </div>

      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={item.parentId ?? "none"}
        onChange={(event) => {
          const nextParentId =
            event.target.value === "none" ? null : event.target.value;
          if (
            nextParentId &&
            wouldCreateCycle(item.id, nextParentId, parentById)
          ) {
            return;
          }
          onParentChange(nextParentId);
        }}
      >
        <option value="none">Bez nadradenej</option>
        {categoryOptions
          .filter(
            (option) =>
              option.id !== item.id &&
              !wouldCreateCycle(item.id, option.id, parentById)
          )
          .map((option) => (
            <option key={option.id} value={option.id}>
              {option.depth > 0 ? `${"— ".repeat(option.depth)}` : ""}
              {option.name}
            </option>
          ))}
      </select>
    </div>
  );
}
