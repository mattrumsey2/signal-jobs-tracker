# SIGNAL — Build Spec & Handoff

A shared, filterable, auto-updating board of English-language sports-TV jobs worldwide
(presenters, reporters, anchors, MMJs, producers). This document is the handoff for making
the prototype (`index.html`) live and self-refreshing. It is written to be handed to Claude
Code, which can create the repo, wire the scheduled collector, and deploy — none of which a
chat session can do.

---

## 1. What already works

`index.html` is a standalone, dependency-free front end. It:

- Renders a `{ updated, jobs[] }` data object as a filterable "live board".
- Tries to `fetch('jobs.json')` first (hosted mode); falls back to data embedded in the page
  (standalone mode) if the file isn't present. **This is the seam the automation plugs into.**
- Filters by role category and region, free-text searches every field, and expands each row to
  show full requirements + all contact fields + advert/broadcaster links.
- Is responsive, keyboard-accessible, and respects reduced-motion.

To go live you only need to (a) produce `jobs.json` on a schedule and (b) host both files.

## 2. Data schema (`jobs.json`)

```json
{
  "updated": "2026-08-19",
  "jobs": [
    {
      "id": "unique-slug",
      "role": "Studio Reporter (×2)",
      "sub": "one-line role summary",
      "employer": "Sky Sports News",
      "site": "https://careers.sky.com",
      "location": "Isleworth, London",
      "region": "UK & Europe | United States | Middle East | Asia-Pacific | Africa | Global",
      "type": "Full-time | Freelance | Contract | Various",
      "category": "Presenter | Reporter | Anchor | MMJ | Producer",
      "status": "open | closing | watch",
      "requirements": "paraphrased summary of the advert",
      "contact_name": "",
      "contact_email": "",
      "contact_phone": "",
      "ad_url": "https://…",
      "source": "board or API the row came from",
      "posted": "Aug 2026",
      "closes": ""
    }
  ]
}
```

Rules the collector should honour:
- `status:"closing"` when a `closes` date is within ~7 days → row shows the red tally.
- `status:"watch"` for career-portal entries with no specific dated advert (excluded from the
  "live listings" count).
- `id` must be stable across runs (slug from employer+role+location) so rows don't churn.
- Contact fields stay empty unless the advert genuinely lists them — do not infer or invent.

## 3. Collection strategy (ranked by reliability)

**Tier 1 — official career-page APIs (use these first; clean JSON, no scraping, ToS-friendly).**
Most broadcasters run a standard ATS with a public board endpoint:
- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true`
- Lever: `https://api.lever.co/v0/postings/{company}?mode=json`
- Workday: each tenant exposes a `…/wday/cxs/{tenant}/{site}/jobs` POST endpoint (JSON body).
- Ashby / SmartRecruiters / Teamtailor have similar public JSON boards.
Task for Claude Code: identify the ATS for each target broadcaster (Sky, DAZN, Paramount/CBS,
NBCUniversal, Hearst, Sinclair, Gray, Tegna, Scripps, WBD/TNT, beIN, MultiChoice/SuperSport,
CNBC), then filter results to sport + on-air/producer keywords.

**Tier 2 — RSS / structured feeds.** Some job boards and station groups publish RSS. Parse and
map to the schema.

**Tier 3 — assisted/manual.** Aggregators like Indeed and LinkedIn **block scraping** (technical
+ ToS) and should not be crawled. For coverage there, add a lightweight admin path: a
`sources.md` or a small form that lets a human paste an advert URL; a parser fills the row.
Keep this out of the automated path.

> Legal note to surface to Matt: scraping Indeed/LinkedIn risks IP blocks and ToS breach.
> Sticking to Tier 1/2 keeps the whole thing durable and defensible. "Comprehensive" here means
> "every source we can pull cleanly," not "every advert on the open web."

## 4. Automation & hosting

Recommended, zero-cost, zero-server:

```
repo/
  index.html            # the front end (already built)
  jobs.json             # generated artifact, committed each run
  collector/            # Node or Python
    fetch_greenhouse.*
    fetch_lever.*
    fetch_workday.*
    normalise.*         # → schema, dedupe by id, set status from closes date
    sources.json        # list of {ats, company, filters} to poll
  .github/workflows/
    update.yml          # scheduled collector + commit
```

`update.yml` (sketch): `on: schedule: cron "0 6 * * *"` + `workflow_dispatch`; run the collector;
`git commit jobs.json` if changed. Deploy via **GitHub Pages** (Settings → Pages → deploy from
branch) or **Vercel** for a nicer URL. Either gives one shareable link that refreshes when
`jobs.json` changes. Add a private admin (basic auth or a separate unlisted repo) if the manual
paste path is used.

## 5. Nice-to-haves (later)

- Per-row "new since your last visit" marker (compare `id` set in memory — no browser storage).
- CSV / Google Sheets export for colleagues who prefer a sheet.
- Email/Slack digest of new rows via a second Action step.
- A `verified` date per row so stale listings can be auto-greyed after N days.

## 6. Caveats to keep visible on the page (already in the footer)

- Not exhaustive — national on-air seats are often filled by direct appointment, never advertised.
- Contact names/phones/emails are rare in TV adverts; most applications route through the ATS.
