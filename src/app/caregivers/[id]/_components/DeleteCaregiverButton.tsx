"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCaregiverButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Pflegekraft und alle Dokumente unwiderruflich löschen?")) return;
    setBusy(true);
    await fetch(`/api/caregivers/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <button onClick={onDelete} disabled={busy} className="btn btn-ghost text-sm">
      {busy ? "Lösche…" : "Löschen"}
    </button>
  );
}
