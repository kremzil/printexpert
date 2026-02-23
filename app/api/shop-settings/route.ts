import { NextResponse } from "next/server";
import { getShopSettings } from "@/lib/shop-settings";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const GETHandler = async () => {
  const settings = await getShopSettings();
  return NextResponse.json({
    vatRate: settings.vatRate,
    paymentSettings: settings.paymentSettings,
    dpdShipping: {
      courierPrice: settings.dpdSettings.courierPrice,
      courierFreeFrom: settings.dpdSettings.courierFreeFrom,
      pickupPointEnabled: settings.dpdSettings.pickupPointEnabled,
    },
    dpdWidget: {
      enabled: settings.dpdSettings.mapWidgetEnabled,
      apiKey: settings.dpdSettings.mapApiKey,
      language: settings.dpdSettings.mapLanguage,
    },
  });
}

export const GET = withObservedRoute("GET /api/shop-settings", GETHandler);



