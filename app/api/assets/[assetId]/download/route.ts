import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getS3Client } from "@/lib/s3";

const sanitizeDispositionFileName = (fileName: string) => {
  const baseName = fileName.split(/[\\/]/).pop() || "file";
  const cleaned = baseName
    .replace(/"/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  const limited = cleaned.length > 180 ? cleaned.slice(0, 180).trim() : cleaned;
  return limited.length > 0 ? limited : "file";
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId } = await params;

    const asset = await prisma.orderAsset.findUnique({
      where: { id: assetId },
      include: {
        order: {
          select: { userId: true },
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

    const dispositionName = sanitizeDispositionFileName(asset.fileNameOriginal);
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: asset.bucket,
      Key: asset.objectKey,
      ResponseContentDisposition: `attachment; filename="${dispositionName}"`,
    });

    const downloadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return new Response(null, {
      status: 302,
      headers: {
        Location: downloadUrl,
      },
    });
  } catch (error) {
    console.error("GET /api/assets/[assetId]/download error:", error);
    return NextResponse.json(
      { error: "Interná chyba servera." },
      { status: 500 }
    );
  }
}
