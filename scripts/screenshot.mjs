// Usage: node scripts/screenshot.mjs <outDir> <path1> [path2...]   (env: BASE, EMAIL, MOBILE=1)
import { chromium } from "playwright";
import fs from "node:fs";
const [outDir, ...paths] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3100";
fs.mkdirSync(outDir, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const browser = await chromium.launch({ executablePath: exe });
const mobile = process.env.MOBILE === "1";
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
await page.goto(`${BASE}/login`);
await page.fill("#email", process.env.EMAIL ?? "varinder@taxpro.demo");
await page.fill("#password", "TaxPro@2026");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click("button[type=submit]")]);
for (const p of paths) {
  const res = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(300);
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.screenshot({ path: `${outDir}/${mobile ? "m_" : ""}${name}.png`, fullPage: process.env.FULL !== "0" });
  console.log(p, res?.status());
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
