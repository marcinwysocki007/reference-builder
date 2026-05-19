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
      // OCR couldn't anchor this PII — keep Claude's own box (with a small
      // pad), don't expand to a full-width strip. Previously we strip-masked
      // entire lines which produced "almost everything blacked out" on
      // documents where OCR was noisy. Better to occasionally miss a token
      // than redact half the page.
      out.push({
        ...claude,
        x: Math.max(0, claude.x - 0.005),
        width: Math.min(1, claude.width + 0.01),
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

// A tesseract word "matches" a token if they are equal, or if one starts
// with the other (prefix match — handles OCR truncation like "Filak" vs
// "Filakk" or "Filak,"). Substring-containment matching was too greedy:
// a 4-char surname like "Anna" would match "Annahme", "Anneliese", etc.
function wordMatches(wordNorm: string, token: string): boolean {
  if (!wordNorm || !token) return false;
  if (wordNorm === token) return true;
  // Pure-digit tokens must match exactly (e.g. PESEL, PLZ).
  if (/^\d+$/.test(token) || /^\d+$/.test(wordNorm)) return wordNorm === token;
  if (token.length < 4 || wordNorm.length < 4) return false;
  // Prefix-match in either direction, requiring 80% overlap of the shorter
  // string. "Filak" vs "Filakk" matches; "Anna" vs "Annahme" does not.
  const shorter = wordNorm.length <= token.length ? wordNorm : token;
  const longer = wordNorm.length <= token.length ? token : wordNorm;
  if (!longer.startsWith(shorter)) return false;
  return shorter.length / longer.length >= 0.8;
}
