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
      className="text-xs px-1.5 py-0.5 rounded hover:bg-black/5 transition"
      style={{ color: "var(--muted)" }}
    >
      {busy ? "…" : "⟳"}
    </button>
  );
}
