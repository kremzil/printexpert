const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")
const { PrismaPg } = require("@prisma/adapter-pg")
const { Pool } = require("pg")
const { PrismaClient } = require("../lib/generated/prisma/client")

// Manual remap from legacy WooCommerce product IDs to current wpProductId values.
const WP_PRODUCT_ID_REMAP = new Map([
  [2221, 3270], // Fotografie na plátne -> Obraz na plátne s dreveným rámom
  [2374, 3270], // Fotografie na plátne v muzeálnej kvalite -> Obraz na plátne s dreveným rámom
  [2395, 3285], // Fotografie na hliníkovej doske -> Fotografie na hliníkovej doske s háčikom
  [2969, 2993], // Rohož #1 (legacy) -> Rohož #1 (current)
])

function remapWpProductId(wpProductId) {
  return WP_PRODUCT_ID_REMAP.get(wpProductId) ?? wpProductId
}

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    dataDir: path.join(__dirname, "..", "customers"),
    envFile: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === "--apply") {
      args.apply = true
      args.dryRun = false
      continue
    }

    if (arg === "--dry-run") {
      args.apply = false
      args.dryRun = true
      continue
    }

    if (arg.startsWith("--data-dir=")) {
      args.dataDir = path.resolve(process.cwd(), arg.slice("--data-dir=".length))
      continue
    }

    if (arg === "--data-dir" && argv[i + 1]) {
      args.dataDir = path.resolve(process.cwd(), argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith("--env-file=")) {
      args.envFile = path.resolve(process.cwd(), arg.slice("--env-file=".length))
      continue
    }

    if (arg === "--env-file" && argv[i + 1]) {
      args.envFile = path.resolve(process.cwd(), argv[i + 1])
      i += 1
    }
  }

  return args
}

function loadEnv(envFile) {
  if (envFile) {
    if (!fs.existsSync(envFile)) {
      throw new Error(`Env file not found: ${envFile}`)
    }
    dotenv.config({ path: envFile, override: false })
    return
  }

  const candidates = [
    path.join(__dirname, "..", ".env.local"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", ".env.prod"),
    path.join(__dirname, "..", ".env.production"),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue
    dotenv.config({ path: filePath, override: false })
  }
}

function resolveCsvPath(dataDir, baseName) {
  const filteredPath = path.join(dataDir, `${baseName}_filtered.csv`)
  if (fs.existsSync(filteredPath)) return filteredPath

  const originalPath = path.join(dataDir, `${baseName}.csv`)
  if (fs.existsSync(originalPath)) return originalPath

  throw new Error(`CSV file not found for ${baseName} in ${dataDir}`)
}

function resolveOptionalCsvPath(dataDir, baseName) {
  const filteredPath = path.join(dataDir, `${baseName}_filtered.csv`)
  if (fs.existsSync(filteredPath)) return filteredPath

  const originalPath = path.join(dataDir, `${baseName}.csv`)
  if (fs.existsSync(originalPath)) return originalPath

  return null
}

function parseCsv(content) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]

    if (inQuotes) {
      if (char === "\"") {
        const nextChar = content[i + 1]
        if (nextChar === "\"") {
          field += "\""
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === "\"") {
      inQuotes = true
      continue
    }

    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }

    if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }

    if (char === "\r") {
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []

  const rawHeader = rows[0]
  if (rawHeader.length > 0) {
    rawHeader[0] = rawHeader[0].replace(/^\uFEFF/, "")
  }
  const header = rawHeader.map((item) => item.trim())
  const out = []

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i]
    const record = {}
    for (let j = 0; j < header.length; j += 1) {
      const key = header[j]
      const value = values[j] ?? ""
      record[key] = normalizeCsvValue(value)
    }
    out.push(record)
  }

  return out
}

function normalizeCsvValue(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (trimmed.toUpperCase() === "NULL") return null
  return trimmed
}

function readCsvObjects(filePath) {
  const raw = fs.readFileSync(filePath, "utf8")
  return parseCsv(raw)
}

function groupBy(items, key) {
  const map = new Map()
  for (const item of items) {
    const value = item[key]
    if (!value) continue
    const existing = map.get(value)
    if (existing) {
      existing.push(item)
    } else {
      map.set(value, [item])
    }
  }
  return map
}

