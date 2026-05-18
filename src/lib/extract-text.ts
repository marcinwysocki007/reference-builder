import { readFile } from "./storage";
import { ocrImage } from "./ocr";

// Extract raw text from a stored document. PDFs: try pdf parsing first, fall
// back to nothing. Images: OCR with tesseract (deu+pol).
export async function extractText(opts: {
  path: string;
  mime: string;
}): Promise<string> {
  const buf = await readFile(opts.path);
  if (opts.mime.startsWith("image/")) {
    return ocrImage(buf);
  }
  if (opts.mime === "application/pdf") {
    return extractPdfText(buf);
  }
  return "";
}

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    // pdfjs-dist with no worker — Node can't load .mjs worker via require().
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: unknown) => {
          if (typeof it === "object" && it && "str" in it) {
            return (it as { str: string }).str;
          }
          return "";
        })
        .join(" ");
      text += pageText + "\n\n";
    }
    return text.trim();
  } catch (err) {
    console.error("[pdf-extract] failed:", err);
    return "";
  }
}
