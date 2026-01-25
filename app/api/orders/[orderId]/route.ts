import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Objednávka nebola nájdená" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET /api/orders/[orderId] error:", error);
    const message = error instanceof Error ? error.message : "Chyba pri načítaní objednávky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
