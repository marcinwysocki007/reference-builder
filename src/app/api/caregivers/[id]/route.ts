import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { caregiverUpdateSchema } from "@/lib/validation";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const caregiver = await prisma.caregiver.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { createdAt: "asc" },
        include: { redactionBoxes: true },
      },
      exports: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!caregiver) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ caregiver });
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = caregiverUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const updated = await prisma.caregiver.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.formerName !== undefined && { formerName: data.formerName }),
      ...(data.birthDate !== undefined && {
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.languages !== undefined && { languages: data.languages }),
      ...(data.specialties !== undefined && { specialties: data.specialties }),
    },
  });
  return NextResponse.json({ caregiver: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  await prisma.caregiver.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
