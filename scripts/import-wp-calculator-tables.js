const fs = require("fs")
const path = require("path")
const { PrismaPg } = require("@prisma/adapter-pg")
const { Pool } = require("pg")
const { PrismaClient } = require("../lib/generated/prisma/client")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key]) continue
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
})

const BASE_DIR = path.join(__dirname, "..", "data", "wp", "wp_")

function parsePhpMyAdminExport(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim()
  if (!raw) return []
  const cleaned = raw.startsWith(",") ? raw.slice(1) : raw
  const wrapped = cleaned.startsWith("[") ? cleaned : `[${cleaned}]`
  return JSON.parse(wrapped)
}

function loadTable(fileName, tableName) {
  const filePath = path.join(BASE_DIR, fileName)
  const json = parsePhpMyAdminExport(filePath)
  const table = json.find((item) => item.type === "table" && item.name === tableName)
  return table?.data ?? []
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function toBigInt(value) {
  if (value === null || value === undefined || value === "") return null
  const text = String(value).trim()
  if (!/^-?\d+$/.test(text)) return null
  try {
    return BigInt(text)
  } catch {
    return null
  }
}

function toStringOrNull(value) {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return null
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+\.\d{3}$/.test(text)) {
    return text.replace(".", "")
  }
  if (/^\d+,\d+$/.test(text)) {
    return text.replace(",", ".")
  }
  return text
}

async function resetTable(model) {
  await prisma[model].deleteMany()
}

async function importMatrixTypes(reset) {
  if (reset) {
    await resetTable("wpMatrixType")
  }

  const rows = loadTable(
    "kpkp_wp2print_table_wp_print_products_matrix_types.json",
    "wp_print_products_matrix_types"
  )

  const data = rows.map((row) => ({
    mtypeId: toInt(row.mtype_id),
    productId: toInt(row.product_id),
    mtype: toInt(row.mtype),
    title: toStringOrNull(row.title),
    defQuantity: toInt(row.def_quantity),
    attributes: toStringOrNull(row.attributes),
    aterms: toStringOrNull(row.aterms),
    numbers: toStringOrNull(row.numbers),
    numStyle: toInt(row.num_style),
    numType: toInt(row.num_type),
    bqNumbers: toStringOrNull(row.bq_numbers),
    ltextAttr: toInt(row.ltext_attr),
    bookMinQuantity: toInt(row.book_min_quantity),
    pqStyle: toInt(row.pq_style),
    pqNumbers: toStringOrNull(row.pq_numbers),
    sorder: toInt(row.sorder),
    minQMailed: toInt(row.min_qmailed),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpMatrixType.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importMatrixPrices(reset) {
  if (reset) {
    await resetTable("wpMatrixPrice")
  }

  const rows = loadTable(
    "kpkp_wp2print_table_wp_print_products_matrix_prices.json",
    "wp_print_products_matrix_prices"
  )

  const data = rows
    .map((row) => ({
      mtypeId: toInt(row.mtype_id),
      aterms: toStringOrNull(row.aterms),
      number: toBigInt(row.number),
      price: normalizePrice(row.price),
    }))
    .filter((row) => row.mtypeId && row.aterms && row.number && row.price)

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpMatrixPrice.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importTerms(reset) {
  if (reset) {
    await resetTable("wpTerm")
  }

  const rows = loadTable("kpkp_wp2print_table_wp_terms.json", "wp_terms")
  const data = rows.map((row) => ({
    termId: toInt(row.term_id),
    name: String(row.name ?? ""),
    slug: toStringOrNull(row.slug),
    termGroup: toInt(row.term_group),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpTerm.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importTermTaxonomy(reset) {
  if (reset) {
    await resetTable("wpTermTaxonomy")
  }

  const rows = loadTable(
    "kpkp_wp2print_table_wp_term_taxonomy.json",
    "wp_term_taxonomy"
  )
  const data = rows.map((row) => ({
    termTaxonomyId: toInt(row.term_taxonomy_id),
    termId: toInt(row.term_id),
    taxonomy: String(row.taxonomy ?? ""),
    description: toStringOrNull(row.description),
    parent: toInt(row.parent),
    count: toInt(row.count),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpTermTaxonomy.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importTermRelationships(reset) {
  if (reset) {
    await resetTable("wpTermRelationship")
  }

  const rows = loadTable(
    "kpkp_wp2print_table_wp_term_relationships.json",
    "wp_term_relationships"
  )
  const data = rows.map((row) => ({
    objectId: toInt(row.object_id),
    termTaxonomyId: toInt(row.term_taxonomy_id),
    termOrder: toInt(row.term_order),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpTermRelationship.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importTermMeta(reset) {
  if (reset) {
    await resetTable("wpTermMeta")
  }

  const rows = loadTable("kpkp_wp2print_table_wp_termmeta.json", "wp_termmeta")
  const data = rows.map((row) => ({
    metaId: toInt(row.meta_id),
    termId: toInt(row.term_id),
    metaKey: toStringOrNull(row.meta_key),
    metaValue: toStringOrNull(row.meta_value),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpTermMeta.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function importAttributeTaxonomy(reset) {
  if (reset) {
    await resetTable("wpAttributeTaxonomy")
  }

  const rows = loadTable(
    "kpkp_wp2print_table_wp_woocommerce_attribute_taxonomies.json",
    "wp_woocommerce_attribute_taxonomies"
  )
  const data = rows.map((row) => ({
    attributeId: toInt(row.attribute_id),
    attributeName: String(row.attribute_name ?? ""),
    attributeLabel: String(row.attribute_label ?? ""),
    attributeType: toStringOrNull(row.attribute_type),
    attributeOrder: toInt(row.attribute_order),
    attributePublic: toInt(row.attribute_public),
  }))

  const chunkSize = 1000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await prisma.wpAttributeTaxonomy.createMany({
      data: chunk,
      skipDuplicates: true,
    })
  }
}

async function main() {
  const reset = process.argv.includes("--reset")

  await importMatrixTypes(reset)
  await importMatrixPrices(reset)
  await importTerms(reset)
  await importTermTaxonomy(reset)
  await importTermRelationships(reset)
  await importTermMeta(reset)
  await importAttributeTaxonomy(reset)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
