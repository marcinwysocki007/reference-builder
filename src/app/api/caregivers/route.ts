import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { caregiverCreateSchema } from "@/lib/validation";

export async function GET() {
  const list = await prisma.caregiver.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
  return NextResponse.json({ caregivers: list });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = caregiverCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const created = await prisma.caregiver.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      formerName: data.formerName ?? null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      bio: data.bio ?? null,
      languages: data.languages ?? null,
      specialties: data.specialties ?? null,
    },
  });
  return NextResponse.json({ caregiver: created }, { status: 201 });
}
