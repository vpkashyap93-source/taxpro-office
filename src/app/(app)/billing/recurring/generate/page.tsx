import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { listRecurring } from "@/server/queries/invoices";
import { PageHeader } from "@/components/ui/page-header";
import { SelectFilter } from "@/components/ui/url-filters";
import { GenerateBills, type PreviewRow } from "@/components/billing/generate-bills";
import { addMonths, monthLabel, startOfMonth, todayISO } from "@/lib/dates";
import { computeInvoiceTotals } from "@/lib/money";
import { duePeriods, periodLabel } from "@/lib/recurring";
import { readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Generate Monthly Bills" };

export default async function GeneratePage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("billing", "edit");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const current = startOfMonth(today).slice(0, 7);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : current;
  const plans = listRecurring(auth.firm.id).filter((p) => p.active && p.clientStatus !== "Inactive");
  const existing = plans.length
    ? db
        .select({ planId: s.invoices.recurringBillId, period: s.invoices.billingPeriod })
        .from(s.invoices)
        .where(and(eq(s.invoices.firmId, auth.firm.id), inArray(s.invoices.recurringBillId, plans.map((p) => p.id))))
        .all()
    : [];
  const billed = new Set(existing.map((e) => `${e.planId}|${e.period}`));

  const rows: PreviewRow[] = plans.map((p) => {
    const totals = computeInvoiceTotals(p.items.map((i) => i.amount), 0, p.gstRate);
    const due = duePeriods(p.nextPeriodStart, p.intervalMonths, month).map((d) => ({ key: d.key, label: d.label, alreadyBilled: billed.has(`${p.id}|${d.key}`) }));
    const periods = due.length ? due : [{ key: "none", label: `Billed through ${periodLabel(addMonths(p.nextPeriodStart, -p.intervalMonths), p.intervalMonths)}`, alreadyBilled: true }];
    return { planId: p.id, clientId: p.clientId, clientName: p.clientName, periods, lines: p.items.map((i) => ({ service: i.service, amount: i.amount })), subtotal: totals.subtotal, gst: totals.gstAmount, totalPerPeriod: totals.total };
  });
  rows.sort((a, b) => Number(a.periods[0]!.alreadyBilled) - Number(b.periods[0]!.alreadyBilled) || a.clientName.localeCompare(b.clientName));
  const monthOptions = [-2, -1, 0, 1, 2].map((o) => addMonths(`${current}-01`, o).slice(0, 7)).map((m) => ({ value: m, label: monthLabel(m, "long") }));

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/billing/recurring" className="hover:underline">Recurring Billing</Link>}
        title="Generate Monthly Bills"
        description={`Preview bills for every active recurring client up to ${monthLabel(month, "long")}. Deselect anyone you don't want to bill.`}
        actions={<SelectFilter param="month" label="Bill up to month" placeholder={monthLabel(current, "long")} options={monthOptions} />}
      />
      <GenerateBills key={month} rows={rows} uptoMonth={month} defaultDate={today} monthLabel={monthLabel(month, "long")} />
    </div>
  );
}
