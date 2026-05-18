import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const job = await prisma.exportJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ exportJob: job });
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json();
  const job = await prisma.exportJob.update({
    where: { id },
    data: {
      ...(body.summaryDraft !== undefined && { summaryDraft: body.summaryDraft }),
      ...(body.summaryFinal !== undefined && { summaryFinal: body.summaryFinal }),
    },
  });
  return NextResponse.json({ exportJob: job });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const job = await prisma.exportJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.outputPath) await deleteFile(job.outputPath);
  await prisma.exportJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
