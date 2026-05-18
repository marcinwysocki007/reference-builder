"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const router = useRouter();
  const current = useLocale();

  function setLocale(next: Locale) {
    if (next === current) return;
    // Cookie lives 1 year; SameSite=Lax so it survives normal navigation.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // router.refresh() re-fetches server components with the new cookie.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          className="px-2 py-0.5 rounded transition"
          style={{
            background:
              loc === current ? "rgba(255,255,255,0.25)" : "transparent",
            color: "white",
            opacity: loc === current ? 1 : 0.7,
            fontWeight: loc === current ? 600 : 400,
            cursor: loc === current ? "default" : "pointer",
          }}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
