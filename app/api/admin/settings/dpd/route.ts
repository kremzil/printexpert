import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { getDpdSettings } from "@/lib/shop-settings";

const SETTINGS_ID = "default";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dpdSettings = await getDpdSettings();
  return NextResponse.json(dpdSettings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const prisma = getPrisma();

  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, dpdSettings: payload },
    update: { dpdSettings: payload },
  });

  return NextResponse.json({ ok: true });
}

