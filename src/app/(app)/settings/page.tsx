import Link from "next/link";
import { eq } from "drizzle-orm";
import { Cloud, Database, Plug, ShieldCheck } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { getBankSettings, getInvoiceSettings } from "@/server/settings";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AddTypeButton, BillingSettingsForm, FirmForm, TypeModals, TypeToggle } from "@/components/admin/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requireStaff("settings");
  const edit = auth.can("settings", "edit");
  const firm = db.select().from(s.firms).where(eq(s.firms.id, auth.firm.id)).get()!;
  const inv = getInvoiceSettings(auth.firm.id);
  const bank = getBankSettings(auth.firm.id) ?? { accountName: "", bankName: "", accountNumber: "", ifsc: "", upiId: "" };
  const types = db.select().from(s.complianceTypes).where(eq(s.complianceTypes.firmId, auth.firm.id)).all().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const storageDriver = process.env.STORAGE_DRIVER ?? "local";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Firm profile, billing defaults, compliance master data and integrations." />
      <Card>
        <CardHeader title="Firm profile" subtitle="Printed on invoices and reports" />
        <CardBody><FirmForm firm={firm} disabled={!edit} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Billing" subtitle="Invoice numbering restarts every financial year" />
        <CardBody><BillingSettingsForm disabled={!edit} values={{ ...inv, ...bank }} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Compliance types" subtitle="Editable master data. TaxPro Office never hard-codes statutory due dates — defaults here only pre-fill new tasks." action={edit ? <AddTypeButton /> : undefined} />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Compliance types</caption>
            <thead><tr className="border-y border-line bg-subtle text-[11.5px] tracking-[0.06em] text-ink-3 uppercase"><th className="px-5 py-2.5 text-left font-semibold">Category</th><th className="px-4 py-2.5 text-left font-semibold">Type</th><th className="px-4 py-2.5 text-left font-semibold">Periodicity</th><th className="px-4 py-2.5 text-left font-semibold">Default due day</th><th className="px-4 py-2.5 text-left font-semibold">Status</th><th className="px-5 py-2.5" /></tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5 text-ink-2">{t.category}</td>
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-ink-2">{t.periodicity}</td>
                  <td className="tnum px-4 py-2.5 text-ink-2">{t.defaultDueDay ? `Day ${t.defaultDueDay} of next month` : "Set per task"}</td>
                  <td className="px-4 py-2.5"><Badge tone={t.active ? "ok" : "neutral"}>{t.active ? "Active" : "Disabled"}</Badge></td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">{edit && <><Link href={`/settings?type=${t.id}`} scroll={false} className="me-4 text-[13px] font-medium text-navy-600 hover:underline">Edit</Link><TypeToggle id={t.id} active={t.active} disabled={!edit} /></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Storage & data" icon={<Database className="h-4 w-4" />} />
          <CardBody className="space-y-3 text-sm">
            <Row label="Database" value="Relational (SQLite via Drizzle ORM) — portable to PostgreSQL" />
            <Row label="Document storage" value={<Badge tone="info">{storageDriver === "local" ? "Local disk (server)" : storageDriver}</Badge>} />
            <p className="flex items-start gap-2 text-xs text-ink-3"><Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Cloud storage (S3-compatible) can be added via the storage driver interface and environment variables — not configured in this build.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Integrations" icon={<Plug className="h-4 w-4" />} />
          <CardBody className="space-y-3 text-sm">
            {["GST portal", "Income Tax e-filing", "TRACES (TDS)", "MCA (ROC)", "WhatsApp Business API", "Email (SMTP)"].map((n) => (
              <Row key={n} label={n} value={<Badge>Not connected</Badge>} />
            ))}
            <p className="text-xs text-ink-3">TaxPro Office is a practice-management tool. It does not file returns or fetch data from government portals. WhatsApp and email currently open your own app with a pre-filled message.</p>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Security" icon={<ShieldCheck className="h-4 w-4" />} />
        <CardBody className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Row label="Passwords" value="bcrypt (cost 12), never stored in plain text" />
          <Row label="Sessions" value={`HTTP-only cookie, ${process.env.SESSION_TTL_HOURS ?? 12}h expiry, HMAC-hashed at rest`} />
          <Row label="Access control" value={<Link href="/team" className="text-navy-600 hover:underline">Role permissions matrix</Link>} />
          <Row label="Audit trail" value="Every change records who and when; client activity timeline" />
        </CardBody>
      </Card>
      <TypeModals types={types} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-ink-3">{label}</span><span className="text-right text-ink">{value}</span></div>;
}
