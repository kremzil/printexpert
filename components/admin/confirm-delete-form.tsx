"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ConfirmDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>
  triggerText: string
  title: string
  description: string
  confirmText?: string
  cancelText?: string
}

export function ConfirmDeleteForm({
  action,
  triggerText,
  title,
  description,
  confirmText = "Odstrániť",
  cancelText = "Zrušiť",
}: ConfirmDeleteFormProps) {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button size="xs" variant="destructive" type="button">
        {triggerText}
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="xs" variant="destructive" type="button">
          {triggerText}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => formRef.current?.requestSubmit()}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
        <form ref={formRef} action={action} />
      </AlertDialogContent>
    </AlertDialog>
  )
}
