import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRecommendationLetter } from "@/lib/anthropic";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/caregivers/:id/recommendation-letter/generate
// Generates a fresh German recommendation letter from the caregiver's
// profile + any uploaded reference/certificate context. Stores it on the
// caregiver record; user can then edit it via PATCH /…/recommendation-letter.
export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const caregiver = await prisma.caregiver.findUnique({
    where: { id },
    include: { documents: { where: { type: { in: ["REFERENZ", "ZERTIFIKAT"] } } } },
  });
  if (!caregiver) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Need at least SOMETHING to generate from — name alone isn't enough for a
  // meaningful letter.
  const hasProfileData = !!(
    caregiver.bio ||
    caregiver.languages ||
    caregiver.specialties
  );
  const hasDocs = caregiver.documents.length > 0;
  if (!hasProfileData && !hasDocs) {
    return NextResponse.json(
      {
        error: "no_profile_data",
        hint:
          "Keine Profil-Daten und keine Referenzen/Zertifikate vorhanden — bitte den Brief selbst schreiben oder erst ein Profil hochladen.",
      },
      { status: 422 },
    );
  }

  const text = await generateRecommendationLetter({
    caregiver: {
      firstName: caregiver.firstName,
      lastName: caregiver.lastName,
      formerName: caregiver.formerName,
      languages: caregiver.languages,
      specialties: caregiver.specialties,
      bio: caregiver.bio,
    },
    contextDocs: caregiver.documents.map((d) => ({
      type: d.type,
      title: d.title,
      issuedBy: d.issuedBy,
      issuedAt: d.issuedAt,
      language: d.originalLang,
      text: [d.translationText, d.ocrText].filter(Boolean).join("\n\n") || "",
    })),
  });

  const updated = await prisma.caregiver.update({
    where: { id },
    data: {
      recommendationLetterDe: text,
      recommendationLetterUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({
    caregiver: {
      id: updated.id,
      recommendationLetterDe: updated.recommendationLetterDe,
      recommendationLetterUpdatedAt: updated.recommendationLetterUpdatedAt,
    },
  });
}
