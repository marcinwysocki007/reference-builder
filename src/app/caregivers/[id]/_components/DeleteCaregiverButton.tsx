"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/locale-context";

export function DeleteCaregiverButton({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(t("caregiverActions.deleteConfirm"))) return;
    setBusy(true);
    await fetch(`/api/caregivers/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <button onClick={onDelete} disabled={busy} className="btn btn-ghost text-sm">
      {busy ? t("caregiverActions.deleting") : t("common.delete")}
    </button>
  );
}
