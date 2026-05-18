import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile, extFromMime, randomId } from "@/lib/storage";
import { enhanceScan } from "@/lib/image";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/types";
import { isUploadedFile } from "@/lib/form";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const caregiverId = String(form.get("caregiverId") ?? "");
  const type = String(form.get("type") ?? "") as DocumentType;
  const issuedBy = (form.get("issuedBy") as string | null) || null;
  const issuedAtRaw = (form.get("issuedAt") as string | null) || null;
  const trainingTopic = (form.get("trainingTopic") as string | null) || null;
  const originalLang = (form.get("originalLang") as string | null) || null;
  const file = form.get("file");

  if (!caregiverId || !DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  // Title can be passed or derived from the uploaded filename. Will likely be
  // overwritten by the AI metadata step shortly after.
  const title =
    String(form.get("title") ?? "") ||
    file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "Dokument";
  const caregiver = await prisma.caregiver.findUnique({ where: { id: caregiverId } });
  if (!caregiver) {
    return NextResponse.json({ error: "caregiver_not_found" }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const isImage = mime.startsWith("image/");
  const finalBuf = isImage ? await enhanceScan(buf) : buf;
  const finalMime = isImage ? "image/jpeg" : mime;
  const ext = isImage ? "jpg" : extFromMime(mime);
  const docId = randomId();
  const subpath = `${docId}/original.${ext}`;
  const stored = await saveFile({ bucket: "documents", subpath, data: finalBuf });

  const doc = await prisma.document.create({
    data: {
      id: docId,
      caregiverId,
      type,
      title,
      issuedBy,
      issuedAt: issuedAtRaw ? new Date(issuedAtRaw) : null,
      trainingTopic,
      originalLang,
      originalPath: stored,
      originalMime: finalMime,
      status: "UPLOADED",
    },
  });
  return NextResponse.json({ document: doc }, { status: 201 });
}
