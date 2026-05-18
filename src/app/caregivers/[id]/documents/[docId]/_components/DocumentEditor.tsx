"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Document, RedactionBox } from "@/generated/prisma";

type DocWithBoxes = Document & { redactionBoxes: RedactionBox[] };

export function DocumentEditor({ doc: initialDoc }: { doc: DocWithBoxes }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Partial<Document>) {
    setBusy("saving");
    setError(null);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError("Speichern fehlgeschlagen");
    } else {
      const { document } = await res.json();
      setDoc({ ...doc, ...document });
    }
    setBusy(null);
  }

  async function process(steps: string[], force = false) {
    setBusy(`ki:${steps.join(",")}`);
    setError(null);
    const res = await fetch(`/api/documents/${doc.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps, force }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? "Verarbeitung fehlgeschlagen");
    } else {
      const { document } = await res.json();
      setDoc({ ...doc, ...document, redactionBoxes: document.redactionBoxes });
      router.refresh();
    }
    setBusy(null);
  }

  async function remove() {
    if (!confirm("Dokument löschen?")) return;
    setBusy("delete");
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    router.push(`/caregivers/${doc.caregiverId}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card space-y-3">
        <h2 className="font-semibold">Original</h2>
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {doc.originalMime === "application/pdf" ? (
            <iframe
              src={`/api/documents/${doc.id}/file`}
              className="w-full"
              style={{ height: "70vh" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/documents/${doc.id}/file`}
              alt="Original"
              className="w-full"
            />
          )}
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {doc.originalMime} · {doc.originalLang?.toUpperCase() ?? "Sprache unbekannt"}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-semibold">Metadaten</h2>
          <div>
            <label className="label">Titel</label>
            <input
              className="input"
              defaultValue={doc.title}
              onBlur={(e) => e.target.value !== doc.title && patch({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ausgestellt von</label>
              <input
                className="input"
                defaultValue={doc.issuedBy ?? ""}
                onBlur={(e) =>
                  e.target.value !== (doc.issuedBy ?? "") &&
                  patch({ issuedBy: e.target.value || null })
                }
              />
            </div>
            <div>
              <label className="label">Datum</label>
              <input
                type="date"
                className="input"
                defaultValue={doc.issuedAt ? new Date(doc.issuedAt).toISOString().slice(0, 10) : ""}
                onBlur={(e) =>
                  patch({
                    issuedAt: e.target.value ? new Date(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Schulungs-/Kursthema</label>
            <input
              className="input"
              defaultValue={doc.trainingTopic ?? ""}
              onBlur={(e) =>
                e.target.value !== (doc.trainingTopic ?? "") &&
                patch({ trainingTopic: e.target.value || null })
              }
            />
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Agentur-Bestätigung (DE)</h2>
            <button
              onClick={() => process(["ocr", "metadata", "attest"], true)}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              {busy?.startsWith("ki:") ? "KI läuft…" : "KI-Entwurf neu"}
            </button>
          </div>
          <textarea
            className="textarea"
            rows={4}
            defaultValue={doc.agencyAttestation ?? ""}
            onBlur={(e) =>
              e.target.value !== (doc.agencyAttestation ?? "") &&
              patch({ agencyAttestation: e.target.value || null })
            }
            placeholder="z.B. „Hierbei handelt es sich um eine Referenz, ausgestellt von …"
          />
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Deutsche Übersetzung</h2>
            <button
              onClick={() => process(["ocr", "translate"], true)}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              KI-Übersetzung neu
            </button>
          </div>
          <textarea
            className="textarea font-mono text-sm"
            rows={10}
            defaultValue={doc.translationText ?? ""}
            onBlur={(e) =>
              e.target.value !== (doc.translationText ?? "") &&
              patch({ translationText: e.target.value || null })
            }
            placeholder="Vom OCR + KI ausgefüllt — frei editierbar."
          />
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">RODO / DSGVO — Drittpersonen-Daten</h2>
            <button
              onClick={() => process(["pii"], true)}
              disabled={!!busy}
              className="btn btn-secondary text-xs"
            >
              KI-Vorschläge neu
            </button>
          </div>
          {doc.redactionBoxes.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Noch keine PII gefunden. Klick „KI-Vorschläge neu" oben.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {doc.redactionBoxes.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start gap-2 p-2 rounded"
                  style={{ background: b.approved ? "#e8f5e9" : "#fff3e0" }}
                >
                  <input
                    type="checkbox"
                    defaultChecked={b.approved}
                    onChange={async (e) => {
                      const updated = doc.redactionBoxes.map((x) =>
                        x.id === b.id ? { ...x, approved: e.target.checked } : x,
                      );
                      await fetch(`/api/documents/${doc.id}/redactions`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          boxes: updated.map((x) => ({
                            page: x.page,
                            x: x.x,
                            y: x.y,
                            width: x.width,
                            height: x.height,
                            source: x.source as "ai" | "manual",
                            reason: x.reason,
                            approved: x.approved,
                          })),
                        }),
                      });
                      setDoc({ ...doc, redactionBoxes: updated });
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div>{b.reason ?? "—"}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {b.source === "ai" ? "KI-Vorschlag" : "Manuell"} · Seite {b.page + 1}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Nur als „bestätigt" markierte Schwärzungen mit definierter Geometrie werden im PDF
            angewandt. Geometrie zeichnen kommt in v2 — bis dahin direkt im Dokument schwärzen oder
            sensible Stellen in der Übersetzung weglassen.
          </p>
        </div>

        <div className="card flex items-center justify-between">
          <button
            onClick={() => process(["ocr", "metadata", "translate", "attest", "pii"], true)}
            disabled={!!busy}
            className="btn btn-secondary"
          >
            Alle KI-Schritte neu
          </button>
          <button onClick={remove} className="btn btn-ghost text-red-600">
            Dokument löschen
          </button>
        </div>

        {error && (
          <div className="card text-sm" style={{ color: "var(--brand)" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
