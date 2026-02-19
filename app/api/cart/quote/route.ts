import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getCart } from "@/lib/cart";
import { generateQuotePdf } from "@/lib/pdf";
import { getShopVatRate } from "@/lib/shop-settings";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

/**
 * GET /api/cart/quote - Generate and download price quote PDF
 * Available for all users, but primarily for B2B
 */
const GETHandler = async () => {
  try {
    // Get session for customer info
    const session = await auth();
    
    // Get cart
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session_id")?.value;
    const cart = await getCart(sessionId);

    if (!cart || cart.items.length === 0) {
      return NextResponse.json(
        { error: "Košík je prázdny" },
        { status: 400 }
      );
    }

    // Get VAT rate
    const vatRate = await getShopVatRate();

    // Generate PDF
    const pdfBuffer = await generateQuotePdf(cart, {
      customerName: session?.user?.name ?? undefined,
      customerEmail: session?.user?.email ?? undefined,
      vatRate,
    });

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `cenova-ponuka-${dateStr}.pdf`;

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating quote PDF:", error);
    return NextResponse.json(
      { error: "Chyba pri generovaní cenovej ponuky" },
      { status: 500 }
    );
  }
}

export const GET = withObservedRoute("GET /api/cart/quote", GETHandler);



