import "server-only"

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
])

const stripUnsafeTags = (input: string) =>
  input.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi, "")

const isSafeCssValue = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.includes("url(") || normalized.includes("expression(")) {
    return false
  }
  return /^[#a-z0-9(),.%\s-]+$/i.test(normalized)
}

const filterStyle = (tagName: string, rawStyle: string) => {
  const rules = rawStyle.split(";")
  const allowedProps = new Set<string>()

  if (["p", "h2", "h3", "blockquote", "ul", "ol", "li"].includes(tagName)) {
    allowedProps.add("text-align")
  }
  if (["span", "mark"].includes(tagName)) {
    allowedProps.add("color")
    allowedProps.add("background-color")
  }

  const kept = rules
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [prop, ...rest] = rule.split(":")
      if (!prop || rest.length === 0) return null
      const name = prop.trim().toLowerCase()
      const value = rest.join(":").trim()
      if (!allowedProps.has(name)) return null
      if (!isSafeCssValue(value)) return null
      return `${name}: ${value}`
    })
    .filter((rule): rule is string => Boolean(rule))

  return kept.length ? kept.join("; ") : ""
}

const sanitizeTag = (fullMatch: string, tagNameRaw: string, attrsRaw: string) => {
  const tagName = tagNameRaw.toLowerCase()
  const isClosing = fullMatch.startsWith("</")

  if (!allowedTags.has(tagName)) {
    return ""
  }

  if (isClosing) {
    return `</${tagName}>`
  }

  if (tagName === "img") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i)
    const altMatch =
      attrsRaw.match(/\salt\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\salt\s*=\s*'([^']*)'/i)
    const titleMatch =
      attrsRaw.match(/\stitle\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\stitle\s*=\s*'([^']*)'/i)
    const rawSrc = srcMatch ? srcMatch[1].trim() : ""
    if (!/^https:\/\//i.test(rawSrc) && !rawSrc.startsWith("/uploads/")) {
      return ""
    }
    const alt = altMatch ? altMatch[1] : ""
    const title = titleMatch ? titleMatch[1] : ""
    return `<img src="${rawSrc}"${alt ? ` alt="${alt}"` : ""}${
      title ? ` title="${title}"` : ""
    } />`
  }

  if (tagName === "video") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i)
    const rawSrc = srcMatch ? srcMatch[1].trim() : ""
    if (!/^https:\/\//i.test(rawSrc) && !rawSrc.startsWith("/uploads/")) {
      return ""
    }
    return `<video src="${rawSrc}" controls></video>`
  }

  if (tagName === "iframe") {
    const srcMatch =
      attrsRaw.match(/\ssrc\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\ssrc\s*=\s*'([^']+)'/i) ||
      attrsRaw.match(/\ssrc\s*=\s*([^\s>]+)/i)
    const titleMatch =
      attrsRaw.match(/\stitle\s*=\s*"([^"]*)"/i) ||
      attrsRaw.match(/\stitle\s*=\s*'([^']*)'/i)
    const allowFullscreen =
      /allowfullscreen/i.test(attrsRaw) || /allowFullScreen/i.test(attrsRaw)
    const rawSrc = srcMatch ? srcMatch[1].trim() : ""
    if (!/^https:\/\//i.test(rawSrc) && !rawSrc.startsWith("/uploads/")) {
      return ""
    }
    const title = titleMatch ? titleMatch[1] : "Video"
    return `<iframe src="${rawSrc}" title="${title}"${
      allowFullscreen ? " allowfullscreen" : ""
    }></iframe>`
  }

  if (tagName !== "a") {
    const styleMatch =
      attrsRaw.match(/\sstyle\s*=\s*"([^"]+)"/i) ||
      attrsRaw.match(/\sstyle\s*=\s*'([^']+)'/i)
    const styleValue = styleMatch ? filterStyle(tagName, styleMatch[1]) : ""
    return styleValue ? `<${tagName} style="${styleValue}">` : `<${tagName}>`
  }

  const hrefMatch =
    attrsRaw.match(/\shref\s*=\s*"([^"]+)"/i) ||
    attrsRaw.match(/\shref\s*=\s*'([^']+)'/i) ||
    attrsRaw.match(/\shref\s*=\s*([^\s>]+)/i)

  const rawHref = hrefMatch ? hrefMatch[1].trim() : ""
  if (!/^https:\/\//i.test(rawHref)) {
    return "<a>"
  }

  return `<a href="${rawHref}">`
}

// Sanitizujeme HTML pre popis produktu ešte na serveri.
export const sanitizeHtml = (input: string) => {
  const withoutUnsafe = stripUnsafeTags(input)
  return withoutUnsafe.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    sanitizeTag
  )
}
