import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readFile, writeFile } from "@/lib/storage";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";

// POST /api/documents/:id/rotate
// body: { degrees: 90 | 180 | 270 } — clockwise. Default 90.
// Only works for image documents (rotating embedded PDFs is out of scope —
// the user can re-upload a re-rotated PDF if needed).
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const degrees = Number(body.degrees) || 90;
  if (![90, 180, 270].includes(degrees)) {
    return NextResponse.json({ error: "invalid_degrees" }, { status: 400 });
  }
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!doc.originalMime.startsWith("image/")) {
    return NextResponse.json(
      { error: "only_images_supported" },
      { status: 422 },
    );
  }
  const buf = await readFile(doc.originalPath);
  const rotated = await sharp(buf)
    .rotate(degrees)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  await writeFile(doc.originalPath, rotated);
  return NextResponse.json({ ok: true, degrees });
}
