import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractProfileFromText } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/caregivers/from-text
// body: { text: string }
// Uses Claude to extract structured profile fields, then creates the caregiver.
// Returns the created caregiver. Photo can be uploaded separately via
// POST /api/caregivers/:id/photo.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text: string = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "missing_text" }, { status: 400 });

  const profile = await extractProfileFromText(text);
  const firstName = profile.firstName?.trim();
  const lastName = profile.lastName?.trim();
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "could_not_extract_name", profile },
      { status: 422 },
    );
  }

  const created = await prisma.caregiver.create({
    data: {
      firstName,
      lastName,
      formerName: profile.formerName?.trim() || null,
      birthDate: profile.birthDate ? safeDate(profile.birthDate) : null,
      languages: profile.languages?.trim() || null,
      specialties: profile.specialties?.trim() || null,
      bio: profile.bio?.trim() || null,
    },
  });
  return NextResponse.json({ caregiver: created, extracted: profile }, { status: 201 });
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
