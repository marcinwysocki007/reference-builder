import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import { BRANDING } from "@/lib/branding";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  t,
  type Locale,
} from "@/lib/i18n";
import { LocaleProvider } from "@/lib/locale-context";
import { LocaleSwitcher } from "./_components/LocaleSwitcher";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRANDING.toolName,
  description: "Referenzen, Zertifikate und Empfehlungen für Betreuungskräfte",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <html lang={locale}>
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
        <LocaleProvider locale={locale}>
          <header style={{ background: "var(--brand)" }} className="text-white">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="font-semibold">
                {BRANDING.toolName}
                {BRANDING.toolTagline && (
                  <span className="opacity-70 font-normal text-sm ml-2">
                    · {BRANDING.toolTagline}
                  </span>
                )}
              </Link>
              <nav className="text-sm flex items-center gap-4">
                <Link href="/" className="opacity-90 hover:opacity-100">
                  {t(locale, "nav.caregivers")}
                </Link>
                <Link href="/api-docs" className="opacity-90 hover:opacity-100">
                  {t(locale, "nav.api")}
                </Link>
                <LocaleSwitcher />
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
