"use client"

import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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

type ProductMatrixDialogProps = {
  productName: string
  attributes: MatrixAttribute[]
  createMatrixAction: (formData: FormData) => void
}

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

export function ProductMatrixDialog({
  productName,
  attributes,
  createMatrixAction,
}: ProductMatrixDialogProps) {
  const [open, setOpen] = useState(false)
  const slotCounterRef = useRef(1)
  const [attributeSlots, setAttributeSlots] = useState<
    { id: string; attributeId: number | null; termIds: number[] }[]
  >([{ id: "slot-1", attributeId: null, termIds: [] }])
  const [activeSlotId, setActiveSlotId] = useState("slot-1")
  const [kind, setKind] = useState("simple")
  const [numType, setNumType] = useState("0")
  const [numbers, setNumbers] = useState("")

  const activeSlot = useMemo(
    () => attributeSlots.find((slot) => slot.id === activeSlotId) ?? null,
    [activeSlotId, attributeSlots]
  )

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
      slotCounterRef.current = 1
      setAttributeSlots([{ id: "slot-1", attributeId: null, termIds: [] }])
      setActiveSlotId("slot-1")
      setKind("simple")
      setNumType("0")
      setNumbers("")
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
        <Button type="button" size="sm">
          + Pridať maticu
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{`Nová matica${title ? ` - ${title}` : ""}`}</DialogTitle>
        </DialogHeader>

        <form
          action={createMatrixAction}
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
                            attributeSlots.length <= 1
                              ? "cursor-not-allowed text-muted-foreground/50"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (attributeSlots.length <= 1) return
                            handleRemoveSlot(slot.id)
                          }}
                          onKeyDown={(event) => {
                            if (attributeSlots.length <= 1) return
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              handleRemoveSlot(slot.id)
                            }
                          }}
                          aria-label="Odstrániť vlastnosť"
                          aria-disabled={attributeSlots.length <= 1}
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
                onChange={(event) => setKind(event.target.value)}
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
