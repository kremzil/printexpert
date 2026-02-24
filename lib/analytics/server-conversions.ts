import "server-only"

import { createHash } from "node:crypto"

import { buildMarketingItemId } from "@/lib/analytics/item-id"
import { logger } from "@/lib/observability/logger"
import { getPrisma } from "@/lib/prisma"
import { toAbsoluteUrl } from "@/lib/seo"

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect"
const META_ENDPOINT_BASE = "https://graph.facebook.com/v20.0"

type SendPurchaseConversionsOptions = {
  reason: "stripe_paid" | "checkout_offline" | "payment_method_offline"
}

const toSha256 = (value: string) =>
  createHash("sha256").update(value.trim().toLowerCase()).digest("hex")

const normalizePhone = (value: string) => value.replace(/\D/g, "")

const round2 = (value: number) => Math.round(value * 100) / 100

export const sendPurchaseConversions = async (
  orderId: string,
  options: SendPurchaseConversionsOptions
) => {
  const prisma = getPrisma()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      customerEmail: true,
      customerPhone: true,
      items: {
        select: {
          quantity: true,
          priceGross: true,
          productName: true,
          product: {
            select: {
              id: true,
              wpProductId: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    logger.warn({
      event: "marketing.purchase.order_missing",
      orderId,
      reason: options.reason,
    })
    return { ga4Sent: false, metaSent: false }
  }

  const normalizedItems = order.items
    .map((item) => {
      const quantity = item.quantity > 0 ? item.quantity : 1
      const lineGross = Number(item.priceGross.toString())
      if (!Number.isFinite(lineGross) || lineGross <= 0) return null
      const unitPrice = round2(lineGross / quantity)
      return {
        item_id: buildMarketingItemId(item.product.id, item.product.wpProductId),
        item_name: item.productName,
        quantity,
        lineGross: round2(lineGross),
        unitPrice,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (normalizedItems.length === 0) {
    logger.warn({
      event: "marketing.purchase.empty_items",
      orderId: order.id,
      reason: options.reason,
    })
    return { ga4Sent: false, metaSent: false }
  }

  const value = round2(
    normalizedItems.reduce((sum, item) => sum + item.lineGross, 0)
  )
  const currency = "EUR"
  const eventId = order.id
  const transactionId = order.orderNumber || order.id
  const eventSourceUrl = toAbsoluteUrl(`/checkout/success?orderId=${order.id}`)
  const gaClientId = `server.${order.id}`

  const gaMeasurementId = process.env.GA4_MEASUREMENT_ID
  const gaApiSecret = process.env.GA4_API_SECRET
  const metaPixelId = process.env.META_PIXEL_ID
  const metaAccessToken = process.env.META_ACCESS_TOKEN

  const tasks: Array<Promise<unknown>> = []
  let ga4Enabled = false
  let metaEnabled = false

  if (!gaMeasurementId && !metaPixelId) {
    logger.info({
      event: "marketing.purchase.skipped_no_destinations",
      orderId: order.id,
      reason: options.reason,
    })
    return { ga4Sent: false, metaSent: false }
  }

  if (gaMeasurementId && gaApiSecret) {
    ga4Enabled = true
    const gaPayload = {
      client_id: gaClientId,
      user_id: order.userId ?? undefined,
      events: [
        {
          name: "purchase",
          params: {
            currency,
            value,
            transaction_id: transactionId,
            event_id: eventId,
            items: normalizedItems.map((item) => ({
              item_id: item.item_id,
              item_name: item.item_name,
              price: item.unitPrice,
              quantity: item.quantity,
            })),
          },
        },
      ],
    }

    tasks.push(
      fetch(
        `${GA_ENDPOINT}?measurement_id=${encodeURIComponent(gaMeasurementId)}&api_secret=${encodeURIComponent(gaApiSecret)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gaPayload),
        }
      ).then(async (response) => {
        if (!response.ok) {
          const body = await response.text()
          throw new Error(`GA4 MP error ${response.status}: ${body}`)
        }
      })
    )
  }

  if (metaPixelId && metaAccessToken) {
    metaEnabled = true
    const userData: {
      em?: string[]
      ph?: string[]
    } = {}
    if (order.customerEmail) {
      userData.em = [toSha256(order.customerEmail)]
    }
    if (order.customerPhone) {
      const normalizedPhone = normalizePhone(order.customerPhone)
      if (normalizedPhone) {
        userData.ph = [toSha256(normalizedPhone)]
      }
    }

    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: eventSourceUrl,
          user_data: userData,
          custom_data: {
            currency,
            value,
            order_id: transactionId,
            content_type: "product",
            contents: normalizedItems.map((item) => ({
              id: item.item_id,
              quantity: item.quantity,
              item_price: item.unitPrice,
            })),
          },
        },
      ],
    }

    tasks.push(
      fetch(
        `${META_ENDPOINT_BASE}/${encodeURIComponent(metaPixelId)}/events?access_token=${encodeURIComponent(metaAccessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaPayload),
        }
      ).then(async (response) => {
        if (!response.ok) {
          const body = await response.text()
          throw new Error(`Meta CAPI error ${response.status}: ${body}`)
        }
      })
    )
  }

  if (tasks.length === 0) {
    logger.info({
      event: "marketing.purchase.skipped_missing_keys",
      orderId: order.id,
      reason: options.reason,
      gaMeasurementId: Boolean(gaMeasurementId),
      gaApiSecret: Boolean(gaApiSecret),
      metaPixelId: Boolean(metaPixelId),
      metaAccessToken: Boolean(metaAccessToken),
    })
    return { ga4Sent: false, metaSent: false }
  }

  const settled = await Promise.allSettled(tasks)
  const hasError = settled.some((result) => result.status === "rejected")

  settled.forEach((result) => {
    if (result.status === "rejected") {
      logger.error({
        event: "marketing.purchase.send_failed",
        orderId: order.id,
        reason: options.reason,
        errorMessage:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      })
    }
  })

  if (!hasError) {
    logger.info({
      event: "marketing.purchase.sent",
      orderId: order.id,
      reason: options.reason,
      ga4Enabled,
      metaEnabled,
    })
  }

  return {
    ga4Sent: ga4Enabled && !hasError,
    metaSent: metaEnabled && !hasError,
  }
}
