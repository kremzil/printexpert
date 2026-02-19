import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPdfSettings, updatePdfSettings } from "@/lib/pdf";
import type { PdfSettings } from "@/lib/pdf";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

/**
 * GET /api/admin/settings/pdf
 * Get PDF settings
 */
const GETHandler = async (): Promise<NextResponse> => {
  try {
    const session = await auth();
    
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vyžaduje sa admin oprávnenie" },
        { status: 403 }
      );
    }

    const settings = await getPdfSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get PDF settings error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa načítať nastavenia" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/pdf
 * Update PDF settings
 */
const PUTHandler = async (request: Request): Promise<NextResponse> => {
  try {
    const session = await auth();
    
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vyžaduje sa admin oprávnenie" },
        { status: 403 }
      );
    }

    const body = await request.json() as Partial<PdfSettings>;
    const settings = await updatePdfSettings(body);
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Update PDF settings error:", error);
    return NextResponse.json(
      { error: "Nepodarilo sa uložiť nastavenia" },
      { status: 500 }
    );
  }
}

export const GET = withObservedRoute("GET /api/admin/settings/pdf", GETHandler);
export const PUT = withObservedRoute("PUT /api/admin/settings/pdf", PUTHandler);



