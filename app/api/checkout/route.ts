import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerEmail, customerPhone, shippingAddress, billingAddress, notes } =
      body;

    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: "Meno a email sú povinné" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session_id")?.value;

    const order = await createOrder(
      {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        billingAddress,
        notes,
      },
      sessionId
    );

    // Удаляем cookie сессии корзины после успешного заказа
    if (sessionId) {
      cookieStore.delete("cart_session_id");
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST /api/checkout error:", error);
    const message = error instanceof Error ? error.message : "Chyba pri vytváraní objednávky";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
