"use client"

import { useMemo, useState } from "react"

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
  const [selectedAttributeId, setSelectedAttributeId] = useState<number | null>(
    null
  )
  const [kind, setKind] = useState("simple")
  const [numType, setNumType] = useState("0")
  const [numbers, setNumbers] = useState("")

  const selectedAttribute = useMemo(
    () =>
      attributes.find(
        (entry) => entry.attribute.attributeId === selectedAttributeId
      ) ?? null,
    [attributes, selectedAttributeId]
  )

  const title = selectedAttribute
    ? `${productName} – ${
        selectedAttribute.attribute.attributeLabel ||
        selectedAttribute.attribute.attributeName
      }`
    : ""

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSelectedAttributeId(null)
      setKind("simple")
      setNumType("0")
      setNumbers("")
    }
  }

  const handleSelectAttribute = (attributeId: number | null) => {
    setSelectedAttributeId(attributeId)
  }

  const isSubmitDisabled =
    !selectedAttribute || selectedAttribute.terms.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          + Pridať maticu
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nová matica</DialogTitle>
          <DialogDescription>
            Vyberte vlastnosť a hodnoty, ktoré sa použijú pri výpočte ceny.
          </DialogDescription>
        </DialogHeader>

        <form
          action={createMatrixAction}
          onSubmit={() => setOpen(false)}
          className="space-y-5"
        >
          <input type="hidden" name="title" value={title} />

          <div className="space-y-2">
            <Label htmlFor="matrix-attribute">Vlastnosť</Label>
            <select
              id="matrix-attribute"
              className={selectClassName}
              value={selectedAttributeId ? String(selectedAttributeId) : ""}
              onChange={(event) => {
                const nextValue = event.target.value
                handleSelectAttribute(nextValue ? Number(nextValue) : null)
              }}
            >
              <option value="">Vyberte vlastnosť…</option>
              {attributes.map(({ attribute }) => {
                const attributeLabel =
                  attribute.attributeLabel || attribute.attributeName
                return (
                  <option
                    key={attribute.attributeId}
                    value={attribute.attributeId}
                  >
                    {attributeLabel}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Hodnoty</div>
            <div className="rounded-lg border px-4 py-4 text-sm">
              {!selectedAttribute ? (
                <div className="text-xs text-muted-foreground">
                  Najprv vyberte vlastnosť.
                </div>
              ) : selectedAttribute.terms.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Bez hodnôt pre túto vlastnosť.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedAttribute.terms.map((term) => (
                    <label
                      key={term.termId}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name={`terms:${selectedAttribute.attribute.attributeId}`}
                        value={term.termId}
                        className="size-4 accent-primary"
                      />
                      <span>{term.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="matrix-title">Názov matice</Label>
              <Input
                id="matrix-title"
                value={title || "Najprv vyberte vlastnosť"}
                readOnly
              />
            </div>
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
