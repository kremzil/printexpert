"use client"

import { useMemo, useRef, useState, type ComponentProps } from "react"

import { AdminButton as Button } from "@/components/admin/admin-button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  numStyle: string
  aUnit: string
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

export function ProductMatrixDialog({
  productName,
  attributes,
  submitAction,
  triggerLabel = "+ Pridať maticu",
  dialogTitle = "Nová matica",
  triggerVariant = "primary",
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
  const [numStyle, setNumStyle] = useState(initialValues?.numStyle ?? "0")
  const [aUnit, setAUnit] = useState(initialValues?.aUnit ?? "cm2")
  const [numbers, setNumbers] = useState(initialValues?.numbers ?? "")
  const [step, setStep] = useState(1)

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
      setNumStyle(initialValues?.numStyle ?? "0")
      setAUnit(initialValues?.aUnit ?? "cm2")
      setNumbers(initialValues?.numbers ?? "")
      setStep(1)
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

  const hasAnyAttribute = attributeSlots.some((slot) => Boolean(slot.attributeId))
  const hasTermsForAllSelected = attributeSlots
    .filter((slot) => Boolean(slot.attributeId))
    .every((slot) => slot.termIds.length > 0)
  const canProceedFromStep1 = hasAnyAttribute && hasTermsForAllSelected
  const isSubmitDisabled = !canProceedFromStep1

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
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="numType" value={numType} />
          <input type="hidden" name="numStyle" value={numStyle} />
          <input type="hidden" name="aUnit" value={aUnit} />
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
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Krok {step} z 3
            {step === 1 ? " - Výber vlastností" : null}
            {step === 2 ? " - Nastavenie výpočtu" : null}
            {step === 3 ? " - Breakpointy a potvrdenie" : null}
          </div>

          {step === 1 ? (
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
                    size="sm"
                    className="h-7 w-7 p-0"
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
                          <Select
                            value={
                              slot.attributeId ? String(slot.attributeId) : ""
                            }
                            onValueChange={(value) => {
                              handleSelectAttribute(
                                slot.id,
                                value ? Number(value) : null
                              )
                            }}
                          >
                            <SelectTrigger id={`matrix-attribute-${slot.id}`}>
                              <SelectValue placeholder="Vyberte vlastnosť…" />
                            </SelectTrigger>
                            <SelectContent>
                              {attributes.map(({ attribute }) => {
                                const attributeLabel =
                                  attribute.attributeLabel || attribute.attributeName
                                const isTaken =
                                  takenAttributeIds.has(attribute.attributeId)
                                return (
                                  <SelectItem
                                    key={attribute.attributeId}
                                    value={String(attribute.attributeId)}
                                    disabled={isTaken}
                                  >
                                    {attributeLabel}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
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
          ) : null}

          {step === 2 ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="matrix-kind">Typ matice</Label>
                  <Select
                    value={kind}
                    onValueChange={(value) => {
                      const nextKind = value as "simple" | "finishing"
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
                    <SelectTrigger id="matrix-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Základná</SelectItem>
                      <SelectItem value="finishing">Dokončovacia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matrix-num-type">Typ množstva</Label>
                  <Select
                    value={numType}
                    onValueChange={setNumType}
                  >
                    <SelectTrigger id="matrix-num-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Fixná</SelectItem>
                      <SelectItem value="2">Plocha (šírka × výška)</SelectItem>
                      <SelectItem value="3">Obvod</SelectItem>
                      <SelectItem value="4">Šírka × 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matrix-num-style">Štýl množstva</Label>
                  <Select value={numStyle} onValueChange={setNumStyle}>
                    <SelectTrigger id="matrix-num-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Vstup</SelectItem>
                      <SelectItem value="1">Zoznam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="matrix-a-unit">Jednotka plochy</Label>
                <Select value={aUnit} onValueChange={setAUnit}>
                  <SelectTrigger id="matrix-a-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cm2">cm2</SelectItem>
                    <SelectItem value="m2">m2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
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
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Skontrolujte výber vlastností a potvrďte uloženie matice.
              </div>
            </>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Zrušiť
              </Button>
            </DialogClose>
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((prev) => Math.max(prev - 1, 1))}>
                Späť
              </Button>
            ) : null}
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep((prev) => Math.min(prev + 1, 3))}
                disabled={step === 1 ? !canProceedFromStep1 : false}
              >
                Pokračovať
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitDisabled}>
                Potvrdiť
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
