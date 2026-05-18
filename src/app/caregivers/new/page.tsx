"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useT } from "@/lib/locale-context";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
};

export default function NewCaregiverPage() {
  const router = useRouter();
  const t = useT();
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
      setError(t("newCaregiver.errorNoInput"));
      return;
    }
    setBusy(true);

    let caregiverId: string | null = null;

    if (hasProfile) {
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
            ? t("newCaregiver.errorNoName")
            : body.error === "no_text_extracted"
            ? t("newCaregiver.errorNoText")
            : t("newCaregiver.errorGeneric");
        setError(msg);
        setBusy(false);
        return;
      }
      const { caregiver } = await res.json();
      caregiverId = caregiver.id;
    } else {
      const res = await fetch("/api/caregivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || "?",
        }),
      });
      if (!res.ok) {
        setError(t("newCaregiver.errorGeneric"));
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
      <h1 className="text-2xl font-semibold mb-1">
        {t("newCaregiver.title")}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {t("newCaregiver.intro")}
      </p>

      <div className="card space-y-5">
        <div>
          <label className="label">{t("newCaregiver.profileFiles")}</label>
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
              {t("newCaregiver.profileDropTitle")}
            </div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {isDragActive
                ? t("newCaregiver.profileDropActive")
                : t("newCaregiver.profileDropHint")}
            </div>
            <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              {t("newCaregiver.profileDropFormats")}
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
                    {t("common.remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="flex items-center gap-3 text-xs"
          style={{ color: "var(--muted)" }}
        >
          <div
            className="flex-1 border-t"
            style={{ borderColor: "var(--border)" }}
          />
          <span>{t("common.or")}</span>
          <div
            className="flex-1 border-t"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div>
          <label className="label">{t("newCaregiver.nameSection")}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder={t("newCaregiver.firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={profileFiles.length > 0}
            />
            <input
              className="input"
              placeholder={t("newCaregiver.lastNamePlaceholder")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={profileFiles.length > 0}
            />
          </div>
          {profileFiles.length > 0 && (
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {t("newCaregiver.nameDisabled")}
            </div>
          )}
        </div>

        <div>
          <label className="label">{t("newCaregiver.photoLabel")}</label>
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
            {t("common.cancel")}
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
                ? t("newCaregiver.readingProfile")
                : t("newCaregiver.creating")
              : t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
