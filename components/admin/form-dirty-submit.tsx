"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";

type FormDirtySubmitProps = {
  idleText?: string;
  dirtyText?: string;
  submitLabel?: string;
  pendingLabel?: string;
};

function DirtySubmitButton({
  submitLabel,
  pendingLabel,
}: {
  submitLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <AdminButton type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        submitLabel
      )}
    </AdminButton>
  );
}

export function FormDirtySubmit({
  idleText = "Žiadne neuložené zmeny.",
  dirtyText = "Máte neuložené zmeny v matici.",
  submitLabel = "Uložiť maticu",
  pendingLabel = "Ukladám maticu...",
}: FormDirtySubmitProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const form = root?.closest("form");
    if (!form) return;

    const onMarkDirty = () => setIsDirty(true);
    const onSubmit = () => setIsDirty(false);
    form.addEventListener("input", onMarkDirty);
    form.addEventListener("change", onMarkDirty);
    form.addEventListener("submit", onSubmit);

    return () => {
      form.removeEventListener("input", onMarkDirty);
      form.removeEventListener("change", onMarkDirty);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);

  const toneClass = useMemo(
    () =>
      isDirty
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-border bg-muted/20 text-muted-foreground",
    [isDirty]
  );

  return (
    <div ref={rootRef} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      <span>{isDirty ? dirtyText : idleText}</span>
      {isDirty ? <DirtySubmitButton submitLabel={submitLabel} pendingLabel={pendingLabel} /> : null}
    </div>
  );
}
