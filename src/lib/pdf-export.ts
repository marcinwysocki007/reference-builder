import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { promises as fs } from "node:fs";
import { readFile } from "./storage";
import {
  roundPortrait,
  gradientPng,
  shadeHex,
  pixelatePIIRegions,
} from "./image";
import {
  DOCUMENT_TYPE_LABELS_DE_PLURAL,
  type DocumentType,
} from "./types";
import { BRANDING } from "./branding";

const TEXT_RGB = rgb(0.12, 0.12, 0.12);
const MUTED_RGB = rgb(0.42, 0.42, 0.42);

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 50;

function hexToRgb(hex: string) {
  const m = hex.trim().replace(/^#/, "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return rgb(
    isFinite(r) ? r : 0.23,
    isFinite(g) ? g : 0.23,
    isFinite(b) ? b : 0.27,
  );
}

const BRAND_RGB = hexToRgb(BRANDING.primary);
const BRAND_SOFT_RGB = hexToRgb(BRANDING.primarySoft);

// Embed Noto Sans (Regular + Bold) so we get proper Polish (ś, ł, ż, ą, …)
// and other extended Latin glyphs. Falls back to Helvetica if the TTFs are
// missing for some reason (e.g. broken deploy).
const FONT_REG_PATH = path.resolve(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.resolve(process.cwd(), "public/fonts/NotoSans-Bold.ttf");

async function loadFonts(pdf: PDFDocument) {
  try {
    pdf.registerFontkit(fontkit);
    const [reg, bold] = await Promise.all([
      fs.readFile(FONT_REG_PATH),
      fs.readFile(FONT_BOLD_PATH),
    ]);
    const font = await pdf.embedFont(reg, { subset: true });
    const fontBold = await pdf.embedFont(bold, { subset: true });
    return { font, fontBold, unicode: true };
  } catch (err) {
    console.warn("[pdf-export] Noto Sans not loaded, falling back to Helvetica:", err);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    return { font, fontBold, unicode: false };
  }
}

export interface ExportInput {
  caregiver: {
    firstName: string;
    lastName: string;
    formerName?: string | null;
    photoPath?: string | null;
    bio?: string | null;
    languages?: string | null;
    specialties?: string | null;
  };
  summary: string;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    issuedBy?: string | null;
    issuedAt?: Date | null;
    trainingTopic?: string | null;
    originalPath: string;
    originalMime: string;
    originalLang?: string | null;
    translationText?: string | null;
    agencyAttestation?: string | null;
    redactionBoxes: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      approved: boolean;
    }>;
  }>;
}

export interface SectionExportInput {
  caregiver: ExportInput["caregiver"];
  type: DocumentType;
  overview: string;
  documents: Array<
    ExportInput["documents"][number] & { blurb?: string }
  >;
}

export async function renderSectionPDF(
  input: SectionExportInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const { font, fontBold } = await loadFonts(pdf);

  await drawSectionCover(pdf, font, fontBold, input);
  for (const doc of input.documents) {
    await appendOriginalPages(pdf, doc);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export interface LetterExportInput {
  caregiver: ExportInput["caregiver"];
  letterText: string;
}

// Self-contained recommendation letter PDF: branded header band with photo
// and caregiver name, then the letter body in a warm letter layout, then a
// signature line.
export async function renderLetterPDF(
  input: LetterExportInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const { font, fontBold } = await loadFonts(pdf);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const afterHeader = await drawCaregiverHeader(
    pdf,
    page,
    font,
    fontBold,
    input.caregiver,
  );

  // Section title
  page.drawText("Empfehlungsschreiben", {
    x: MARGIN,
    y: afterHeader,
    size: 30,
    font: fontBold,
    color: BRAND_RGB,
  });
  let y = afterHeader - 16;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 80, y },
    thickness: 1.2,
    color: BRAND_SOFT_RGB,
  });
  y -= 36;

  // Letter body. Salutation/closing are added by the renderer so the AI
  // doesn't have to produce them (and so they stay consistent visually).
  page = drawLetterBody(pdf, page, font, fontBold, input.letterText, y);

  drawFooter(page, font);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function drawLetterBody(
  pdf: PDFDocument,
  startPage: Page,
  font: Font,
  fontBold: Font,
  body: string,
  startY: number,
): Page {
  let page = startPage;
  const wrapWidth = PAGE_W - 2 * MARGIN;
  const lineH = 17;
  const paragraphGap = 9;
  const minY = MARGIN + 110; // leave room for closing + signature line + footer

  let y = startY;

  // Salutation
  page.drawText("Sehr geehrte Damen und Herren,", {
    x: MARGIN,
    y,
    size: 12,
    font,
    color: TEXT_RGB,
  });
  y -= lineH + paragraphGap;

  // Body — split into paragraphs by blank lines.
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const lines = wrapText(para, font, 12, wrapWidth);
    for (const line of lines) {
      if (y < minY) {
        drawFooter(page, font);
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, size: 12, font, color: TEXT_RGB });
      y -= lineH;
    }
    y -= paragraphGap;
  }

  // Closing
  if (y < minY) {
    drawFooter(page, font);
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }
  y -= 6;
  page.drawText("Mit freundlichen Grüßen", {
    x: MARGIN,
    y,
    size: 12,
    font,
    color: TEXT_RGB,
  });
  y -= 56;

  // Signature line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 200, y },
    thickness: 0.5,
    color: BRAND_SOFT_RGB,
  });
  y -= 14;
  const signatureName = BRANDING.pdfBrandName || "";
  if (signatureName) {
    page.drawText(sanitize(signatureName), {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: MUTED_RGB,
    });
  }
  return page;
}

