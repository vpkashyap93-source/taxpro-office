import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { CmaActions } from "@/components/cma/cma-actions";
import { LogoMark } from "@/components/layout/logo";
import { benchmarkState, CMA_INPUT_FIELDS, computeCma, parseCmaInputs, type Metric } from "@/lib/cma";
import { formatMetric, formatRupees } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata = { title: "CMA Report" };

export default async function CmaReportPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff("cma");
  const { id } = await params;
  const r = db.select().from(s.cmaRecords).where(and(eq(s.cmaRecords.id, id), eq(s.cmaRecords.firmId, auth.firm.id))).get();
  if (!r) notFound();
  const client = db.select().from(s.clients).where(eq(s.clients.id, r.clientId)).get()!;
  const firm = db.select().from(s.firms).where(eq(s.firms.id, auth.firm.id)).get()!;
  const inputs = parseCmaInputs(r.inputs);
  const metrics = computeCma(inputs);
  const groups = [...new Set(metrics.map((m) => m.group))];
  const flagged = metrics.filter((m) => benchmarkState(m) !== null);
  const missing = CMA_INPUT_FIELDS.filter((f) => inputs[f.key] === undefined);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4">
        <div>
          <nav className="text-[13px] text-ink-3" aria-label="Breadcrumb"><Link href="/cma" className="hover:underline">CMA</Link> / <span className="text-ink-2">{client.name}</span></nav>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{r.purpose}</h1>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-1 text-sm text-ink-3">
            <Link href={`/clients/${client.id}?tab=cma`} className="hover:underline">{client.name}</Link> · {r.bank ?? "Bank not set"} {r.reportGeneratedAt && `· Report generated ${formatDateTime(r.reportGeneratedAt)}`}
          </p>
        </div>
        <CmaActions id={r.id} canEdit={auth.can("cma", "edit")} generated={!!r.reportGeneratedAt} />
        {missing.length > 0 && (
          <p className="rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-[13px] text-warn">
            {missing.length} input{missing.length > 1 ? "s are" : " is"} blank ({missing.slice(0, 5).map((m) => m.label).join(", ")}{missing.length > 5 ? "…" : ""}) — related ratios show “—”.
          </p>
        )}
      </div>

      <article className="print-area mx-auto w-full max-w-[900px] rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
        <header className="flex flex-col justify-between gap-4 border-b-2 border-navy-900 pb-5 sm:flex-row">
          <div className="flex gap-3">
            <LogoMark className="h-11 w-11 shrink-0" />
            <div>
              <p className="font-semibold text-navy-900">{firm.name}</p>
              <p className="text-xs text-ink-2">{firm.address}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-semibold tracking-[0.04em] text-navy-900">CMA DATA — SUMMARY REPORT</p>
            <p className="text-xs text-ink-2">Prepared {formatDate(r.reportGeneratedAt?.slice(0, 10) ?? r.updatedAt.slice(0, 10))}</p>
          </div>
        </header>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 py-5 text-sm sm:grid-cols-2">
          {[
            ["Borrower", client.name],
            ["Constitution", client.constitution ?? "—"],
            ["PAN / GSTIN", [client.pan, client.gstin].filter(Boolean).join(" / ") || "—"],
            ["Bank / Institution", r.bank ?? "—"],
            ["Purpose", r.purpose],
            ["Limit applied", r.loanAmount ? formatINR(r.loanAmount) : "—"],
            ["Period", r.period],
            ["Financial year", r.financialYear],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-36 shrink-0 text-ink-3">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="grid grid-cols-1 gap-6 border-t border-line pt-5 md:grid-cols-2">
          {[...new Set(CMA_INPUT_FIELDS.map((f) => f.group))].map((g) => (
            <div key={g}>
              <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{g}</h2>
              <table className="w-full text-[13px]">
                <tbody>
                  {CMA_INPUT_FIELDS.filter((f) => f.group === g).map((f) => (
                    <tr key={f.key} className="border-b border-line last:border-0">
                      <td className="py-1.5 text-ink-2">{f.label}</td>
                      <td className="tnum py-1.5 text-right">{inputs[f.key] !== undefined ? formatRupees(inputs[f.key]!) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Computed ratios & indicators</h2>
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <p className="mb-1.5 text-sm font-semibold text-navy-900">{g}</p>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line bg-subtle text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
                    <th className="py-1.5 ps-2 text-left font-semibold">Indicator</th>
                    <th className="hidden py-1.5 text-left font-semibold sm:table-cell">Formula</th>
                    <th className="py-1.5 pe-2 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.filter((m) => m.group === g).map((m) => <MetricRow key={m.key} m={m} />)}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        {flagged.length > 0 && (
          <section className="mt-6 rounded-xl border border-line p-4">
            <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Observations</h2>
            <ul className="space-y-1.5 text-[13px]">
              {flagged.map((m) => {
                const ok = benchmarkState(m) === "ok";
                return (
                  <li key={m.key} className="flex items-start gap-2">
                    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}
                    <span>
                      {m.label} is <strong>{formatMetric(m.value, m.format)}</strong> — {ok ? "within" : "outside"} the practitioner rule of thumb ({m.benchmark!.hint}).
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {r.notes && <p className="mt-6 text-[13px] text-ink-2"><strong>Notes:</strong> {r.notes}</p>}
        <p className="mt-8 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
          Figures are based on data furnished by the borrower. Ratios are computed transparently from the inputs using the formulas shown; benchmark hints are general rules of thumb and do not represent any specific bank&apos;s lending norms.
        </p>
      </article>
    </div>
  );
}

function MetricRow({ m }: { m: Metric }) {
  const b = benchmarkState(m);
  return (
    <tr className="border-b border-line">
      <td className="py-2 ps-2 align-top font-medium text-ink">
        {m.label}
        {m.benchmark && <span className="block text-[11px] font-normal text-ink-3">{m.benchmark.hint}</span>}
      </td>
      <td className="hidden py-2 pe-3 align-top text-[12px] text-ink-3 sm:table-cell">{m.formula}</td>
      <td className={cn("tnum py-2 pe-2 text-right align-top font-semibold", b === "warn" ? "text-warn" : b === "ok" ? "text-brand" : "text-ink")}>{formatMetric(m.value, m.format)}</td>
    </tr>
  );
}
