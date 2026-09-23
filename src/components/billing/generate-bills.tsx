"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { generateRecurringBills } from "@/server/actions/billing";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker, Field, FormError } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { formatINR } from "@/lib/money";

export interface PreviewRow {
  planId: string;
  clientId: string;
  clientName: string;
  periods: { key: string; label: string; alreadyBilled: boolean }[];
  lines: { service: string; amount: number }[];
  subtotal: number;
  gst: number;
  totalPerPeriod: number;
}

export function GenerateBills({ rows, uptoMonth, defaultDate, monthLabel }: { rows: PreviewRow[]; uptoMonth: string; defaultDate: string; monthLabel: string }) {
  const billable = rows.filter((r) => r.periods.some((p) => !p.alreadyBilled));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(billable.map((r) => r.planId)));
  const [invoiceDate, setInvoiceDate] = useState(defaultDate);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; total: number; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const newPeriods = (r: PreviewRow) => r.periods.filter((p) => !p.alreadyBilled).length;
  const chosen = billable.filter((r) => selected.has(r.planId));
  const grand = chosen.reduce((a, r) => a + r.totalPerPeriod * newPeriods(r), 0);
  const count = chosen.reduce((a, r) => a + newPeriods(r), 0);
  const allOn = billable.length > 0 && selected.size === billable.length;

  if (done)
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-brand" />}
          title={`${done.count} invoice${done.count === 1 ? "" : "s"} generated · ${formatINR(done.total)}`}
          description="They are marked “Generated”, not sent. Review each one, then share via WhatsApp or email from the invoice page."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/billing?status=pending">Open Bill Tracker</LinkButton>
              <Button variant="secondary" onClick={() => { setDone(null); router.refresh(); }}>Back to preview</Button>
            </div>
          }
        />
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          <Field label="Invoice date for generated bills" htmlFor="gen-date" className="sm:w-64">
            <DatePicker id="gen-date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
          <div className="text-sm sm:text-right">
            <p className="text-ink-3">Selected: <strong className="text-ink">{chosen.length} clients · {count} invoices</strong></p>
            <p className="tnum text-xl font-semibold">{formatINR(grand)} <span className="text-xs font-normal text-ink-3">incl. GST</span></p>
          </div>
        </div>
        {billable.length === 0 ? (
          <EmptyState title={`All active plans are billed up to ${monthLabel}`} description="Choose a later month to generate the next cycle." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Bills to generate</caption>
              <thead>
                <tr className="border-b border-line bg-subtle text-[11.5px] tracking-[0.06em] text-ink-3 uppercase">
                  <th className="w-10 py-2.5 ps-5 text-left">
                    <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(billable.map((r) => r.planId)))} className="h-4 w-4 accent-brand" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">Client</th>
                  <th className="hidden px-3 py-2.5 text-left font-semibold md:table-cell">Services</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Period(s)</th>
                  <th className="px-3 py-2.5 pe-5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const n = newPeriods(r);
                  const disabled = n === 0;
                  return (
                    <tr key={r.planId} className={`border-b border-line last:border-0 ${disabled ? "opacity-55" : ""}`}>
                      <td className="py-3 ps-5">
                        <input
                          type="checkbox"
                          aria-label={`Include ${r.clientName}`}
                          disabled={disabled}
                          checked={selected.has(r.planId)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.planId);
                            else next.delete(r.planId);
                            setSelected(next);
                          }}
                          className="h-4 w-4 accent-brand"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium"><Link href={`/clients/${r.clientId}`} className="hover:underline">{r.clientName}</Link></td>
                      <td className="hidden px-3 py-3 text-ink-2 md:table-cell">{r.lines.map((l) => `${l.service} ${formatINR(l.amount)}`).join(" · ")}</td>
                      <td className="px-3 py-3 text-ink-2">
                        {r.periods.map((p) => (
                          <span key={p.key} className="block">
                            {p.label} {p.alreadyBilled && <span className="text-xs text-ok">· already billed</span>}
                          </span>
                        ))}
                      </td>
                      <td className="tnum px-3 py-3 pe-5 text-right">
                        <span className="font-semibold">{formatINR(r.totalPerPeriod * Math.max(n, 1))}</span>
                        <span className="block text-xs text-ink-3">{formatINR(r.subtotal)} + GST {formatINR(r.gst)}{n > 1 ? ` × ${n}` : ""}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {billable.length > 0 && (
        <div className="flex justify-end">
          <Button variant="success" size="lg" disabled={count === 0} icon={<FileText className="h-4.5 w-4.5" />} onClick={() => { setError(null); setConfirm(true); }}>
            Generate {count} bill{count === 1 ? "" : "s"}
          </Button>
        </div>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title={`Generate ${count} invoice${count === 1 ? "" : "s"}?`}
        description={`Total ${formatINR(grand)} dated ${invoiceDate}. Invoice numbers are assigned sequentially.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="success"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await generateRecurringBills({ uptoMonth, invoiceDate, planIds: chosen.map((c) => c.planId) });
                  if (r.ok) {
                    setConfirm(false);
                    setDone({ count: r.data?.count ?? 0, total: r.data?.total ?? 0, message: r.message ?? "" });
                  } else setError(r.error);
                })
              }
            >
              {pending ? "Generating…" : "Generate bills"}
            </Button>
          </>
        }
      >
        <FormError message={error} />
        <p className="text-sm text-ink-2">Bills will be created with status <strong>Generated</strong>. They will <strong>not</strong> be sent to clients until you share them.</p>
      </Modal>
    </div>
  );
}
