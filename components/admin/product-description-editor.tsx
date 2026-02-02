"use client"

import { useState } from "react"

import { RichTextEditor } from "@/components/RichTextEditor"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <Label className="text-base font-medium">{label}</Label>
        <ToggleGroup 
          type="single" 
          value={mode} 
          onValueChange={(val) => val && setMode(val as "wysiwyg" | "html")}
          className="bg-muted p-1 rounded-md"
        >
          <ToggleGroupItem value="wysiwyg" size="sm" className="data-[state=on]:bg-white data-[state=on]:shadow-sm text-xs">
            Vizuálny
          </ToggleGroupItem>
          <ToggleGroupItem value="html" size="sm" className="data-[state=on]:bg-white data-[state=on]:shadow-sm text-xs">
            HTML
          </ToggleGroupItem>
        </ToggleGroup>
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
