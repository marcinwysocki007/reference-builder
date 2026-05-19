"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/locale-context";

// Manual 90° clockwise rotation. Useful when the auto-detected orientation
// in OCR/process was wrong and the user wants to fix it without re-uploading.
// Disabled for non-image docs (PDFs).
export function DocumentRotateButton({
  documentId,
  mime,
}: {
  documentId: string;
  mime: string;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  if (!mime.startsWith("image/")) return null;

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    await fetch(`/api/documents/${documentId}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ degrees: 90 }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={t("document.rotate")}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border bg-white hover:bg-gray-50 transition disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--ink)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-3.5-7.1" />
        <polyline points="21 4 21 10 15 10" />
      </svg>
      {busy ? "…" : t("document.rotateLabel")}
    </button>
  );
}
