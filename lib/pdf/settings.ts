import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { TAGS } from "@/lib/cache-tags";
import type { PdfSettings } from "./types";
import { defaultPdfSettings } from "./types";

/**
 * Get PDF settings from database (cached with shop-settings tag)
 */
const getCachedPdfSettings = unstable_cache(
  async (): Promise<PdfSettings> => {
    const shopSettings = await prisma.shopSettings.findUnique({
      where: { id: "default" },
    });

    if (!shopSettings?.pdfSettings) {
      return defaultPdfSettings;
    }

    const stored = shopSettings.pdfSettings as Record<string, unknown>;

    return {
      ...defaultPdfSettings,
      ...stored,
    } as PdfSettings;
  },
  ["pdf-settings"],
  { tags: [TAGS.SHOP_SETTINGS], revalidate: 300 }
);

export async function getPdfSettings(): Promise<PdfSettings> {
  return getCachedPdfSettings();
}

/**
 * Update PDF settings in database
 */
export async function updatePdfSettings(
  settings: Partial<PdfSettings>
): Promise<PdfSettings> {
  const currentSettings = await getPdfSettings();
  const newSettings = { ...currentSettings, ...settings };

  await prisma.shopSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      pdfSettings: newSettings as Prisma.InputJsonValue,
    },
    update: {
      pdfSettings: newSettings as Prisma.InputJsonValue,
    },
  });

  // Сбросить кэш настроек (shop-settings тег покрывает и vatRate, и PDF)
  revalidateTag(TAGS.SHOP_SETTINGS, "max");

  return newSettings;
}
