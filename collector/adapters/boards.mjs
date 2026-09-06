// Generic adapters for the other common public-JSON job boards.
// Each returns raw job objects mapped to a common shape; normalise.mjs does
// the role/sport filtering and final schema mapping.

import { isSport, classifyRole, stripHtml } from "../lib/util.mjs";

const UA = "SIGNAL-jobs-collector/1.0";
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

// ---- Greenhouse ----------------------------------------------------------
// https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
export async function collectGreenhouse(src) {
  const data = await getJSON(
    `https://boards-api.greenhouse.io/v1/boards/${src.token}/jobs?content=true`
  );
  const out = [];
  for (const j of data.jobs || []) {
    const title = j.title || "";
    if (!classifyRole(title)) continue;
    const content = (j.content || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    if (!src.alwaysSport && !isSport(`${title} ${content}`)) continue;
    out.push({
      role: title,
      employer: src.employer,
      site: src.brandSite || j.absolute_url,
      location: j.location?.name || "",
      type: "",
      requirements: stripHtml(content),
      ad_url: j.absolute_url,
      source: `${src.employer} · Greenhouse`,
      posted: j.updated_at || "",
      closes: "",
      _rawTitle: title,
    });
  }
  return out;
}

// ---- Lever ---------------------------------------------------------------
// https://api.lever.co/v0/postings/{token}?mode=json
export async function collectLever(src) {
  const data = await getJSON(`https://api.lever.co/v0/postings/${src.token}?mode=json`);
  const out = [];
  for (const j of data || []) {
    const title = j.text || "";
    if (!classifyRole(title)) continue;
    const desc = `${j.descriptionPlain || ""} ${(j.lists || []).map((l) => l.content).join(" ")}`;
    if (!src.alwaysSport && !isSport(`${title} ${desc}`)) continue;
    out.push({
      role: title,
      employer: src.employer,
      site: src.brandSite || j.hostedUrl,
      location: j.categories?.location || "",
      type: j.categories?.commitment || "",
      requirements: stripHtml(desc),
      ad_url: j.hostedUrl,
      source: `${src.employer} · Lever`,
      posted: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : "",
      closes: "",
      _rawTitle: title,
    });
  }
  return out;
}

// ---- SmartRecruiters -----------------------------------------------------
// https://api.smartrecruiters.com/v1/companies/{company}/postings
export async function collectSmartRecruiters(src) {
  const list = await getJSON(
    `https://api.smartrecruiters.com/v1/companies/${src.company}/postings?limit=100`
  );
  const out = [];
  for (const j of list.content || []) {
    const title = j.name || "";
    if (!classifyRole(title)) continue;
    // topic filter on title only (list endpoint has no full description)
    if (!src.alwaysSport && !isSport(title)) continue;
    const loc = [j.location?.city, j.location?.country].filter(Boolean).join(", ");
    out.push({
      role: title,
      employer: src.employer,
      site: src.brandSite || "",
      location: loc,
      type: j.typeOfEmployment?.label || "",
      requirements: j.jobAd?.sections?.jobDescription?.text
        ? stripHtml(j.jobAd.sections.jobDescription.text)
        : title,
      ad_url: `https://jobs.smartrecruiters.com/${src.company}/${j.id}`,
      source: `${src.employer} · SmartRecruiters`,
      posted: (j.releasedDate || "").slice(0, 10),
      closes: "",
      _rawTitle: title,
    });
  }
  return out;
}
