import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import type { PdfSettings } from "./types";
import { defaultPdfSettings } from "./types";

/**
 * Get PDF settings from database
 */
export async function getPdfSettings(): Promise<PdfSettings> {
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

  return newSettings;
}
