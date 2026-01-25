import { NextRequest, NextResponse } from "next/server";
import { updateCartItem, removeFromCart } from "@/lib/cart";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await req.json();
    const { quantity, priceSnapshot } = body;

    if (quantity === undefined || quantity < 0) {
      return NextResponse.json({ error: "quantity je povinné" }, { status: 400 });
    }

    const updatedItem = await updateCartItem(itemId, quantity, priceSnapshot);
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("PATCH /api/cart/[itemId] error:", error);
    return NextResponse.json({ error: "Chyba pri aktualizácii položky" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    await removeFromCart(itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cart/[itemId] error:", error);
    return NextResponse.json({ error: "Chyba pri odstraňovaní položky" }, { status: 500 });
  }
}
