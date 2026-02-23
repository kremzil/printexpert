import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { NotificationStatus, NotificationType, OrderStatus, Prisma } from "@/lib/generated/prisma";
import {
  emailLayout,
  heading,
  paragraph,
  greeting,
  signoff,
  badge,
  button,
  divider,
  infoTable,
  orderItemsTable,
  totalsBlock,
  sectionTitle,
  addressBlock,
  BRAND,
} from "@/lib/email/template";

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Čaká sa",
  CONFIRMED: "Potvrdená",
  PROCESSING: "Spracováva sa",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
};

const statusBadgeColors: Record<OrderStatus, { color: string; bg: string }> = {
  PENDING: { color: "#92400E", bg: "#FEF3C7" },
  CONFIRMED: { color: "#065F46", bg: "#D1FAE5" },
  PROCESSING: { color: "#1E40AF", bg: "#DBEAFE" },
  COMPLETED: { color: "#065F46", bg: "#D1FAE5" },
  CANCELLED: { color: "#374151", bg: "#F3F4F6" },
};

let cachedTransport: nodemailer.Transporter | null = null;

type Address = {
  name?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

function getSmtpTransport(): nodemailer.Transporter {
  if (cachedTransport) {
    return cachedTransport;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP nie je nastavené");
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number(port),
    auth: { user, pass },
  });

  return cachedTransport;
}

const parseAddress = (address: unknown): Address | null => {
  if (!address || typeof address !== "object") {
    return null;
  }
  return address as Address;
};

const formatAddressLine = (address: Address | null) => {
  if (!address) return null;
  const parts = [address.street, address.postalCode, address.city, address.country]
    .filter(Boolean)
    .join(", ");
  return parts || null;
};

const formatMoney = (value: unknown) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return "0,00 €";
  }
  return `${amount.toFixed(2).replace(".", ",")} €`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const deliveryMethodLabels: Record<string, string> = {
  DPD_COURIER: "DPD kuriér",
  DPD_PICKUP: "DPD Pickup point",
  PERSONAL_PICKUP: "Osobný odber",
};

const paymentMethodLabels: Record<string, string> = {
  STRIPE: "Kartou online",
  BANK_TRANSFER: "Bankový prevod",
  COD: "Dobierka",
};

