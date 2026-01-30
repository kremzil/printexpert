import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck,
  Package,
  Truck,
  XCircle,
} from "lucide-react"

export type OrderStatus =
  | "pending"
  | "files-uploaded"
  | "prepress-check"
  | "printing"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "error"

interface StatusBadgeProps {
  status: OrderStatus
  size?: "sm" | "md" | "lg"
}

const statusConfig = {
  pending: {
    label: "Čaká sa",
    icon: Clock,
    color: "var(--status-pending)",
    bg: "var(--status-pending-bg)",
  },
  "files-uploaded": {
    label: "Súbory nahrané",
    icon: FileCheck,
    color: "var(--status-processing)",
    bg: "var(--status-processing-bg)",
  },
  "prepress-check": {
    label: "Kontrola súborov",
    icon: AlertCircle,
    color: "var(--status-processing)",
    bg: "var(--status-processing-bg)",
  },
  printing: {
    label: "Tlačí sa",
    icon: Package,
    color: "var(--status-processing)",
    bg: "var(--status-processing-bg)",
  },
  shipping: {
    label: "Expeduje sa",
    icon: Truck,
    color: "var(--status-processing)",
    bg: "var(--status-processing-bg)",
  },
  delivered: {
    label: "Doručené",
    icon: CheckCircle,
    color: "var(--status-completed)",
    bg: "var(--status-completed-bg)",
  },
  cancelled: {
    label: "Zrušené",
    icon: XCircle,
    color: "var(--status-cancelled)",
    bg: "var(--status-cancelled-bg)",
  },
  error: {
    label: "Chyba",
    icon: XCircle,
    color: "var(--status-error)",
    bg: "var(--status-error-bg)",
  },
} satisfies Record<
  OrderStatus,
  { label: string; icon: typeof Clock; color: string; bg: string }
>

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  )
}
