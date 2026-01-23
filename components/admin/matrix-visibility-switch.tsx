"use client"

import { useId, useRef, useState, useTransition } from "react"

import { Switch } from "@/components/ui/switch"

type MatrixVisibilitySwitchProps = {
  checked: boolean
  action: (formData: FormData) => void | Promise<void>
  label?: string
}

export function MatrixVisibilitySwitch({
  checked,
  action,
  label = "Zobraziť na stránke",
}: MatrixVisibilitySwitchProps) {
  const [isChecked, setIsChecked] = useState(checked)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="hidden"
        name="isActive"
        defaultValue={checked ? "1" : "0"}
      />
      <Switch
        id={id}
        checked={isChecked}
        disabled={isPending}
        onCheckedChange={(nextChecked) => {
          setIsChecked(nextChecked)
          if (inputRef.current) {
            inputRef.current.value = nextChecked ? "1" : "0"
          }
          startTransition(() => formRef.current?.requestSubmit())
        }}
      />
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
    </form>
  )
}
