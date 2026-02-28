const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");

function parseArgs(argv) {
  const args = {
    envFile: ".env.production",
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--env-file") {
      args.envFile = argv[i + 1] || args.envFile;
      i += 1;
      continue;
    }
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getCdnBaseUrl() {
  const value =
    process.env.PRODUCTS_CDN_BASE_URL ||
    process.env.NEXT_PUBLIC_PRODUCTS_CDN_BASE_URL ||
    "";
  return value.trim().replace(/\/+$/, "");
}

function normalizeRelPath(value) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function mimeFromExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function walkFiles(dir, acc = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, acc);
    } else if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putObjectWithRetry(client, params, maxAttempts = 6) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.send(new PutObjectCommand(params));
      return;
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const isRetryable =
        message.includes("ENOTFOUND") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT") ||
        message.includes("EAI_AGAIN") ||
        message.includes("NetworkingError");

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(15000, 500 * 2 ** (attempt - 1));
      console.warn(
        `Retryable S3 error (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function extractProductsKeyFromUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return null;

  if (value.startsWith("/products/")) {
    return normalizeRelPath(value);
  }
  if (value.startsWith("products/")) {
    return normalizeRelPath(value);
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/products/")) {
      return normalizeRelPath(parsed.pathname);
    }
  } catch (_) {
    return null;
  }

  return null;
}

function buildCdnUrl(cdnBaseUrl, objectKey) {
  return `${cdnBaseUrl}/${normalizeRelPath(objectKey)}`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  dotenv.config({ path: args.envFile, override: true });

  const databaseUrl = requireEnv("DATABASE_URL");
  const bucket = requireEnv("S3_BUCKET");
  const region = requireEnv("S3_REGION");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");
  const endpoint = (process.env.S3_ENDPOINT || "").trim() || undefined;
  const cdnBaseUrl = getCdnBaseUrl();

  if (!cdnBaseUrl) {
    throw new Error(
      "Missing PRODUCTS_CDN_BASE_URL or NEXT_PUBLIC_PRODUCTS_CDN_BASE_URL"
    );
  }

  const publicProductsDir = path.join(process.cwd(), "public", "products");
  const hasProductsDir = fs.existsSync(publicProductsDir);
  if (!hasProductsDir) {
    throw new Error(`Products directory not found: ${publicProductsDir}`);
  }

  const allFiles = await walkFiles(publicProductsDir);
  const fileMap = new Map();
  for (const filePath of allFiles) {
    const relFromPublic = normalizeRelPath(
      path.relative(path.join(process.cwd(), "public"), filePath)
    );
    fileMap.set(relFromPublic, filePath);
  }

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    const productImages = await prisma.productImage.findMany({
      select: { id: true, url: true },
    });

    const dbCandidates = [];
    const dbMissingFiles = [];
    let alreadyCdn = 0;

    for (const image of productImages) {
      const key = extractProductsKeyFromUrl(image.url);
      if (!key) continue;

      const expectedCdnUrl = buildCdnUrl(cdnBaseUrl, key);
      if (String(image.url).trim() === expectedCdnUrl) {
        alreadyCdn += 1;
        continue;
      }

      if (!fileMap.has(key)) {
        dbMissingFiles.push({ id: image.id, url: image.url, key });
        continue;
      }

      dbCandidates.push({ id: image.id, from: image.url, to: expectedCdnUrl, key });
    }

    console.log(`Mode: ${args.apply ? "APPLY" : "DRY-RUN"}`);
    console.log(`Env file: ${args.envFile}`);
    console.log(`S3 bucket: ${bucket}`);
    console.log(`CDN base: ${cdnBaseUrl}`);
    console.log(`Local files under public/products: ${fileMap.size}`);
    console.log(`ProductImage rows total: ${productImages.length}`);
    console.log(`Already CDN URLs: ${alreadyCdn}`);
    console.log(`DB rows to update: ${dbCandidates.length}`);
    console.log(`DB rows with missing local file: ${dbMissingFiles.length}`);

    const keysToUpload = new Set(
      dbCandidates.map((item) => item.key).filter((key) => fileMap.has(key))
    );
    console.log(`S3 objects to upload: ${keysToUpload.size}`);

    if (!args.apply) {
      if (dbMissingFiles.length > 0) {
        console.log("Sample missing files (max 10):");
        dbMissingFiles.slice(0, 10).forEach((item) => {
          console.log(`- ${item.id} | ${item.key} | ${item.url}`);
        });
      }
      return;
    }

    let uploaded = 0;
    for (const key of keysToUpload) {
      const fullPath = fileMap.get(key);
      const body = await fs.promises.readFile(fullPath);
      await putObjectWithRetry(s3, {
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mimeFromExt(key),
          CacheControl: "public, max-age=31536000, immutable",
        });
      uploaded += 1;
      if (uploaded % 100 === 0) {
        console.log(`Uploaded ${uploaded}/${keysToUpload.size}`);
      }
    }

    let updated = 0;
    for (const candidate of dbCandidates) {
      await prisma.productImage.update({
        where: { id: candidate.id },
        data: { url: candidate.to },
      });
      updated += 1;
      if (updated % 200 === 0) {
        console.log(`Updated DB rows ${updated}/${dbCandidates.length}`);
      }
    }

    console.log("Migration completed.");
    console.log(`Uploaded objects: ${uploaded}`);
    console.log(`Updated DB rows: ${updated}`);
    if (dbMissingFiles.length > 0) {
      console.log(`Skipped missing file rows: ${dbMissingFiles.length}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
