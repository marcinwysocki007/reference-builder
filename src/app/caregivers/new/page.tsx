"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
};

export default function NewCaregiverPage() {
  const router = useRouter();
  const [profileFiles, setProfileFiles] = useState<File[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setError(null);
    setProfileFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  });

  async function submit() {
    setError(null);

    const hasProfile = profileFiles.length > 0;
    const hasName = firstName.trim().length > 0;

    if (!hasProfile && !hasName) {
      setError(
        "Bitte entweder eine Profil-Datei hochladen ODER mindestens einen Vornamen eingeben.",
      );
      return;
    }
    setBusy(true);

    let caregiverId: string | null = null;

    if (hasProfile) {
      // KI extracts name + metadata from uploaded profile files.
      const fd = new FormData();
      for (const f of profileFiles) fd.append("files", f);
      const res = await fetch("/api/caregivers/from-file", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          body.error === "could_not_extract_name"
            ? "Kein Name im Dokument erkennbar. Bitte Vor-/Nachname unten eintragen."
            : body.error === "no_text_extracted"
            ? "Aus den Dateien konnte kein Text gelesen werden. Bitte Vor-/Nachname eintragen oder schärferes Foto/PDF nutzen."
            : `Anlegen fehlgeschlagen: ${body.error ?? res.statusText}`;
        setError(msg);
        setBusy(false);
        return;
      }
      const { caregiver } = await res.json();
      caregiverId = caregiver.id;
    } else {
      // Direct create from the manually-typed name.
      const res = await fetch("/api/caregivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || "?",
        }),
      });
      if (!res.ok) {
        setError("Pflegekraft konnte nicht angelegt werden.");
        setBusy(false);
        return;
      }
      const { caregiver } = await res.json();
      caregiverId = caregiver.id;
    }

    if (caregiverId && photo) {
      const photoForm = new FormData();
      photoForm.set("photo", photo);
      await fetch(`/api/caregivers/${caregiverId}/photo`, {
        method: "POST",
        body: photoForm,
      });
    }

    if (caregiverId) router.push(`/caregivers/${caregiverId}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Neue Pflegekraft</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Entweder Profil-Datei hochladen (KI extrahiert Name, Geburtsname, Sprachen, Schwerpunkte)
        — oder unten direkt Vor- und Nachname eintippen. Foto ist immer optional.
        Kontaktdaten (Telefon, E-Mail, Adresse) werden grundsätzlich nicht übernommen.
      </p>

      <div className="card space-y-5">
        {/* Variant A: drop a profile file → KI extracts everything */}
        <div>
          <label className="label">Profil-Datei(en) — optional, KI liest aus</label>
          <div
            {...getRootProps()}
            className="cursor-pointer rounded-xl p-6 text-center transition"
            style={{
              border: `2px dashed ${isDragActive ? "var(--brand)" : "var(--border)"}`,
              background: isDragActive ? "var(--brand-tint)" : "transparent",
            }}
          >
            <input {...getInputProps()} />
            <div className="text-3xl mb-2">📋</div>
            <div className="font-semibold mb-1">
              Profil-PDF oder -Screenshot
            </div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {isDragActive
                ? "Loslassen zum Hinzufügen…"
                : "Dateien hierher ziehen oder klicken"}
            </div>
            <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              PDF, JPG, PNG, WebP, HEIC — mehrere Seiten/Bilder möglich
            </div>
          </div>
          {profileFiles.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {profileFiles.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded px-2 py-1"
                  style={{ background: "var(--brand-tint)" }}
                >
                  <span className="truncate flex-1 mr-3">{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setProfileFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="text-xs opacity-70 hover:opacity-100"
                  >
                    entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
          <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
          <span>ODER</span>
          <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
        </div>

        {/* Variant B: type the name directly */}
        <div>
          <label className="label">Name direkt eintragen — falls kein Profil vorliegt</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Vorname *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={profileFiles.length > 0}
            />
            <input
              className="input"
              placeholder={"Nachname (oder Anfangsbuchstabe, z.B. „W.“)"}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={profileFiles.length > 0}
            />
          </div>
          {profileFiles.length > 0 && (
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              (Deaktiviert weil Profil-Datei vorliegt — KI extrahiert den Namen automatisch.)
            </div>
          )}
        </div>

        {/* Photo always optional */}
        <div>
          <label className="label">Foto (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="input"
          />
        </div>

        {error && (
          <div className="text-sm" style={{ color: "var(--brand)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost"
            disabled={busy}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              busy ||
              (profileFiles.length === 0 && firstName.trim().length === 0)
            }
            className="btn btn-primary"
          >
            {busy
              ? profileFiles.length > 0
                ? "Liest Profil…"
                : "Lege an…"
              : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
