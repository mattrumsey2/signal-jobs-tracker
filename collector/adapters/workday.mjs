// Generic Workday adapter.
// Uses the public CXS endpoints every Workday tenant exposes:
//   list:   POST {origin}/wday/cxs/{tenant}/{site}/jobs
//   detail: GET  {origin}/wday/cxs/{tenant}/{site}{externalPath}
// No auth, no scraping — this is the candidate-facing JSON the careers page itself calls.

import { sleep, classifyRole, isSport, stripHtml } from "../lib/util.mjs";

const UA = "SIGNAL-jobs-collector/1.0 (+contact: set in repo README)";

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Workday list ${r.status} ${url}`);
  return r.json();
}
async function get(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!r.ok) throw new Error(`Workday detail ${r.status} ${url}`);
  return r.json();
}

export async function collectWorkday(src) {
  const { tenant, dc, site } = src;
  const origin = `https://${tenant}.${dc}.myworkdayjobs.com`;
  const listUrl = `${origin}/wday/cxs/${tenant}/${site}/jobs`;
  const terms = src.searchTerms && src.searchTerms.length ? src.searchTerms : [""];

  // 1) Page the list for each search term, collect unique postings.
  const seen = new Map(); // externalPath -> {title, locationsText, postedOn}
  for (const term of terms) {
    let offset = 0;
    const limit = 20;
    const cap = src.maxList ?? 200;
    while (offset < cap) {
      let page;
      try {
        page = await post(listUrl, { appliedFacets: {}, limit, offset, searchText: term });
      } catch (e) {
        console.warn(`  · ${src.employer}: list term "${term}" @${offset} failed — ${e.message}`);
        break;
      }
      const posts = page.jobPostings || [];
      for (const p of posts) {
        if (p.externalPath && !seen.has(p.externalPath)) {
          seen.set(p.externalPath, {
            title: p.title || "",
            locationsText: p.locationsText || "",
            postedOn: p.postedOn || "",
          });
        }
      }
      const total = page.total ?? 0;
      offset += limit;
      if (offset >= total || posts.length === 0) break;
      await sleep(250);
    }
  }

  // 2) Pre-filter by title so we only fetch detail for plausible on-air/producer roles.
  const candidates = [...seen.entries()].filter(([, v]) => classifyRole(v.title));

  // 3) Fetch detail (description + close date) for candidates, honouring the sport filter.
  const jobs = [];
  const detailCap = src.maxDetail ?? 80;
  let fetched = 0;
  for (const [externalPath, v] of candidates) {
    if (fetched >= detailCap) break;
    fetched++;
    let info = {};
    try {
      const detail = await get(`${origin}/wday/cxs/${tenant}/${site}${externalPath}`);
      info = detail.jobPostingInfo || {};
    } catch (e) {
      console.warn(`  · ${src.employer}: detail failed ${externalPath} — ${e.message}`);
    }
    await sleep(200);

    const title = info.title || v.title;
    const description = info.jobDescription || "";
    const haystack = `${title} ${description}`;
    if (!src.alwaysSport && !isSport(haystack)) continue; // news orgs: keep only sport roles

    const applyUrl =
      info.externalUrl || `${origin}/en-US/${site}${externalPath}`;

    jobs.push({
      role: title,
      employer: src.employer,
      site: src.brandSite || origin,
      location: info.location || v.locationsText || "",
      type: info.timeType || "",
      requirements: stripHtml(description) || v.title,
      ad_url: applyUrl,
      source: `${src.employer} · Workday`,
      posted: info.startDate || v.postedOn || "",
      closes: info.endDate || "",
      _rawTitle: title,
    });
  }

  return jobs;
}
