/**
 * Email layout and template helpers for transactional emails.
 *
 * Uses inline CSS (the only reliable approach for email clients).
 * Zero extra dependencies — just string concatenation.
 *
 * Design: clean, professional, mobile-friendly (max-width + 100%).
 */

/* ── Brand constants ── */

const BRAND = {
  name: "Print Expert",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk",
  email: "info@printexpert.sk",
  phone: "+421 917 545 003",
  color: {
    primary: "#030213",
    accent: "#E74C3C",
    bg: "#f5f5f7",
    cardBg: "#ffffff",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    success: "#10B981",
    warning: "#F59E0B",
  },
} as const

/* ── Shared styles ── */

const reset = `
  margin: 0; padding: 0;
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
`

const fontStack =
  "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/* ── Layout wrapper ── */

export function emailLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="sk" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND.name}</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="${reset} background-color:${BRAND.color.bg}; font-family:${fontStack}; color:${BRAND.color.text}; line-height:1.6;">
  ${preheader ? `<div style="display:none;font-size:1px;color:${BRAND.color.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.color.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Main card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:${BRAND.color.cardBg}; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.color.primary}; padding:24px 32px; text-align:center;">
              <a href="${BRAND.url}" style="text-decoration:none;">
                <span style="font-family:${fontStack}; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">${BRAND.name}</span>
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid ${BRAND.color.border}; text-align:center;">
              <p style="margin:0 0 8px; font-size:13px; color:${BRAND.color.textMuted};">
                ${BRAND.name} &middot; ${BRAND.email} &middot; ${BRAND.phone}
              </p>
              <p style="margin:0; font-size:12px; color:${BRAND.color.textMuted};">
                <a href="${BRAND.url}" style="color:${BRAND.color.textMuted}; text-decoration:underline;">${BRAND.url.replace("https://", "")}</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

/* ── Reusable components ── */

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px; font-size:22px; font-weight:600; color:${BRAND.color.primary}; line-height:1.3;">${text}</h1>`
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${BRAND.color.text}; line-height:1.6;">${text}</p>`
}

export function greeting(name: string): string {
  return paragraph(`Dobrý deň${name ? ` ${name}` : ""},`)
}

export function signoff(): string {
  return `
    <p style="margin:24px 0 0; font-size:15px; color:${BRAND.color.text}; line-height:1.6;">
      Ďakujeme za dôveru.<br/>
      <strong>${BRAND.name}</strong>
    </p>`
}

export function badge(label: string, color: string, bgColor: string): string {
  return `<span style="display:inline-block; padding:4px 12px; font-size:13px; font-weight:600; color:${color}; background-color:${bgColor}; border-radius:6px;">${label}</span>`
}

export function button(text: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background-color:${BRAND.color.primary}; border-radius:8px;">
          <a href="${href}" style="display:inline-block; padding:12px 28px; font-family:${fontStack}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`
}

export function divider(): string {
  return `<hr style="margin:24px 0; border:none; border-top:1px solid ${BRAND.color.border};" />`
}

export function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0; font-size:14px; color:${BRAND.color.textMuted}; white-space:nowrap; vertical-align:top;">${label}</td>
      <td style="padding:6px 0; font-size:14px; color:${BRAND.color.text}; font-weight:500;">${value}</td>
    </tr>`
}

export function infoTable(rows: [string, string][]): string {
  const body = rows.map(([label, value]) => infoRow(label, value)).join("")
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${body}
    </table>`
}

export function orderItemsTable(
  items: { name: string; quantity: number; total: string }[]
): string {
  const headerStyle = `padding:10px 12px; font-size:13px; font-weight:600; color:${BRAND.color.textMuted}; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid ${BRAND.color.border};`
  const cellStyle = `padding:12px; font-size:14px; color:${BRAND.color.text}; border-bottom:1px solid ${BRAND.color.border};`

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="${cellStyle}">${item.name}</td>
        <td style="${cellStyle} text-align:center;">${item.quantity}</td>
        <td style="${cellStyle} text-align:right; font-weight:500;">${item.total}</td>
      </tr>`
    )
    .join("")

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="${headerStyle} text-align:left;">Produkt</th>
          <th style="${headerStyle} text-align:center;">Ks</th>
          <th style="${headerStyle} text-align:right;">Cena</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`
}

export function totalsBlock(lines: [string, string, boolean?][]): string {
  const rows = lines
    .map(([label, value, isBold]) => {
      const style = isBold
        ? `font-size:16px; font-weight:700; color:${BRAND.color.primary};`
        : `font-size:14px; color:${BRAND.color.text};`
      return `
        <tr>
          <td style="padding:4px 0; ${style}">${label}</td>
          <td style="padding:4px 0; text-align:right; ${style}">${value}</td>
        </tr>`
    })
    .join("")

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      ${rows}
    </table>`
}

export function sectionTitle(text: string): string {
  return `<p style="margin:24px 0 8px; font-size:14px; font-weight:600; color:${BRAND.color.primary}; text-transform:uppercase; letter-spacing:0.5px;">${text}</p>`
}

export function addressBlock(label: string, address: string | null): string {
  if (!address) return ""
  return `
    <div style="margin:12px 0; padding:12px 16px; background-color:${BRAND.color.bg}; border-radius:8px;">
      <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${BRAND.color.textMuted}; text-transform:uppercase; letter-spacing:0.5px;">${label}</p>
      <p style="margin:0; font-size:14px; color:${BRAND.color.text};">${address}</p>
    </div>`
}

export { BRAND }
