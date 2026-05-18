import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { documentUpdateSchema } from "@/lib/validation";
import { deleteFile } from "@/lib/storage";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { redactionBoxes: true, caregiver: true },
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ document: doc });
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = documentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.issuedBy !== undefined && { issuedBy: data.issuedBy }),
      ...(data.issuedAt !== undefined && {
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
      }),
      ...(data.trainingTopic !== undefined && { trainingTopic: data.trainingTopic }),
      ...(data.originalLang !== undefined && { originalLang: data.originalLang }),
      ...(data.translationText !== undefined && { translationText: data.translationText }),
      ...(data.agencyAttestation !== undefined && { agencyAttestation: data.agencyAttestation }),
    },
  });
  return NextResponse.json({ document: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (doc?.originalPath) await deleteFile(doc.originalPath);
  if (doc?.translationPath) await deleteFile(doc.translationPath);
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
