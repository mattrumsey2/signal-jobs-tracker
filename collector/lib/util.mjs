// Shared helpers for the SIGNAL collector.
// No external dependencies — Node 20+ (native fetch, ESM).

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function slug(...parts) {
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// ---- Role classification -------------------------------------------------
// Order matters: first match wins. Returns null if the title is not an
// on-air / production role we track (so it gets filtered out).
const ROLE_RULES = [
  [/\b(mmj|multi[-\s]?media journalist|multi[-\s]?skilled|photojournalist|video journalist)\b/i, "MMJ"],
  [/\b(anchor|newsreader|newscaster)\b/i, "Anchor"],
  [/\b(presenter|host|anchor\/presenter)\b/i, "Presenter"],
  [/\b(reporter|correspondent|journalist)\b/i, "Reporter"],
  [/\b(producer|editor|edit\b|line producer|output editor)\b/i, "Producer"],
];
export function classifyRole(title = "") {
  for (const [re, cat] of ROLE_RULES) if (re.test(title)) return cat;
  return null;
}

// ---- Topic (sport) filter ------------------------------------------------
const SPORT_RE =
  /\b(sport|sports|football|soccer|cricket|rugby|tennis|olympic|olympics|nba|nfl|nhl|mlb|golf|motorsport|motor sport|formula\s?1|f1|athletics|basketball|boxing|cycling|premier league|uefa|fifa|wimbledon|grand prix|esports)\b/i;
export function isSport(text = "") {
  return SPORT_RE.test(text);
}

// ---- Region bucketing ----------------------------------------------------
const REGION_MAP = [
  [/united states|u\.s\.a?\.?|\busa\b|new york|atlanta|los angeles|washington|chicago|miami|dallas|,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i, "United States"],
  [/united kingdom|england|london|scotland|wales|manchester|\bu\.?k\.?\b|isleworth/i, "UK & Europe"],
  [/germany|france|spain|italy|netherlands|belgium|ireland|portugal|poland|europe|paris|berlin|madrid/i, "UK & Europe"],
  [/qatar|doha|dubai|abu dhabi|saudi|riyadh|uae|united arab emirates|middle east|bahrain|kuwait/i, "Middle East"],
  [/singapore|india|hong kong|japan|australia|sydney|new zealand|malaysia|kuala lumpur|philippines|asia|pacific|tokyo/i, "Asia-Pacific"],
  [/south africa|johannesburg|nigeria|kenya|egypt|africa/i, "Africa"],
];
export function regionOf(locationText = "") {
  for (const [re, region] of REGION_MAP) if (re.test(locationText)) return region;
  return "Global";
}

// ---- Status from a close date -------------------------------------------
export function statusFrom(closesISO) {
  if (!closesISO) return "open";
  const closes = new Date(closesISO);
  if (isNaN(closes)) return "open";
  const days = (closes - new Date()) / 86400000;
  if (days < 0) return "expired";
  if (days <= 7) return "closing";
  return "open";
}

// Strip HTML to a plain, trimmed requirements summary.
export function stripHtml(html = "", max = 600) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}
