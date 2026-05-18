import { createWorker } from "tesseract.js";

let workerPromise: ReturnType<typeof createWorker> | null = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(["deu", "pol"]);
  }
  return workerPromise;
}

// Plain OCR — kept for callers that just want the text. Vision OCR is
// preferred for images now, but this is still used as a fallback.
export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text ?? "";
}

export interface OCRWord {
  text: string;
  // Bounding box normalized to 0..1 of image dimensions, origin top-left.
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

// Word-level OCR with bounding boxes. The text values may be noisy on
// difficult scans, but the bbox positions are spatially accurate — exactly
// what we need to look up "where in the image is this PII string?".
export async function recognizeWordBoxes(
  buffer: Buffer,
  imgWidth: number,
  imgHeight: number,
): Promise<OCRWord[]> {
  const worker = await getWorker();
  const { data } = (await worker.recognize(buffer, undefined, {
    blocks: true,
  })) as unknown as {
    data: {
      blocks?: Array<{
        paragraphs?: Array<{
          lines?: Array<{
            words?: Array<{
              text: string;
              confidence: number;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>;
          }>;
        }>;
      }>;
    };
  };
  const out: OCRWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          if (!w.bbox) continue;
          out.push({
            text: w.text ?? "",
            x0: w.bbox.x0 / imgWidth,
            y0: w.bbox.y0 / imgHeight,
            x1: w.bbox.x1 / imgWidth,
            y1: w.bbox.y1 / imgHeight,
            confidence: w.confidence ?? 0,
          });
        }
      }
    }
  }
  return out;
}

export async function shutdownOCR() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
