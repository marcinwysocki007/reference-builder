"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/locale-context";

export function RecommendationLetterCard({
  caregiverId,
  initialText,
  initialUpdatedAt,
  hasProfileData,
}: {
  caregiverId: string;
  initialText: string | null;
  initialUpdatedAt: string | null;
  // True if there's enough profile + doc data for the AI to generate from
  hasProfileData: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [text, setText] = useState(initialText ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy("gen");
    setError(null);
    const res = await fetch(
      `/api/caregivers/${caregiverId}/recommendation-letter/generate`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.hint ?? body.error ?? t("letter.errorGenerate"));
    } else {
      const { caregiver } = await res.json();
      setText(caregiver.recommendationLetterDe ?? "");
      setUpdatedAt(caregiver.recommendationLetterUpdatedAt ?? null);
      setEditing(true);
    }
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    setError(null);
    const res = await fetch(
      `/api/caregivers/${caregiverId}/recommendation-letter`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    if (!res.ok) {
      setError(t("letter.errorSave"));
    } else {
      const { caregiver } = await res.json();
      setUpdatedAt(caregiver.recommendationLetterUpdatedAt ?? null);
      setEditing(false);
      router.refresh();
    }
    setBusy(null);
  }

  async function exportPDF() {
    setBusy("pdf");
    setError(null);
    const res = await fetch(
      `/api/caregivers/${caregiverId}/sections/EMPFEHLUNG/export`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? t("common.error"));
    } else {
      const { exportJob } = await res.json();
      window.open(`/api/exports/${exportJob.id}/file`, "_blank", "noopener,noreferrer");
      router.refresh();
    }
    setBusy(null);
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{t("letter.heading")}</h2>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {hasText
              ? updatedAt
                ? `${t("letter.statusReady")} ${new Date(updatedAt).toLocaleString()}`
                : t("letter.statusDraft")
              : hasProfileData
                ? t("letter.statusEmptyAi")
                : t("letter.statusEmptyManual")}
          </div>
        </div>
        <div className="flex gap-2">
          {hasProfileData && (
            <button
              onClick={generate}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              {busy === "gen"
                ? t("letter.generating")
                : hasText
                  ? t("letter.regenerate")
                  : t("letter.generate")}
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              {hasText ? t("common.edit") : t("letter.writeManually")}
            </button>
          )}
          {hasText && !editing && (
            <button
              onClick={exportPDF}
              disabled={!!busy}
              className="btn btn-primary text-xs"
            >
              {busy === "pdf" ? t("sectionPdf.creating") : t("sectionPdf.create")}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="textarea font-mono text-sm"
            rows={18}
            placeholder={t("letter.placeholder")}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setText(initialText ?? "");
                setEditing(false);
              }}
              disabled={!!busy}
              className="btn btn-ghost text-xs"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={save}
              disabled={!!busy}
              className="btn btn-primary text-xs"
            >
              {busy === "save" ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </>
      ) : hasText ? (
        <div
          className="text-sm whitespace-pre-wrap leading-relaxed rounded-lg p-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          {text}
        </div>
      ) : null}

      {error && (
        <div className="text-sm" style={{ color: "var(--brand)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