function firstBy(items, key) {
  const map = new Map()
  for (const item of items) {
    const value = item[key]
    if (!value || map.has(value)) continue
    map.set(value, item)
  }
  return map
}

function parseDateTime(value) {
  if (!value) return null
  const date = new Date(value.replace(" ", "T") + "Z")
  if (Number.isNaN(date.getTime())) return null
  return date
}

function parseUnixToDate(value) {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n * 1000)
}

function parseIntSafe(value) {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function moneyToCents(value) {
  if (!value) return 0
  const normalized = String(value).replace(",", ".")
  const n = Number(normalized)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function centsToDecimal(cents) {
  return (cents / 100).toFixed(2)
}

function mapOrderStatus(status) {
  switch ((status || "").toLowerCase()) {
    case "wc-completed":
      return "COMPLETED"
    case "wc-processing":
      return "PROCESSING"
    case "wc-cancelled":
    case "wc-failed":
      return "CANCELLED"
    case "wc-refunded":
      return "CANCELLED"
    case "wc-pending":
    case "wc-on-hold":
    default:
      return "PENDING"
  }
}

function mapPaymentStatus(order) {
  const status = (order.status || "").toLowerCase()
  const hasPaidSignal = Boolean(order.transaction_id) || Boolean(order.date_paid_unix)

  if (status === "wc-completed") return "PAID"
  if (status === "wc-refunded") return "REFUNDED"
  if (status === "wc-cancelled" || status === "wc-failed") return "FAILED"
  if (hasPaidSignal) return "PAID"
  if (status === "wc-processing" || status === "wc-on-hold" || status === "wc-pending") {
    return "PENDING"
  }
  return "UNPAID"
}

function mapPaymentProvider(method) {
  if ((method || "").toLowerCase() === "stripe") return "STRIPE"
  return null
}

function mapCheckoutPaymentMethod(method) {
  switch ((method || "").toLowerCase()) {
    case "stripe":
      return "STRIPE"
    case "bacs":
      return "BANK_TRANSFER"
    case "cod":
      return "COD"
    default:
      return null
  }
}

function mapDeliveryMethod(shippingRow) {
  if (!shippingRow) return null
  const methodId = (shippingRow.method_id || "").toLowerCase()
  const shippingName = (shippingRow.shipping_name || "").toLowerCase()

  if (methodId.includes("local_pickup")) return "PERSONAL_PICKUP"
  if (methodId.includes("parcelshop") || shippingName.includes("pickup")) return "DPD_PICKUP"
  if (methodId.includes("dpd")) return "DPD_COURIER"
  return null
}

function buildAddress(addressRow, prefix) {
  if (!addressRow) return null

  const firstName = addressRow[`${prefix}_first_name`] || null
  const lastName = addressRow[`${prefix}_last_name`] || null
  const company = addressRow[`${prefix}_company`] || null
  const address1 = addressRow[`${prefix}_address_1`] || null
  const address2 = addressRow[`${prefix}_address_2`] || null
  const city = addressRow[`${prefix}_city`] || null
  const postcode = addressRow[`${prefix}_postcode`] || null
  const country = addressRow[`${prefix}_country`] || null
  const state = addressRow[`${prefix}_state`] || null

  const hasAnyValue = Boolean(
    firstName || lastName || company || address1 || address2 || city || postcode || country || state
  )
  if (!hasAnyValue) return null

  return {
    firstName,
    lastName,
    company,
    address1,
    address2,
    city,
    postcode,
    country,
    state,
  }
}

function chooseShippingRow(rows) {
  if (!rows || rows.length === 0) return null
  let selected = rows[0]
  let selectedCost = moneyToCents(selected.cost)

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]
    const cost = moneyToCents(row.cost)
    if (cost > selectedCost) {
      selected = row
      selectedCost = cost
    }
  }

  return selected
}

function mapSlovakStatusLabel(label) {
  const normalized = (label || "").trim().toLowerCase()
  if (normalized === "prijatá") return "PENDING"
  if (normalized === "čaká na platbu") return "PENDING"
  if (normalized === "spracováva sa") return "PROCESSING"
  if (normalized === "vybavená") return "COMPLETED"
  if (normalized === "zrušené") return "CANCELLED"
  return null
}

