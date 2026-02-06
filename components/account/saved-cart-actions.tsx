"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ModeButton } from "@/components/print/mode-button"
import { getCsrfHeader } from "@/lib/csrf"

export function SavedCartActions({
  savedCartId,
  name,
}: {
  savedCartId: string
  name?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(name ?? "")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const isBusy = isPending || isMutating

  const handleLoadCart = async () => {
    if (isMutating) return
    setMessage(null)
    setIsMutating(true)

    try {
      const response = await fetch(`/api/saved-carts/${savedCartId}/load`, {
        method: "POST",
        headers: { ...getCsrfHeader() },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const errorMessage = data?.error ?? "Nepodarilo sa načítať košík."
        setMessage({ type: "error", text: errorMessage })
        setIsMutating(false)
        return
      }

      setMessage({ type: "success", text: "Košík bol načítaný." })
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"))
      }
      startTransition(() => {
        router.push("/cart")
      })
    } catch (error) {
      console.error("Load cart error:", error)
      setMessage({ type: "error", text: "Nepodarilo sa načítať košík." })
    } finally {
      setIsMutating(false)
    }
  }

  const handleRename = async () => {
    if (isMutating) return
    setMessage(null)
    setIsMutating(true)

    try {
      const response = await fetch(`/api/saved-carts/${savedCartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          name: renameValue.trim() !== "" ? renameValue.trim() : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const errorMessage = data?.error ?? "Nepodarilo sa upraviť košík."
        setMessage({ type: "error", text: errorMessage })
        setIsMutating(false)
        return
      }

      setMessage({ type: "success", text: "Názov košíka bol aktualizovaný." })
      setIsRenameOpen(false)
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      console.error("Rename cart error:", error)
      setMessage({ type: "error", text: "Nepodarilo sa upraviť košík." })
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelete = async () => {
    if (isMutating) return
    setMessage(null)
    setIsMutating(true)

    try {
      const response = await fetch(`/api/saved-carts/${savedCartId}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const errorMessage = data?.error ?? "Nepodarilo sa odstrániť košík."
        setMessage({ type: "error", text: errorMessage })
        setIsMutating(false)
        return
      }

      setIsDeleteOpen(false)
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      console.error("Delete cart error:", error)
      setMessage({ type: "error", text: "Nepodarilo sa odstrániť košík." })
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <ModeButton
          mode="b2b"
          variant="outline"
          size="sm"
          type="button"
          onClick={handleLoadCart}
          disabled={isBusy}
        >
          Načítať do košíka
        </ModeButton>

        <Dialog
          open={isRenameOpen}
          onOpenChange={(open) => {
            setIsRenameOpen(open)
            if (open) {
              setMessage(null)
              setRenameValue(name ?? "")
            }
          }}
        >
          <DialogTrigger asChild>
            <ModeButton mode="b2b" variant="outline" size="sm" type="button" disabled={isBusy}>
              Premenovať
            </ModeButton>
          </DialogTrigger>
          <DialogContent size="default">
            <DialogHeader>
              <DialogTitle>Premenovať košík</DialogTitle>
              <DialogDescription>
                Zmeňte názov pre jednoduchšie vyhľadanie uloženého košíka.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`rename-cart-${savedCartId}`}>Názov košíka</Label>
              <Input
                id={`rename-cart-${savedCartId}`}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Napr. Tlač pre pobočky"
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <ModeButton
                mode="b2b"
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsRenameOpen(false)}
              >
                Zrušiť
              </ModeButton>
              <ModeButton
                mode="b2b"
                variant="primary"
                size="sm"
                type="button"
                onClick={handleRename}
                disabled={isBusy}
              >
                Uložiť
              </ModeButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogTrigger asChild>
            <ModeButton mode="b2b" variant="outline" size="sm" type="button" disabled={isBusy}>
              Odstrániť
            </ModeButton>
          </AlertDialogTrigger>
          <AlertDialogContent size="default">
            <AlertDialogHeader>
              <AlertDialogTitle>Odstrániť košík?</AlertDialogTitle>
              <AlertDialogDescription>
                Tento krok je nevratný. Košík aj jeho položky budú odstránené.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isBusy}
              >
                Odstrániť
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {message?.type === "success" ? (
        <div className="text-xs text-green-600">{message.text}</div>
      ) : null}
      {message?.type === "error" ? (
        <div className="text-xs text-red-600">{message.text}</div>
      ) : null}
    </div>
  )
}
