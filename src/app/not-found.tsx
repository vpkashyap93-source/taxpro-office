import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-gold">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-ink-3">The page you are looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">Go to TaxPro Office</Link>
    </div>
  );
}