function extractStatusChange(content) {
  if (!content) return null
  const match = content.match(/Stav objednávky zmenený z (.+?) na (.+?)\./i)
  if (!match) return null

  const fromStatus = mapSlovakStatusLabel(match[1])
  const toStatus = mapSlovakStatusLabel(match[2])
  if (!fromStatus || !toStatus) return null

  return { fromStatus, toStatus }
}

function buildOrderNotesText(notes) {
  if (!notes || notes.length === 0) return null
  const sorted = [...notes].sort((a, b) => {
    const left = parseDateTime(a.created_at)?.getTime() ?? 0
    const right = parseDateTime(b.created_at)?.getTime() ?? 0
    return left - right
  })

  return sorted
    .map((note) => {
      const date = note.created_at || "unknown-date"
      const author = note.author || "unknown-author"
      const content = note.content || ""
      return `[${date}] ${author}: ${content}`
    })
    .join("\n")
}

function parsePhpSerializedStrings(value) {
  if (!value) return []
  const matches = String(value).matchAll(/s:\d+:"((?:[^"\\]|\\.)*)";/g)
  const out = []
  for (const match of matches) {
    const text = match[1]
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\")
      .trim()
    if (text) out.push(text)
  }
  return out
}

function parseProductAttributesMeta(value) {
  const attributes = {}
  for (const raw of parsePhpSerializedStrings(value)) {
    const separatorIndex = raw.indexOf(":")
    if (separatorIndex === -1) continue
    const key = raw.slice(0, separatorIndex).trim()
    const val = raw.slice(separatorIndex + 1).trim()
    if (!key || !val) continue
    attributes[key] = val
  }
  return attributes
}

function buildSelectedOptionsFromMetaRows(metaRows) {
  if (!metaRows || metaRows.length === 0) return null

  const attributes = {}
  for (const row of metaRows) {
    const key = row.meta_key
    const value = row.meta_value
    if (!key || value === null || value === undefined || value === "") continue

    if (key === "_product_attributes") {
      Object.assign(attributes, parseProductAttributesMeta(value))
      continue
    }

    // Keep readable custom fields exported from WooCommerce item meta.
    if (!key.startsWith("_")) {
      attributes[key] = String(value)
    }
  }

  if (Object.keys(attributes).length === 0) return null
  return { _attributes: attributes }
}