async function createLog(type: NotificationType, orderId: string | null, toEmail: string) {
  try {
    return await prisma.notificationLog.create({
      data: {
        type,
        orderId,
        toEmail,
        status: NotificationStatus.FAILED,
        error: "pending-send",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

async function sendWithLog(options: {
  type: NotificationType;
  orderId: string | null;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const log = await createLog(options.type, options.orderId, options.toEmail);
  if (!log) {
    return false;
  }

  try {
    const transport = getSmtpTransport();
    const from = process.env.SMTP_FROM ?? "Print Expert <info@printexpert.sk>";
    const info = await transport.sendMail({
      from,
      to: options.toEmail,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.SENT,
        providerMessageId: info.messageId ?? null,
        error: null,
      },
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.FAILED,
        error: message,
      },
    });

    return false;
  }
}

export const NotificationService = {
  async sendOrderCreated(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        shippingAddress: true,
        billingAddress: true,
        subtotal: true,
        vatAmount: true,
        total: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            priceGross: true,
          },
        },
      },
    });

    if (!order?.customerEmail) {
      return false;
    }

    const shippingAddress = formatAddressLine(parseAddress(order.shippingAddress));
    const billingAddress = formatAddressLine(parseAddress(order.billingAddress));
    const customerPhone = order.customerPhone ?? "";

    const itemsText = order.items
      .map((item) => {
        return `- ${item.productName} × ${item.quantity} — ${formatMoney(item.priceGross)}`;
      })
      .join("\n");

    const subject = `Potvrdenie objednávky #${order.orderNumber}`;

    const text = `Dobrý deň ${order.customerName},\n\nvaša objednávka #${order.orderNumber} bola úspešne vytvorená. Budeme vás informovať o ďalšom priebehu.\n\nÚdaje zákazníka:\nMeno: ${order.customerName}\nE-mail: ${order.customerEmail}${customerPhone ? `\nTelefón: ${customerPhone}` : ""}\n\nPoložky objednávky:\n${itemsText}\n\nMedzisúčet: ${formatMoney(order.subtotal)}\nDPH: ${formatMoney(order.vatAmount)}\nCelkom: ${formatMoney(order.total)}\n\nĎakujeme za dôveru.\nPrint Expert`;

    const itemsForTable = order.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      total: formatMoney(item.priceGross),
    }));

    const customerInfoRows: [string, string][] = [
      ["Meno:", order.customerName ?? ""],
      ["E-mail:", order.customerEmail],
    ];
    if (customerPhone) customerInfoRows.push(["Telefón:", customerPhone]);

    const html = emailLayout(
      [
        heading(`Objednávka #${order.orderNumber}`),
        greeting(order.customerName ?? ""),
        paragraph("Vaša objednávka bola úspešne vytvorená. Budeme vás informovať o ďalšom priebehu."),
        button("Zobraziť objednávku", `${BRAND.url}/account/orders`),
        divider(),
        sectionTitle("Údaje zákazníka"),
        infoTable(customerInfoRows),
        addressBlock("Fakturačná adresa", billingAddress),
        addressBlock("Adresa doručenia", shippingAddress),
        divider(),
        sectionTitle("Položky objednávky"),
        orderItemsTable(itemsForTable),
        totalsBlock([
          ["Medzisúčet:", formatMoney(order.subtotal)],
          ["DPH:", formatMoney(order.vatAmount)],
          ["Celkom:", formatMoney(order.total), true],
        ]),
        signoff(),
      ].join(""),
      `Potvrdenie objednávky #${order.orderNumber}`
    );

    return sendWithLog({
      type: NotificationType.ORDER_CREATED,
      orderId,
      toEmail: order.customerEmail,
      subject,
      text,
      html,
    });
  },

  async sendOrderStatusChanged(orderId: string, from: OrderStatus, to: OrderStatus) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, customerEmail: true, customerName: true },
    });

    if (!order?.customerEmail) {
      return false;
    }

    const subject = `Zmena stavu objednávky #${order.orderNumber}`;
    const text = `Dobrý deň ${order.customerName},\n\nstatus vašej objednávky #${order.orderNumber} sa zmenil z "${statusLabels[from]}" na "${statusLabels[to]}".\n\nPrint Expert`;

    const toBadge = statusBadgeColors[to];
    const html = emailLayout(
      [
        heading(`Objednávka #${order.orderNumber}`),
        greeting(order.customerName ?? ""),
        paragraph(`Status vašej objednávky sa zmenil:`),
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
          <tr>
            <td style="padding:4px 8px; font-size:14px; color:#6b7280;">${statusLabels[from]}</td>
            <td style="padding:4px 8px; font-size:18px; color:#6b7280;">&rarr;</td>
            <td style="padding:4px 0;">${badge(statusLabels[to], toBadge.color, toBadge.bg)}</td>
          </tr>
        </table>`,
        button("Zobraziť objednávku", `${BRAND.url}/account/orders`),
        signoff(),
      ].join(""),
      `Zmena stavu objednávky #${order.orderNumber}`
    );

    return sendWithLog({
      type: NotificationType.ORDER_STATUS_CHANGED,
      orderId,
      toEmail: order.customerEmail,
      subject,
      text,
      html,
    });
  },

  async sendArtworkUploaded(orderId: string, assetId: string) {
    const toEmail = process.env.SMTP_TO ?? process.env.SMTP_FROM;
    if (!toEmail) {
      return false;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });

    const asset = await prisma.orderAsset.findUnique({
      where: { id: assetId },
      select: { fileNameOriginal: true },
    });

    if (!order) {
      return false;
    }

    const fileLabel = asset?.fileNameOriginal ? ` (${asset.fileNameOriginal})` : "";
    const subject = `Nahraná grafika k objednávke #${order.orderNumber}`;
    const text = `K objednávke #${order.orderNumber} bola nahraná grafika${fileLabel}.`;

    const html = emailLayout(
      [
        heading(`Nahraná grafika`),
        paragraph(`K objednávke <strong>#${order.orderNumber}</strong> bola nahraná nová grafika.`),
        asset?.fileNameOriginal
          ? infoTable([["Súbor:", asset.fileNameOriginal]])
          : "",
        button("Zobraziť objednávku", `${BRAND.url}/admin/orders/${orderId}`),
      ].join(""),
      `Nová grafika k objednávke #${order.orderNumber}`
    );

    return sendWithLog({
      type: NotificationType.ARTWORK_UPLOADED,
      orderId,
      toEmail,
      subject,
      text,
      html,
    });
  },

  async sendAdminOrderCreated(orderId: string) {
    const toEmail = process.env.SMTP_TO ?? process.env.SMTP_FROM;
    if (!toEmail) {
      return false;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        audience: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        deliveryMethod: true,
        paymentMethod: true,
        billingAddress: true,
        shippingAddress: true,
        notes: true,
        subtotal: true,
        vatAmount: true,
        total: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            priceGross: true,
          },
        },
        assets: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            kind: true,
            status: true,
            fileNameOriginal: true,
          },
        },
      },
    });

    if (!order) {
      return false;
    }

    const orderUrl = `${BRAND.url}/admin/orders/${order.id}`;
    const assetsListUrl = `${BRAND.url}/api/orders/${order.id}/assets`;
    const deliveryMethodLabel = order.deliveryMethod
      ? deliveryMethodLabels[order.deliveryMethod] ?? order.deliveryMethod
      : "—";
    const paymentMethodLabel = order.paymentMethod
      ? paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod
      : "—";
    const audienceLabel = order.audience.toUpperCase();

    const itemsText = order.items
      .map((item) => {
        return `- ${item.productName} × ${item.quantity} — ${formatMoney(item.priceGross)}`;
      })
      .join("\n");

    const itemsForTable = order.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      total: formatMoney(item.priceGross),
    }));

    const billingAddress = formatAddressLine(parseAddress(order.billingAddress));
    const shippingAddress = formatAddressLine(parseAddress(order.shippingAddress));

    const fileAssets = order.assets.filter((asset) => asset.kind !== "INVOICE");
    const fileLinks = fileAssets.map((asset) => ({
      title: `${asset.fileNameOriginal} (${asset.kind}, ${asset.status})`,
      url: `${BRAND.url}/api/assets/${asset.id}/download`,
    }));

    const filesText =
      fileLinks.length > 0
        ? fileLinks.map((file, index) => `${index + 1}. ${file.title}\n   ${file.url}`).join("\n")
        : "Súbory zatiaľ neboli nahraté. Aktuálny stav nájdete v detaile objednávky.";

    const notesText = order.notes?.trim() ? order.notes.trim() : "—";
    const subject = `Nová objednávka #${order.orderNumber}`;

    const text = [
      `Bola vytvorená nová objednávka #${order.orderNumber}.`,
      "",
      `Režim: ${audienceLabel}`,
      `Meno: ${order.customerName}`,
      `E-mail: ${order.customerEmail}`,
      order.customerPhone ? `Telefón: ${order.customerPhone}` : null,
      `Doručenie: ${deliveryMethodLabel}`,
      `Platba: ${paymentMethodLabel}`,
      "",
      "Položky objednávky:",
      itemsText || "—",
      "",
      `Medzisúčet: ${formatMoney(order.subtotal)}`,
      `DPH: ${formatMoney(order.vatAmount)}`,
      `Celkom: ${formatMoney(order.total)}`,
      "",
      "Súbory:",
      filesText,
      `Zoznam súborov (API): ${assetsListUrl}`,
      "",
      `Poznámka: ${notesText}`,
      "",
      `Detail objednávky: ${orderUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const filesHtml =
      fileLinks.length > 0
        ? `<ul style="margin:8px 0 0; padding-left:18px;">${fileLinks
            .map(
              (file) =>
                `<li style="margin:6px 0;"><a href="${file.url}" style="color:#1d4ed8; text-decoration:underline;">${escapeHtml(file.title)}</a></li>`
            )
            .join("")}</ul>`
        : paragraph("Súbory zatiaľ neboli nahraté. Aktuálny stav nájdete v detaile objednávky.");

    const orderMetaRows: [string, string][] = [
      ["Objednávka:", `#${order.orderNumber}`],
      ["Režim:", audienceLabel],
      ["Meno:", order.customerName ?? ""],
      ["E-mail:", order.customerEmail],
      ["Doručenie:", deliveryMethodLabel],
      ["Platba:", paymentMethodLabel],
    ];
    if (order.customerPhone) {
      orderMetaRows.push(["Telefón:", order.customerPhone]);
    }

    const html = emailLayout(
      [
        heading(`Nová objednávka #${order.orderNumber}`),
        paragraph("V systéme bola vytvorená nová objednávka."),
        button("Otvoriť detail objednávky", orderUrl),
        divider(),
        sectionTitle("Základné údaje"),
        infoTable(orderMetaRows),
        addressBlock("Fakturačná adresa", billingAddress),
        addressBlock("Adresa doručenia", shippingAddress),
        divider(),
        sectionTitle("Položky objednávky"),
        orderItemsTable(itemsForTable),
        totalsBlock([
          ["Medzisúčet:", formatMoney(order.subtotal)],
          ["DPH:", formatMoney(order.vatAmount)],
          ["Celkom:", formatMoney(order.total), true],
        ]),
        sectionTitle("Súbory"),
        filesHtml,
        paragraph(
          `Aktuálny zoznam súborov: <a href="${assetsListUrl}" style="color:#1d4ed8; text-decoration:underline;">${assetsListUrl}</a>`
        ),
        sectionTitle("Poznámka"),
        paragraph(escapeHtml(notesText).replace(/\n/g, "<br/>")),
      ].join(""),
      `Nová objednávka #${order.orderNumber}`
    );

    return sendWithLog({
      type: NotificationType.ORDER_CREATED,
      orderId,
      toEmail,
      subject,
      text,
      html,
    });
  },
};

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      customerEmail: true,
      customerName: true,
      total: true,
    },
  });

  if (!order?.customerEmail) {
    return false;
  }

  // Get invoice asset
  const invoiceAsset = await prisma.orderAsset.findFirst({
    where: {
      orderId,
      kind: "INVOICE",
    },
    orderBy: { createdAt: "desc" },
  });

  // Get invoice PDF
  let attachments: { filename: string; content: Buffer }[] = [];
  if (invoiceAsset) {
    const { getInvoiceFromS3 } = await import("@/lib/s3");
    try {
      const pdfBuffer = await getInvoiceFromS3(invoiceAsset.bucket, invoiceAsset.objectKey);
      attachments = [{
        filename: invoiceAsset.fileNameOriginal,
        content: pdfBuffer,
      }];
    } catch (error) {
      console.error("Failed to get invoice from S3:", error);
    }
  }

  const total = Number(order.total).toFixed(2);
  const subject = `Faktúra k objednávke #${order.orderNumber}`;
  const text = `Dobrý deň ${order.customerName},\n\nv prílohe posielame faktúru k objednávke #${order.orderNumber} v hodnote ${total} €.\n\nĎakujeme za dôveru.\nPrint Expert`;

  const html = emailLayout(
    [
      heading(`Faktúra k objednávke #${order.orderNumber}`),
      greeting(order.customerName ?? ""),
      paragraph(`V prílohe posielame faktúru k vašej objednávke v hodnote <strong>${total}&nbsp;€</strong>.`),
      button("Zobraziť objednávku", `${BRAND.url}/account/orders`),
      signoff(),
    ].join(""),
    `Faktúra k objednávke #${order.orderNumber}`
  );

  try {
    const transport = getSmtpTransport();
    const from = process.env.SMTP_FROM ?? "Print Expert <info@printexpert.sk>";
    await transport.sendMail({
      from,
      to: order.customerEmail,
      subject,
      text,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return false;
  }
}
