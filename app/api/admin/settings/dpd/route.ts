import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { getDpdSettings } from "@/lib/shop-settings";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const SETTINGS_ID = "default";

const GETHandler = async () => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dpdSettings = await getDpdSettings();
  return NextResponse.json(dpdSettings);
}

const PUTHandler = async (req: NextRequest) => {
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

export const GET = withObservedRoute("GET /api/admin/settings/dpd", GETHandler);
export const PUT = withObservedRoute("PUT /api/admin/settings/dpd", PUTHandler);



