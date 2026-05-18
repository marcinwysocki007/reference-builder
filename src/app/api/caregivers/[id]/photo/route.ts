import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile, deleteFile } from "@/lib/storage";
import { squareCropPortrait } from "@/lib/image";
import { isUploadedFile } from "@/lib/form";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const caregiver = await prisma.caregiver.findUnique({ where: { id } });
  if (!caregiver) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("photo");
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const processed = await squareCropPortrait(buf, 600);
  const subpath = `${id}.jpg`;

  if (caregiver.photoPath) {
    await deleteFile(caregiver.photoPath);
  }

  const stored = await saveFile({ bucket: "photos", subpath, data: processed });
  const updated = await prisma.caregiver.update({
    where: { id },
    data: { photoPath: stored },
  });
  return NextResponse.json({ caregiver: updated });
}
