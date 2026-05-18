"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      setError(
        body.hint ??
          body.error ??
          "KI-Generierung fehlgeschlagen.",
      );
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
      setError("Speichern fehlgeschlagen.");
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
      setError(b.message ?? b.error ?? "Export fehlgeschlagen.");
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
          <h2 className="font-semibold">Empfehlungsschreiben</h2>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {hasText
              ? updatedAt
                ? `zuletzt aktualisiert ${new Date(updatedAt).toLocaleString("de-DE")}`
                : "Entwurf vorhanden"
              : hasProfileData
              ? "Noch kein Schreiben — KI-Entwurf möglich"
              : "Noch kein Schreiben — bitte selbst schreiben"}
          </div>
        </div>
        <div className="flex gap-2">
          {hasProfileData && (
            <button
              onClick={generate}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
              title="KI generiert einen neuen Entwurf aus dem Profil"
            >
              {busy === "gen" ? "KI denkt…" : hasText ? "Neu generieren" : "KI-Entwurf"}
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              {hasText ? "Bearbeiten" : "Selbst schreiben"}
            </button>
          )}
          {hasText && !editing && (
            <button
              onClick={exportPDF}
              disabled={!!busy}
              className="btn btn-primary text-xs"
            >
              {busy === "pdf" ? "Erstelle…" : "PDF erstellen"}
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
            placeholder="Sehr geehrte Damen und Herren&#10;…"
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
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={!!busy}
              className="btn btn-primary text-xs"
            >
              {busy === "save" ? "Speichere…" : "Speichern"}
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
