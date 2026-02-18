import { NextResponse } from "next/server";
import { getShopSettings } from "@/lib/shop-settings";

export async function GET() {
  const settings = await getShopSettings();
  return NextResponse.json({
    paymentSettings: settings.paymentSettings,
    dpdWidget: {
      enabled: settings.dpdSettings.mapWidgetEnabled,
      apiKey: settings.dpdSettings.mapApiKey,
      language: settings.dpdSettings.mapLanguage,
    },
  });
}

