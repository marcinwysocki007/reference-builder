"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/locale-context";

export function DocumentDeleteButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`${t("document.deleteConfirm")} ${title}`)) return;
    setBusy(true);
    await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={t("document.deleteLabel")}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition disabled:opacity-50"
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
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      {busy ? "…" : t("document.deleteLabel")}
    </button>
  );
}
