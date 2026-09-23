import { requireClientUser } from "@/server/auth";
import { PortalView } from "@/components/portal/portal-view";

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const auth = await requireClientUser();
  const { tab } = await searchParams;
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-[-0.02em]">Welcome, {auth.user.name.split(" (")[0]}</h1>
      <p className="mb-6 text-sm text-ink-3">Your compliance, documents and bills with {auth.firm.name}.</p>
      <PortalView firmId={auth.firm.id} clientId={auth.user.clientId} tab={tab} base="/portal" />
    </div>
  );
}
