"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";

type FormSubmitButtonProps = {
  children: string;
  pendingText?: string;
} & Omit<ComponentProps<typeof AdminButton>, "children" | "type">;

export function FormSubmitButton({
  children,
  pendingText = "Ukladám...",
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <AdminButton type="submit" disabled={disabled || pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </AdminButton>
  );
}
