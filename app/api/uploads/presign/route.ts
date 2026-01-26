import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getS3Client, getS3Config } from "@/lib/s3";
import {
  buildOrderAssetKey,
  isExtensionDenied,
  isMimeAllowed,
  normalizeMimeType,
  sanitizeFileName,
  uploadConfig,
} from "@/lib/uploads/config";

const allowedKinds = new Set(["ARTWORK", "PREVIEW", "INVOICE", "OTHER"]);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const orderItemId = typeof body?.orderItemId === "string" ? body.orderItemId : null;
    const kind = typeof body?.kind === "string" ? body.kind : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
    const sizeBytes = Number(body?.sizeBytes ?? 0);

    if (!orderId || !fileName || !kind || !Number.isFinite(sizeBytes)) {
      return NextResponse.json({ error: "Neplatné údaje." }, { status: 400 });
    }

    if (!allowedKinds.has(kind)) {
      return NextResponse.json({ error: "Neplatný typ súboru." }, { status: 400 });
    }

    if (sizeBytes <= 0 || sizeBytes > uploadConfig.maxBytes) {
      return NextResponse.json(
        { error: "Súbor má neplatnú veľkosť." },
        { status: 400 }
      );
    }

    const normalizedMime = normalizeMimeType(mimeType);

    if (!isMimeAllowed(normalizedMime)) {
      return NextResponse.json(
        { error: "Nepodporovaný MIME typ." },
        { status: 400 }
      );
    }

    if (isExtensionDenied(fileName)) {
      return NextResponse.json(
        { error: "Nepovolená prípona súboru." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Objednávka neexistuje." }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    if (!isAdmin && !order.userId) {
      return NextResponse.json({ error: "Prístup zamietnutý." }, { status: 403 });
    }

    if (orderItemId) {
      const orderItem = await prisma.orderItem.findFirst({
        where: { id: orderItemId, orderId },
        select: { id: true },
      });

      if (!orderItem) {
        return NextResponse.json({ error: "Položka objednávky neexistuje." }, { status: 400 });
      }
    }

    const { bucket, region } = getS3Config();
    const safeName = sanitizeFileName(fileName);
    const placeholderKey = `orders/${orderId}/pending/${safeName}`;

    const asset = await prisma.orderAsset.create({
      data: {
        orderId,
        orderItemId,
        kind,
        status: "PENDING",
        fileNameOriginal: fileName,
        mimeType: normalizedMime,
        sizeBytes: Math.trunc(sizeBytes),
        storageProvider: "S3",
        bucket,
        objectKey: placeholderKey,
        region,
        uploadedByUserId: session.user.id,
      },
      select: { id: true },
    });

    const objectKey = buildOrderAssetKey(orderId, asset.id, fileName);

    await prisma.orderAsset.update({
      where: { id: asset.id },
      data: { objectKey },
    });

    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: normalizedMime,
      ContentLength: Math.trunc(sizeBytes),
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return NextResponse.json({
      assetId: asset.id,
      objectKey,
      uploadUrl,
      headers: {
        "Content-Type": normalizedMime,
      },
    });
  } catch (error) {
    console.error("POST /api/uploads/presign error:", error);
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    );
  }
}
