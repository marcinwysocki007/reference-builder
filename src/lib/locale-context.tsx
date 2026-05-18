"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale, t as tCore, sectionMeta } from "./i18n";

const LocaleCtx = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleCtx);
}

// Convenience: in any client component, `const t = useT(); t("common.cancel")`.
export function useT() {
  const locale = useLocale();
  return (key: string) => tCore(locale, key);
}

export function useSectionMeta() {
  const locale = useLocale();
  return (type: "REFERENZ" | "ZERTIFIKAT" | "GRUSSKARTE" | "EMPFEHLUNG") =>
    sectionMeta(locale, type);
}