type Font = Awaited<ReturnType<PDFDocument["embedFont"]>>;
type Page = ReturnType<PDFDocument["addPage"]>;

// Branded header band: smooth coral gradient spanning the page top with the
// caregiver name on the left (large, white) and a circular photo on the
// right framed by a subtle white ring. Returns the Y where the next content
// block should start.
async function drawCaregiverHeader(
  pdf: PDFDocument,
  page: Page,
  font: Font,
  fontBold: Font,
  caregiver: ExportInput["caregiver"],
): Promise<number> {
  const bandH = 108;
  const bandY = PAGE_H - bandH;

  // 3-stop vertical gradient: subtle highlight at top, primary in middle,
  // slightly deeper at bottom — gives the band a soft "glow" feel without
  // being garish.
  const gradBuf = await gradientPng({
    width: Math.round(PAGE_W * 2),
    height: Math.round(bandH * 2),
    stops: [
      { offset: 0, color: shadeHex(BRANDING.primary, 6) },
      { offset: 0.55, color: BRANDING.primary },
      { offset: 1, color: shadeHex(BRANDING.primary, -8) },
    ],
  });
  const gradImg = await pdf.embedPng(gradBuf);
  page.drawImage(gradImg, {
    x: 0,
    y: bandY,
    width: PAGE_W,
    height: bandH,
  });

  // Hairline shadow under the band — adds a slight "lift" to suggest depth.
  page.drawRectangle({
    x: 0,
    y: bandY - 1.5,
    width: PAGE_W,
    height: 1.5,
    color: BRAND_SOFT_RGB,
  });

  // Photo on the right, circular, with a soft white ring frame.
  const photoSize = 76;
  const photoX = PAGE_W - MARGIN - photoSize;
  const photoY = bandY + (bandH - photoSize) / 2;
  if (caregiver.photoPath) {
    try {
      const buf = await readFile(caregiver.photoPath);
      // White ring frame: drawn first, slightly larger than the photo.
      const cx = photoX + photoSize / 2;
      const cy = photoY + photoSize / 2;
      page.drawCircle({
        x: cx,
        y: cy,
        size: photoSize / 2 + 2.5,
        color: rgb(1, 1, 1),
        opacity: 0.92,
      });
      const rounded = await roundPortrait(buf, photoSize * 3);
      const img = await pdf.embedPng(rounded);
      page.drawImage(img, {
        x: photoX,
        y: photoY,
        width: photoSize,
        height: photoSize,
      });
    } catch {
      /* ignore */
    }
  }

  // Name on the left, vertically centered in the band.
  const nameX = MARGIN;
  const nameSize = 30;
  const nameY = bandY + bandH / 2 - 4;
  page.drawText(sanitize(formatName(caregiver.firstName, caregiver.lastName)), {
    x: nameX,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  if (caregiver.formerName) {
    page.drawText(sanitize(`ehemalig ${caregiver.formerName}`), {
      x: nameX,
      y: nameY - 18,
      size: 10.5,
      font,
      color: rgb(1, 1, 1),
    });
  }

  // Generous breathing room below the band.
  return bandY - 48;
}

function drawFooter(page: Page, font: Font) {
  // Hairline above the footer text — thin and coral-soft for elegance.
  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 32 },
    end: { x: PAGE_W - MARGIN, y: MARGIN + 32 },
    thickness: 0.4,
    color: BRAND_SOFT_RGB,
  });
  page.drawText(`Erstellt am ${formatDate(new Date())}`, {
    x: MARGIN,
    y: MARGIN + 16,
    size: 8.5,
    font,
    color: MUTED_RGB,
  });
  if (BRANDING.pdfFooterUrl) {
    page.drawText(BRANDING.pdfFooterUrl, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(BRANDING.pdfFooterUrl, 8.5),
      y: MARGIN + 16,
      size: 8.5,
      font,
      color: MUTED_RGB,
    });
  }
}

