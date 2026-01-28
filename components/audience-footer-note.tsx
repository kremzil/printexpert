import { cacheLife } from "next/cache"

import { resolveAudienceContext } from "@/lib/audience-context"

export async function AudienceFooterNote() {
  "use cache: private"
  cacheLife("minutes")
  const audienceContext = await resolveAudienceContext()
  const footerLabel =
    audienceContext.source === "default"
      ? "Režim: nevybraný"
      : audienceContext.audience === "b2b"
        ? "Režim: B2B"
        : "Režim: B2C"
  return <span>{footerLabel}</span>
}
