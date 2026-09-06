// SIGNAL collector — orchestrator.
// Usage: node collector/run.mjs   (run from the repo root; writes ./jobs.json)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { collectWorkday } from "./adapters/workday.mjs";
import { collectGreenhouse, collectLever, collectSmartRecruiters } from "./adapters/boards.mjs";
import { normalise, merge } from "./normalise.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const ADAPTERS = {
  workday: collectWorkday,
  greenhouse: collectGreenhouse,
  lever: collectLever,
  smartrecruiters: collectSmartRecruiters,
};

async function main() {
  const cfg = JSON.parse(await readFile(join(here, "sources.json"), "utf8"));
  const manualFile = JSON.parse(await readFile(join(here, "manual.json"), "utf8"));

  const report = { ran: [], skipped: [], failed: [], collected: 0 };
  const rawCollected = [];

  for (const src of cfg.sources) {
    if (src.enabled === false || !ADAPTERS[src.adapter]) {
      report.skipped.push(`${src.employer} (${src.adapter}/${src.confidence || "?"})`);
      continue;
    }
    try {
      const rows = await ADAPTERS[src.adapter](src);
      rawCollected.push(...rows);
      report.ran.push(`${src.employer}: ${rows.length}`);
    } catch (e) {
      report.failed.push(`${src.employer}: ${e.message}`);
    }
  }

  const collected = rawCollected.map(normalise).filter(Boolean);
  report.collected = collected.length;

  const manual = (manualFile.jobs || []);
  const jobs = merge(collected, manual);

  // Sort: live listings first (open, then closing), watch rows last; then by employer.
  const rank = { closing: 0, open: 1, watch: 2 };
  jobs.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.employer.localeCompare(b.employer));

  const out = { updated: new Date().toISOString().slice(0, 10), jobs };
  await writeFile(join(repoRoot, "jobs.json"), JSON.stringify(out, null, 2) + "\n");

  console.log("── SIGNAL collector run ─────────────────────────");
  console.log("Ran:     ", report.ran.join(" | ") || "(none)");
  console.log("Skipped: ", report.skipped.join(" | ") || "(none)");
  console.log("Failed:  ", report.failed.join(" | ") || "(none)");
  console.log(`Total written: ${jobs.length} (${report.collected} auto + ${manual.length} manual, deduped)`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
