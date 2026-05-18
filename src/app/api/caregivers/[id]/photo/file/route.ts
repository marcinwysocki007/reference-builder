import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const caregiver = await prisma.caregiver.findUnique({ where: { id } });
  if (!caregiver?.photoPath) {
    return new NextResponse("no photo", { status: 404 });
  }
  const buf = await readFile(caregiver.photoPath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
