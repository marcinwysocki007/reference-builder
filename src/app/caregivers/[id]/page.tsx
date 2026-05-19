import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { type DocumentType } from "@/lib/types";
import path from "node:path";
import { DropZone } from "./_components/DropZone";
import { SectionExportButton } from "./_components/SectionExportButton";
import { DeleteCaregiverButton } from "./_components/DeleteCaregiverButton";
import { PhotoUploader } from "./_components/PhotoUploader";
import { DocumentDeleteButton } from "./_components/DocumentDeleteButton";
import { DocumentReprocessButton } from "./_components/DocumentReprocessButton";
import { DocumentRotateButton } from "./_components/DocumentRotateButton";
import { ExportDeleteButton } from "./_components/ExportDeleteButton";
import { RecommendationLetterCard } from "./_components/RecommendationLetterCard";
import { fullName } from "@/lib/display";
import { t, sectionMeta } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

// Upload-style sections (file drops). EMPFEHLUNG is rendered alongside but
// uses the letter card (no upload) — handled inline in the grid below.
const UPLOAD_SECTIONS: DocumentType[] = ["REFERENZ", "ZERTIFIKAT", "GRUSSKARTE"];

export default async function CaregiverDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const caregiver = await prisma.caregiver.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      exports: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!caregiver) notFound();

  const docsByType = new Map<string, typeof caregiver.documents>();
  for (const d of caregiver.documents) {
    if (!docsByType.has(d.type)) docsByType.set(d.type, []);
    docsByType.get(d.type)!.push(d);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <PhotoUploader
            caregiverId={caregiver.id}
            hasPhoto={!!caregiver.photoPath}
            firstName={caregiver.firstName}
            lastName={caregiver.lastName}
          />
          <h1 className="text-3xl font-semibold tracking-tight">
            {fullName(caregiver.firstName, caregiver.lastName)}
          </h1>
        </div>
        <DeleteCaregiverButton id={caregiver.id} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {UPLOAD_SECTIONS.map((type) => {
          const docs = docsByType.get(type) ?? [];
          const meta = sectionMeta(locale, type);
          return (
            <div key={type} className="space-y-2">
              <DropZone
                caregiverId={caregiver.id}
                type={type}
                label={meta.label}
                hint={meta.hint}
                icon={meta.icon}
              />
              {docs.length > 0 && (
                <>
                  <ul
                    className="text-sm rounded-lg overflow-hidden divide-y"
                    style={{ background: "white", borderColor: "var(--border)", border: "1px solid var(--border)" }}
                  >
                    {docs.map((d) => (
                      <li
                        key={d.id}
                        className="px-3 py-2 flex items-center gap-2"
                      >
                        <Link
                          href={`/caregivers/${caregiver.id}/documents/${d.id}`}
                          className="flex-1 truncate hover:underline"
                          title={d.title}
                        >
                          {d.title}
                        </Link>
                        <StatusBadge status={d.status} />
                        <DocumentRotateButton documentId={d.id} mime={d.originalMime} />
                        <DocumentReprocessButton documentId={d.id} />
                        <DocumentDeleteButton documentId={d.id} title={d.title} />
                      </li>
                    ))}
                  </ul>
                  <SectionExportButton
                    caregiverId={caregiver.id}
                    type={type}
                    documentCount={docs.length}
                  />
                </>
              )}
            </div>
          );
        })}
        <RecommendationLetterCard
          caregiverId={caregiver.id}
          initialText={caregiver.recommendationLetterDe}
          initialUpdatedAt={
            caregiver.recommendationLetterUpdatedAt
              ? caregiver.recommendationLetterUpdatedAt.toISOString()
              : null
          }
          hasProfileData={
            !!(caregiver.bio || caregiver.languages || caregiver.specialties) ||
            caregiver.documents.some(
              (d) => d.type === "REFERENZ" || d.type === "ZERTIFIKAT",
            )
          }
        />
      </div>

      {caregiver.exports.filter((e) => e.outputPath).length > 0 && (
        <div className="card">
          <div className="font-semibold mb-3">{t(locale, "exports.title")}</div>
          <ul
            className="text-sm rounded-lg overflow-hidden divide-y"
            style={{
              background: "white",
              borderColor: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            {caregiver.exports
              .filter((e) => e.outputPath)
              .slice(0, 12)
              .map((e) => {
                const filename = e.outputPath
                  ? path.basename(e.outputPath)
                  : `Export-${e.id}.pdf`;
                return (
                  <li
                    key={e.id}
                    className="px-3 py-2 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/api/exports/${e.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs hover:underline block truncate"
                        title={filename}
                      >
                        {filename}
                      </a>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "var(--muted)" }}
                      >
                        {new Date(e.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <a
                      href={`/api/exports/${e.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline whitespace-nowrap"
                      style={{ color: "var(--brand)" }}
                    >
                      {t(locale, "common.open")}
                    </a>
                    <ExportDeleteButton exportId={e.id} filename={filename} />
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    UPLOADED: { bg: "#fff3e0", fg: "#b25b00" },
    PROCESSING: { bg: "#e3f2fd", fg: "#0d47a1" },
    READY: { bg: "#e8f5e9", fg: "#1b5e20" },
    ERROR: { bg: "#ffebee", fg: "#b71c1c" },
  };
  const c = colors[status] ?? colors.UPLOADED;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2"
      style={{ background: c.bg, color: c.fg }}
    >
      {status === "READY" ? "✓" : status}
    </span>
  );
}
