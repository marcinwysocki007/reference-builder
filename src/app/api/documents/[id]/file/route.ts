import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new NextResponse("not found", { status: 404 });
  const buf = await readFile(doc.originalPath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.originalMime,
      "Cache-Control": "private, max-age=300",
    },
  });
}
