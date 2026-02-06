const fs = require("fs");
const path = require("path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");

const ENTRY_BATCH_SIZE = Number(process.env.ENTRY_BATCH_SIZE || 1000);

function unserialize(input) {
  let idx = 0;

  const readUntil = (char) => {
    const start = idx;
    const end = input.indexOf(char, idx);
    if (end === -1) {
      throw new Error("Invalid serialization");
    }
    idx = end + 1;
    return input.slice(start, end);
  };

  const parseValue = () => {
    const type = input[idx];
    idx += 2;

    if (type === "N") {
      idx += 1;
      return null;
    }

    if (type === "i") {
      const num = readUntil(";");
      return Number(num);
    }

    if (type === "s") {
      const lenStr = readUntil(":");
      const len = Number(lenStr);
      if (input[idx] !== '"') {
        throw new Error("Invalid string");
      }
      idx += 1;
      const value = input.slice(idx, idx + len);
      idx += len;
      if (input[idx] !== '"') {
        throw new Error("Invalid string terminator");
      }
      idx += 2;
      return value;
    }

    if (type === "a") {
      const countStr = readUntil(":");
      const count = Number(countStr);
      if (input[idx] !== "{") {
        throw new Error("Invalid array start");
      }
      idx += 1;
      const obj = {};
      for (let i = 0; i < count; i += 1) {
        const key = parseValue();
        const value = parseValue();
        obj[String(key)] = value;
      }
      if (input[idx] !== "}") {
        throw new Error("Invalid array end");
      }
      idx += 1;
      const keys = Object.keys(obj);
      const isSequential =
        keys.length > 0 && keys.every((key, i) => Number(key) === i);
      if (isSequential) {
        return keys.map((key) => obj[key]);
      }
      return obj;
    }

    throw new Error(`Unsupported type: ${type}`);
  };

  return parseValue();
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => String(item));
  }
  return [];
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function toBigInt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    loadDotEnv(path.join(__dirname, "..", ".env"));
  }

  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is not set.");
  }

  const pool = new Pool({
    connectionString,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  const products = await prisma.product.findMany({
    where: { wpProductId: { not: null } },
    select: { id: true, wpProductId: true },
  });
  const productByWpId = new Map(
    products
      .filter((product) => typeof product.wpProductId === "number")
      .map((product) => [String(product.wpProductId), product])
  );

  const matrixTypes = await prisma.wpMatrixType.findMany({
    orderBy: [{ productId: "asc" }, { mtypeId: "asc" }],
  });

  let processed = 0;
  let skipped = 0;
  let created = 0;
  let updated = 0;
  let entriesCreated = 0;
  let entriesSkipped = 0;

  for (const matrix of matrixTypes) {
    const product = productByWpId.get(String(matrix.productId));
    if (!product) {
      skipped += 1;
      continue;
    }

    const kind = matrix.mtype === 1 ? "FINISHING" : "BASE";
    const breakpoints = matrix.numbers ? matrix.numbers : [];
    const meta = {};
    if (matrix.attributes) {
      try {
        meta.attributes = toArray(unserialize(matrix.attributes));
      } catch {
        meta.attributes = [];
      }
    }
    if (matrix.aterms) {
      try {
        const raw = unserialize(matrix.aterms);
        const atermsObj =
          raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
        const atermsByAid = {};
        for (const [aid, terms] of Object.entries(atermsObj)) {
          atermsByAid[aid] = toArray(terms);
        }
        meta.aterms = atermsByAid;
      } catch {
        meta.aterms = {};
      }
    }
    if (matrix.title) meta.title = matrix.title;
    if (matrix.defQuantity !== null && matrix.defQuantity !== undefined) {
      meta.defQuantity = matrix.defQuantity;
    }
    if (matrix.sorder !== null && matrix.sorder !== undefined) {
      meta.sorder = matrix.sorder;
    }
    const metaValue = Object.keys(meta).length > 0 ? meta : null;

    const existing = await prisma.pricingModel.findUnique({
      where: {
        productId_sourceMtypeId: {
          productId: product.id,
          sourceMtypeId: matrix.mtypeId,
        },
      },
      select: { id: true },
    });

    const model = existing
      ? await prisma.pricingModel.update({
          where: { id: existing.id },
          data: {
            kind,
            breakpoints,
            numStyle: matrix.numStyle ?? null,
            numType: matrix.numType ?? null,
            aUnit: matrix.aUnit ?? null,
            isActive: matrix.isActive ?? true,
            meta: metaValue,
          },
          select: { id: true },
        })
      : await prisma.pricingModel.create({
          data: {
            productId: product.id,
            kind,
            sourceMtypeId: matrix.mtypeId,
            breakpoints,
            numStyle: matrix.numStyle ?? null,
            numType: matrix.numType ?? null,
            aUnit: matrix.aUnit ?? null,
            isActive: matrix.isActive ?? true,
            meta: metaValue,
          },
          select: { id: true },
        });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    const prices = await prisma.wpMatrixPrice.findMany({
      where: { mtypeId: matrix.mtypeId },
    });

    await prisma.pricingEntry.deleteMany({
      where: { pricingModelId: model.id },
    });

    const entries = prices
      .map((row) => {
        const breakpoint = toBigInt(row.number);
        if (breakpoint === null) {
          entriesSkipped += 1;
          return null;
        }
        const attrsKey = String(row.aterms ?? "");
        return {
          pricingModelId: model.id,
          attrsKey,
          breakpoint,
          price: row.price,
        };
      })
      .filter(Boolean);

    if (entries.length > 0) {
      const batches = chunk(entries, ENTRY_BATCH_SIZE);
      for (const batch of batches) {
        await prisma.pricingEntry.createMany({
          data: batch,
        });
      }
      entriesCreated += entries.length;
    }

    processed += 1;
    if (processed % 20 === 0) {
      console.log(
        `Processed ${processed}/${matrixTypes.length} models... created ${created}, updated ${updated}`
      );
    }
  }

  await prisma.$disconnect();
  await pool.end();

  console.log("Done.");
  console.log(
    `Models: total=${processed}, created=${created}, updated=${updated}, skipped=${skipped}`
  );
  console.log(
    `Entries: created=${entriesCreated}, skipped=${entriesSkipped}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
