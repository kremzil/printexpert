"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Package, Download, RotateCcw } from "lucide-react"

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
  pending: { label: "Čaká sa", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "V spracovaní", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "Doručené", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Zrušené", color: "bg-red-100 text-red-800" },
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
      {orders.map((order) => (
        (() => {
          const status = statusConfig[order.status] ?? {
            label: "Neznámy stav",
            color: "bg-muted text-foreground",
          }

          return (
        <Card key={order.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/30 p-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="mb-1 text-sm text-muted-foreground">Číslo objednávky</div>
                <div className="font-bold" style={{ color: modeColor }}>
                  #{order.orderNumber}
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="mb-1 text-sm text-muted-foreground">Dátum</div>
                <div className="font-medium">{order.date}</div>
              </div>
            </div>

            <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>

          <div className="p-4">
            {/* Order Items */}
            <div className="mb-4 space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.configuration}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{item.quantity} ks</div>
                </div>
              ))}
            </div>

            {/* Estimated Delivery */}
            {order.estimatedDelivery && order.status !== "cancelled" && order.status !== "delivered" && (
              <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Odhadované doručenie: </span>
                <span className="font-medium">{order.estimatedDelivery}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <div>
                <div className="mb-1 text-sm text-muted-foreground">Celková suma</div>
                <div className="text-xl font-bold">{order.total.toFixed(2)} €</div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/account/orders/${order.id}`}
                  className="rounded-lg border-2 px-4 py-2 font-medium transition-all hover:bg-muted"
                  style={{ borderColor: modeColor, color: modeColor }}
                >
                  Detail
                </Link>

                {mode === "b2b" && order.status !== "pending" && (
                  <button
                    className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-all hover:bg-muted"
                    onClick={() => {
                      // TODO: Implement invoice download
                      console.log('Download invoice', order.id)
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Faktúra
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
          )
        })()
      ))}
    </div>
  )
}
