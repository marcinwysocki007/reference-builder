import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BRANDING } from "@/lib/branding";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRANDING.toolName,
  description: "Referenzen, Zertifikate und Empfehlungen für Betreuungskräfte",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        style={
          {
            "--brand": BRANDING.primary,
            "--brand-soft": BRANDING.primarySoft,
            "--brand-tint": BRANDING.primaryTint,
          } as React.CSSProperties
        }
      >
        <header
          style={{ background: "var(--brand)" }}
          className="text-white"
        >
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold">
              {BRANDING.toolName}
              {BRANDING.toolTagline && (
                <span className="opacity-70 font-normal text-sm ml-2">
                  · {BRANDING.toolTagline}
                </span>
              )}
            </Link>
            <nav className="text-sm flex gap-4">
              <Link href="/" className="opacity-90 hover:opacity-100">
                Pflegekräfte
              </Link>
              <Link href="/api-docs" className="opacity-90 hover:opacity-100">
                API
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
