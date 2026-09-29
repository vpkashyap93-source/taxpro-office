import { redirect } from "next/navigation";
import { CheckCircle2, Leaf } from "lucide-react";
import { getAuth } from "@/server/auth";
import { LogoMark, Wordmark } from "@/components/layout/logo";
import { TAGLINE } from "@/components/layout/sidebar";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const DEMO_USERS = [
  { email: "varinder@taxpro.demo", role: "Admin" },
  { email: "rahul@taxpro.demo", role: "Senior" },
  { email: "amit@taxpro.demo", role: "Junior" },
  { email: "pooja@taxpro.demo", role: "Billing Staff" },
  { email: "abc@client.demo", role: "Client portal" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const auth = await getAuth();
  if (auth) redirect(auth.user.role === "Client" ? "/portal" : "/dashboard");
  const { next } = await searchParams;
  const showDemo = process.env.SHOW_DEMO_LOGINS !== "false";
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-navy-800/40 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <Wordmark />
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">Practice management for tax professionals</p>
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">One operating system for your entire tax office.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">Clients, GST/ITR/TDS work, monthly billing, collections, documents, CMA and your team — organised in one place.</p>
          <ul className="mt-8 space-y-3 text-sm text-white/75">
            {["Know what is due today, before your first coffee", "Recurring monthly bills generated in one click", "Track who has not paid and who has not sent documents"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <CheckCircle2 className="h-4.5 w-4.5 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 flex items-center gap-2 text-xs text-white/40">
          <Leaf className="h-3.5 w-3.5 text-brand-500" /> {TAGLINE}
        </p>
      </section>
      <section className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <Wordmark tone="dark" />
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Sign in</h2>
          <p className="mt-1 text-sm text-ink-3">Welcome back. Enter your office credentials.</p>
          <LoginForm next={next} />
          {showDemo && (
            <div className="mt-8 rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Demo accounts</p>
              <p className="mt-1 text-xs text-ink-3">
                Password for all: <code className="rounded bg-subtle px-1 py-0.5 font-mono text-ink">{process.env.SEED_DEMO_PASSWORD ?? "TaxPro@2026"}</code>
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {DEMO_USERS.map((u) => (
                  <li key={u.email} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-ink-2">{u.email}</span>
                    <span className="shrink-0 text-ink-3">{u.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {process.env.RENDER_GIT_COMMIT && <p className="mt-6 text-center text-[11px] text-ink-4">Version {process.env.RENDER_GIT_COMMIT.slice(0, 7)}</p>}
        </div>
      </section>
    </div>
  );
}
