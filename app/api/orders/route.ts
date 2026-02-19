import { NextResponse } from "next/server"
import { getUserOrders } from "@/lib/orders"
import { OBS_EVENT } from "@/lib/observability/events"
import { logger } from "@/lib/observability/logger"
import { withObservedRoute } from "@/lib/observability/with-observed-route"

export const dynamic = "force-dynamic"

const getHandler = async () => {
  try {
    const orders = await getUserOrders()
    return NextResponse.json(orders)
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown orders route error")
    logger.error({
      event: OBS_EVENT.SERVER_UNHANDLED_ERROR,
      method: "GET",
      path: "/api/orders",
      errorName: err.name,
      errorMessage: err.message,
    })
    const message =
      error instanceof Error ? error.message : "Chyba pri načítaní objednávok"
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export const GET = withObservedRoute("GET /api/orders", getHandler)
