"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle, Upload, XCircle } from "lucide-react"

export type FileStatus = "idle" | "uploading" | "success" | "error" | "warning"

interface FileUploadProps {
  onFileSelect?: (files: FileList) => void
  status?: FileStatus
  statusMessage?: string
  acceptedFormats?: string[]
  maxSizeMB?: number
}

export function FileUpload({
  onFileSelect,
  status = "idle",
  statusMessage,
  acceptedFormats = ["PDF", "AI", "EPS", "INDD", "PSD"],
  maxSizeMB = 100,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (onFileSelect && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onFileSelect && e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files)
    }
  }

  const statusConfig = {
    idle: { icon: Upload, color: "text-muted-foreground", bg: "bg-muted/50" },
    uploading: { icon: Upload, color: "text-blue-600", bg: "bg-blue-50" },
    success: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    warning: {
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8 text-center transition-all
          ${isDragging ? "border-primary bg-primary/5" : "border-border"}
          ${config.bg}
        `}
      >
        <input
          type="file"
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
          multiple
          accept=".pdf,.ai,.eps,.indd,.psd"
        />

        <div className="flex flex-col items-center gap-4">
          <div
            className={`rounded-full p-4 ${status === "idle" ? "bg-muted" : config.bg}`}
          >
            <StatusIcon className={`h-8 w-8 ${config.color}`} />
          </div>

          <div className="space-y-2">
            <p className="font-medium">
              {status === "uploading" && "Nahrávam súbory..."}
              {status === "success" && "Súbory úspešne nahrané"}
              {status === "error" && "Chyba pri nahrávaní"}
              {status === "warning" && "Upozornenie"}
              {status === "idle" &&
                "Presuňte súbory sem alebo kliknite pre výber"}
            </p>

            {statusMessage && (
              <p className={`text-sm ${config.color}`}>{statusMessage}</p>
            )}

            {status === "idle" && (
              <p className="text-sm text-muted-foreground">
                Podporované formáty: {acceptedFormats.join(", ")} (max.{" "}
                {maxSizeMB} MB)
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h4 className="mb-3 font-medium">Požiadavky na súbory:</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>Rozlíšenie minimálne 300 DPI</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>Spadávka 3 mm na všetkých stranách</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>Farebný priestor CMYK (nie RGB)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>Všetky fonty vložené alebo prevedené na krivky</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
