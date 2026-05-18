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
      className="text-xs px-1.5 py-0.5 rounded hover:bg-black/5 transition"
      style={{ color: "var(--muted)" }}
    >
      {busy ? "…" : "↻"}
    </button>
  );
}
