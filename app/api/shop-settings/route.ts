import { NextResponse } from "next/server";
import { getShopSettings } from "@/lib/shop-settings";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async () => {
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

export const GET = withObservedRoute("GET /api/shop-settings", GETHandler);



