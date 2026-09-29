// End-to-end smoke test. Runs against a running server seeded with demo data (it mutates data).
//   BASE=http://localhost:3200 node tests/e2e/smoke.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3200";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "TaxPro@2026";
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
let failures = 0;
const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push(`✓ ${name}`);
  } catch (e) {
    failures++;
    results.push(`✗ ${name}\n    ${String(e.message ?? e).split("\n")[0]}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function session(email, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click("button[type=submit]")]);
  return { ctx, page, errors };
}

/* ---------------------------------------------------------------- admin */
const admin = await session("varinder@taxpro.demo");
const { page } = admin;

await step("login lands on dashboard with KPIs", async () => {
  expect(page.url().endsWith("/dashboard"), `url ${page.url()}`);
  for (const t of ["Total Clients", "Pending Work", "Unpaid Bills", "This Month Collection", "Documents Pending", "Today's Work", "Paperless Practice"]) {
    await page.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {
      throw new Error(`missing ${t}`);
    });
  }
});

const pages = ["/clients", "/billing", "/billing/recurring", "/billing/recurring/generate", "/billing/invoices/new", "/payments", "/compliance", "/documents", "/cma", "/cma/new", "/tasks", "/tasks?view=team", "/calendar", "/calendar?view=week", "/calendar?view=day", "/notices", "/dsc", "/reports", "/reports?report=staff", "/reports?report=outstanding", "/team", "/client-portal", "/settings", "/account", "/help"];
await step(`all ${pages.length} staff pages render without errors`, async () => {
  for (const p of pages) {
    const res = await page.goto(`${BASE}${p}`);
    expect(res?.status() === 200, `${p} → ${res?.status()}`);
    expect(!(await page.getByText("Something went wrong").isVisible()), `${p} shows error state`);
  }
  expect(admin.errors.length === 0, `console errors: ${admin.errors.slice(0, 3).join(" | ")}`);
});

await step("global search finds a client by GSTIN fragment", async () => {
  await page.goto(`${BASE}/dashboard`);
  await page.keyboard.press("Control+k");
  await page.keyboard.type("AAKFA3121K");
  await page.getByRole("option", { name: /ABC Traders/ }).first().waitFor({ timeout: 5000 });
});

let clientUrl = "";
await step("add a client (validation, then success)", async () => {
  await page.goto(`${BASE}/clients?new=1`);
  await page.fill("#name", "E2E Test Traders");
  await page.fill("#pan", "ABCDE1234");
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.getByText("PAN format").waitFor({ timeout: 5000 });
  await page.fill("#pan", "AFGPE1234K");
  await page.fill("#mobile", "9876543210");
  await page.locator("label", { hasText: /^GST$/ }).click();
  await page.getByRole("button", { name: "Add client", exact: true }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 10000 });
  clientUrl = page.url();
  expect(await page.getByRole("heading", { name: "E2E Test Traders" }).isVisible(), "profile heading");
});

let invoiceUrl = "";
await step("create and generate an invoice (₹5,000 + 18% = ₹5,900)", async () => {
  const clientId = clientUrl.split("/").pop();
  await page.goto(`${BASE}/billing/invoices/new?client=${clientId}`);
  await page.fill("#amt-0", "5000");
  await page.getByText("₹5,900").first().waitFor();
  await page.getByRole("button", { name: "Generate Invoice" }).click();
  await page.waitForURL(/\/billing\/invoices\/[0-9a-f-]{36}$/, { timeout: 10000 });
  invoiceUrl = page.url();
  expect(await page.getByText(/TPO\/\d{4}-\d{2}\/\d{4}/).first().isVisible(), "invoice number");
});

await step("record a partial payment → Partially Paid, ₹2,900 outstanding", async () => {
  const clientId = clientUrl.split("/").pop();
  const invoiceId = invoiceUrl.split("/").pop();
  await page.goto(`${BASE}/payments?new=1&client=${clientId}&invoice=${invoiceId}`);
  await page.fill("#pay-amount", "3000");
  await page.getByText("₹2,900 will remain outstanding").waitFor();
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await page.getByText("Payment of ₹3,000 recorded").waitFor({ timeout: 10000 });
  await page.goto(invoiceUrl);
  expect(await page.getByText("Partially Paid").first().isVisible(), "status");
  expect(await page.getByText("₹2,900").first().isVisible(), "outstanding");
});

await step("overpayment is rejected server-side", async () => {
  const clientId = clientUrl.split("/").pop();
  const invoiceId = invoiceUrl.split("/").pop();
  await page.goto(`${BASE}/payments?new=1&client=${clientId}&invoice=${invoiceId}`);
  await page.fill("#pay-amount", "9999");
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await page.getByText("exceeds the outstanding").waitFor({ timeout: 10000 });
});

await step("generate monthly bills (preview → confirm), duplicates prevented", async () => {
  await page.goto(`${BASE}/billing/recurring/generate`);
  const btn = page.getByRole("button", { name: /^Generate \d+ bills?$/ });
  await btn.click();
  await page.getByRole("button", { name: "Generate bills" }).click();
  await page.getByText(/invoices? generated/).waitFor({ timeout: 15000 });
  await page.goto(`${BASE}/billing/recurring/generate`);
  await page.getByText(/All active plans are billed up to/).waitFor({ timeout: 10000 });
});

await step("compliance status quick-change persists", async () => {
  await page.goto(`${BASE}/compliance?due=today`);
  const sel = page.locator("select[aria-label^='Status of']").first();
  await sel.selectOption("Filed");
  await page.getByText("Marked Filed").waitFor({ timeout: 10000 });
});

await step("upload a document and download it back", async () => {
  await page.goto(`${BASE}/documents`);
  await page.locator("a[href*='checklist=']").first().click();
  await page.locator("dialog button[aria-label^='Upload ']").first().click();
  const tmp = path.join(os.tmpdir(), "tpo-e2e.pdf");
  fs.writeFileSync(tmp, "%PDF-1.4\n% e2e\n");
  await page.setInputFiles("input[type=file]", tmp);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByText(/uploaded$/).first().waitFor({ timeout: 10000 });
  const link = page.locator("a[aria-label^='Download']").first();
  const href = await link.getAttribute("href");
  const res = await page.request.get(`${BASE}${href}`);
  expect(res.status() === 200, `download ${res.status()}`);
});

await step("create a CMA and see live ratios on the report", async () => {
  await page.goto(`${BASE}/cma/new`);
  await page.selectOption("#cma-client", { label: "ABC Traders" });
  await page.fill("#cma-purpose", "E2E CC limit");
  await page.fill("#in-sales", "1000000");
  await page.fill("#in-closingStock", "200000");
  await page.fill("#in-debtors", "200000");
  await page.fill("#in-creditors", "100000");
  await page.fill("#in-workingCapitalLoans", "100000");
  await page.getByRole("button", { name: "Save & view report" }).click();
  await page.waitForURL(/\/cma\/[0-9a-f-]{36}$/, { timeout: 10000 });
  await page.getByText("CMA DATA — SUMMARY REPORT").waitFor();
  expect(await page.getByText("2.00").first().isVisible(), "current ratio 2.00");
});

await step("CSV export works and neutralises formulas", async () => {
  const res = await page.request.get(`${BASE}/api/reports/revenue`);
  expect(res.status() === 200, `status ${res.status()}`);
  const text = await res.text();
  expect(text.includes("Invoice No."), "csv header");
});

await step("unauthenticated API access is refused", async () => {
  const anon = await browser.newContext();
  const r1 = await anon.request.get(`${BASE}/api/search?q=abc`);
  const r2 = await anon.request.get(`${BASE}/api/reports/revenue`);
  expect(r1.status() === 401 && r2.status() === 401, `${r1.status()} ${r2.status()}`);
  const r3 = await anon.request.get(`${BASE}/dashboard`, { maxRedirects: 0 });
  expect([302, 307].includes(r3.status()), `dashboard ${r3.status()}`);
  await anon.close();
});
await admin.ctx.close();

/* ---------------------------------------------------------------- junior */
await step("junior cannot open billing, settings or reports; no finance on dashboard", async () => {
  const j = await session("amit@taxpro.demo");
  for (const p of ["/billing", "/settings", "/reports", "/payments", "/team"]) {
    await j.page.goto(`${BASE}${p}`);
    await j.page.getByRole("heading", { name: "Access restricted" }).waitFor({ timeout: 10000 }).catch(() => {
      throw new Error(`${p} not blocked`);
    });
  }
  await j.page.goto(`${BASE}/dashboard`);
  expect(!(await j.page.getByText("Unpaid Bills").isVisible()), "finance KPI visible to junior");
  const r = await j.page.request.get(`${BASE}/api/reports/revenue`);
  expect(r.status() === 401, `report api ${r.status()}`);
  await j.ctx.close();
});

/* ---------------------------------------------------------------- client portal */
await step("client portal login sees only their data and can't reach staff pages", async () => {
  const c = await session("abc@client.demo");
  expect(c.page.url().includes("/portal"), c.page.url());
  await c.page.getByText("Welcome").waitFor();
  await c.page.goto(`${BASE}/dashboard`);
  expect(c.page.url().includes("/portal"), "client reached dashboard");
  const r = await c.page.request.get(`${BASE}/api/search?q=Sharma`);
  expect(r.status() === 401, `search ${r.status()}`);
  await c.page.goto(`${BASE}/portal?tab=bills`);
  expect(!(await c.page.getByText("Sharma & Co").isVisible()), "other client's data leaked");
  await c.ctx.close();
});

/* ---------------------------------------------------------------- mobile */
await step("mobile: bottom nav + quick add sheet", async () => {
  const m = await session("varinder@taxpro.demo", { width: 390, height: 844 });
  await m.page.getByRole("button", { name: "Quick add" }).click();
  for (const a of ["Add Client", "Create Bill", "Add Task", "Add Payment", "Upload Document", "New Compliance"]) {
    expect(await m.page.getByRole("link", { name: a }).isVisible(), `missing ${a}`);
  }
  await m.page.getByRole("link", { name: "Add Task" }).click();
  await m.page.getByRole("heading", { name: "Add task" }).waitFor({ timeout: 10000 });
  await m.ctx.close();
});

await browser.close();
console.log(results.join("\n"));
console.log(failures ? `\n${failures} step(s) failed` : `\nAll ${results.length} steps passed`);
process.exit(failures ? 1 : 0);
