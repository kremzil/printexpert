"use client"

import { useEffect, useMemo, useState } from "react"
import { Node } from "@tiptap/core"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Underline from "@tiptap/extension-underline"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"

import { ModeButton } from "@/components/print/mode-button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getCsrfHeader } from "@/lib/csrf"
import { cn } from "@/lib/utils"
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PaletteIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  VideoIcon,
} from "lucide-react"

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  mode?: "wysiwyg" | "html"
  onModeChange?: (mode: "wysiwyg" | "html") => void
}

const normalizeLink = (rawUrl: string) => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

const normalizeVideoUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ""
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v")
      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "")
      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0]
      if (id) {
        return `https://player.vimeo.com/video/${id}`
      }
    }
    return ""
  } catch {
    return ""
  }
}

const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      title: { default: "Video" },
    }
  },
  parseHTML() {
    return [{ tag: "iframe" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      {
        ...HTMLAttributes,
        "data-video-embed": "true",
        allowfullscreen: "true",
      },
    ]
  },
})

const VideoFile = Node.create({
  name: "videoFile",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    }
  },
  parseHTML() {
    return [{ tag: "video" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      {
        ...HTMLAttributes,
        controls: "true",
      },
    ]
  },
})

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  mode,
  onModeChange,
}: RichTextEditorProps) {
  const [internalMode, setInternalMode] = useState<"wysiwyg" | "html">("wysiwyg")
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [mediaTab, setMediaTab] = useState<"image" | "video">("image")
  const [mediaUrl, setMediaUrl] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const currentMode = mode ?? internalMode
  const setMode = (nextMode: "wysiwyg" | "html") => {
    if (onModeChange) {
      onModeChange(nextMode)
    } else {
      setInternalMode(nextMode)
    }
  }
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Image.configure({ allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        validate: (href) => /^https:\/\//i.test(href),
      }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      VideoEmbed,
      VideoFile,
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML())
    },
    editorProps: {
      attributes: {
        class: "min-h-40 outline-none",
      },
    },
    immediatelyRender: false,
  })

  // ...existing code...
    useEffect(() => {
      if (!editor) return
      const current = editor.getHTML()
      if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false })
      }
    }, [editor, value])
  // ...existing code...

  const isEmpty = !value || value === "<p></p>"

  const handleLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const nextUrl = window.prompt("Zadajte URL", previousUrl ?? "")
    if (nextUrl === null) return
    const normalized = normalizeLink(nextUrl)
    if (!normalized) {
      editor.chain().focus().unsetLink().run()
      return
    }
    if (!/^https:\/\//i.test(normalized)) {
      return
    }
    editor.chain().focus().setLink({ href: normalized }).run()
  }

  const handleImage = () => {
    if (!editor) return
    setMediaTab("image")
    setMediaDialogOpen(true)
  }

  const handleVideo = () => {
    if (!editor) return
    setMediaTab("video")
    setMediaDialogOpen(true)
  }

  const handleSetColor = () => {
    if (!editor) return
    const current = editor.getAttributes("textStyle").color as string | undefined
    const nextColor = window.prompt("Farba textu (napr. #111111)", current ?? "")
    if (nextColor === null) return
    const trimmed = nextColor.trim()
    if (!trimmed) {
      editor.chain().focus().unsetColor().run()
      return
    }
    editor.chain().focus().setColor(trimmed).run()
  }

  const handleHighlight = () => {
    if (!editor) return
    const current = editor.getAttributes("highlight").color as string | undefined
    const nextColor = window.prompt(
      "Zvýraznenie (napr. #fff3bf)",
      current ?? ""
    )
    if (nextColor === null) return
    const trimmed = nextColor.trim()
    if (!trimmed) {
      editor.chain().focus().unsetHighlight().run()
      return
    }
    editor.chain().focus().setHighlight({ color: trimmed }).run()
  }

  if (!editor) {
    return (
      <div className="rounded-md border bg-background">
        <div className="h-10 border-b" />
        <div className="min-h-40 px-3 py-2" />
      </div>
    )
  }

  const handleInsertMediaUrl = () => {
    const trimmed = mediaUrl.trim()
    if (!trimmed) return
    if (mediaTab === "image") {
      const normalized = normalizeLink(trimmed)
      if (!/^https:\/\//i.test(normalized) && !normalized.startsWith("/uploads/")) {
        setUploadError("URL musí začínať https://")
        return
      }
      editor.chain().focus().setImage({ src: normalized }).run()
    } else {
      const normalized = normalizeVideoUrl(trimmed)
      if (!normalized) {
        setUploadError("Zadajte platnú URL videa.")
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: "videoEmbed", attrs: { src: normalized } })
        .run()
    }
    setMediaUrl("")
    setUploadError(null)
    setMediaDialogOpen(false)
  }

  const handleUpload = async (file: File) => {
    setUploadError(null)
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("kind", mediaTab)
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: getCsrfHeader(),
        body,
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || "Nepodarilo sa nahrať súbor.")
      }
      const payload = (await response.json()) as { url: string }
      if (mediaTab === "image") {
        editor.chain().focus().setImage({ src: payload.url }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent({ type: "videoFile", attrs: { src: payload.url } })
          .run()
      }
      setMediaDialogOpen(false)
      setMediaUrl("")
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Chyba nahrávania.")
    } finally {
      setIsUploading(false)
    }
  }

  const textAlignValue = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : "left"

  return (
    <div className="rounded-md border bg-background">
      {currentMode === "wysiwyg" ? (
        <div className="border-b p-2">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={
                editor.isActive("heading", { level: 2 })
                  ? "h2"
                  : editor.isActive("heading", { level: 3 })
                    ? "h3"
                    : ""
              }
              onValueChange={(value) => {
                if (value === "h2") {
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                } else if (value === "h3") {
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                } else {
                  editor.chain().focus().setParagraph().run()
                }
              }}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="h2" aria-label="Nadpis 2">
                    <Heading2Icon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Nadpis 2</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Alt+2</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="h3" aria-label="Nadpis 3">
                    <Heading3Icon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Nadpis 3</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Alt+3</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>

            <ToggleGroup
              type="multiple"
              value={[
                editor.isActive("bold") ? "bold" : "",
                editor.isActive("italic") ? "italic" : "",
                editor.isActive("underline") ? "underline" : "",
                editor.isActive("strike") ? "strike" : "",
              ].filter(Boolean)}
              onValueChange={() => {}}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="bold"
                    aria-label="Tučné"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    <BoldIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Tučné</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+B</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="italic"
                    aria-label="Kurzíva"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    <ItalicIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Kurzíva</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+I</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="underline"
                    aria-label="Podčiarknutie"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                  >
                    <UnderlineIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Podčiarknutie</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+U</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="strike"
                    aria-label="Prečiarknutie"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                  >
                    <StrikethroughIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Prečiarknutie</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+X</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>

            <ToggleGroup
              type="single"
              value={
                editor.isActive("bulletList")
                  ? "bullet"
                  : editor.isActive("orderedList")
                    ? "ordered"
                    : ""
              }
              onValueChange={(value) => {
                if (value === "bullet") {
                  editor.chain().focus().toggleBulletList().run()
                } else if (value === "ordered") {
                  editor.chain().focus().toggleOrderedList().run()
                } else if (editor.isActive("bulletList")) {
                  editor.chain().focus().toggleBulletList().run()
                } else if (editor.isActive("orderedList")) {
                  editor.chain().focus().toggleOrderedList().run()
                }
              }}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="bullet" aria-label="Odrážky">
                    <ListIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Odrážky</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+8</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="ordered" aria-label="Číslovanie">
                    <ListOrderedIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Číslovanie</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+7</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>

            <ToggleGroup
              type="multiple"
              value={[
                editor.isActive("blockquote") ? "quote" : "",
                editor.isActive("link") ? "link" : "",
                editor.isActive("highlight") ? "highlight" : "",
                editor.getAttributes("textStyle").color ? "color" : "",
              ].filter(Boolean)}
              onValueChange={() => {}}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="quote"
                    aria-label="Citácia"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  >
                    <QuoteIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Citácia</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+B</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="link"
                    aria-label="Odkaz"
                    onClick={handleLink}
                  >
                    <LinkIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Odkaz</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+K</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="highlight"
                    aria-label="Zvýraznenie"
                    onClick={handleHighlight}
                  >
                    <HighlighterIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Zvýraznenie</div>
                  <div className="text-muted-foreground">Skratka: nie je</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="color"
                    aria-label="Farba textu"
                    onClick={handleSetColor}
                  >
                    <PaletteIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Farba textu</div>
                  <div className="text-muted-foreground">Skratka: nie je</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>

            <ToggleGroup type="multiple" value={[]} onValueChange={() => {}}>
              <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <DialogTrigger asChild>
                      <ToggleGroupItem
                        value="image"
                        aria-label="Obrázok"
                        onClick={handleImage}
                      >
                        <ImageIcon className="size-4" />
                      </ToggleGroupItem>
                    </DialogTrigger>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <div className="font-medium">Obrázok</div>
                    <div className="text-muted-foreground">Skratka: nie je</div>
                  </HoverCardContent>
                </HoverCard>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <DialogTrigger asChild>
                      <ToggleGroupItem
                        value="video"
                        aria-label="Video"
                        onClick={handleVideo}
                      >
                        <VideoIcon className="size-4" />
                      </ToggleGroupItem>
                    </DialogTrigger>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <div className="font-medium">Video</div>
                    <div className="text-muted-foreground">Skratka: nie je</div>
                  </HoverCardContent>
                </HoverCard>

                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {mediaTab === "image" ? "Pridať obrázok" : "Pridať video"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <ModeButton
                        type="button"
                        size="xs"
                        variant={mediaTab === "image" ? "secondary" : "ghost"}
                        onClick={() => setMediaTab("image")}
                      >
                        Obrázok
                      </ModeButton>
                      <ModeButton
                        type="button"
                        size="xs"
                        variant={mediaTab === "video" ? "secondary" : "ghost"}
                        onClick={() => setMediaTab("video")}
                      >
                        Video
                      </ModeButton>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Vložiť URL</div>
                      <div className="flex gap-2">
                        <Input
                          value={mediaUrl}
                          onChange={(event) => setMediaUrl(event.target.value)}
                          placeholder={
                            mediaTab === "image"
                              ? "https://..."
                              : "https://youtube.com/..."
                          }
                        />
                        <ModeButton type="button" size="sm" onClick={handleInsertMediaUrl}>
                          Vložiť
                        </ModeButton>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Nahrať súbor</div>
                      <Input
                        type="file"
                        accept={mediaTab === "image" ? "image/*" : "video/mp4,video/webm"}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            void handleUpload(file)
                          }
                        }}
                        disabled={isUploading}
                      />
                      {uploadError ? (
                        <div className="text-xs text-destructive">{uploadError}</div>
                      ) : null}
                      {isUploading ? (
                        <div className="text-xs text-muted-foreground">
                          Nahrávame súbor...
                        </div>
                      ) : null}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </ToggleGroup>

            <ToggleGroup
              type="single"
              value={textAlignValue}
              onValueChange={(value) => {
                const alignValue = value || "left"
                editor.chain().focus().setTextAlign(alignValue).run()
              }}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="left" aria-label="Zarovnať vľavo">
                    <AlignLeftIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Zarovnať vľavo</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+L</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="center" aria-label="Zarovnať na stred">
                    <AlignCenterIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Zarovnať na stred</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+E</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem value="right" aria-label="Zarovnať vpravo">
                    <AlignRightIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Zarovnať vpravo</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+R</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>

            <ToggleGroup type="multiple" value={[]} onValueChange={() => {}}>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="hr"
                    aria-label="Oddelovač"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  >
                    <MinusIcon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Oddelovač</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+H</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="undo"
                    aria-label="Späť"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                  >
                    <Undo2Icon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Späť</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Z</div>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <ToggleGroupItem
                    value="redo"
                    aria-label="Znova"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                  >
                    <Redo2Icon className="size-4" />
                  </ToggleGroupItem>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="font-medium">Znova</div>
                  <div className="text-muted-foreground">Skratka: Ctrl+Shift+Z</div>
                </HoverCardContent>
              </HoverCard>
            </ToggleGroup>
          </div>
        </div>
      ) : null}
      <div className="relative">
        {currentMode === "wysiwyg" ? (
          <>
            {placeholder && isEmpty ? (
              <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
                {placeholder}
              </div>
            ) : null}
            <EditorContent
              editor={editor}
              className={cn(
                "min-h-40 px-3 py-2 text-sm",
                "prose prose-sm max-w-none",
                "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
                "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
                "[&_hr]:my-4 [&_hr]:border-border",
                "[&_mark]:rounded [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:bg-amber-200",
                "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md",
                "[&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-md [&_iframe]:border-0",
                "[&_video]:w-full [&_video]:rounded-md"
              )}
            />
          </>
        ) : (
          <textarea
            className="min-h-40 w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value
              onChange(nextValue)
              setMode("html")
            }}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  )
}
