import { NextResponse } from "next/server"
import { getUserOrders } from "@/lib/orders"

export async function GET() {
  try {
    const orders = await getUserOrders()
    return NextResponse.json(orders)
  } catch (error) {
    console.error("GET /api/orders error:", error)
    const message =
      error instanceof Error ? error.message : "Chyba pri načítaní objednávok"
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