function normalizeName(...parts) {
  const merged = parts.filter(Boolean).join(" ").trim()
  return merged || null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnv(args.envFile)

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Use --env-file or set env vars before running.")
  }

  const csvPaths = {
    wpUsers: resolveCsvPath(args.dataDir, "wp_users"),
    orders: resolveCsvPath(args.dataDir, "orders"),
    orderItems: resolveCsvPath(args.dataDir, "order_items"),
    orderItemMeta: resolveOptionalCsvPath(args.dataDir, "order_itemmeta_full"),
    orderAddresses: resolveCsvPath(args.dataDir, "order_addresses"),
    shipping: resolveCsvPath(args.dataDir, "shipping"),
    orderNotes: resolveCsvPath(args.dataDir, "order_notes"),
  }

  const wpUsers = readCsvObjects(csvPaths.wpUsers)
  const orders = readCsvObjects(csvPaths.orders)
  const orderItems = readCsvObjects(csvPaths.orderItems)
  const orderItemMeta = csvPaths.orderItemMeta ? readCsvObjects(csvPaths.orderItemMeta) : []
  const orderAddresses = readCsvObjects(csvPaths.orderAddresses)
  const shipping = readCsvObjects(csvPaths.shipping)
  const orderNotes = readCsvObjects(csvPaths.orderNotes)

  const ordersById = firstBy(orders, "wp_order_id")
  const orderItemsByOrderId = groupBy(orderItems, "wp_order_id")
  const orderItemMetaByItemId = groupBy(orderItemMeta, "order_item_id")
  const addressesByOrderId = firstBy(orderAddresses, "wp_order_id")
  const shippingByOrderId = groupBy(shipping, "wp_order_id")
  const notesByOrderId = groupBy(orderNotes, "wp_order_id")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  })

  const stats = {
    dryRun: args.dryRun,
    passwordPolicy: {
      importedUsersWithPasswordHash: 0,
      importedUsersMarkedAsNotMigrated: 0,
      existingUsersPasswordUntouched: true,
      passwordColumnsDetectedInSource: false,
    },
    input: {
      users: wpUsers.length,
      orders: orders.length,
      orderItems: orderItems.length,
      orderItemMeta: orderItemMeta.length,
      orderAddresses: orderAddresses.length,
      shipping: shipping.length,
      orderNotes: orderNotes.length,
    },
    users: {
      processed: 0,
      upserted: 0,
      skippedNoEmail: 0,
    },
    orders: {
      processed: 0,
      upserted: 0,
      missingOrderId: 0,
      missingCustomerEmail: 0,
      linkedUser: 0,
      withItems: 0,
      statusHistoryRows: 0,
    },
    orderItems: {
      processed: 0,
      inserted: 0,
      skippedProductNotMapped: 0,
      skippedBadOrder: 0,
      skippedInvalidProductId: 0,
      withSelectedOptions: 0,
    },
    mapping: {
      productWpIdsSeen: 0,
      productWpIdsRemapped: 0,
      productWpIdsMapped: 0,
      productWpIdsMissing: 0,
    },
  }

  try {
    const wpUserById = new Map()
    const knownEmails = new Set()

    if (wpUsers.length > 0) {
      const userColumns = Object.keys(wpUsers[0])
      const hasPasswordLikeColumn = userColumns.some((column) =>
        /(pass|password|hash)/i.test(column)
      )
      stats.passwordPolicy.passwordColumnsDetectedInSource = hasPasswordLikeColumn
    }

    for (const row of wpUsers) {
      if (row.user_email) knownEmails.add(row.user_email.toLowerCase())
    }
    for (const row of orderAddresses) {
      if (row.billing_email) knownEmails.add(row.billing_email.toLowerCase())
    }

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: [...knownEmails] } },
      select: { id: true, email: true },
    })
    const existingUserByEmail = new Map(
      existingUsers.map((u) => [u.email.toLowerCase(), u.id])
    )

    if (args.apply) {
      for (const row of wpUsers) {
        stats.users.processed += 1
        const email = row.user_email ? row.user_email.toLowerCase() : null
        if (!email) {
          stats.users.skippedNoEmail += 1
          continue
        }

        const name = row.display_name || row.user_login || null
        const createdAt = parseDateTime(row.user_registered) || new Date()

        const user = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name,
            createdAt,
            passwordHash: null,
            passwordMigrated: false,
          },
          update: {
            name,
            // Never overwrite password data during WP customer migration.
          },
          select: {
            id: true,
          },
        })

        stats.users.upserted += 1
        stats.passwordPolicy.importedUsersMarkedAsNotMigrated += 1
        wpUserById.set(row.wp_user_id, user.id)
      }
    } else {
      for (const row of wpUsers) {
        stats.users.processed += 1
        const email = row.user_email ? row.user_email.toLowerCase() : null
        if (!email) {
          stats.users.skippedNoEmail += 1
          continue
        }
        if (existingUserByEmail.has(email)) {
          wpUserById.set(row.wp_user_id, existingUserByEmail.get(email))
        }
      }
    }

    const orphanOrderItems = orderItems.filter((item) => !ordersById.has(item.wp_order_id))
    stats.orderItems.skippedBadOrder = orphanOrderItems.length

    const wpProductIds = new Set()
    const remappedSourceWpProductIds = new Set()
    for (const item of orderItems) {
      const originalWpProductId = parseIntSafe(item.product_id)
      if (originalWpProductId !== null) {
        const mappedWpProductId = remapWpProductId(originalWpProductId)
        wpProductIds.add(mappedWpProductId)
        if (mappedWpProductId !== originalWpProductId) {
          remappedSourceWpProductIds.add(originalWpProductId)
        }
      }
    }
    stats.mapping.productWpIdsSeen = wpProductIds.size
    stats.mapping.productWpIdsRemapped = remappedSourceWpProductIds.size

    const products = await prisma.product.findMany({
      where: {
        wpProductId: { in: [...wpProductIds] },
      },
      select: {
        id: true,
        wpProductId: true,
      },
    })
    const productMap = new Map()
    for (const product of products) {
      if (product.wpProductId === null) continue
      productMap.set(product.wpProductId, product.id)
    }
    stats.mapping.productWpIdsMapped = productMap.size
    stats.mapping.productWpIdsMissing = Math.max(0, wpProductIds.size - productMap.size)

    for (const order of orders) {
      stats.orders.processed += 1
      const wpOrderId = order.wp_order_id
      if (!wpOrderId) {
        stats.orders.missingOrderId += 1
        continue
      }

      const address = addressesByOrderId.get(wpOrderId) || null
      const shippingRows = shippingByOrderId.get(wpOrderId) || []
      const shippingRow = chooseShippingRow(shippingRows)
      const notes = notesByOrderId.get(wpOrderId) || []
      const userRow = wpUserById.has(order.wp_user_id)
        ? wpUsers.find((u) => u.wp_user_id === order.wp_user_id) || null
        : null

      const billingAddress = buildAddress(address, "billing")
      const shippingAddress = buildAddress(address, "shipping")

      const fallbackEmail = userRow?.user_email || null
      const billingEmail = address?.billing_email || null
      const customerEmail =
        (billingEmail || fallbackEmail || `wp-order-${wpOrderId}@example.invalid`).toLowerCase()
      if (!customerEmail) {
        stats.orders.missingCustomerEmail += 1
        continue
      }

      const customerName =
        normalizeName(address?.billing_first_name, address?.billing_last_name) ||
        normalizeName(address?.shipping_first_name, address?.shipping_last_name) ||
        userRow?.display_name ||
        userRow?.user_login ||
        "Zákazník"

      const orderItemsRows = orderItemsByOrderId.get(wpOrderId) || []
      let vatCents = 0
      for (const itemRow of orderItemsRows) {
        vatCents += moneyToCents(itemRow.line_tax)
      }
      const totalCents = moneyToCents(order.total)
      const subtotalCents = Math.max(0, totalCents - vatCents)

      const deliveryMethod = mapDeliveryMethod(shippingRow)
      const paymentMethod = mapCheckoutPaymentMethod(order.payment_method)
      const paymentProvider = mapPaymentProvider(order.payment_method)
      const paidAt = parseUnixToDate(order.date_paid_unix)
      const orderCreatedAt = parseDateTime(order.created_at) || new Date()
      const orderUpdatedAt = parseDateTime(order.updated_at) || orderCreatedAt
      const orderNotesText = buildOrderNotesText(notes)
      const linkedUserId =
        wpUserById.get(order.wp_user_id) ||
        (billingEmail ? existingUserByEmail.get(billingEmail.toLowerCase()) : null) ||
        null

      const orderPayload = {
        orderNumber: `WP-${wpOrderId}`,
        userId: linkedUserId,
        audience: "b2c",
        status: mapOrderStatus(order.status),
        paymentStatus: mapPaymentStatus(order),
        paymentProvider,
        paidAt,
        subtotal: centsToDecimal(subtotalCents),
        vatAmount: centsToDecimal(vatCents),
        total: centsToDecimal(totalCents),
        customerName,
        customerEmail,
        customerPhone: address?.billing_phone || null,
        deliveryMethod,
        paymentMethod,
        shippingAddress,
        billingAddress,
        codAmount: paymentMethod === "COD" ? centsToDecimal(totalCents) : null,
        codCurrency: paymentMethod === "COD" ? (order.currency || "EUR") : null,
        carrier: shippingRow?.shipping_name || null,
        notes: orderNotesText,
        createdAt: orderCreatedAt,
        updatedAt: orderUpdatedAt,
      }

      if (linkedUserId) {
        stats.orders.linkedUser += 1
      }

      const mappedItems = []
      for (const itemRow of orderItemsRows) {
        stats.orderItems.processed += 1
        const originalProductWpId = parseIntSafe(itemRow.product_id)
        if (originalProductWpId === null) {
          stats.orderItems.skippedInvalidProductId += 1
          continue
        }

        const mappedProductWpId = remapWpProductId(originalProductWpId)
        const productId = productMap.get(mappedProductWpId)
        if (!productId) {
          stats.orderItems.skippedProductNotMapped += 1
          continue
        }

        const priceNetCents = moneyToCents(itemRow.line_total)
        const priceVatCents = moneyToCents(itemRow.line_tax)
        const quantity = Math.max(1, parseIntSafe(itemRow.qty) || 1)
        const metaRows = orderItemMetaByItemId.get(itemRow.order_item_id) || []
        const selectedOptions = buildSelectedOptionsFromMetaRows(metaRows)
        if (selectedOptions) {
          stats.orderItems.withSelectedOptions += 1
        }

        mappedItems.push({
          productId,
          productName: itemRow.order_item_name || "Produkt",
          quantity,
          selectedOptions,
          priceNet: centsToDecimal(priceNetCents),
          priceVat: centsToDecimal(priceVatCents),
          priceGross: centsToDecimal(priceNetCents + priceVatCents),
          priceSnapshot: {
            wpOrderItemId: itemRow.order_item_id || null,
            wpProductId: mappedProductWpId,
            wpProductIdOriginal:
              mappedProductWpId !== originalProductWpId ? originalProductWpId : null,
            source: "woocommerce_csv",
          },
        })
      }

      if (mappedItems.length > 0) {
        stats.orders.withItems += 1
      }

      const historyRows = notes
        .map((note) => {
          const statusChange = extractStatusChange(note.content)
          if (!statusChange) return null
          return {
            fromStatus: statusChange.fromStatus,
            toStatus: statusChange.toStatus,
            note: `${note.author || "WooCommerce"}: ${note.content || ""}`,
            createdAt: parseDateTime(note.created_at) || orderCreatedAt,
          }
        })
        .filter(Boolean)

      stats.orders.statusHistoryRows += historyRows.length

      if (!args.apply) continue

      const importedOrder = await prisma.order.upsert({
        where: { orderNumber: orderPayload.orderNumber },
        create: orderPayload,
        update: {
          userId: orderPayload.userId,
          audience: orderPayload.audience,
          status: orderPayload.status,
          paymentStatus: orderPayload.paymentStatus,
          paymentProvider: orderPayload.paymentProvider,
          paidAt: orderPayload.paidAt,
          subtotal: orderPayload.subtotal,
          vatAmount: orderPayload.vatAmount,
          total: orderPayload.total,
          customerName: orderPayload.customerName,
          customerEmail: orderPayload.customerEmail,
          customerPhone: orderPayload.customerPhone,
          deliveryMethod: orderPayload.deliveryMethod,
          paymentMethod: orderPayload.paymentMethod,
          shippingAddress: orderPayload.shippingAddress,
          billingAddress: orderPayload.billingAddress,
          codAmount: orderPayload.codAmount,
          codCurrency: orderPayload.codCurrency,
          carrier: orderPayload.carrier,
          notes: orderPayload.notes,
          createdAt: orderPayload.createdAt,
          updatedAt: orderPayload.updatedAt,
        },
        select: { id: true },
      })

      await prisma.orderItem.deleteMany({
        where: { orderId: importedOrder.id },
      })

      if (mappedItems.length > 0) {
        await prisma.orderItem.createMany({
          data: mappedItems.map((item) => ({
            orderId: importedOrder.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            selectedOptions: item.selectedOptions,
            priceNet: item.priceNet,
            priceVat: item.priceVat,
            priceGross: item.priceGross,
            priceSnapshot: item.priceSnapshot,
          })),
        })
      }

      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: importedOrder.id },
      })

      if (historyRows.length > 0) {
        await prisma.orderStatusHistory.createMany({
          data: historyRows.map((entry) => ({
            orderId: importedOrder.id,
            fromStatus: entry.fromStatus,
            toStatus: entry.toStatus,
            note: entry.note,
            createdAt: entry.createdAt,
          })),
        })
      }

      stats.orders.upserted += 1
      stats.orderItems.inserted += mappedItems.length
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }

  console.log(JSON.stringify({ csvPaths, stats }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
