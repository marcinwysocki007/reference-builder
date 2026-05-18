import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_TYPE_LABELS_DE, type DocumentType } from "@/lib/types";
import { DocumentEditor } from "./_components/DocumentEditor";
import { fullName } from "@/lib/display";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { redactionBoxes: true, caregiver: true },
  });
  if (!doc || doc.caregiverId !== id) notFound();

  return (
    <div className="space-y-4">
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        <Link href={`/caregivers/${id}`} className="hover:underline">
          ← Zurück zu {fullName(doc.caregiver.firstName, doc.caregiver.lastName)}
        </Link>
      </div>
      <div>
        <span className="badge">{DOCUMENT_TYPE_LABELS_DE[doc.type as DocumentType]}</span>
        <h1 className="text-2xl font-semibold mt-2">{doc.title}</h1>
      </div>
      <DocumentEditor doc={doc} />
    </div>
  );
}
