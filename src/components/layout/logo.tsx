export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#0d1f3c" />
      <path d="M11 13.5h18" stroke="#c9a23a" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20 13.5V29" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24.5 23.5c2.2-3.6 5.4-4.9 7.5-5-.3 2.6-1.7 5.9-5.2 7.4-1.2.5-2.6.3-2.3-2.4Z" fill="#17a078" />
    </svg>
  );
}

export function Wordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className={tone === "light" ? "text-white" : "text-navy-900"}>
      <span className="text-[17px] font-semibold tracking-[-0.02em]">TaxPro</span>
      <span className="text-[17px] font-light tracking-[-0.02em] opacity-80"> Office</span>
    </span>
  );
}
