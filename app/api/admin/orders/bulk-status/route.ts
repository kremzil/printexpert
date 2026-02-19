import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/generated/prisma";
import { NotificationService, sendInvoiceEmail } from "@/lib/notifications";
import { generateAndSaveInvoice, getPdfSettings } from "@/lib/pdf";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

type BulkStatusBody = {
  orderIds?: string[];
  status?: OrderStatus;
  note?: string;
};

const ALLOWED_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

const POSTHandler = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as BulkStatusBody | null;
  const status = body?.status;
  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : null;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Neplatný stav objednávky." }, { status: 400 });
  }

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "Nie sú vybrané žiadne objednávky." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, status: true },
  });
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const foundIds = orderIds.filter((id) => orderById.has(id));
  const missingIds = orderIds.filter((id) => !orderById.has(id));

  let changed = 0;
  const changedOrderIds: string[] = [];
  const unchangedOrderIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const orderId of foundIds) {
      const currentOrder = orderById.get(orderId);
      if (!currentOrder) continue;

      if (currentOrder.status === status) {
        unchangedOrderIds.push(orderId);
        continue;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentOrder.status,
          toStatus: status,
          changedByUserId: session.user.id,
          note: note && note.length > 0 ? note : null,
        },
      });

      changed += 1;
      changedOrderIds.push(orderId);
    }
  });

  // Async side effects: notifications + optional invoice generation.
  for (const orderId of changedOrderIds) {
    const previous = orderById.get(orderId)?.status;
    if (!previous) continue;

    NotificationService.sendOrderStatusChanged(orderId, previous, status).catch((error) => {
      console.error("Bulk status notification failed:", error);
    });
  }

  if (status === "COMPLETED" && changedOrderIds.length > 0) {
    getPdfSettings()
      .then(async (pdfSettings) => {
        const autoGenerateEnabled =
          pdfSettings.autoGenerateEnabled ??
          (pdfSettings.autoGenerateOnStatus === "COMPLETED");
        if (!autoGenerateEnabled) return;

        for (const orderId of changedOrderIds) {
          try {
            const existingInvoice = await prisma.orderAsset.findFirst({
              where: { orderId, kind: "INVOICE" },
              select: { id: true },
            });
            if (!existingInvoice) {
              await generateAndSaveInvoice(orderId);
            }
            if (pdfSettings.autoSendEmail) {
              await sendInvoiceEmail(orderId);
            }
          } catch (error) {
            console.error(`Bulk invoice generation failed for ${orderId}:`, error);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to get PDF settings for bulk status update:", error);
      });
  }

  return NextResponse.json({
    ok: true,
    status,
    changed,
    unchanged: unchangedOrderIds.length,
    missing: missingIds.length,
    changedOrderIds,
    unchangedOrderIds,
    missingIds,
  });
};

export const POST = withObservedRoute("POST /api/admin/orders/bulk-status", POSTHandler);

