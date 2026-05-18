"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExportDeleteButton({
  exportId,
  filename,
}: {
  exportId: string;
  filename: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Erzeugtes PDF „${filename}" löschen?`)) return;
    setBusy(true);
    await fetch(`/api/exports/${exportId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="PDF löschen"
      className="text-xs px-1.5 py-0.5 rounded hover:bg-black/5 transition"
      style={{ color: "var(--muted)" }}
    >
      {busy ? "…" : "✕"}
    </button>
  );
}
