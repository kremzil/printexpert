import "server-only";

import { getDpdSettings } from "@/lib/shop-settings";
import { prisma } from "@/lib/prisma";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: string;
};

const DPD_ENDPOINT =
  process.env.DPD_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.dpd.sk";

function buildPickupDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}${m}${day}`;
}

function extractLabelUrlFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const candidate = (
    meta as {
      result?: {
        result?: Array<{ label?: unknown }>;
      };
    }
  )?.result?.result?.[0]?.label;

  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

async function fetchPdfFromLabelUrl(labelUrl: string): Promise<Buffer> {
  const response = await fetch(labelUrl);
  if (!response.ok) {
    throw new Error(`DPD label URL HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/pdf")) {
    return Buffer.from(await response.arrayBuffer());
  }

  const text = await response.text();
  throw new Error(
    text?.slice(0, 200) || "DPD label URL nevrátil PDF."
  );
}

async function callShipmentApi<T>(payload: JsonRpcRequest): Promise<T> {
  const response = await fetch(`${DPD_ENDPOINT}/shipment/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`DPD API HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function createDpdShipment(orderId: string) {
  const settings = await getDpdSettings();
  if (!settings.delisId || !settings.clientEmail || !settings.apiKey || !settings.senderAddressId) {
    throw new Error("DPD nastavenia sú neúplné (delisId/email/apiKey/senderAddressId).");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) throw new Error("Objednávka neexistuje.");
  if (order.deliveryMethod === "PERSONAL_PICKUP") {
    throw new Error("Pre osobný odber sa DPD zásielka nevytvára.");
  }
  if (order.carrierShipmentId) throw new Error("DPD zásielka už bola vytvorená.");

  const shipping = (order.shippingAddress as Record<string, string> | null) ?? null;
  const pickupPoint = (order.pickupPoint as Record<string, string> | null) ?? null;
  if (!shipping) throw new Error("Chýba doručovacia adresa.");

  const isPickup = order.deliveryMethod === "DPD_PICKUP";
  if (isPickup && !pickupPoint?.parcelShopId) {
    throw new Error("Pre pickup objednávku chýba parcelShopId.");
  }
  if (order.paymentMethod === "COD" && !settings.bankAccountId) {
    throw new Error("Pre COD chýba ID bankového účtu v DPD nastaveniach.");
  }

  const product = isPickup ? 17 : settings.defaultProduct;
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: product === 9 ? "createV3" : "create",
    id: "null",
    params: {
      DPDSecurity: {
        SecurityToken: {
          ClientKey: settings.apiKey,
          Email: settings.clientEmail,
        },
      },
      shipment: [
        {
          reference: order.orderNumber,
          delisId: settings.delisId,
          product,
          pickup: {
            date: buildPickupDate(settings.pickupDateOffsetDays),
            timeWindow: {
              beginning: settings.pickupTimeFrom,
              end: settings.pickupTimeTo,
            },
          },
          addressSender: { id: settings.senderAddressId },
          addressRecipient: {
            type: isPickup ? "psd" : "b2c",
            name: shipping.name ?? order.customerName,
            street: shipping.street ?? "",
            houseNumber: "1",
            zip: shipping.postalCode ?? "",
            country: 703,
            city: shipping.city ?? "",
            phone: order.customerPhone ?? "",
            email: order.customerEmail,
          },
          parcels: {
            parcel: [{ weight: "1", height: 1, width: 1, depth: 1 }],
          },
          services: {
            ...(isPickup
              ? {
                  parcelShopDelivery: {
                    parcelShopId: pickupPoint?.parcelShopId,
                  },
                }
              : {}),
            ...(order.paymentMethod === "COD"
              ? {
                  cod: {
                    amount: order.codAmount?.toString() ?? order.total.toString(),
                    currency: order.codCurrency ?? "EUR",
                    bankAccount: { id: settings.bankAccountId },
                    variableSymbol: order.orderNumber.replace(/\D/g, "").slice(0, 10),
                    paymentMethod: 1,
                  },
                }
              : {}),
            ...(settings.notificationsEnabled
              ? {
                  notifications: [
                    {
                      type: settings.notificationChannel === "sms" ? 3 : 1,
                      destination:
                        settings.notificationChannel === "sms"
                          ? order.customerPhone ?? ""
                          : order.customerEmail,
                      rule: Number(settings.notificationRule),
                      language: settings.mapLanguage.toUpperCase(),
                    },
                  ],
                }
              : {}),
          },
        },
      ],
    },
  };

  type DpdCreateResponse = {
    result?: { result?: Array<{ success?: boolean; mpsid?: string; messages?: string[]; parcels?: Array<{ parcelno?: string }> }> };
  };

  const response = await callShipmentApi<DpdCreateResponse>(request);
  const first = response.result?.result?.[0];
  if (!first?.success) {
    throw new Error(first?.messages?.[0] ?? "DPD shipment creation failed.");
  }

  const parcelNumbers = (first.parcels ?? [])
    .map((p) => p.parcelno)
    .filter((v): v is string => Boolean(v));

  await prisma.order.update({
    where: { id: orderId },
    data: {
      carrier: "DPD",
      dpdProduct: product,
      carrierShipmentId: first.mpsid ?? null,
      carrierParcelNumbers: parcelNumbers,
      carrierMeta: response as unknown as object,
    },
  });

  return { mpsid: first.mpsid ?? null, parcelNumbers };
}

export async function printDpdLabels(orderId: string) {
  const settings = await getDpdSettings();
  if (!settings.clientEmail || !settings.apiKey) {
    throw new Error("DPD nastavenia sú neúplné (email/api key).");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Objednávka neexistuje.");

  if (!order.carrierParcelNumbers?.length) {
    const fallbackLabelUrl = extractLabelUrlFromMeta(order.carrierMeta);
    if (!fallbackLabelUrl) {
      throw new Error("Objednávka nemá DPD parcel numbers ani label URL.");
    }

    const pdfFromCreate = await fetchPdfFromLabelUrl(fallbackLabelUrl);
    await prisma.order.update({
      where: { id: orderId },
      data: { carrierLabelLastPrintedAt: new Date() },
    });
    return pdfFromCreate;
  }

  const payload: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "printLabels",
    id: "null",
    params: {
      DPDSecurity: {
        SecurityToken: {
          ClientKey: settings.apiKey,
          Email: settings.clientEmail,
        },
      },
      label: {
        parcels: {
          parcel: order.carrierParcelNumbers.map((parcelno) => ({ parcelno })),
        },
        pageSize: settings.labelFormat,
        position: settings.labelPosition,
      },
    },
  };

  const response = await fetch(`${DPD_ENDPOINT}/shipment/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`DPD printLabels HTTP ${response.status}`);

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let pdfBuffer: Buffer;
  if (contentType.includes("application/pdf")) {
    pdfBuffer = Buffer.from(await response.arrayBuffer());
  } else {
    type DpdPrintLabelsResponse = {
      result?: {
        result?: Array<{
          success?: boolean;
          messages?: string[];
          label?: string;
        }>;
      };
    };

    const json = (await response.json()) as DpdPrintLabelsResponse;
    const first = json.result?.result?.[0];
    if (first?.success === false) {
      throw new Error(first.messages?.[0] ?? "DPD printLabels zlyhalo.");
    }
    if (!first?.label) {
      throw new Error("DPD printLabels nevrátil PDF ani label URL.");
    }
    pdfBuffer = await fetchPdfFromLabelUrl(first.label);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { carrierLabelLastPrintedAt: new Date() },
  });

  return pdfBuffer;
}

export async function cancelDpdShipment(orderId: string) {
  const settings = await getDpdSettings();
  if (!settings.clientEmail || !settings.apiKey) {
    throw new Error("DPD nastavenia sú neúplné (email/api key).");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Objednávka neexistuje.");

  const parcelNumbers = order.carrierParcelNumbers ?? [];
  if (parcelNumbers.length === 0) {
    throw new Error("Objednávka nemá DPD parcel numbers na zrušenie.");
  }

  const payload: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "deleteShipments",
    id: "null",
    params: {
      DPDSecurity: {
        SecurityToken: {
          ClientKey: settings.apiKey,
          Email: settings.clientEmail,
        },
      },
      shipments: {
        shipment: parcelNumbers.map((parcelno) => ({ parcelno })),
      },
    },
  };

  type DpdDeleteResponse = {
    result?: { result?: Array<{ success?: boolean; messages?: string[] }> };
  };

  const response = await callShipmentApi<DpdDeleteResponse>(payload);
  const allSuccessful = (response.result?.result ?? []).every((item) => item.success);
  if (!allSuccessful) {
    const firstError = (response.result?.result ?? [])
      .find((item) => !item.success)
      ?.messages?.[0];
    throw new Error(firstError ?? "DPD deleteShipments zlyhalo.");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      carrierShipmentId: null,
      carrierParcelNumbers: [],
      carrierMeta: response as unknown as object,
    },
  });

  return { success: true };
}
