import { NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getS3Client } from "@/lib/s3";
import { normalizeMimeType } from "@/lib/uploads/config";
import { NotificationService } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const assetId = typeof body?.assetId === "string" ? body.assetId : "";

    if (!assetId) {
      return NextResponse.json({ error: "Chýba assetId." }, { status: 400 });
    }

    const asset = await prisma.orderAsset.findUnique({
      where: { id: assetId },
      include: {
        order: {
          select: { id: true, userId: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Súbor neexistuje." }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && asset.order.userId !== session.user.id) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    if (!isAdmin && !asset.order.userId) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    const client = getS3Client();
    let head;

    try {
      head = await client.send(
        new HeadObjectCommand({
          Bucket: asset.bucket,
          Key: asset.objectKey,
        })
      );
    } catch (error) {
      console.error("S3 head failed:", error);
      return NextResponse.json({ error: "Súbor sa nenašiel." }, { status: 404 });
    }

    const actualSize = head.ContentLength ?? null;
    const expectedSize = asset.sizeBytes;

    if (actualSize === null || actualSize !== expectedSize) {
      await prisma.orderAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json(
        { error: "Veľkosť súboru sa nezhoduje." },
        { status: 400 }
      );
    }

    const actualMime = normalizeMimeType(head.ContentType ?? "");
    const expectedMime = normalizeMimeType(asset.mimeType);

    if (actualMime && expectedMime && actualMime !== expectedMime) {
      await prisma.orderAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json(
        { error: "Typ súboru sa nezhoduje." },
        { status: 400 }
      );
    }

    const updated = await prisma.orderAsset.update({
      where: { id: asset.id },
      data: { status: "UPLOADED" },
    });

    NotificationService.sendArtworkUploaded(asset.orderId, asset.id).catch((error) => {
      console.error("Failed to send artwork upload notification:", error);
    });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    console.error("POST /api/uploads/confirm error:", error);
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    );
  }
}
