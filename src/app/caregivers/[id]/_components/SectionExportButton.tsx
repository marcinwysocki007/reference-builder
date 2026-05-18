"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@/lib/types";

export function SectionExportButton({
  caregiverId,
  type,
  documentCount,
}: {
  caregiverId: string;
  type: DocumentType;
  documentCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch(
        `/api/caregivers/${caregiverId}/sections/${type}/export`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Export fehlgeschlagen");
      }
      const { exportJob } = await res.json();
      const url = `/api/exports/${exportJob.id}/file`;
      setDownloadUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (documentCount === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm mt-2">
      <button
        onClick={run}
        disabled={busy}
        className="btn btn-primary"
      >
        {busy ? "Erstelle PDF…" : `PDF erstellen (${documentCount})`}
      </button>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: "var(--brand)" }}
        >
          PDF öffnen
        </a>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--brand)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
