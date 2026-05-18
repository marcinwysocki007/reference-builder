"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initials } from "@/lib/display";

const SIZE = 96; // px — slightly bigger, makes the avatar feel intentional

export function PhotoUploader({
  caregiverId,
  hasPhoto,
  firstName,
  lastName,
}: {
  caregiverId: string;
  hasPhoto: boolean;
  firstName: string;
  lastName: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("photo", file);
    await fetch(`/api/caregivers/${caregiverId}/photo`, {
      method: "POST",
      body: fd,
    });
    setVersion((v) => v + 1);
    setBusy(false);
    router.refresh();
  }

  const ringStyle: React.CSSProperties = {
    width: SIZE,
    height: SIZE,
    minWidth: SIZE,
    minHeight: SIZE,
    borderRadius: "50%",
    objectFit: "cover",
    boxShadow:
      "0 0 0 3px white, 0 0 0 4px var(--brand-soft), 0 2px 6px rgba(0,0,0,0.08)",
    display: "block",
  };

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      title={hasPhoto ? "Foto ändern" : "Foto hinzufügen"}
      className="relative group shrink-0"
      style={{
        width: SIZE,
        height: SIZE,
        padding: 0,
        background: "transparent",
        border: 0,
      }}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/caregivers/${caregiverId}/photo/file?v=${version}`}
          alt={firstName}
          style={ringStyle}
        />
      ) : (
        <div
          style={{
            ...ringStyle,
            background: "var(--brand-tint)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {initials(firstName, lastName)}
        </div>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-xs"
        style={{
          background: "rgba(0,0,0,0.45)",
          borderRadius: "50%",
          width: SIZE,
          height: SIZE,
        }}
      >
        {busy ? "…" : hasPhoto ? "ändern" : "+ Foto"}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
    </button>
  );
}
