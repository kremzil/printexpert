"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Package, CheckCircle, Clock, Cog, XCircle } from "lucide-react"

type OrderStatus = "pending" | "processing" | "delivered" | "cancelled"

interface OrderItem {
  id: string
  orderNumber: string
  date: string
  status: OrderStatus
  items: {
    name: string
    quantity: number
    configuration: string
  }[]
  total: number
  estimatedDelivery?: string
}

interface OrderHistoryProps {
  mode: "b2c" | "b2b"
  orders: OrderItem[]
}

const statusConfig = {
  pending: {
    label: "Čaká sa",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  processing: {
    label: "Vo výrobe",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Cog,
  },
  delivered: {
    label: "Dokončené",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Zrušené",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
}

export function OrderHistory({ mode, orders }: OrderHistoryProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  if (orders.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 p-12 text-center">
        <Package className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-xl font-bold">Žiadne objednávky</h3>
        <p className="text-muted-foreground">
          {mode === "b2c"
            ? "Zatiaľ ste nevytvorili žiadnu objednávku"
            : "Vaša firma zatiaľ nevytvorila žiadnu objednávku"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) =>
        (() => {
          const status = statusConfig[order.status] ?? {
            label: "Neznámy stav",
            className: "bg-muted text-foreground border-border",
            icon: Package,
          }
          const StatusIcon = status.icon

          return (
            <Card key={order.id} className="overflow-hidden rounded-2xl border border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/30 p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Číslo objednávky</div>
                    <div className="font-semibold" style={{ color: modeColor }}>
                      #{order.orderNumber}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Dátum</div>
                    <div className="text-sm font-medium">{order.date}</div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>
              </div>

              <div className="p-4">
                <div className="mb-4 space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.configuration}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.quantity} ks</div>
                    </div>
                  ))}
                </div>

                {order.estimatedDelivery && order.status !== "cancelled" && order.status !== "delivered" && (
                  <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Odhadované doručenie: </span>
                    <span className="font-medium text-foreground">{order.estimatedDelivery}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Celková suma</div>
                    <div className="text-2xl font-bold text-foreground">{order.total.toFixed(2)} €</div>
                    <div className="text-sm text-muted-foreground">s DPH</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all hover:bg-muted"
                      style={{ borderColor: modeColor, color: modeColor }}
                    >
                      Detail
                    </Link>

                    {order.status === "delivered" && (
                      <Link
                        href={`/account/orders/${order.id}?repeat=1`}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: modeColor }}
                      >
                        Objednať znova
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })()
      )}
    </div>
  )
}
