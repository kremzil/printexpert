const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");
const fs = require("fs");
const path = require("path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    loadDotEnv(path.join(__dirname, "..", ".env"));
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
    },
  });

  const byName = new Map();
  for (const product of products) {
    const key = product.name.trim().toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(product);
  }

  const duplicates = Array.from(byName.values()).filter((items) => items.length > 1);

  let deletedProducts = 0;
  let deletedImages = 0;
  let deletedPricingModels = 0;

  for (const items of duplicates) {
    const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    const keep = sorted[0];
    const toRemove = sorted.slice(1);

    if (toRemove.length === 0) continue;

    const ids = toRemove.map((item) => item.id);

    const images = await prisma.productImage.deleteMany({
      where: { productId: { in: ids } },
    });
    const models = await prisma.pricingModel.deleteMany({
      where: { productId: { in: ids } },
    });
    const productsDeleted = await prisma.product.deleteMany({
      where: { id: { in: ids } },
    });

    deletedImages += images.count;
    deletedPricingModels += models.count;
    deletedProducts += productsDeleted.count;

    console.log(`Kept "${keep.name}" (${keep.slug}), removed ${toRemove.length}`);
  }

  console.log(`Deleted products: ${deletedProducts}`);
  console.log(`Deleted images: ${deletedImages}`);
  console.log(`Deleted pricing models: ${deletedPricingModels}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
