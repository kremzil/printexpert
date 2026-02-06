const fs = require("fs");
const path = require("path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("../lib/generated/prisma/client");

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 200);

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

const allowedTags = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "del",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "hr",
  "mark",
  "span",
  "img",
  "iframe",
  "video",
  "a",
]);

const allowedIframeHosts = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
]);

const stripUnsafeTags = (input) =>
  input.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi, "");

const hasUnsafeAttributeChars = (value) =>
  /["'<>\\\u0000-\u001F\u007F]/.test(value);

const stripUrlHashAndQuery = (value) => value.split(/[?#]/)[0] ?? value;

const hasSvgExtension = (value) => {
  const target = stripUrlHashAndQuery(value).trim().toLowerCase();
  return target.endsWith(".svg") || target.endsWith(".svgz");
};

const parseHttpsUrl = (raw) => {
  if (!raw || hasUnsafeAttributeChars(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
};

const isAllowedIframeUrl = (url) => {
  const hostname = url.hostname.toLowerCase();
  if (!allowedIframeHosts.has(hostname)) return false;

  if (
    hostname === "www.youtube.com" ||
    hostname === "youtube.com" ||
    hostname === "www.youtube-nocookie.com" ||
    hostname === "youtube-nocookie.com"
  ) {
    return url.pathname.startsWith("/embed/");
  }

  if (hostname === "player.vimeo.com") {
    return url.pathname.startsWith("/video/");
  }

  return false;
};

const isSafeCssValue = (value) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("url(") || normalized.includes("expression(")) {
    return false;
  }
  return /^[#a-z0-9(),.%\s-]+$/i.test(normalized);
};

const filterStyle = (tagName, rawStyle) => {
  const rules = rawStyle.split(";");
  const allowedProps = new Set();

  if (["p", "h2", "h3", "blockquote", "ul", "ol", "li"].includes(tagName)) {
    allowedProps.add("text-align");
  }
  if (["span", "mark"].includes(tagName)) {
    allowedProps.add("color");
    allowedProps.add("background-color");
  }

  const kept = rules
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [prop, ...rest] = rule.split(":");
      if (!prop || rest.length === 0) return null;
      const name = prop.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (!allowedProps.has(name)) return null;
      if (!isSafeCssValue(value)) return null;
      return `${name}: ${value}`;
    })
    .filter((rule) => Boolean(rule));

  return kept.length ? kept.join("; ") : "";
};

const sanitizeTag = (fullMatch, tagNameRaw, attrsRaw) => {
  const tagName = tagNameRaw.toLowerCase();
  const isClosing = fullMatch.startsWith("</");

  if (!allowedTags.has(tagName)) {
    return "";
  }

  if (isClosing) {
    return `</${tagName}>`;
  }

  if (tagName === "img") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i);
    const altMatch =
      attrsRaw.match(/\salt\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\salt\s*=\s*'([^']*)'/i);
    const titleMatch =
      attrsRaw.match(/\stitle\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\stitle\s*=\s*'([^']*)'/i);
    const rawSrc = srcMatch ? srcMatch[1].trim() : "";
    if (!rawSrc || hasUnsafeAttributeChars(rawSrc)) {
      return "";
    }

    if (hasSvgExtension(rawSrc)) {
      return "";
    }

    if (rawSrc.startsWith("/uploads/")) {
      // keep
    } else if (parseHttpsUrl(rawSrc)) {
      // keep
    } else {
      return "";
    }
    const alt = altMatch ? altMatch[1] : "";
    const title = titleMatch ? titleMatch[1] : "";
    return `<img src="${rawSrc}"${alt ? ` alt="${alt}"` : ""}${
      title ? ` title="${title}"` : ""
    } />`;
  }

  if (tagName === "video") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i);
    const rawSrc = srcMatch ? srcMatch[1].trim() : "";
    if (!rawSrc || hasUnsafeAttributeChars(rawSrc)) {
      return "";
    }
    if (rawSrc.startsWith("/uploads/")) {
      // keep
    } else if (parseHttpsUrl(rawSrc)) {
      // keep
    } else {
      return "";
    }
    return `<video src="${rawSrc}" controls></video>`;
  }

  if (tagName === "iframe") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i);
    const titleMatch =
      attrsRaw.match(/\stitle\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\stitle\s*=\s*'([^']*)'/i);
    const allowFullscreen =
      /allowfullscreen/i.test(attrsRaw) || /allowFullScreen/i.test(attrsRaw);
    const rawSrc = srcMatch ? srcMatch[1].trim() : "";

    const parsedUrl = parseHttpsUrl(rawSrc);
    if (!parsedUrl || !isAllowedIframeUrl(parsedUrl)) {
      return "";
    }
    const title = titleMatch ? titleMatch[1] : "Video";
    return `<iframe src="${parsedUrl.toString()}" title="${title}"${
      allowFullscreen ? " allowfullscreen" : ""
    }></iframe>`;
  }

  if (tagName !== "a") {
    const styleMatch =
      attrsRaw.match(/\sstyle\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\sstyle\s*=\s*'([^']+)'/i);
    const styleValue = styleMatch ? filterStyle(tagName, styleMatch[1]) : "";
    return styleValue ? `<${tagName} style="${styleValue}">` : `<${tagName}>`;
  }

  const hrefMatch =
    attrsRaw.match(/\shref\s*=\s*"([^"]+)"/i) ||
    attrsRaw.match(/\shref\s*=\s*'([^']+)'/i) ||
    attrsRaw.match(/\shref\s*=\s*([^\s>]+)/i);

  const rawHref = hrefMatch ? hrefMatch[1].trim() : "";
  const parsedHref = parseHttpsUrl(rawHref);
  if (!parsedHref) {
    return "<a>";
  }

  return `<a href="${parsedHref.toString()}">`;
};

const sanitizeHtml = (input) => {
  const withoutUnsafe = stripUnsafeTags(input);
  return withoutUnsafe.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, sanitizeTag);
};

const sanitizeToNullable = (value) => {
  if (value === null || value === undefined) return null;
  const sanitized = sanitizeHtml(String(value)).trim();
  return sanitized.length > 0 ? sanitized : null;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    loadDotEnv(path.join(__dirname, "..", ".env"));
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  let cursor = null;
  let total = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const products = await prisma.product.findMany({
      take: BATCH_SIZE,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        description: true,
        excerpt: true,
      },
    });

    if (products.length === 0) {
      break;
    }

    for (const product of products) {
      total += 1;
      const nextDescription = sanitizeToNullable(product.description);
      const nextExcerpt = sanitizeToNullable(product.excerpt);
      const descriptionChanged = nextDescription !== product.description;
      const excerptChanged = nextExcerpt !== product.excerpt;

      if (!descriptionChanged && !excerptChanged) {
        skipped += 1;
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: {
          description: nextDescription,
          excerpt: nextExcerpt,
        },
      });

      updated += 1;
    }

    cursor = products[products.length - 1].id;
    console.log(`Processed ${total}... updated ${updated}, skipped ${skipped}`);
  }

  await prisma.$disconnect();
  await pool.end();

  console.log(`Done. total=${total}, updated=${updated}, skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
