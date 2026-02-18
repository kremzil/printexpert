import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { printDpdLabels } from "@/lib/dpd";

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
    const pdf = await printDpdLabels(orderId);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dpd-labels-${orderId}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DPD label error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
