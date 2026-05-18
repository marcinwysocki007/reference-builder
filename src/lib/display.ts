// Display helpers shared between UI and PDF.
// Agency profiles often anonymize the surname (e.g. "Klaudia W." or just
// "Klaudia"), so we treat empty / "?" lastNames specially.

export function fullName(
  first: string,
  last: string | null | undefined,
): string {
  const trimmed = (last ?? "").trim();
  if (!trimmed || trimmed === "?") return first.trim();
  return `${first.trim()} ${trimmed}`;
}

export function initials(
  first: string,
  last: string | null | undefined,
): string {
  const f = (first ?? "").trim()[0] ?? "";
  const l = (last ?? "").trim().replace(/[?.]/g, "")[0] ?? "";
  return (f + l).toUpperCase() || "?";
}
