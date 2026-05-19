"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/locale-context";

// Triggers a full KI re-run (vision-OCR, metadata, translation, attestation, PII)
// on an existing document. Useful when the doc was processed with an older
// version of the pipeline (e.g. tesseract-only) and the user wants better
// results without re-uploading.
export function DocumentReprocessButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    await fetch(`/api/documents/${documentId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={t("document.reprocess")}
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
        <path d="M12 2v3" />
        <path d="m5.6 5.6 2.1 2.1" />
        <path d="M2 12h3" />
        <path d="m5.6 18.4 2.1-2.1" />
        <path d="M12 22v-3" />
        <path d="m18.4 18.4-2.1-2.1" />
        <path d="M22 12h-3" />
        <path d="m18.4 5.6-2.1 2.1" />
      </svg>
      {busy ? "…" : t("document.reprocessLabel")}
    </button>
  );
}
