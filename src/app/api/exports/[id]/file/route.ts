import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import path from "node:path";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const job = await prisma.exportJob.findUnique({ where: { id } });
  if (!job?.outputPath) return new NextResponse("not ready", { status: 404 });
  const buf = await readFile(job.outputPath);
  const filename = path.basename(job.outputPath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
