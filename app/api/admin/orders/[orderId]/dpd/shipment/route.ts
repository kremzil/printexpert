import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDpdShipment } from "@/lib/dpd";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const POSTHandler = async (
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const result = await createDpdShipment(orderId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DPD shipment error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withObservedRoute("POST /api/admin/orders/[orderId]/dpd/shipment", POSTHandler);



