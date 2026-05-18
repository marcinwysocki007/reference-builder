import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderSectionPDF, renderLetterPDF } from "@/lib/pdf-export";
import { saveFile } from "@/lib/storage";
import { generateSectionOverview } from "@/lib/anthropic";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS_DE, type DocumentType } from "@/lib/types";

interface RouteCtx {
  params: Promise<{ id: string; type: string }>;
}

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/caregivers/:id/sections/:type/export
// Renders ONE section as a self-contained PDF.
//   REFERENZ | ZERTIFIKAT | GRUSSKARTE → cover + section overview +
//     per-doc one-liners + originals appended.
//   EMPFEHLUNG → cover + the generated/edited recommendation letter
//     (single self-contained page, no document attachments).
export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const { id, type: rawType } = await params;
  const type = rawType.toUpperCase() as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  // EMPFEHLUNG has its own data path — it's a generated letter, not docs.
  if (type === "EMPFEHLUNG") {
    return exportLetter(id);
  }

  const caregiver = await prisma.caregiver.findUnique({
    where: { id },
    include: {
      documents: {
        where: { type },
        orderBy: { issuedAt: "desc" },
        include: { redactionBoxes: true },
      },
    },
  });
  if (!caregiver) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (caregiver.documents.length === 0) {
    return NextResponse.json(
      { error: "no_documents_in_section" },
      { status: 422 },
    );
  }

  const docsForAI = caregiver.documents.map((d) => ({
    type: d.type,
    title: d.title,
    issuedBy: d.issuedBy,
    issuedAt: d.issuedAt,
    language: d.originalLang,
    text: [d.translationText, d.ocrText].filter(Boolean).join("\n\n") || "",
  }));

  const overview = await generateSectionOverview({
    type,
    caregiver: {
      firstName: caregiver.firstName,
      lastName: caregiver.lastName,
      formerName: caregiver.formerName,
      languages: caregiver.languages,
      specialties: caregiver.specialties,
    },
    documents: docsForAI,
  });

  const job = await prisma.exportJob.create({
    data: {
      caregiverId: id,
      summaryDraft: overview.overview,
      summaryFinal: overview.overview,
      status: "RENDERING",
    },
  });

  try {
    const pdfBuf = await renderSectionPDF({
      caregiver: {
        firstName: caregiver.firstName,
        lastName: caregiver.lastName,
        formerName: caregiver.formerName,
        photoPath: caregiver.photoPath,
        bio: caregiver.bio,
        languages: caregiver.languages,
        specialties: caregiver.specialties,
      },
      type,
      overview: overview.overview,
      documents: caregiver.documents.map((d, i) => ({
        id: d.id,
        type: d.type,
        // Prefer the AI-translated German title for display; fall back to DB title.
        title: overview.titles[i] || d.title,
        issuedBy: d.issuedBy,
        issuedAt: d.issuedAt,
        trainingTopic: d.trainingTopic,
        originalPath: d.originalPath,
        originalMime: d.originalMime,
        originalLang: d.originalLang,
        translationText: d.translationText,
        agencyAttestation: d.agencyAttestation,
        redactionBoxes: d.redactionBoxes.map((b) => ({
          page: b.page,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          approved: b.approved,
        })),
        blurb: overview.blurbs[i],
      })),
    });

    const sectionLabel = DOCUMENT_TYPE_LABELS_DE[type].replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
    const cleanName = `${caregiver.lastName}_${caregiver.firstName}`
      .replace(/[^a-zA-ZäöüÄÖÜß0-9_-]/g, "")
      .slice(0, 60);
    const filename = `${sectionLabel}_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const stored = await saveFile({
      bucket: "exports",
      subpath: `${job.id}/${filename}`,
      data: pdfBuf,
    });
    const updated = await prisma.exportJob.update({
      where: { id: job.id },
      data: { outputPath: stored, status: "READY" },
    });
    return NextResponse.json({ exportJob: updated, filename, type });
  } catch (err) {
    console.error("[section-export]", err);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "ERROR" },
    });
    return NextResponse.json(
      { error: "render_failed", message: String(err) },
      { status: 500 },
    );
  }
}

async function exportLetter(id: string) {
  const caregiver = await prisma.caregiver.findUnique({ where: { id } });
  if (!caregiver) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const letter = caregiver.recommendationLetterDe?.trim();
  if (!letter) {
    return NextResponse.json(
      {
        error: "no_letter",
        hint:
          "Bitte erst ein Empfehlungsschreiben generieren oder eintragen, bevor du es exportierst.",
      },
      { status: 422 },
    );
  }

  const job = await prisma.exportJob.create({
    data: {
      caregiverId: id,
      summaryDraft: letter,
      summaryFinal: letter,
      status: "RENDERING",
    },
  });

  try {
    const pdfBuf = await renderLetterPDF({
      caregiver: {
        firstName: caregiver.firstName,
        lastName: caregiver.lastName,
        formerName: caregiver.formerName,
        photoPath: caregiver.photoPath,
        bio: caregiver.bio,
        languages: caregiver.languages,
        specialties: caregiver.specialties,
      },
      letterText: letter,
    });

    const cleanName = `${caregiver.lastName}_${caregiver.firstName}`
      .replace(/[^a-zA-ZäöüÄÖÜß0-9_-]/g, "")
      .slice(0, 60);
    const filename = `Empfehlungsschreiben_${cleanName}_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    const stored = await saveFile({
      bucket: "exports",
      subpath: `${job.id}/${filename}`,
      data: pdfBuf,
    });
    const updated = await prisma.exportJob.update({
      where: { id: job.id },
      data: { outputPath: stored, status: "READY" },
    });
    return NextResponse.json({ exportJob: updated, filename, type: "EMPFEHLUNG" });
  } catch (err) {
    console.error("[letter-export]", err);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "ERROR" },
    });
    return NextResponse.json(
      { error: "render_failed", message: String(err) },
      { status: 500 },
    );
  }
}