async function drawSectionCover(
  pdf: PDFDocument,
  font: Font,
  fontBold: Font,
  input: SectionExportInput,
) {
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const headerEndY = await drawCaregiverHeader(
    pdf,
    page,
    font,
    fontBold,
    input.caregiver,
  );

  // Section title: large, generous breathing room.
  const label = DOCUMENT_TYPE_LABELS_DE_PLURAL[input.type] ?? String(input.type);
  const title = `${label} (${input.documents.length})`;
  page.drawText(sanitize(title), {
    x: MARGIN,
    y: headerEndY,
    size: 30,
    font: fontBold,
    color: BRAND_RGB,
  });
  let y = headerEndY - 16;

  // Soft accent line under the heading — wider, lighter color for elegance.
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 80, y },
    thickness: 1.2,
    color: BRAND_SOFT_RGB,
  });
  y -= 30;

  // Overview paragraph — slightly larger, more breathing room.
  for (const line of wrapText(input.overview, font, 11.5, PAGE_W - 2 * MARGIN)) {
    if (y < MARGIN + 60) break;
    page.drawText(line, { x: MARGIN, y, size: 11.5, font, color: TEXT_RGB });
    y -= 17;
  }
  y -= 28;

  // Per-document list. Continues onto fresh pages if it overflows.
  const NUM_X = MARGIN;
  const ITEM_X = MARGIN + 28; // indent for title + body, leaving room for number
  const ITEM_WRAP = PAGE_W - ITEM_X - MARGIN;

  for (let i = 0; i < input.documents.length; i++) {
    const d = input.documents[i];

    const titleLines = wrapText(d.title, fontBold, 14, ITEM_WRAP);
    const blurbLines = wrapText(d.blurb ?? "", font, 11.5, ITEM_WRAP);

    // trainingTopic is intentionally NOT shown — blurb covers it in German
    // and the raw OCR'd topic is often still Polish.
    const metaParts: string[] = [];
    if (d.issuedBy) metaParts.push(d.issuedBy);
    if (d.issuedAt) metaParts.push(formatDate(d.issuedAt));
    const metaLines = metaParts.length
      ? wrapText(metaParts.join(" · "), font, 10, ITEM_WRAP)
      : [];

    const blockHeight =
      titleLines.length * 18 +
      4 +
      metaLines.length * 13 +
      6 +
      blurbLines.length * 16 +
      22;

    if (y - blockHeight < MARGIN + 50) {
      drawFooter(page, font);
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    // Number — slightly larger, regular weight, coral — reads as section
    // marker rather than competing with the title weight.
    page.drawText(String(i + 1).padStart(2, "0"), {
      x: NUM_X,
      y,
      size: 13,
      font,
      color: BRAND_RGB,
    });

    // Title — bold, larger.
    let ty = y;
    for (const tl of titleLines) {
      page.drawText(tl, {
        x: ITEM_X,
        y: ty,
        size: 14,
        font: fontBold,
        color: TEXT_RGB,
      });
      ty -= 18;
    }
    y = ty - 2;

    for (const ml of metaLines) {
      page.drawText(ml, {
        x: ITEM_X,
        y,
        size: 10,
        font,
        color: MUTED_RGB,
      });
      y -= 13;
    }
    y -= 4;
    for (const bl of blurbLines) {
      page.drawText(bl, {
        x: ITEM_X,
        y,
        size: 11.5,
        font,
        color: TEXT_RGB,
      });
      y -= 16;
    }
    y -= 22;
  }

  drawFooter(page, font);
}

