// QA crawler: visits every reachable internal page (plus create/edit modals) for each role at
// desktop and phone sizes, and reports HTTP errors, page/console errors, error states and
// horizontal overflow.   BASE=http://localhost:3000 node tests/e2e/crawl.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "TaxPro@2026";
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
const problems = [];

const EXTRA = ["/clients?new=1", "/tasks?new=1", "/compliance?new=1", "/compliance?bulk=1", "/payments?new=1", "/documents?new=1", "/documents?upload=1", "/notices?new=1", "/dsc?new=1", "/calendar?new=1", "/team?new=1", "/billing/recurring?new=1", "/calendar?view=week", "/calendar?view=day", "/tasks?view=team", "/settings?type=new"];

async function crawl(email, label, viewport, maxPages) {
  const ctx = await browser.newContext(viewport.mobile ? { viewport: { width: Number(process.env.WIDTH ?? 390), height: 800 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let current = "";
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror on ${current}: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text())) problems.push(`[${label}] console on ${current}: ${m.text().slice(0, 160)}`);
  });
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click("button[type=submit]")]);
  const start = new URL(page.url()).pathname;
  const queue = [start, ...(email.includes("client") ? [] : EXTRA)];
  const seen = new Set();
  let visited = 0;
  while (queue.length && visited < maxPages) {
    const path = queue.shift();
    const key = path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").replace(/([?&](page|date|month|q|edit|checklist|event|client|invoice)=)[^&]+/g, "$1*");
    if (seen.has(key)) continue;
    seen.add(key);
    current = path;
    visited++;
    let res;
    try {
      res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      problems.push(`[${label}] timeout ${path}`);
      continue;
    }
    const status = res?.status() ?? 0;
    if (status >= 400) problems.push(`[${label}] HTTP ${status} ${path}`);
    const info = await page.evaluate(() => {
      // Measure real overflow: switch off the html/body overflow-x safety net first.
      document.documentElement.style.overflowX = document.body.style.overflowX = "visible";
      const vw = document.documentElement.clientWidth;
      const text = document.body.innerText;
      const links = [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href"));
      return { overflow: document.documentElement.scrollWidth - vw, errorState: /Something went wrong|Record not found|Application error/.test(text), forbidden: /Access restricted/.test(text), links };
    });
    if (info.overflow > 1) problems.push(`[${label}] horizontal overflow ${info.overflow}px on ${path}`);
    if (info.errorState) problems.push(`[${label}] error state shown on ${path}`);
    for (const l of info.links) if (!l.startsWith("/api/") && !seen.has(l)) queue.push(l);
  }
  await ctx.close();
  return visited;
}

const runs = [
  ["varinder@taxpro.demo", "admin-desktop", {}, 160],
  ["varinder@taxpro.demo", "admin-phone", { mobile: true }, 160],
  ["amit@taxpro.demo", "junior-phone", { mobile: true }, 60],
  ["pooja@taxpro.demo", "billing-desktop", {}, 60],
  ["abc@client.demo", "client-phone", { mobile: true }, 30],
];
const only = process.env.RUN;
for (const [email, label, vp, max] of runs.filter((r) => !only || r[1] === only)) {
  const n = await crawl(email, label, vp, max);
  console.log(`${label}: ${n} pages`);
}
await browser.close();
const uniq = [...new Set(problems)];
console.log(uniq.length ? `\n${uniq.length} problem(s):\n` + uniq.join("\n") : "\nNo problems found");
process.exit(uniq.length ? 1 : 0);
