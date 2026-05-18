"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@/lib/types";
import { useT } from "@/lib/locale-context";

interface FileState {
  name: string;
  status: "uploading" | "processing" | "ready" | "error";
  documentId?: string;
  error?: string;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
};

export function DropZone({
  caregiverId,
  type,
  label,
  hint,
  icon,
}: {
  caregiverId: string;
  type: DocumentType;
  label: string;
  hint: string;
  icon: string;
}) {
  const router = useRouter();
  const t = useT();
  const [files, setFiles] = useState<FileState[]>([]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const initial: FileState[] = accepted.map((f) => ({
        name: f.name,
        status: "uploading",
      }));
      setFiles((prev) => [...prev, ...initial]);

      await Promise.all(
        accepted.map(async (file, i) => {
          const localIdx = files.length + i;
          try {
            const fd = new FormData();
            fd.set("caregiverId", caregiverId);
            fd.set("type", type);
            fd.set("file", file);
            const res = await fetch("/api/documents", { method: "POST", body: fd });
            if (!res.ok) throw new Error(`upload ${res.status}`);
            const { document } = await res.json();

            setFiles((prev) => {
              const next = [...prev];
              next[localIdx] = {
                name: file.name,
                status: "processing",
                documentId: document.id,
              };
              return next;
            });

            const pRes = await fetch(`/api/documents/${document.id}/process`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (!pRes.ok) throw new Error(`process ${pRes.status}`);

            setFiles((prev) => {
              const next = [...prev];
              next[localIdx] = {
                name: file.name,
                status: "ready",
                documentId: document.id,
              };
              return next;
            });
            router.refresh();
          } catch (err) {
            setFiles((prev) => {
              const next = [...prev];
              next[localIdx] = {
                name: file.name,
                status: "error",
                error: String(err),
              };
              return next;
            });
          }
        }),
      );
    },
    [caregiverId, type, files.length, router],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  });

  return (
    <div className="card">
      <div
        {...getRootProps()}
        className="cursor-pointer rounded-xl p-6 text-center transition"
        style={{
          border: `2px dashed ${isDragActive ? "var(--brand)" : "var(--border)"}`,
          background: isDragActive ? "var(--brand-tint)" : "transparent",
        }}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-2">{icon}</div>
        <div className="font-semibold mb-1">{label}</div>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          {isDragActive ? t("drop.dragging") : t("drop.hint")}
        </div>
        <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded px-2 py-1"
              style={{ background: rowBg(f.status) }}
            >
              <span className="truncate flex-1 mr-3">{f.name}</span>
              <span className="text-xs">{statusLabel(t, f.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function rowBg(s: FileState["status"]) {
  return {
    uploading: "#fff3e0",
    processing: "#e3f2fd",
    ready: "#e8f5e9",
    error: "#ffebee",
  }[s];
}

function statusLabel(t: (k: string) => string, s: FileState["status"]) {
  switch (s) {
    case "uploading": return t("drop.uploading");
    case "processing": return t("drop.processing");
    case "ready": return t("drop.done");
    case "error": return t("drop.error");
  }
}
