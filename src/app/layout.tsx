import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "TaxPro Office", template: "%s · TaxPro Office" },
  description: "Practice management for Indian tax professionals, accountants, GST practitioners and CA firms.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d1f3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
