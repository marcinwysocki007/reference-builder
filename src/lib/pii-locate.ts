import type { OCRWord } from "./ocr";
import type { PIIBox } from "./anthropic";

// Normalize a string for fuzzy comparison: lowercase, strip punctuation +
// accents (so "Świadectwo" matches "swiadectwo" and "Słoneczna" matches
// "sloneczna" — tesseract often loses diacritics on noisy scans).
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ł]/g, "l")
    .replace(/[^a-z0-9]/g, "");
}

// Strategy: instead of trying to union word bboxes into one big PII rect,
// we mask EACH tesseract word that matches a Claude-identified PII token.
// This guarantees every occurrence is covered, even repeats (e.g. a last
// name appearing multiple times in a letter) and avoids cross-line union
// artifacts. Trade-off: may add small overlapping boxes — fine for the
// pixelation pipeline.
export function locatePIIBoxesViaOCR(
  claudeBoxes: PIIBox[],
  ocrWords: OCRWord[],
): PIIBox[] {
  if (ocrWords.length === 0) return claudeBoxes;
  const normWords = ocrWords.map((w) => ({ ...w, n: norm(w.text) }));

  const out: PIIBox[] = [];
  // Track which Claude findings produced ≥1 OCR-matched box, so the
  // fallback "use Claude's box" only fires when OCR found nothing.
  for (const claude of claudeBoxes) {
    const tokens = tokensForLookup(claude);
    if (tokens.length === 0) {
      out.push(claude);
      continue;
    }

    const matches = new Map<string, typeof normWords[number]>();
    for (const tok of tokens) {
      for (const w of normWords) {
        if (w.n.length < 2) continue;
        if (!wordMatches(w.n, tok)) continue;
        const key = `${w.x0.toFixed(4)}_${w.y0.toFixed(4)}`;
        matches.set(key, w);
      }
    }

    if (matches.size === 0) {
      // OCR couldn't find any words for this PII — fall back to a
      // full-width horizontal strip at Claude's Y. Claude's Y estimate is
      // usually within ±5–10 %, so widening Y a bit and stretching X to
      // the full image width ensures the line containing the PII is
      // covered even if the exact column was off. We lose surrounding
      // text on the same line but DSGVO trumps aesthetics.
      const yPad = Math.max(0.015, claude.height * 0.5);
      out.push({
        ...claude,
        x: 0,
        width: 1,
        y: Math.max(0, claude.y - yPad),
        height: Math.min(1, claude.height + 2 * yPad),
      });
      continue;
    }

    for (const w of matches.values()) {
      out.push({
        page: claude.page,
        category: claude.category,
        excerpt: claude.excerpt,
        x: w.x0,
        y: w.y0,
        width: Math.max(0.005, w.x1 - w.x0),
        height: Math.max(0.005, w.y1 - w.y0),
      });
    }
  }
  return out;
}

// Tokens we'll look for in OCR text. Drops trivially short tokens. Keeps
// digits and letters separately so "27" still gets matched literally but
// without dragging in word-matches.
function tokensForLookup(box: PIIBox): string[] {
  const raw = box.excerpt.split(/\s+/).map((t) => norm(t)).filter(Boolean);
  return raw.filter((t) => {
    if (t.length >= 3) return true;
    // Keep 2-char tokens only if they're pure digits (e.g. PLZ start),
    // never pure letters (too generic).
    if (t.length === 2 && /^\d+$/.test(t)) return true;
    return false;
  });
}

// A tesseract word "matches" a token if either fully contains the other,
// or shares a strong substring (≥4 chars). Avoids matching tiny fragments.
function wordMatches(wordNorm: string, token: string): boolean {
  if (!wordNorm || !token) return false;
  if (wordNorm === token) return true;
  if (token.length >= 4 && wordNorm.includes(token)) return true;
  if (wordNorm.length >= 4 && token.includes(wordNorm)) return true;
  // Pure-digit tokens must match exactly (e.g. PESEL, PLZ).
  if (/^\d+$/.test(token)) return wordNorm === token;
  return false;
}
