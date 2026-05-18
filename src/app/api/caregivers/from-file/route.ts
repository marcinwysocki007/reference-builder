import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractProfileFromText } from "@/lib/anthropic";
import { extractText } from "@/lib/extract-text";
import { isUploadedFile, type UploadedFile } from "@/lib/form";
import { saveFile } from "@/lib/storage";
import { enhanceScan, squareCropPortrait } from "@/lib/image";
import { extractPortraitFromPDF } from "@/lib/pdf-extract-image";

export const runtime = "nodejs";
export const maxDuration = 180;

// POST /api/caregivers/from-file
// multipart/form-data: file (one or more, field "files")
// Runs OCR / PDF text extraction on each, concatenates the result, asks Claude
// to extract a contact-data-free profile, creates the caregiver.
// Source files are NOT stored — they're processed in a temp dir and discarded.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fileEntries: UploadedFile[] = [];
  for (const v of form.getAll("files")) {
    if (isUploadedFile(v)) fileEntries.push(v);
  }
  if (fileEntries.length === 0) {
    const single = form.get("file");
    if (isUploadedFile(single)) fileEntries.push(single);
  }
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  // Save each upload to a temp file in storage/_tmp/<id>/ so the shared
  // extractText helper (which reads paths) can use it. Cleanup at the end.
  const tmpId = crypto.randomBytes(6).toString("hex");
  const chunks: string[] = [];
  const tmpRelPaths: string[] = [];
  let photoCandidate: Buffer | null = null;

  try {
    for (let i = 0; i < fileEntries.length; i++) {
      const f = fileEntries[i];
      const buf = Buffer.from(await f.arrayBuffer());
      const isImage = (f.type || "").startsWith("image/");
      const finalBuf = isImage ? await enhanceScan(buf) : buf;
      const ext =
        f.type === "application/pdf" ? "pdf" : isImage ? "jpg" : "bin";
      const subpath = path.join("_tmp", tmpId, `src-${i}.${ext}`);
      const stored = await saveFile({
        bucket: "documents",
        subpath,
        data: finalBuf,
      });
      tmpRelPaths.push(stored);
      const mime = isImage ? "image/jpeg" : f.type || "application/octet-stream";
      const text = await extractText({ path: stored, mime });
      if (text) chunks.push(`[Quelle ${i + 1}: ${f.name}]\n${text}`);

      // Try to find a portrait photo: PDFs get scanned for embedded images;
      // for uploaded images we just keep the file itself as a candidate.
      if (!photoCandidate) {
        if (f.type === "application/pdf") {
          try {
            const extracted = await extractPortraitFromPDF(buf);
            if (extracted) photoCandidate = extracted;
          } catch (e) {
            console.error("[from-file] portrait extract failed:", e);
          }
        } else if (isImage) {
          photoCandidate = finalBuf;
        }
      }
    }

    const combined = chunks.join("\n\n---\n\n").trim();
    if (!combined) {
      return NextResponse.json(
        { error: "no_text_extracted", hint: "OCR konnte keinen Text lesen. Foto klarer oder als PDF hochladen." },
        { status: 422 },
      );
    }

    const filenames = fileEntries.map((f) => f.name);
    const profile = await extractProfileFromText(combined, { filenames });
    const firstName = profile.firstName?.trim();
    // Abbreviated lastnames ("W.", "K.") and "?" placeholder are valid — agency
    // profiles routinely anonymize the surname. Only fail if there's no first name.
    const lastName = profile.lastName?.trim() || "";
    if (!firstName) {
      return NextResponse.json(
        { error: "could_not_extract_name", profile, hint: "Kein Vorname im Dokument gefunden." },
        { status: 422 },
      );
    }

    const created = await prisma.caregiver.create({
      data: {
        firstName,
        lastName,
        formerName: profile.formerName?.trim() || null,
        birthDate: profile.birthDate ? safeDate(profile.birthDate) : null,
        languages: profile.languages?.trim() || null,
        specialties: profile.specialties?.trim() || null,
        bio: profile.bio?.trim() || null,
      },
    });

    let photoSet = false;
    if (photoCandidate) {
      try {
        const processed = await squareCropPortrait(photoCandidate, 600);
        const storedPhoto = await saveFile({
          bucket: "photos",
          subpath: `${created.id}.jpg`,
          data: processed,
        });
        await prisma.caregiver.update({
          where: { id: created.id },
          data: { photoPath: storedPhoto },
        });
        photoSet = true;
      } catch (e) {
        console.error("[from-file] photo save failed:", e);
      }
    }

    return NextResponse.json(
      { caregiver: { ...created, photoPath: photoSet ? `photos/${created.id}.jpg` : null }, extracted: profile, photoExtracted: photoSet },
      { status: 201 },
    );
  } finally {
    // Discard temp files — we don't persist profile sources.
    await Promise.all(
      tmpRelPaths.map(async (rel) => {
        try {
          const full = path.join(
            process.env.STORAGE_DIR ?? "./storage",
            rel,
          );
          await fsp.unlink(full).catch(() => {});
        } catch {
          /* ignore */
        }
      }),
    );
    try {
      const dir = path.join(
        process.env.STORAGE_DIR ?? "./storage",
        "documents",
        "_tmp",
        tmpId,
      );
      await fsp.rmdir(dir).catch(() => {});
    } catch {
      /* ignore */
    }
    // Touch os to silence unused-import warning if tree-shaken oddly.
    void os;
  }
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
