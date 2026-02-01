import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { NotificationStatus, NotificationType, OrderStatus, Prisma } from "@/lib/generated/prisma";

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Čaká sa",
  CONFIRMED: "Potvrdená",
  PROCESSING: "Spracováva sa",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
};

let cachedTransport: nodemailer.Transporter | null = null;

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
      select: { orderNumber: true, customerEmail: true, customerName: true },
    });

    if (!order?.customerEmail) {
      return false;
    }

    const subject = `Potvrdenie objednávky #${order.orderNumber}`;
    const text = `Dobrý deň ${order.customerName},\n\nvaša objednávka #${order.orderNumber} bola úspešne vytvorená. Budeme vás informovať o ďalšom priebehu.\n\nĎakujeme za dôveru.\nPrint Expert`;
    const html = `<p>Dobrý deň ${order.customerName},</p><p>vaša objednávka <strong>#${order.orderNumber}</strong> bola úspešne vytvorená. Budeme vás informovať o ďalšom priebehu.</p><p>Ďakujeme za dôveru.<br/>Print Expert</p>`;

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
    const html = `<p>Dobrý deň ${order.customerName},</p><p>status vašej objednávky <strong>#${order.orderNumber}</strong> sa zmenil z "${statusLabels[from]}" na "${statusLabels[to]}".</p><p>Print Expert</p>`;

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
    const html = `<p>K objednávke <strong>#${order.orderNumber}</strong> bola nahraná grafika${fileLabel}.</p>`;

    return sendWithLog({
      type: NotificationType.ARTWORK_UPLOADED,
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
  const html = `<p>Dobrý deň ${order.customerName},</p><p>v prílohe posielame faktúru k objednávke <strong>#${order.orderNumber}</strong> v hodnote <strong>${total} €</strong>.</p><p>Ďakujeme za dôveru.<br/>Print Expert</p>`;

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
