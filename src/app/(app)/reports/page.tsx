import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { BILLING_SERVICES, COMPLIANCE_CATEGORIES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { buildReport, defaultFilters, REPORTS, type ReportColumn, type ReportKey } from "@/server/queries/reports";
import { clientOptions, staffOptions } from "@/server/queries/common";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { GroupedBarChart, HBarList } from "@/components/ui/charts";
import { DateFilter, SelectFilter } from "@/components/ui/url-filters";
import { buttonClass } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { withParams } from "@/components/ui/filter-chips";
import { formatINR } from "@/lib/money";
import { financialYearOf, formatDate, todayISO } from "@/lib/dates";
import { readParams, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/cn";

export const metadata = { title: "Reports" };

function cell(c: ReportColumn, v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return <span className="text-ink-4">—</span>;
  switch (c.format) {
    case "money": return formatINR(Number(v));
    case "date": return formatDate(String(v));
    case "percent": return `${v}%`;
    case "number": return Number(v).toLocaleString("en-IN");
    default: return String(v);
  }
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("reports");
  const sp = await readParams(searchParams);
  const available = REPORTS.filter((r) => auth.can(r.needs));
  const key = (available.some((r) => r.key === sp.report) ? sp.report : available[0]?.key) as ReportKey | undefined;
  const filters = defaultFilters(sp);
  const report = key ? buildReport(auth, key, filters) : null;
  const def = REPORTS.find((r) => r.key === key);
  const isWork = def?.group === "Work";
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "report") as [string, string][]).toString();
  const cur = Number(financialYearOf(todayISO()).slice(0, 4));
  const fyOptions = [0, 1, 2].map((o) => `${cur - o}-${String((cur - o + 1) % 100).padStart(2, "0")}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Export-ready practice reports. CSV opens in Excel; Print gives an A4 PDF." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Reports" className="no-print">
          <div className="lg:hidden">
            <SelectFilter param="report" label="Report" placeholder="Choose report" options={available.map((r) => ({ value: r.key, label: r.label }))} className="w-full" />
          </div>
          <div className="hidden space-y-5 lg:block">
            {["Finance", "Work"].map((g) => {
              const list = available.filter((r) => r.group === g);
              if (!list.length) return null;
              return (
                <div key={g}>
                  <p className="mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.12em] text-ink-4 uppercase">{g}</p>
                  <ul className="space-y-0.5">
                    {list.map((r) => (
                      <li key={r.key}>
                        <Link href={withParams("/reports", { from: sp.from, to: sp.to, fy: sp.fy, client: sp.client, staff: sp.staff }, { report: r.key })} aria-current={r.key === key ? "page" : undefined} className={cn("block rounded-lg px-3 py-2 text-sm", r.key === key ? "bg-navy-900 font-medium text-white" : "text-ink-2 hover:bg-surface")}>
                          {r.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          <Card className="no-print">
            <div className="flex flex-wrap items-end gap-2 p-4">
              <label className="grid grid-cols-1 gap-1 text-xs text-ink-3">From<DateFilter param="from" label="From date" fallback={filters.from} /></label>
              <label className="grid grid-cols-1 gap-1 text-xs text-ink-3">To<DateFilter param="to" label="To date" fallback={filters.to} /></label>
              <SelectFilter param="fy" label="Financial year" placeholder={`FY ${filters.fy}`} options={fyOptions.map((f) => ({ value: f, label: `FY ${f}` }))} />
              <SelectFilter param="client" label="Client" placeholder="All clients" options={clientOptions(auth.firm.id, { includeInactive: true })} className="max-w-52" />
              <SelectFilter param="service" label="Service" placeholder="All services" options={isWork ? COMPLIANCE_CATEGORIES : BILLING_SERVICES} />
              {isWork && <SelectFilter param="staff" label="Staff" placeholder="All staff" options={staffOptions(auth.firm.id)} />}
              {key && (
                <div className="ms-auto flex gap-2">
                  <a href={`/api/reports/${key}${qs ? `?${qs}` : ""}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Export CSV</a>
                  <PrintButton />
                </div>
              )}
            </div>
          </Card>

          {!report ? (
            <Card><EmptyState icon={<BarChart3 className="h-5.5 w-5.5" />} title="No reports available for your role" /></Card>
          ) : (
            <Card className="print-area">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-lg font-semibold">{report.title}</h2>
                <p className="text-[13px] text-ink-3">{report.description} · {formatDate(filters.from)} – {formatDate(filters.to)} · {auth.firm.name}</p>
              </div>
              {report.chart && report.rows.length > 0 && (
                <CardBody className="border-b border-line pt-5">
                  {report.chart.kind === "grouped" ? (
                    <GroupedBarChart ariaLabel={report.title} data={report.chart.data} series={report.chart.series} unit={report.chart.unit} />
                  ) : (
                    <div className="max-w-2xl">
                      <HBarList unit={report.chart.unit} color={report.chart.series[0]!.color} data={report.chart.data.map((d) => ({ label: d.label, value: d.values[report.chart!.series[0]!.key] ?? 0 }))} />
                    </div>
                  )}
                </CardBody>
              )}
              {report.rows.length === 0 ? (
                <EmptyState title="No data for these filters" description="Widen the date range or clear filters." />
              ) : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{report.title}</caption>
                    <thead>
                      <tr className="border-b border-line bg-subtle">
                        {report.columns.map((c) => (
                          <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase first:ps-5 last:pe-5", ["money", "number", "percent"].includes(c.format) ? "text-right" : "text-left")}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.slice(0, 500).map((row, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          {report.columns.map((c) => (
                            <td key={c.key} className={cn("px-4 py-2.5 first:ps-5 last:pe-5", ["money", "number", "percent"].includes(c.format) ? "tnum text-right whitespace-nowrap" : "text-ink-2 whitespace-nowrap", c.format === "date" && "tnum")}>{cell(c, row[c.key])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {report.totals && (
                      <tfoot>
                        <tr className="border-t-2 border-navy-900 bg-subtle font-semibold">
                          {report.columns.map((c, i) => (
                            <td key={c.key} className={cn("px-4 py-2.5 first:ps-5 last:pe-5", ["money", "number", "percent"].includes(c.format) && "tnum text-right")}>{i === 0 ? "Total" : c.key in report.totals! ? cell(c, report.totals![c.key]) : ""}</td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {report.rows.length > 500 && <p className="px-5 py-3 text-xs text-ink-3">Showing first 500 rows — export CSV for the full report ({report.rows.length} rows).</p>}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
