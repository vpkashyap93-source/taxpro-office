import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { clientOptions, staffOptions } from "@/server/queries/common";
import { PageHeader } from "@/components/ui/page-header";
import { CmaEditor } from "@/components/cma/cma-editor";
import { financialYearOf, todayISO } from "@/lib/dates";
import { readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "New CMA" };

export default async function NewCmaPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("cma", "edit");
  const sp = await readParams(searchParams);
  const fy = financialYearOf(todayISO());
  const prev = `${Number(fy.slice(0, 4)) - 1}-${fy.slice(2, 4)}`;
  return (
    <div>
      <PageHeader eyebrow={<Link href="/cma" className="hover:underline">CMA</Link>} title="New CMA" description="Enter the latest financials. Ratios update as you type." />
      <CmaEditor initial={{ clientId: sp.client, financialYear: fy, period: `FY ${prev} (Actual) + ${fy} (Projected)`, inputs: {} }} clients={clientOptions(auth.firm.id)} staff={staffOptions(auth.firm.id)} />
    </div>
  );
}
