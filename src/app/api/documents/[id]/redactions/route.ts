import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redactionBoxesSchema } from "@/lib/validation";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const boxes = await prisma.redactionBox.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ boxes });
}

// Replaces the full list of redaction boxes for a document.
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = redactionBoxesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await prisma.$transaction([
    prisma.redactionBox.deleteMany({ where: { documentId: id } }),
    prisma.redactionBox.createMany({
      data: parsed.data.boxes.map((b) => ({
        documentId: id,
        page: b.page,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        source: b.source,
        reason: b.reason ?? null,
        approved: b.approved,
      })),
    }),
  ]);
  const boxes = await prisma.redactionBox.findMany({ where: { documentId: id } });
  return NextResponse.json({ boxes });
}
