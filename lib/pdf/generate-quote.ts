import { renderToBuffer } from "@react-pdf/renderer";
import { getPdfSettings } from "./settings";
import { QuoteTemplate } from "./quote-template";
import type { QuoteData, QuoteItem, CompanyInfo, QuoteInfo, QuoteTotals, InvoiceSettings } from "./types";
import type { CartData, CartItemWithProduct } from "@/types/cart";

/**
 * Generate quote number based on timestamp
 */
function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CP-${year}${month}${day}-${random}`;
}

/**
 * Extract attributes from selectedOptions
 */
function extractAttributes(selectedOptions: unknown): Record<string, string> {
  if (!selectedOptions || typeof selectedOptions !== "object") {
    return {};
  }

  const options = selectedOptions as Record<string, unknown>;
  
  // Check for _attributes field (from calculator)
  if ("_attributes" in options && options._attributes && typeof options._attributes === "object") {
    const attrs = options._attributes as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  }

  // Fallback: extract string values directly
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith("_")) continue; // Skip internal fields
    if (typeof value === "string") {
      result[key] = value;
    } else if (typeof value === "number") {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Convert potential Decimal to number
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  // Prisma Decimal has toNumber() method
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Convert cart item to quote item
 */
function cartItemToQuoteItem(item: CartItemWithProduct, vatRate: number): QuoteItem {
  const priceSnapshot = item.priceSnapshot;
  const netPrice = toNumber(priceSnapshot?.net);
  const vatAmount = toNumber(priceSnapshot?.vatAmount);
  const grossPrice = toNumber(priceSnapshot?.gross) || netPrice;
  const quantity = toNumber(item.quantity);
  const unitPrice = quantity > 0 ? netPrice / quantity : 0;
  
  const attributes = extractAttributes(item.selectedOptions);
  
  // Build dimensions string - convert potential Decimals to numbers
  const width = toNumber(item.width);
  const height = toNumber(item.height);
  
  let dimensions: string | undefined;
  if (width && height) {
    dimensions = `${width} × ${height} cm`;
  } else if (width) {
    dimensions = `Šírka: ${width} cm`;
  } else if (height) {
    dimensions = `Výška: ${height} cm`;
  }

  return {
    name: item.product.name,
    quantity,
    width: width || null,
    height: height || null,
    configuration: {
      attributes,
      dimensions,
    },
    unitPrice,
    netPrice,
    vatRate,
    vatAmount,
    grossPrice,
  };
}

/**
 * Generate quote PDF from cart data
 */
export async function generateQuotePdf(
  cart: CartData,
  options?: {
    customerName?: string;
    customerEmail?: string;
    vatRate?: number;
  }
): Promise<Buffer> {
  const pdfSettings = await getPdfSettings();
  const vatRate = options?.vatRate ?? 0.2;
  
  // Build company info
  const company: CompanyInfo = {
    name: pdfSettings.companyName,
    address: pdfSettings.companyAddress,
    city: pdfSettings.companyCity,
    ico: pdfSettings.companyIco,
    dic: pdfSettings.companyDic,
    icDph: pdfSettings.companyIcDph,
    iban: pdfSettings.bankIban,
  };

  // Build quote info
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 14); // 14 days validity

  const quote: QuoteInfo = {
    quoteNumber: generateQuoteNumber(),
    createdAt: now,
    validUntil,
    customerName: options?.customerName,
    customerEmail: options?.customerEmail,
  };

  // Convert cart items to quote items
  const items: QuoteItem[] = cart.items.map((item) =>
    cartItemToQuoteItem(item, vatRate)
  );

  // Calculate totals - convert potential Decimals to numbers
  const totals: QuoteTotals = {
    subtotal: toNumber(cart.totals.subtotal),
    vatRate,
    vatAmount: toNumber(cart.totals.vatAmount),
    total: toNumber(cart.totals.total),
    itemCount: cart.items.length,
  };

  // Build settings
  const settings: InvoiceSettings = {
    logoUrl: pdfSettings.logoUrl || undefined,
    signatureUrl: pdfSettings.signatureUrl || undefined,
    footerText: pdfSettings.footerText,
  };

  // Assemble quote data
  const quoteData: QuoteData = {
    company,
    quote,
    items,
    totals,
    settings,
    isB2B: true, // Quote is for B2B by default
  };

  // Generate PDF
  const pdfBuffer = await renderToBuffer(QuoteTemplate({ data: quoteData }));

  return Buffer.from(pdfBuffer);
}
