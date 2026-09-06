import { slug, classifyRole, regionOf, statusFrom } from "./lib/util.mjs";

// Turn a raw adapter job into a schema-clean row, or null to drop it.
export function normalise(raw) {
  const category = classifyRole(raw._rawTitle || raw.role || "");
  if (!category) return null;

  const location = raw.location || "";
  const status = statusFrom(raw.closes);
  if (status === "expired") return null;

  return {
    id: slug(raw.employer, raw.role, location),
    role: (raw.role || "").trim(),
    sub: "",
    employer: raw.employer,
    site: raw.site || "",
    location,
    region: regionOf(location),
    type: raw.type || "",
    category,
    status,
    requirements: raw.requirements || "",
    contact_name: raw.contact_name || "",
    contact_email: raw.contact_email || "",
    contact_phone: raw.contact_phone || "",
    ad_url: raw.ad_url || "",
    source: raw.source || "",
    posted: raw.posted || "",
    closes: raw.closes || "",
  };
}

// Merge collected + manual rows. Collected wins on id conflict, except a
// manual row flagged "pin": true always survives (used for portal-watch rows).
export function merge(collected, manual) {
  const byId = new Map();
  for (const j of manual) byId.set(j.id, j);
  for (const j of collected) {
    const existing = byId.get(j.id);
    if (existing && existing.pin) continue;
    byId.set(j.id, j);
  }
  return [...byId.values()].map(({ pin, ...j }) => j);
}
