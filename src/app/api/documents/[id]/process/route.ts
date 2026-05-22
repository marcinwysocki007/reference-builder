import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/extract-text";
import {
  translateToGerman,
  generateAgencyAttestation,
  detectPII,
  extractMetadata,
  visionExtractAndOrient,
  visionDetectPIIBoxes,
  visionDetectDocumentBounds,
  type SupportedImageMime,
} from "@/lib/anthropic";
import { readFile, writeFile } from "@/lib/storage";
import { recognizeWordBoxes } from "@/lib/ocr";
import { locatePIIBoxesViaOCR } from "@/lib/pii-locate";
import { extractLargestImageFromPDF } from "@/lib/pdf-extract-image";
import { enhanceDocument, autoCropToDocument } from "@/lib/image";

interface RouteCtx { params: Promise<{ id: string }> }

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/documents/:id/process
// body (optional):
//   { steps: ["ocr","metadata","translate","attest","pii"], force: bool }
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const steps: string[] = body.steps ?? ["ocr", "metadata", "translate", "attest", "pii"];
  const force: boolean = !!body.force;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { caregiver: true },
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.document.update({ where: { id }, data: { status: "PROCESSING", error: null } });

  try {
    let ocrText = doc.ocrText ?? "";

    // Image-PDFs (phone photo wrapped in a PDF, no text layer) need the same
    // crop + rotate + enhance + vision pipeline as plain image uploads —
    // otherwise they end up in the export sideways and faint. Convert to
    // JPEG once, update the doc record, and the rest of the pipeline treats
    // it as an image from here on.
    if (doc.originalMime === "application/pdf" && (force || !ocrText)) {
      try {
        const buf = await readFile(doc.originalPath);
        const probeText = await extractText({
          path: doc.originalPath,
          mime: doc.originalMime,
        });
        const trimmedLen = probeText.replace(/\s+/g, "").length;
        if (trimmedLen < 80) {
          const extracted = await extractLargestImageFromPDF(buf);
          if (extracted) {
            // 1. Crop to document edges (excludes desk, binder, sleeve, etc.)
            const bounds = await visionDetectDocumentBounds({
              imageBuffer: extracted,
              mediaType: "image/jpeg",
            }).catch(() => null);
            const cropped = await autoCropToDocument(extracted, bounds);
            // 2. Enhance contrast / sharpen for legibility.
            const enhanced = await enhanceDocument(cropped);
            const newPath = doc.originalPath.replace(/\.pdf$/i, ".jpg");
            await writeFile(newPath, enhanced);
            await prisma.document.update({
              where: { id },
              data: {
                originalPath: newPath,
                originalMime: "image/jpeg",
              },
            });
            doc.originalPath = newPath;
            doc.originalMime = "image/jpeg";
          }
        }
      } catch (err) {
        console.error("[process] image-pdf conversion failed:", err);
      }
    }

    // Direct image uploads: also auto-crop on (re)processing. Saves over the
    // original — re-running is idempotent because Claude won't see margins to
    // trim on an already-cropped image.
    if (doc.originalMime.startsWith("image/") && (force || !ocrText)) {
      try {
        const buf = await readFile(doc.originalPath);
        const mediaType = (
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            doc.originalMime,
          )
            ? doc.originalMime
            : "image/jpeg"
        ) as SupportedImageMime;
        const bounds = await visionDetectDocumentBounds({
          imageBuffer: buf,
          mediaType,
        }).catch(() => null);
        if (bounds) {
          const cropped = await autoCropToDocument(buf, bounds);
          if (cropped !== buf && cropped.length !== buf.length) {
            await writeFile(doc.originalPath, cropped);
          }
        }
      } catch (err) {
        console.error("[process] auto-crop failed:", err);
      }
    }

    if (steps.includes("ocr") && (!ocrText || force)) {
      if (doc.originalMime.startsWith("image/")) {
        // For photographed paper docs we use Claude vision: dramatically
        // better than tesseract on noisy phone scans, and it also tells us
        // whether the image needs rotation to be upright.
        const buf = await readFile(doc.originalPath);
        const mediaType = (
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            doc.originalMime,
          )
            ? doc.originalMime
            : "image/jpeg"
        ) as SupportedImageMime;
        const vision = await visionExtractAndOrient({
          imageBuffer: buf,
          mediaType,
        });
        if (vision.rotation !== 0) {
          const rotated = await sharp(buf)
            .rotate(vision.rotation)
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();
          await writeFile(doc.originalPath, rotated);
        }
        ocrText = vision.text;
      } else {
        ocrText = await extractText({
          path: doc.originalPath,
          mime: doc.originalMime,
        });
      }
      await prisma.document.update({
        where: { id },
        data: { ocrText },
      });
    }

    if (steps.includes("metadata") && ocrText) {
      const meta = await extractMetadata(ocrText);
      // Auto-uploaded docs get their title derived from the filename — always
      // let AI-extracted metadata win on the first processing pass. Manual
      // edits via PATCH happen after this step, so they're never overwritten.
      await prisma.document.update({
        where: { id },
        data: {
          ...(meta.title && { title: meta.title }),
          ...(meta.issuedBy && (!doc.issuedBy || force) && { issuedBy: meta.issuedBy }),
          ...(meta.issuedAt &&
            (!doc.issuedAt || force) && {
              issuedAt: safeDate(meta.issuedAt),
            }),
          ...(meta.trainingTopic && (!doc.trainingTopic || force) && {
            trainingTopic: meta.trainingTopic,
          }),
          ...(meta.language && (!doc.originalLang || force) && {
            originalLang: meta.language,
          }),
        },
      });
    }

    if (steps.includes("translate") && ocrText) {
      const langNow = (await prisma.document.findUnique({ where: { id } }))?.originalLang;
      if (langNow !== "de" && (!doc.translationText || force)) {
        const translated = await translateToGerman(ocrText);
        await prisma.document.update({
          where: { id },
          data: { translationText: translated },
        });
      }
    }

    if (steps.includes("attest") && (!doc.agencyAttestation || force)) {
      const att = await generateAgencyAttestation({
        type: doc.type,
        issuedBy: doc.issuedBy,
        trainingTopic: doc.trainingTopic,
        text: ocrText,
      });
      await prisma.document.update({
        where: { id },
        data: { agencyAttestation: att },
      });
    }

    if (steps.includes("pii")) {
      // Always replace AI-source boxes — vision detection is the new source
      // of truth. Manual boxes (source="manual") are preserved.
      await prisma.redactionBox.deleteMany({
        where: { documentId: id, source: "ai" },
      });

      if (doc.originalMime.startsWith("image/")) {
        // Hybrid PII pipeline:
        //   1. Claude vision identifies PII strings + categories (high
        //      semantic accuracy, low coord accuracy)
        //   2. tesseract returns word-level bboxes (noisy text, precise
        //      coords)
        //   3. We match Claude's strings to tesseract's word positions to
        //      get accurate redaction boxes. Falls back to Claude's coarse
        //      box if no match is found.
        const buf = await readFile(doc.originalPath);
        const mediaType = (
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            doc.originalMime,
          )
            ? doc.originalMime
            : "image/jpeg"
        ) as SupportedImageMime;
        const claudeBoxes = await visionDetectPIIBoxes({
          imageBuffer: buf,
          mediaType,
          caregiverFirstName: doc.caregiver.firstName,
        });
        // OCR for precise word positions. Use the same image dimensions for
        // bbox normalization.
        const meta = await (await import("sharp")).default(buf).metadata();
        const W = meta.width ?? 1;
        const H = meta.height ?? 1;
        let refined = claudeBoxes;
        try {
          const ocrWords = await recognizeWordBoxes(buf, W, H);
          refined = locatePIIBoxesViaOCR(claudeBoxes, ocrWords);
        } catch (err) {
          console.error(
            "[process] tesseract word-bbox lookup failed, using Claude boxes:",
            err,
          );
        }
        for (const b of refined) {
          await prisma.redactionBox.create({
            data: {
              documentId: id,
              page: 0,
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              source: "ai",
              approved: true,
              reason: `[${b.category}] ${b.excerpt}`,
            },
          });
        }
      } else if (ocrText) {
        // PDF docs: text-only detection (no geometric boxes — too brittle
        // to map text offsets to page coordinates). Stored as 0-geometry
        // entries that surface in the review UI but don't auto-overlay.
        const fullName = `${doc.caregiver.firstName} ${doc.caregiver.lastName}`;
        const findings = await detectPII({
          text: ocrText,
          caregiverFullName: fullName,
        });
        for (const f of findings) {
          await prisma.redactionBox.create({
            data: {
              documentId: id,
              page: 0,
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              source: "ai",
              reason: `[${f.category}] ${f.excerpt} — ${f.reason}`,
            },
          });
        }
      }
    }

    const final = await prisma.document.update({
      where: { id },
      data: { status: "READY" },
      include: { redactionBoxes: true },
    });
    return NextResponse.json({ document: final });
  } catch (err) {
    console.error("[process]", err);
    await prisma.document.update({
      where: { id },
      data: { status: "ERROR", error: String(err) },
    });
    return NextResponse.json({ error: "processing_failed", message: String(err) }, { status: 500 });
  }
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
