import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteCtx { params: Promise<{ id: string }> }

// GET /api/caregivers/:id/recommendation-letter
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const c = await prisma.caregiver.findUnique({
    where: { id },
    select: {
      id: true,
      recommendationLetterDe: true,
      recommendationLetterUpdatedAt: true,
    },
  });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ caregiver: c });
}

// PATCH /api/caregivers/:id/recommendation-letter
// body: { text: string | null }
// Saves the user's edited letter text (or clears it with null).
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string | null =
    typeof body.text === "string" ? body.text : body.text === null ? null : null;

  const updated = await prisma.caregiver.update({
    where: { id },
    data: {
      recommendationLetterDe: text,
      recommendationLetterUpdatedAt: text ? new Date() : null,
    },
    select: {
      id: true,
      recommendationLetterDe: true,
      recommendationLetterUpdatedAt: true,
    },
  });
  return NextResponse.json({ caregiver: updated });
}
