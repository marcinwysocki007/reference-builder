import sharp from "sharp";

// Pulls embedded images out of a PDF using pdfjs-dist's operator list, then
// picks the one most likely to be a portrait photo (largest area with sane
// aspect ratio). Returns a normalized JPEG buffer or null.
export async function extractPortraitFromPDF(
  pdfBuf: Buffer,
): Promise<Buffer | null> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (err) {
    console.error("[pdf-extract-image] pdfjs import failed:", err);
    return null;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuf),
    useSystemFonts: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    console.error("[pdf-extract-image] load failed:", err);
    return null;
  }

  type Candidate = { width: number; height: number; jpeg: Buffer };
  const candidates: Candidate[] = [];

  // Scan first few pages — profile photos are nearly always on page 1, but be
  // robust to multi-page profiles.
  const pagesToScan = Math.min(doc.numPages, 3);
  for (let p = 1; p <= pagesToScan; p++) {
    let page;
    try {
      page = await doc.getPage(p);
    } catch {
      continue;
    }
    let opList;
    try {
      opList = await page.getOperatorList();
    } catch {
      continue;
    }
    const fns = opList.fnArray;
    const args = opList.argsArray;
    for (let i = 0; i < fns.length; i++) {
      const fn = fns[i];
      if (
        fn !== pdfjs.OPS.paintImageXObject &&
        fn !== pdfjs.OPS.paintInlineImageXObject &&
        fn !== pdfjs.OPS.paintImageXObjectRepeat
      ) {
        continue;
      }
      const name: string = args[i][0];
      const img = await getImage(page, name);
      if (!img) continue;
      const jpeg = await imageToJpeg(img).catch(() => null);
      if (!jpeg) continue;
      candidates.push({ width: img.width, height: img.height, jpeg });
    }
  }

  if (candidates.length === 0) return null;

  // Score: prefer larger area, penalize images that are very wide/very tall
  // (logos, banners), and reject anything tiny.
  const scored = candidates
    .filter((c) => c.width >= 80 && c.height >= 80)
    .map((c) => {
      const ratio = c.width / c.height;
      const portraitness = ratio >= 0.5 && ratio <= 1.3 ? 1 : 0.3;
      return { ...c, score: c.width * c.height * portraitness };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  return scored[0].jpeg;
}

// pdfjs page.objs.get takes a callback in legacy build. Wrap as a Promise.
interface PdfImageObj {
  width: number;
  height: number;
  kind?: number; // 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: { width: number; height: number; data?: Uint8ClampedArray };
}
interface PdfPageLike {
  objs: { get(name: string, cb?: (img: unknown) => void): unknown };
}

function getImage(page: unknown, name: string): Promise<PdfImageObj | null> {
  return new Promise((resolve) => {
    try {
      const objs = (page as PdfPageLike).objs;
      // Some versions: synchronous resolve via callback, others return value
      let resolved = false;
      const ret = objs.get(name, (img: unknown) => {
        if (resolved) return;
        resolved = true;
        resolve(normalizeImage(img));
      });
      if (!resolved && ret && typeof ret === "object") {
        resolved = true;
        resolve(normalizeImage(ret));
      }
      // Safety timeout: if pdfjs never resolves we don't want to hang.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 5000);
    } catch {
      resolve(null);
    }
  });
}

function normalizeImage(raw: unknown): PdfImageObj | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as PdfImageObj;
  if (r.bitmap?.data && r.bitmap.width && r.bitmap.height) {
    return {
      width: r.bitmap.width,
      height: r.bitmap.height,
      kind: 3,
      data: r.bitmap.data,
    };
  }
  if (r.width && r.height && r.data) return r;
  return null;
}

async function imageToJpeg(img: PdfImageObj): Promise<Buffer | null> {
  if (!img.data) return null;
  const channels = img.kind === 3 ? 4 : img.kind === 1 ? 1 : 3;
  const expectedLen = img.width * img.height * channels;
  if (img.data.length < expectedLen) return null;
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: {
      width: img.width,
      height: img.height,
      channels: channels as 1 | 3 | 4,
    },
  })
    .jpeg({ quality: 88 })
    .toBuffer();
}
