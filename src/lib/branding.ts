// Single source of truth for branding — used by UI, PDF export, and AI prompts.
// Override via env vars or by editing the defaults below.
// Logo files live in /public; reference them by path (e.g. "/brand/logo.png").

export interface Branding {
  toolName: string;
  toolTagline: string;
  pdfBrandName: string;
  pdfTagline: string;
  pdfFooterUrl: string;
  pdfLogoPath: string | null;
  primary: string;
  primarySoft: string;
  primaryTint: string;
}

export const BRANDING: Branding = {
  toolName: process.env.BRAND_TOOL_NAME ?? "Referenzen-Tool",
  toolTagline: process.env.BRAND_TOOL_TAGLINE ?? "",
  pdfBrandName: process.env.BRAND_PDF_NAME ?? "",
  pdfTagline: process.env.BRAND_PDF_TAGLINE ?? "",
  pdfFooterUrl: process.env.BRAND_PDF_FOOTER_URL ?? "",
  pdfLogoPath: process.env.BRAND_PDF_LOGO_PATH ?? null,
  primary: process.env.BRAND_PRIMARY ?? "#3b3b46",
  primarySoft: process.env.BRAND_PRIMARY_SOFT ?? "#d6d6dc",
  primaryTint: process.env.BRAND_PRIMARY_TINT ?? "#eeeef2",
};

// Domain context for the AI prompts — describes WHAT the tool is used for,
// not WHO sells it. Override when the tool is deployed for a different niche.
export const DOMAIN_CONTEXT =
  process.env.BRAND_DOMAIN_CONTEXT ??
  "Aufbereitung von Referenzen, Zertifikaten und Empfehlungsschreiben von 24-Stunden-Betreuungskräften für die häusliche Pflege.";
