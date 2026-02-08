"use client"

import { useMemo, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { AuthForms } from "@/app/(site)/(content)/auth/auth-forms"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function LoginDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const callbackUrl = useMemo(() => {
    const query = searchParams?.toString()
    return query ? `${pathname}?${query}` : pathname || "/"
  }, [pathname, searchParams])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        size="lg"
        aria-label="Prihlásenie"
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Prihlásenie</DialogTitle>
        </DialogHeader>
        <AuthForms
          callbackUrl={callbackUrl}
          stayOnPage
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
