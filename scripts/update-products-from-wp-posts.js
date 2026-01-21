const fs = require("fs");
const path = require("path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");

const DEFAULT_EXPORT = "wc-product-export-21-1-2026-1768984148845.csv";
const DEFAULT_POSTS = "wp_posts.csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    field += ch;
    i += 1;
  }

  row.push(field);
  rows.push(row);

  return rows.filter((item) => item.some((value) => value !== ""));
}

function toOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value);
  return text.trim() ? text : null;
}

function resolvePath(fileName) {
  return path.join(__dirname, "..", "data", "wp", fileName);
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

function loadIdSet(exportCsvPath) {
  const raw = fs.readFileSync(exportCsvPath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    throw new Error(`Empty export file: ${exportCsvPath}`);
  }

  const header = rows[0];
  if (header[0]) {
    header[0] = header[0].replace(/^\uFEFF/, "");
  }
  const idIndex = header.indexOf("ID");
  if (idIndex === -1) {
    throw new Error("Missing ID column in export CSV.");
  }

  const ids = new Set();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rawId = row[idIndex];
    if (!rawId) {
      continue;
    }
    const id = Number(rawId);
    if (Number.isFinite(id)) {
      ids.add(String(id));
    }
  }

  return ids;
}

function loadWpPosts(postsCsvPath, ids) {
  const raw = fs.readFileSync(postsCsvPath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    throw new Error(`Empty posts file: ${postsCsvPath}`);
  }

  const header = rows[0];
  if (header[0]) {
    header[0] = header[0].replace(/^\uFEFF/, "");
  }
  const idIndex = header.indexOf("ID");
  const postTypeIndex = header.indexOf("post_type");
  const nameIndex = header.indexOf("post_name");
  const excerptIndex = header.indexOf("post_excerpt");
  const contentIndex = header.indexOf("post_content");

  if ([idIndex, postTypeIndex, nameIndex, excerptIndex, contentIndex].some((idx) => idx === -1)) {
    throw new Error("Missing required columns in wp_posts.csv.");
  }

  const byId = new Map();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const id = row[idIndex];
    if (!id || !ids.has(String(id))) {
      continue;
    }
    if (row[postTypeIndex] !== "product") {
      continue;
    }

    byId.set(String(id), {
      post_name: row[nameIndex] || "",
      post_excerpt: row[excerptIndex] || "",
      post_content: row[contentIndex] || "",
    });
  }

  return byId;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    loadDotEnv(path.join(__dirname, "..", ".env"));
  }

  const exportCsvPath = resolvePath(process.argv[2] || DEFAULT_EXPORT);
  const postsCsvPath = resolvePath(process.argv[3] || DEFAULT_POSTS);

  const ids = loadIdSet(exportCsvPath);
  if (ids.size === 0) {
    throw new Error("No product IDs found in export CSV.");
  }

  const wpById = loadWpPosts(postsCsvPath, ids);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  const targetIds = Array.from(ids).map((id) => Number(id)).filter((id) => Number.isFinite(id));
  const products = await prisma.product.findMany({
    where: {
      wpProductId: { in: targetIds },
    },
    select: {
      id: true,
      wpProductId: true,
      slug: true,
    },
  });

  const missingWp = [];
  const missingLocal = [];
  const updated = [];

  const localByWpId = new Map(products.map((product) => [String(product.wpProductId), product]));

  for (const id of ids) {
    if (!localByWpId.has(String(id))) {
      missingLocal.push(id);
    }
  }

  for (const product of products) {
    const wp = wpById.get(String(product.wpProductId));
    if (!wp) {
      missingWp.push(String(product.wpProductId));
      continue;
    }

    const nextSlug = toOptionalText(wp.post_name);
    if (!nextSlug) {
      missingWp.push(String(product.wpProductId));
      continue;
    }

    const excerpt = toOptionalText(wp.post_excerpt);
    const description = toOptionalText(wp.post_content);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        slug: nextSlug,
        excerpt,
        description,
      },
    });

    updated.push({
      wpProductId: product.wpProductId,
      slug: nextSlug,
    });
  }

  await prisma.$disconnect();
  await pool.end();

  console.log(`Updated products: ${updated.length}`);
  if (missingLocal.length > 0) {
    console.log(`Missing local products for wpProductId: ${missingLocal.join(", ")}`);
  }
  if (missingWp.length > 0) {
    console.log(`Missing wp_posts rows for wpProductId: ${missingWp.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