async function appendOriginalPages(
  pdf: PDFDocument,
  doc: ExportInput["documents"][number],
) {
  try {
    const buf = await readFile(doc.originalPath);
    if (doc.originalMime === "application/pdf") {
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const indices = src.getPageIndices();
      const copied = await pdf.copyPages(src, indices);
      copied.forEach((p, i) => {
        pdf.addPage(p);
        const { width: pw, height: ph } = p.getSize();
        applyRedactions(
          p,
          doc.redactionBoxes.filter((b) => b.page === i),
          { x: 0, y: 0, width: pw, height: ph },
        );
      });
    } else if (doc.originalMime.startsWith("image/")) {
      // Pre-process: pixelate any approved PII regions in the source image
      // before embedding. Pixelation blends with the document grain much
      // more naturally than an opaque overlay.
      const approvedBoxes = doc.redactionBoxes.filter(
        (b) => b.page === 0 && b.approved && b.width > 0 && b.height > 0,
      );
      const sourceBuf =
        approvedBoxes.length > 0
          ? await pixelatePIIRegions(buf, approvedBoxes, {
              // Tight padding — OCR-anchored boxes are accurate to the
              // word, so only need a thin halo to absorb anti-aliasing.
              padX: 0.008,
              padY: 0.006,
            })
          : buf;

      const page = pdf.addPage([PAGE_W, PAGE_H]);
      const img =
        doc.originalMime === "image/png"
          ? await pdf.embedPng(sourceBuf).catch(() => pdf.embedJpg(sourceBuf))
          : await pdf.embedJpg(sourceBuf);
      const { width, height } = img.scale(1);
      const maxW = PAGE_W - 2 * MARGIN;
      const maxH = PAGE_H - 2 * MARGIN;
      const ratio = Math.min(maxW / width, maxH / height);
      const w = width * ratio;
      const h = height * ratio;
      const ix = (PAGE_W - w) / 2;
      const iy = (PAGE_H - h) / 2;
      page.drawImage(img, { x: ix, y: iy, width: w, height: h });
    }
  } catch (err) {
    console.error("[append-original]", err);
  }
}

// Paper-cream "sticker" overlay used to hide PII without the visual harshness
// of a black bar. Tones chosen to blend with typical scanned paper.
const REDACT_FILL = rgb(0.965, 0.94, 0.86);
const REDACT_BORDER = rgb(0.86, 0.83, 0.74);

// Apply redaction overlays to a page. `canvas` is the rectangle (in page
// coords) onto which the normalized box coords were originally measured —
// for embedded image docs that's the displayed image rect; for embedded PDF
// pages it's the full page.
function applyRedactions(
  page: ReturnType<PDFDocument["addPage"]>,
  boxes: ExportInput["documents"][number]["redactionBoxes"],
  canvas: { x: number; y: number; width: number; height: number },
) {
  for (const b of boxes) {
    if (!b.approved) continue;
    if (b.width <= 0 || b.height <= 0) continue;
    // Boxes are normalized 0..1 with origin TOP-LEFT of the canvas rect.
    // pdf-lib uses origin BOTTOM-LEFT of the page, so we flip y.
    const padX = canvas.width * 0.005;
    const padY = canvas.height * 0.005;
    const x = canvas.x + b.x * canvas.width - padX;
    const y =
      canvas.y + canvas.height - (b.y + b.height) * canvas.height - padY;
    const w = b.width * canvas.width + 2 * padX;
    const h = b.height * canvas.height + 2 * padY;
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: REDACT_FILL,
      borderColor: REDACT_BORDER,
      borderWidth: 0.4,
    });
  }
}

// Light sanitizer: Noto Sans handles most printable Unicode (including Polish,
// German umlauts, etc.). We only strip zero-width chars and replace emoji /
// decorative glyphs that aren't covered by Noto Sans with text equivalents.
function sanitize(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\u2756/g, "\u2022");
}

function wrapText(
  rawText: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
): string[] {
  const text = sanitize(rawText);
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function formatName(first: string, last: string | null | undefined): string {
  const trimmedLast = (last ?? "").trim();
  if (!trimmedLast || trimmedLast === "?") return first.trim();
  return `${first.trim()} ${trimmedLast}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

