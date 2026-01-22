"use client"

import { useState } from "react"

import { RichTextEditor } from "@/components/RichTextEditor"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type ProductDescriptionEditorProps = {
  name: string
  initialValue?: string | null
  placeholder?: string
  label?: string
}

export function ProductDescriptionEditor({
  name,
  initialValue,
  placeholder,
  label = "Detailný popis",
}: ProductDescriptionEditorProps) {
  const [value, setValue] = useState(initialValue ?? "")
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg")

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>HTML</span>
          <Switch
            checked={mode === "wysiwyg"}
            onCheckedChange={(checked) =>
              setMode(checked ? "wysiwyg" : "html")
            }
          />
          <span>Vizuálny</span>
        </div>
      </div>
      <RichTextEditor
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        mode={mode}
        onModeChange={setMode}
      />
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
