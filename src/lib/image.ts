import sharp from "sharp";

// Gentle enhancement for portrait photos / faces — preserves skin tones.
export async function enhancePortrait(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // EXIF auto-orient
    .normalize({ lower: 1, upper: 99 })
    .modulate({ brightness: 1.02 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// Crop a phone photo to just the document page using a vision-detected
// bounding rect. Falls through to the original buffer if detection fails or
// the bounds are too small/invalid to be trusted.
export async function autoCropToDocument(
  input: Buffer,
  bounds: { x: number; y: number; width: number; height: number } | null,
): Promise<Buffer> {
  if (!bounds) return input;
  const meta = await sharp(input).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return input;
  // Small outward pad (0.5%) so we don't shave content at the edges.
  const padX = 0.005;
  const padY = 0.005;
  const left = Math.max(0, Math.floor((bounds.x - padX) * W));
  const top = Math.max(0, Math.floor((bounds.y - padY) * H));
  const width = Math.min(W - left, Math.ceil((bounds.width + 2 * padX) * W));
  const height = Math.min(H - top, Math.ceil((bounds.height + 2 * padY) * H));
  if (width < 100 || height < 100) return input;
  return sharp(input)
    .extract({ left, top, width, height })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// Aggressive enhancement for photographed paper documents — boosts local
// contrast (CLAHE), stretches global contrast, neutralizes warm color casts
// from indoor light, and sharpens text edges. Yields clearly readable scans
// from phone photos of certificates and reference letters.
export async function enhanceDocument(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .clahe({ width: 80, height: 80, maxSlope: 3 })
    .normalize({ lower: 2, upper: 98 })
    .modulate({ saturation: 0.85 })
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// Back-compat alias — at upload time the document endpoint runs this.
export const enhanceScan = enhanceDocument;

export async function resizeForPDF(input: Buffer, maxWidth = 1600): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export async function thumbnail(input: Buffer, size = 240): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: size, height: size, fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// Generate a smooth linear gradient as a PNG buffer. Used as the cover band
// background in the PDF — gives a far more premium feel than a flat fill.
// Stops are { offset: 0..1, color: "#rrggbb" }. Direction is top→bottom.
export async function gradientPng(opts: {
  width: number;
  height: number;
  stops: Array<{ offset: number; color: string }>;
}): Promise<Buffer> {
  const stopsSvg = opts.stops
    .map(
      (s) =>
        `<stop offset="${(s.offset * 100).toFixed(1)}%" stop-color="${s.color}"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stopsSvg}</linearGradient>
    </defs>
    <rect width="${opts.width}" height="${opts.height}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Shade a hex color by a percentage (positive = lighter, negative = darker).
export function shadeHex(hex: string, percent: number): string {
  const m = hex.replace(/^#/, "");
  let r = parseInt(m.slice(0, 2), 16);
  let g = parseInt(m.slice(2, 4), 16);
  let b = parseInt(m.slice(4, 6), 16);
  const f = 1 + percent / 100;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Circular-crop a portrait photo to a transparent PNG. Used at PDF render
// time to give the cover photo a polished round shape on the coral band.
export async function roundPortrait(
  input: Buffer,
  size = 300,
): Promise<Buffer> {
  const radius = size / 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/></svg>`,
  );
  return sharp(input)
    .rotate()
    .resize({ width: size, height: size, fit: "cover", position: "top" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

// Belt-and-braces redaction: a moderate Gaussian blur over the WHOLE image
// PLUS targeted pixelation on identified PII regions. The blur makes body
// text genuinely unreadable (so PII isn't visible even if Claude's bbox is
// slightly off) while keeping the document structurally recognizable. The
// pixelation provides definite coverage where we are confident PII sits.
export async function blurDocumentForPrivacy(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .blur(3)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// Apply pixelation to specified rectangles of an image — used to make PII
// regions unreadable in a way that looks like a natural printing/scanning
// artifact rather than a hard black bar. Coordinates are normalized 0..1
// with origin top-left.
//
// padX / padY are asymmetric: Y gets more padding because Claude's vertical
// estimates tend to drift by ~10 % across text lines, while horizontal
// estimates are usually within ~3-5 %.
export async function pixelatePIIRegions(
  input: Buffer,
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
  opts: { padX?: number; padY?: number } = {},
): Promise<Buffer> {
  if (boxes.length === 0) return input;
  const padX = opts.padX ?? 0.04;
  const padY = opts.padY ?? 0.025;
  const meta = await sharp(input).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return input;

  const composites: sharp.OverlayOptions[] = [];
  for (const b of boxes) {
    const left = Math.max(0, Math.floor((b.x - padX) * W));
    const top = Math.max(0, Math.floor((b.y - padY) * H));
    const width = Math.min(W - left, Math.ceil((b.width + 2 * padX) * W));
    const height = Math.min(H - top, Math.ceil((b.height + 2 * padY) * H));
    if (width < 6 || height < 6) continue;
    // Pixelate: extract → downscale to ~12 px on the short side → upscale.
    // Sharp would otherwise optimize a chained resize-down-then-up into a
    // no-op, so we materialize the buffer between the two resize calls.
    const downSize = Math.max(2, Math.round(Math.min(width, height) / 12));
    const extracted = await sharp(input)
      .extract({ left, top, width, height })
      .toBuffer();
    const small = await sharp(extracted)
      .resize(downSize, downSize, { kernel: "nearest", fit: "fill" })
      .toBuffer();
    const region = await sharp(small)
      .resize(width, height, { kernel: "nearest", fit: "fill" })
      .toBuffer();
    composites.push({ input: region, left, top });
  }
  return sharp(input)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

// Square-crop a portrait photo with gentle enhancement, centered on the top
// third (where faces usually sit). Used for round avatars and cover pages.
export async function squareCropPortrait(
  input: Buffer,
  size = 600,
): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .normalize({ lower: 1, upper: 99 })
    .modulate({ brightness: 1.02 })
    .sharpen({ sigma: 0.6 })
    .resize({
      width: size,
      height: size,
      fit: "cover",
      position: "top",
    })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
