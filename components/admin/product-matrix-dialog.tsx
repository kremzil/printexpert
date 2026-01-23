"use client"

import { useMemo, useRef, useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { XIcon } from "lucide-react"

type MatrixAttribute = {
  attribute: {
    attributeId: number
    attributeLabel: string
    attributeName: string
  }
  terms: {
    termId: number
    name: string
  }[]
}

type MatrixDialogSlot = {
  attributeId: number
  termIds: number[]
}

type MatrixDialogInitialValues = {
  slots: MatrixDialogSlot[]
  kind: "simple" | "finishing"
  numType: string
  numbers: string
}

type ProductMatrixDialogProps = {
  productName: string
  attributes: MatrixAttribute[]
  submitAction: (formData: FormData) => void
  triggerLabel?: string
  dialogTitle?: string
  triggerVariant?: ComponentProps<typeof Button>["variant"]
  triggerSize?: ComponentProps<typeof Button>["size"]
  initialValues?: MatrixDialogInitialValues
}

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

export function ProductMatrixDialog({
  productName,
  attributes,
  submitAction,
  triggerLabel = "+ Pridať maticu",
  dialogTitle = "Nová matica",
  triggerVariant = "default",
  triggerSize = "sm",
  initialValues,
}: ProductMatrixDialogProps) {
  const [open, setOpen] = useState(false)
  const initialSlots = useMemo(() => {
    if (initialValues?.slots?.length) {
      return initialValues.slots.map((slot, index) => ({
        id: `slot-${index + 1}`,
        attributeId: slot.attributeId,
        termIds: slot.termIds,
      }))
    }
    return [{ id: "slot-1", attributeId: null, termIds: [] }]
  }, [initialValues])
  const slotCounterRef = useRef(initialSlots.length)
  const [attributeSlots, setAttributeSlots] = useState<
    { id: string; attributeId: number | null; termIds: number[] }[]
  >(initialSlots)
  const [activeSlotId, setActiveSlotId] = useState(
    initialSlots[0]?.id ?? "slot-1"
  )
  const [kind, setKind] = useState(initialValues?.kind ?? "simple")
  const [numType, setNumType] = useState(initialValues?.numType ?? "0")
  const [numbers, setNumbers] = useState(initialValues?.numbers ?? "")

  const selectedAttributeLabels = useMemo(() => {
    const labels = attributeSlots
      .map((slot) => {
        if (!slot.attributeId) return null
        const entry = attributes.find(
          (attributeEntry) =>
            attributeEntry.attribute.attributeId === slot.attributeId
        )
        if (!entry) return null
        return entry.attribute.attributeLabel || entry.attribute.attributeName
      })
      .filter((label): label is string => Boolean(label))
    return labels.length > 0 ? labels.join(" + ") : ""
  }, [attributeSlots, attributes])

  const title = selectedAttributeLabels
    ? `${productName} – ${selectedAttributeLabels}`
    : ""

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      slotCounterRef.current = initialSlots.length
      setAttributeSlots(initialSlots)
      setActiveSlotId(initialSlots[0]?.id ?? "slot-1")
      setKind(initialValues?.kind ?? "simple")
      setNumType(initialValues?.numType ?? "0")
      setNumbers(initialValues?.numbers ?? "")
    }
  }

  const handleSelectAttribute = (slotId: string, attributeId: number | null) => {
    setAttributeSlots((slots) =>
      slots.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              attributeId,
              termIds:
                slot.attributeId === attributeId ? slot.termIds : [],
            }
          : slot
      )
    )
  }

  const handleAddSlot = () => {
    if (kind === "finishing") {
      return
    }
    slotCounterRef.current += 1
    const id = `slot-${slotCounterRef.current}`
    setAttributeSlots((slots) => [
      ...slots,
      { id, attributeId: null, termIds: [] },
    ])
    setActiveSlotId(id)
  }

  const handleRemoveSlot = (slotId: string) => {
    if (attributeSlots.length <= 1) return
    const nextSlots = attributeSlots.filter((slot) => slot.id !== slotId)
    const nextActive =
      activeSlotId === slotId ? nextSlots[0]?.id ?? "slot-1" : activeSlotId
    setAttributeSlots(nextSlots)
    setActiveSlotId(nextActive)
  }

  const isSubmitDisabled = attributeSlots.every((slot) => !slot.attributeId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size={triggerSize} variant={triggerVariant}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{`${dialogTitle}${title ? ` - ${title}` : ""}`}</DialogTitle>
        </DialogHeader>

        <form
          action={submitAction}
          onSubmit={() => setOpen(false)}
          className="flex min-h-0 flex-col gap-5"
        >
          <input type="hidden" name="title" value={title} />
          {attributeSlots.flatMap((slot) =>
            slot.attributeId
              ? slot.termIds.map((termId) => (
                  <input
                    key={`${slot.id}-${termId}`}
                    type="hidden"
                    name={`terms:${slot.attributeId}`}
                    value={termId}
                  />
                ))
              : []
          )}

          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex items-center gap-2">
              <Label>Vlastnosť</Label>
              {kind === "finishing" ? (
                <span className="text-xs text-muted-foreground">
                  Dokončovacia matica môže mať len jednu vlastnosť.
                </span>
              ) : null}
            </div>

            <Tabs value={activeSlotId} onValueChange={setActiveSlotId}>
              <div className="flex flex-wrap items-center gap-2">
                <TabsList>
                  {attributeSlots.map((slot, index) => {
                    const attributeEntry = slot.attributeId
                      ? attributes.find(
                          (entry) =>
                            entry.attribute.attributeId === slot.attributeId
                        ) ?? null
                      : null
                    const label = attributeEntry
                      ? attributeEntry.attribute.attributeLabel ||
                        attributeEntry.attribute.attributeName
                      : `Vlastnosť ${index + 1}`
                    return (
                      <TabsTrigger key={slot.id} value={slot.id}>
                        <span className="truncate">{label}</span>
                        <span
                          role="button"
                          tabIndex={-1}
                          className={`ml-1 inline-flex size-4 items-center justify-center rounded-sm ${
                            attributeSlots.length <= 1 ||
                            kind === "finishing"
                              ? "cursor-not-allowed text-muted-foreground/50"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (attributeSlots.length <= 1 || kind === "finishing") {
                              return
                            }
                            handleRemoveSlot(slot.id)
                          }}
                          onKeyDown={(event) => {
                            if (attributeSlots.length <= 1 || kind === "finishing") {
                              return
                            }
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              handleRemoveSlot(slot.id)
                            }
                          }}
                          aria-label="Odstrániť vlastnosť"
                          aria-disabled={
                            attributeSlots.length <= 1 || kind === "finishing"
                          }
                        >
                          <XIcon className="size-3" />
                        </span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleAddSlot}
                  disabled={kind === "finishing"}
                >
                  +
                </Button>
              </div>

              {attributeSlots.map((slot) => {
                const attributeEntry = slot.attributeId
                  ? attributes.find(
                      (entry) =>
                        entry.attribute.attributeId === slot.attributeId
                    ) ?? null
                  : null
                const takenAttributeIds = new Set(
                  attributeSlots
                    .filter(
                      (otherSlot) =>
                        otherSlot.id !== slot.id && otherSlot.attributeId
                    )
                    .map((otherSlot) => otherSlot.attributeId as number)
                )

                return (
                  <TabsContent key={slot.id} value={slot.id}>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <select
                          id={`matrix-attribute-${slot.id}`}
                          className={selectClassName}
                          value={
                            slot.attributeId ? String(slot.attributeId) : ""
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value
                            handleSelectAttribute(
                              slot.id,
                              nextValue ? Number(nextValue) : null
                            )
                          }}
                        >
                          <option value="">Vyberte vlastnosť…</option>
                          {attributes.map(({ attribute }) => {
                            const attributeLabel =
                              attribute.attributeLabel || attribute.attributeName
                            const isTaken =
                              takenAttributeIds.has(attribute.attributeId)
                            return (
                              <option
                                key={attribute.attributeId}
                                value={attribute.attributeId}
                                disabled={isTaken}
                              >
                                {attributeLabel}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Hodnoty</div>
                        <div className="h-[28vh] overflow-y-auto rounded-lg border px-4 py-4 text-sm">
                          {!attributeEntry ? (
                            <div className="text-xs text-muted-foreground">
                              Najprv vyberte vlastnosť.
                            </div>
                          ) : attributeEntry.terms.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              Bez hodnôt pre túto vlastnosť.
                            </div>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {attributeEntry.terms.map((term) => (
                                <label
                                  key={term.termId}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={slot.termIds.includes(term.termId)}
                                    onChange={(event) => {
                                      const checked = event.target.checked
                                      setAttributeSlots((slots) =>
                                        slots.map((currentSlot) => {
                                          if (currentSlot.id !== slot.id) {
                                            return currentSlot
                                          }
                                          const nextTermIds = checked
                                            ? Array.from(
                                                new Set([
                                                  ...currentSlot.termIds,
                                                  term.termId,
                                                ])
                                              )
                                            : currentSlot.termIds.filter(
                                                (id) => id !== term.termId
                                              )
                                          return {
                                            ...currentSlot,
                                            termIds: nextTermIds,
                                          }
                                        })
                                      )
                                    }}
                                    className="size-4 accent-primary"
                                  />
                                  <span>{term.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="matrix-kind">Typ matice</Label>
              <select
                id="matrix-kind"
                name="kind"
                className={selectClassName}
                value={kind}
                onChange={(event) => {
                  const nextKind = event.target.value
                  setKind(nextKind)
                  if (nextKind === "finishing") {
                    setAttributeSlots((slots) => slots.slice(0, 1))
                    setActiveSlotId((current) =>
                      current === "slot-1" ? current : "slot-1"
                    )
                    slotCounterRef.current = 1
                  }
                }}
              >
                <option value="simple">Základná</option>
                <option value="finishing">Dokončovacia</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="matrix-num-type">Typ množstva</Label>
              <select
                id="matrix-num-type"
                name="numType"
                className={selectClassName}
                value={numType}
                onChange={(event) => setNumType(event.target.value)}
              >
                <option value="0">Fixná</option>
                <option value="2">Plocha (šírka × výška)</option>
                <option value="3">Obvod</option>
                <option value="4">Šírka × 2</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matrix-breakpoints">Breakpointy</Label>
            <Input
              id="matrix-breakpoints"
              name="numbers"
              placeholder="Breakpointy… (napr. 100|200|500)"
              value={numbers}
              onChange={(event) => setNumbers(event.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Zrušiť
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitDisabled}>
              Potvrdiť
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
