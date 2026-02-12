"use client"

import { useState, useTransition } from "react"
import { Layers, Plus, Trash2, Star, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCsrfHeader } from "@/lib/csrf"

interface Template {
  id: string
  name: string
  elements: unknown
  isDefault: boolean
  sortOrder: number
}

interface DesignTemplatesManagerProps {
  productId: string
  templates: Template[]
}

export function DesignTemplatesManager({
  productId,
  templates: initialTemplates,
}: DesignTemplatesManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [newName, setNewName] = useState("")
  const [isPending, startTransition] = useTransition()

  const addTemplate = () => {
    if (!newName.trim()) return
    startTransition(async () => {
      const res = await fetch("/api/design-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          productId,
          name: newName.trim(),
          elements: [],
          isDefault: templates.length === 0,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setTemplates((prev) => [...prev, created])
        setNewName("")
      }
    })
  }

  const deleteTemplate = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/design-templates/${id}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
      }
    })
  }

  const setDefault = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/design-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            isDefault: t.id === id,
          }))
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-semibold">Šablóny dizajnéra</h3>
        <span className="text-sm text-muted-foreground">
          ({templates.length})
        </span>
      </div>

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  {tpl.isDefault && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">
                      Predvolená
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {Array.isArray(tpl.elements)
                    ? `${(tpl.elements as unknown[]).length} elementov`
                    : "Prázdna šablóna"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!tpl.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault(tpl.id)}
                    disabled={isPending}
                    title="Nastaviť ako predvolenú"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTemplate(tpl.id)}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                  title="Vymazať šablónu"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="newTemplateName" className="text-sm">
            Nová šablóna
          </Label>
          <Input
            id="newTemplateName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Názov šablóny..."
            onKeyDown={(e) => e.key === "Enter" && addTemplate()}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addTemplate}
          disabled={isPending || !newName.trim()}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Pridať
        </Button>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Zatiaľ neboli pridané žiadne šablóny. Šablóny umožňujú zákazníkom
          začať dizajn z predpripraveného návrhu.
        </p>
      )}
    </div>
  )
}
