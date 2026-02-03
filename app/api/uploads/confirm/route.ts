import { NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getS3Client } from "@/lib/s3";
import {
  MAGIC_BYTES_MAX,
  detectMimeTypeFromBuffer,
  isMimeAllowed,
  isMimeCompatible,
  normalizeMimeType,
} from "@/lib/uploads/config";
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
      console.warn("POST /api/uploads/confirm rejected: size mismatch", {
        assetId: asset.id,
        orderId: asset.orderId,
        expectedSize,
        actualSize,
        objectKey: asset.objectKey,
      });
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
      console.warn("POST /api/uploads/confirm rejected: head mime mismatch", {
        assetId: asset.id,
        orderId: asset.orderId,
        expectedMime,
        actualMime,
        objectKey: asset.objectKey,
      });
      await prisma.orderAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json(
        { error: "Typ súboru sa nezhoduje." },
        { status: 400 }
      );
    }

    const object = await client.send(
      new GetObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey,
        Range: `bytes=0-${MAGIC_BYTES_MAX - 1}`,
      })
    );

    if (!object.Body) {
      return NextResponse.json(
        { error: "Nepodarilo sa overiť typ súboru." },
        { status: 400 }
      );
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      if (total >= MAGIC_BYTES_MAX) break;
      const slice =
        total + chunk.length > MAGIC_BYTES_MAX
          ? chunk.slice(0, MAGIC_BYTES_MAX - total)
          : chunk;
      chunks.push(slice);
      total += slice.length;
      if (total >= MAGIC_BYTES_MAX) break;
    }

    const probeBuffer = Buffer.concat(chunks, total);
    const detectedMimeRaw = detectMimeTypeFromBuffer(probeBuffer);
    const detectedMime = normalizeMimeType(detectedMimeRaw);

    if (!detectedMime || !isMimeAllowed(detectedMime)) {
      console.warn("POST /api/uploads/confirm rejected: magic bytes not allowed", {
        assetId: asset.id,
        orderId: asset.orderId,
        detectedMime,
        expectedMime,
        objectKey: asset.objectKey,
      });
      await prisma.orderAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json(
        { error: "Nepodporovaný typ súboru." },
        { status: 400 }
      );
    }

    if (expectedMime && !isMimeCompatible(detectedMime, expectedMime)) {
      console.warn("POST /api/uploads/confirm rejected: magic bytes mismatch", {
        assetId: asset.id,
        orderId: asset.orderId,
        detectedMime,
        expectedMime,
        objectKey: asset.objectKey,
      });
      await prisma.orderAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json(
        { error: "Typ súboru nezodpovedá obsahu." },
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
