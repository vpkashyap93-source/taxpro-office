import Link from "next/link";
import { Keyboard, LifeBuoy, Leaf, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Help" };

const GUIDES: [string, string, string][] = [
  ["Start your morning", "The Dashboard shows today's work, overdue bills, pending documents and upcoming deadlines.", "/dashboard"],
  ["Bill all retainer clients", "Set up Recurring Billing per client, then use Generate Monthly Bills. Review, then send each bill yourself.", "/billing/recurring"],
  ["Record a part payment", "Open Payments → Record Payment. Pick the invoice; the outstanding balance updates automatically.", "/payments?new=1"],
  ["Create GST work for everyone", "Compliance → Bulk create. Choose GSTR-3B and a period; it is created for every GST client.", "/compliance?bulk=1"],
  ["Chase missing documents", "Documents → open a request → Request on WhatsApp. The message lists exactly what is pending.", "/documents"],
  ["Give a client portal access", "Client Portal → Enable. Share the one-time password privately.", "/client-portal"],
];

export default async function HelpPage() {
  await requireStaff();
  return (
    <div className="space-y-6">
      <PageHeader title="Help & shortcuts" description="Quick guides for everyday work in TaxPro Office." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map(([t, d, href]) => (
          <Link key={t} href={href} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-line-strong">
            <p className="text-sm font-semibold">{t}</p>
            <p className="mt-1 text-[13px] text-ink-3">{d}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Keyboard" icon={<Keyboard className="h-4 w-4" />} />
          <CardBody className="space-y-2 text-sm">
            {[["Ctrl / ⌘ + K", "Global search"], ["↑ ↓ then Enter", "Pick a search result"], ["Esc", "Close dialogs and menus"], ["Tab", "Move between fields"]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 text-xs">{k}</kbd><span className="text-ink-2">{v}</span></div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your data" icon={<ShieldCheck className="h-4 w-4" />} />
          <CardBody className="text-[13px] text-ink-2">Each staff member sees only the modules their role allows. Due dates are your firm&apos;s own data — TaxPro Office is not connected to any government portal.</CardBody>
        </Card>
        <Card>
          <CardHeader title="Paperless practice" icon={<Leaf className="h-4 w-4" />} />
          <CardBody className="text-[13px] text-ink-2">Share bills on WhatsApp or email, keep client documents digital and export reports instead of printing. Metrics on the dashboard are calculated from your actual records.</CardBody>
        </Card>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-3"><LifeBuoy className="h-3.5 w-3.5" /> Need more help? Contact your TaxPro Office administrator.</p>
    </div>
  );
}
