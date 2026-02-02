import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { InvoiceTemplate } from "./invoice-template";
import { getPdfSettings } from "./settings";
import type { InvoiceData, InvoiceItem } from "./types";
import { prisma } from "@/lib/prisma";

interface Address {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  name?: string;
  ico?: string;
  dic?: string;
  icDph?: string;
}

function parseAddress(address: unknown): Address | null {
  if (!address || typeof address !== "object") return null;
  return address as Address;
}

function formatAddressLine(addr: Address | null): string {
  if (!addr) return "";
  const parts = [addr.street, addr.postalCode, addr.city].filter(Boolean);
  return parts.join(", ");
}

function formatAddressCity(addr: Address | null): string {
  if (!addr) return "";
  const parts = [addr.postalCode, addr.city, addr.country].filter(Boolean);
  return parts.join(" ");
}

/**
 * Generate next invoice number and increment counter
 */
async function getNextInvoiceNumber(): Promise<string> {
  const settings = await getPdfSettings();
  const prefix = settings.invoicePrefix || "";
  const number = settings.invoiceNextNumber || 1;
  
  // Increment the counter
  await prisma.shopSettings.update({
    where: { id: "default" },
    data: {
      pdfSettings: {
        ...(await prisma.shopSettings.findUnique({ where: { id: "default" } }))?.pdfSettings as object || {},
        invoiceNextNumber: number + 1,
      },
    },
  });
  
  // Format: PREFIX + YYMM + 5-digit number
  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  const formattedNumber = number.toString().padStart(5, "0");
  
  return `${prefix}${yearMonth} ${formattedNumber}`;
}

/**
 * Generate invoice PDF for an order
 */
export async function generateInvoicePdf(orderId: string): Promise<Buffer> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Objednávka nenájdená");
  }

  const settings = await getPdfSettings();
  
  // Generate invoice number if not exists
  const invoiceNumber = await getNextInvoiceNumber();
  
  // Parse addresses
  const billingAddr = parseAddress(order.billingAddress);
  const shippingAddr = parseAddress(order.shippingAddress);

  // Build invoice data
  const invoiceData: InvoiceData = {
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      city: settings.companyCity,
      ico: settings.companyIco,
      dic: settings.companyDic,
      icDph: settings.companyIcDph || undefined,
      bankName: settings.bankName || undefined,
      bic: settings.bankBic || undefined,
      bankCode: settings.bankCode || undefined,
      iban: settings.bankIban,
    },
    customer: {
      name: billingAddr?.name || order.customerName,
      address: formatAddressLine(billingAddr),
      city: formatAddressCity(billingAddr),
      ico: billingAddr?.ico,
      dic: billingAddr?.dic,
      icDph: billingAddr?.icDph,
      email: order.customerEmail,
      phone: order.customerPhone || undefined,
      shippingAddress: shippingAddr ? formatAddressLine(shippingAddr) : undefined,
      shippingCity: shippingAddr ? formatAddressCity(shippingAddr) : undefined,
    },
    order: {
      invoiceNumber,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      issueDate: new Date(),
      taxDate: new Date(),
      dueDate: new Date(Date.now() + (settings.paymentDueDays || 14) * 24 * 60 * 60 * 1000),
      paymentMethod: order.paymentProvider === "STRIPE" ? "Platba kartou" : "Dobierka",
      deliveryMethod: "Kuriér", // TODO: Add delivery method to order
      variableSymbol: invoiceNumber.replace(/\s/g, ""),
    },
    items: order.items.map((item): InvoiceItem => {
      const netPrice = Number(item.priceNet);
      const vatAmount = Number(item.priceVat);
      const grossPrice = Number(item.priceGross);
      const quantity = item.quantity;
      const unitPrice = netPrice / quantity;
      const vatRate = netPrice > 0 ? vatAmount / netPrice : 0.23;

      return {
        name: item.productName,
        quantity,
        unitPrice,
        netPrice,
        vatRate,
        vatAmount,
        grossPrice,
      };
    }),
    totals: {
      subtotal: Number(order.subtotal),
      vatRate: Number(order.subtotal) > 0 
        ? Number(order.vatAmount) / Number(order.subtotal) 
        : 0.23,
      vatAmount: Number(order.vatAmount),
      total: Number(order.total),
    },
    settings: {
      logoUrl: settings.logoUrl || undefined,
      signatureUrl: settings.signatureUrl || undefined,
      footerText: settings.footerText || "",
    },
  };

  // Render PDF to buffer
  const element = InvoiceTemplate({ data: invoiceData }) as ReactElement;
  const pdfBuffer = await renderToBuffer(element);

  return Buffer.from(pdfBuffer);
}

/**
 * Generate invoice and save as order asset
 */
export async function generateAndSaveInvoice(orderId: string): Promise<string> {
  const pdfBuffer = await generateInvoicePdf(orderId);
  
  // Get order for invoice number
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  
  if (!order) {
    throw new Error("Objednávka nenájdená");
  }

  // Save to S3 and create asset record
  const { uploadInvoiceToS3 } = await import("@/lib/s3");
  
  const fileName = `faktura-${order.orderNumber}.pdf`;
  const { bucket, objectKey, region } = await uploadInvoiceToS3(
    pdfBuffer,
    orderId,
    fileName
  );

  // Create order asset record
  const asset = await prisma.orderAsset.create({
    data: {
      orderId,
      kind: "INVOICE",
      status: "UPLOADED",
      fileNameOriginal: fileName,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      storageProvider: "S3",
      bucket,
      objectKey,
      region,
    },
  });

  return asset.id;
}
