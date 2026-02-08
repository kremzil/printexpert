export type AudienceFilter = { showInB2b?: true; showInB2c?: true }

export function getAudienceFilter(audience?: string | null): AudienceFilter {
  if (audience === "b2b") {
    return { showInB2b: true }
  }
  if (audience === "b2c") {
    return { showInB2c: true }
  }
  return {}
}
