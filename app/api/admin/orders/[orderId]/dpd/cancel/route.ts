import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelDpdShipment } from "@/lib/dpd";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const result = await cancelDpdShipment(orderId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DPD cancel error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

