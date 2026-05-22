import Anthropic from "@anthropic-ai/sdk";
import { DOMAIN_CONTEXT } from "./branding";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[anthropic] ANTHROPIC_API_KEY not set — AI features will fail");
}

export const anthropic = new Anthropic({ apiKey: apiKey ?? "missing" });

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export interface DocumentForAI {
  type: string;
  title: string;
  issuedBy?: string | null;
  issuedAt?: Date | null;
  text: string;
  language?: string | null;
}

// --- Recommendation letter generation ------------------------------------

const LETTER_SYSTEM = `Du verfasst ein Empfehlungsschreiben für eine 24-Stunden-Betreuungskraft im deutschsprachigen Raum. Es ist ein offizielles, persönliches Schreiben einer Vermittlungs-Agentur an deutsche Familien, die diese Pflegekraft engagieren könnten.

HARTE FORMAT-REGELN:
- Sprache: DEUTSCH
- Format: Fließtext mit klaren Absätzen, getrennt durch eine Leerzeile (\\n\\n)
- KEIN Markdown, KEINE Sterne, KEINE Bullets, KEINE Überschriften wie "## Empfehlung"
- KEIN "Sehr geehrte Damen und Herren" am Anfang — das setzt das Layout, du beginnst direkt mit dem ersten Inhalts-Absatz
- KEINE Grußformel am Ende ("Mit freundlichen Grüßen", Unterschrift) — auch das setzt das Layout
- KEINE Anführungszeichen um Eigennamen
- Verwende den Vornamen + Anfangsbuchstaben des Nachnamens (z.B. "Maria K." statt "Maria Kowalska") — Datenschutz

INHALT (4–6 Absätze):
1. Vorstellung: Wer ist die Person, was bringt sie mit (Sprache, Erfahrung)
2. Fachliche Qualifikation und Pflege-Schwerpunkte
3. Persönlichkeit und Arbeitsweise (warmherzig, zuverlässig, etc. — nur was aus Profil oder Referenzen ableitbar ist)
4. Optional: konkrete Stärken aus früheren Einsätzen (wenn Referenzen vorliegen)
5. Klares Empfehlungs-Statement
6. Optional: Verfügbarkeits-/Einsatzbereitschaftsaussage

TONALITÄT:
- Warm, professionell, persönlich
- Wertschätzend ohne Marketing-Sprech
- Konkret statt floskelhaft ("verfügt über fundiertes Wissen in der Demenzpflege" statt "ist hervorragend")
- Keine Übertreibungen, keine erfundenen Details — alles muss vom Profil/Referenzen gestützt sein
- Wenn Datenbasis dünn ist: schreibe knapper und sachlicher, nicht ausschmückend

VERBOTEN:
- Klientennamen, Adressen, Telefonnummern, sonstige Drittpersonen-PII
- Marken-/Firmennamen außerhalb der Agentur
- Falsche oder spekulative Aussagen

Gib NUR den fertigen Brieftext zurück, ohne Vorrede, ohne JSON, ohne Code-Block.`;

export async function generateRecommendationLetter(opts: {
  caregiver: CaregiverProfileForAI & { bio?: string | null };
  contextDocs?: DocumentForAI[];
}): Promise<string> {
  const c = opts.caregiver;
  const profileBlock = `Pflegekraft: ${c.firstName}${c.lastName && c.lastName !== "?" ? " " + c.lastName : ""}
${c.formerName ? `Geburtsname: ${c.formerName}\n` : ""}${c.languages ? `Sprachen: ${c.languages}\n` : ""}${c.specialties ? `Schwerpunkte: ${c.specialties}\n` : ""}${c.bio ? `Profil-Beschreibung: ${c.bio}\n` : ""}`;

  const docsBlock = (opts.contextDocs ?? [])
    .filter((d) => d.text && d.text.trim().length > 0)
    .map(
      (d, i) =>
        `[Quelle ${i + 1}: ${d.type}${d.issuedBy ? ` von ${d.issuedBy}` : ""}${d.issuedAt ? ` (${new Date(d.issuedAt).getFullYear()})` : ""}]\n${d.text.slice(0, 1500)}`,
    )
    .join("\n\n---\n\n");

  const userMsg =
    profileBlock +
    (docsBlock
      ? `\n\nBisher vorliegende Dokumente als zusätzlicher Kontext:\n\n${docsBlock}`
      : "\n\n(Keine weiteren Quell-Dokumente vorhanden.)") +
    "\n\nBitte verfasse das Empfehlungsschreiben.";

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: LETTER_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  return extractText(res.content).trim();
}

export interface SectionOverview {
  overview: string;
  blurbs: string[];
  titles: string[];
}

const SECTION_LABELS_DE: Record<string, { single: string; plural: string }> = {
  REFERENZ: { single: "Referenz", plural: "Referenzen" },
  EMPFEHLUNG: { single: "Empfehlungsschreiben", plural: "Empfehlungsschreiben" },
  ZERTIFIKAT: { single: "Zertifikat / Schulungsnachweis", plural: "Zertifikate / Schulungsnachweise" },
  GRUSSKARTE: { single: "Grußkarte", plural: "Grußkarten" },
};

const SECTION_SYSTEM = `Du schreibst eine kurze, warme und professionelle Einleitung zu einer Dokumenten-Übersicht einer Betreuungskraft auf DEUTSCH — gefolgt von kurzen Beschreibungen pro Dokument.

Gib NUR JSON zurück (keine Vorrede, kein Markdown, kein Code-Block):
{"overview": "...", "titles": ["dt. Titel zu Doc 1", ...], "blurbs": ["1 Satz zu Doc 1", ...]}

OVERVIEW — ABSOLUT WICHTIG:
- 2–3 Sätze, NATÜRLICHES Deutsch, klingt wie eine persönliche Vorstellung — nicht wie ein Inhaltsverzeichnis.
- Beginne mit dem VORNAMEN der Pflegekraft (z.B. "Klaudia hat …", "Maria bringt …", "Anna verfügt über …").
- Leicht wertschätzender Ton, aber sachlich — keine Werbesprache, keine Superlative, kein "hervorragend" / "ausgezeichnet" / "exzellent". Beispiele für ok: "fundiert", "breit aufgestellt", "gut belegt", "kontinuierlich".
- VERBOTEN: "Sektion", "Diese Sektion", "Dokumente liegen vor", "Die folgenden", "Anbei", "Hier finden Sie", "Aufstellung", "Übersicht", "Auflistung" oder ähnliches Tool-/Behördendeutsch. Auch keine reinen Anzahlen wie "5 Dokumente" — integriere die Substanz lieber natürlich.
- Tonalität je nach Typ:
  • Referenzen → was Familien/Auftraggeber über sie sagen
  • Empfehlungsschreiben → fachlicher Eindruck aus früherer Zusammenarbeit
  • Zertifikate → ihre fachliche Qualifikation und Weiterbildungspfad
  • Grußkarten → menschliche Verbundenheit, persönliche Wertschätzung
- Wenn die Inhalte dürftig sind: kurz und neutral halten, nichts erfinden.

TITLES:
- IMMER DEUTSCH. Polnische Originaltitel sinngemäß übersetzen (z.B. "Świadectwo kwalifikacji zawodowej MED.14" → "Berufsqualifikationsnachweis MED.14"). Deutsche Titel unverändert. Max. 8 Wörter.

BLURBS:
- Pro Dokument 1 Satz mit dem Wesentlichen: bei Zertifikat Kursthema + Umfang/Stunden, bei Referenz/Empfehlung kurzer Tenor, bei Grußkarte Anlass.
- Wenn keine Inhalte vorliegen: knapper Faktentext aus Titel/Aussteller/Datum.

ALLGEMEIN:
- Kein Markdown, keine Bullets, keine Sternchen.
- Keine Klientennamen, keine Kontaktdaten, keine Drittpersonen, keine fremden Marken-/Firmennamen außer dem Aussteller des jeweiligen Dokuments.
- "items" hat EXAKT so viele Einträge wie Dokumente, in derselben Reihenfolge.
- WICHTIG: Innerhalb der String-Werte (title, blurb, overview) NIEMALS das Zeichen " (ASCII-Anführungszeichen) verwenden — auch nicht für Zitate von Institutionsnamen. Wenn du etwas hervorheben willst, nimm einfache Apostrophe ' oder verzichte ganz auf Anführungszeichen. Beispiel: schreibe Złota Jesień, NICHT „Złota Jesień".`;

export async function generateSectionOverview(opts: {
  type: string;
  caregiver: CaregiverProfileForAI;
  documents: DocumentForAI[];
}): Promise<SectionOverview> {
  const label = SECTION_LABELS_DE[opts.type] ?? { plural: "Dokumente", single: "Dokument" };
  const docsContext = opts.documents
    .map(
      (d, i) =>
        `[${i + 1}] Titel: ${d.title}${d.issuedBy ? ` · Aussteller: ${d.issuedBy}` : ""}${d.issuedAt ? ` · Datum: ${new Date(d.issuedAt).toISOString().slice(0, 10)}` : ""}\nInhalt:\n${d.text || "(kein Volltext verfügbar)"}`,
    )
    .join("\n\n---\n\n");

  const userMsg = `Sektionstyp: ${label.plural}
Pflegekraft: ${opts.caregiver.firstName}${opts.caregiver.lastName && opts.caregiver.lastName !== "?" ? " " + opts.caregiver.lastName : ""}
Anzahl Dokumente: ${opts.documents.length}

${docsContext}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SECTION_SYSTEM,
    tools: [
      {
        name: "report_section_overview",
        description:
          "Sektion-Übersicht: persönliche Einleitung + ein items-Eintrag pro Dokument (deutscher Titel + 1-Satz-Blurb).",
        input_schema: {
          type: "object",
          properties: {
            overview: { type: "string" },
            items: {
              type: "array",
              description:
                "Genau so viele Einträge wie Dokumente, in derselben Reihenfolge.",
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description:
                      "Deutscher Titel des Dokuments (max. 8 Wörter).",
                  },
                  blurb: {
                    type: "string",
                    description:
                      "Ein Satz auf Deutsch, was dieses Dokument aussagt.",
                  },
                },
                required: ["title", "blurb"],
              },
            },
          },
          required: ["overview", "items"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_section_overview" },
    messages: [{ role: "user", content: userMsg }],
  });
  const rawInput = firstToolInput(res) as
    | { overview?: unknown; items?: unknown }
    | null;
  const rawItems = coerceItems(rawInput?.items);
  const titles: string[] = [];
  const blurbs: string[] = [];
  for (const it of rawItems) {
    const obj = (it ?? {}) as { title?: unknown; blurb?: unknown };
    titles.push(typeof obj.title === "string" ? obj.title : "");
    blurbs.push(typeof obj.blurb === "string" ? obj.blurb : "");
  }
  try {
    const parsed: SectionOverview = {
      overview: typeof rawInput?.overview === "string" ? rawInput.overview : "",
      titles,
      blurbs,
    };
    // Defensive: backfill blurbs/titles if AI returned fewer than docs.
    while (parsed.blurbs.length < opts.documents.length) {
      const i = parsed.blurbs.length;
      const d = opts.documents[i];
      parsed.blurbs.push(
        `${label.single}${d.issuedAt ? ` aus dem Jahr ${new Date(d.issuedAt).getFullYear()}` : ""}${d.issuedBy ? ` von ${d.issuedBy}` : ""}.`,
      );
    }
    while (parsed.titles.length < opts.documents.length) {
      const i = parsed.titles.length;
      parsed.titles.push(opts.documents[i].title);
    }
    parsed.blurbs = parsed.blurbs.slice(0, opts.documents.length);
    parsed.titles = parsed.titles.slice(0, opts.documents.length);
    return parsed;
  } catch {
    return {
      overview: `Diese Sektion enthält ${opts.documents.length} ${opts.documents.length === 1 ? label.single : label.plural}.`,
      titles: opts.documents.map((d) => d.title),
      blurbs: opts.documents.map((d) =>
        `${label.single}${d.issuedAt ? ` aus dem Jahr ${new Date(d.issuedAt).getFullYear()}` : ""}${d.issuedBy ? ` von ${d.issuedBy}` : ""}.`,
      ),
    };
  }
}

export interface CaregiverProfileForAI {
  firstName: string;
  lastName: string;
  formerName?: string | null;
  languages?: string | null;
  specialties?: string | null;
}

const SUMMARY_SYSTEM = `Kontext: ${DOMAIN_CONTEXT}
Schreibe eine warme, professionelle, vertrauensbildende Vorstellung der Betreuungskraft auf DEUTSCH.

HARTE FORMAT-REGELN:
- 4–6 Sätze als FLIESSTEXT
- kein Markdown (kein **fett**, keine ##, keine - oder * Listen)
- keine Aufzählungen oder Zwischenüberschriften
- keine Floskeln, kein Marketing-Sprech, keine Sternchen, keine Emojis
- keine Klientennamen, keine Drittpersonen, keine Marken-/Firmennamen
- keine Kontaktdaten (Telefon, E-Mail, Adressen, IDs) — auch nicht in umschreibender Form
- keine Meta-Kommentare wie "Auf Basis der Dokumente…"

Beziehe konkrete Stärken aus den Dokumenten ein: Erfahrung, Qualifikationen, Persönlichkeit, Sprachen.

WENN ZU WENIG DATEN: Schreibe trotzdem 2–3 schlichte Sätze nur auf Basis von Name, Sprachen und Schwerpunkten — KEINE Aufforderung an den Leser, mehr zu liefern. Frage nichts ab, gib keine Hinweise zur Verbesserung.`;

export async function generateSummary(opts: {
  caregiver: CaregiverProfileForAI;
  documents: DocumentForAI[];
}): Promise<string> {
  const docsContext = opts.documents
    .map(
      (d, i) =>
        `[Dokument ${i + 1}] Typ: ${d.type}${d.issuedBy ? `, ausgestellt von: ${d.issuedBy}` : ""}${d.language ? `, Sprache: ${d.language}` : ""}\nTitel: ${d.title}\nInhalt:\n${d.text || "(kein Text extrahiert)"}`,
    )
    .join("\n\n---\n\n");

  const userMsg = `Pflegekraft: ${opts.caregiver.firstName} ${opts.caregiver.lastName}${opts.caregiver.formerName ? ` (ehemalig ${opts.caregiver.formerName})` : ""}
${opts.caregiver.languages ? `Sprachen: ${opts.caregiver.languages}` : ""}
${opts.caregiver.specialties ? `Schwerpunkte: ${opts.caregiver.specialties}` : ""}

Dokumente:
${docsContext}

Bitte schreibe die Zusammenfassung (4–6 Sätze, DE, vertrauensbildend, ohne Marketing-Sprech).`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  return extractText(res.content);
}

const TRANSLATE_SYSTEM = `Du bist beeideter Übersetzer für Polnisch ↔ Deutsch und kennst den Pflegekontext.
Übersetze den Inhalt 1:1 ins Deutsche. Erhalte Tonalität, Anreden und Formatierung (Absätze, Aufzählungen). Setze [unleserlich] für nicht entzifferbare Stellen. Gib NUR die deutsche Übersetzung zurück, ohne Vorrede, ohne Anmerkungen.`;

export async function translateToGerman(text: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: TRANSLATE_SYSTEM,
    messages: [
      { role: "user", content: `Polnischer Originaltext:\n\n${text}` },
    ],
  });
  return extractText(res.content);
}

const ATTESTATION_SYSTEM = `Du verfasst die Agentur-Beglaubigung, die das polnische Originaldokument begleitet.
Format: Ein Absatz auf Deutsch, der bestätigt, was es für ein Dokument ist (Referenz / Zertifikat / Empfehlung / Grußkarte), wer es ausgestellt hat und bei Schulungen WORUM es ging. Sachlich, ohne Marketing. 2–4 Sätze.`;

export async function generateAgencyAttestation(opts: {
  type: string;
  issuedBy?: string | null;
  trainingTopic?: string | null;
  text: string;
}): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: ATTESTATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Typ: ${opts.type}\n${opts.issuedBy ? `Ausgestellt von: ${opts.issuedBy}\n` : ""}${opts.trainingTopic ? `Schulungsthema: ${opts.trainingTopic}\n` : ""}\nDokumentinhalt:\n${opts.text}`,
      },
    ],
  });
  return extractText(res.content);
}

export interface PIIFinding {
  excerpt: string;
  category: string;
  reason: string;
}

const PII_SYSTEM = `Du prüfst Pflegedokumente nach DSGVO (RODO). Identifiziere personenbezogene Daten DRITTER, die geschwärzt werden sollten:
- Vor- und Nachnamen von Klienten, deren Angehörigen, anderen Pflegekräften
- Adressen, Telefonnummern, E-Mail-Adressen
- Geburtsdaten, Versicherungsnummern Dritter
Die Pflegekraft selbst (Name, Geburtsname) ist NICHT zu schwärzen.

Gib die Liste der gefundenen PII-Stellen über das Tool report_pii_findings zurück.`;

export async function detectPII(opts: {
  text: string;
  caregiverFullName: string;
}): Promise<PIIFinding[]> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: PII_SYSTEM,
    tools: [
      {
        name: "report_pii_findings",
        description: "Liste der gefundenen PII-Stellen im Dokumenttext.",
        input_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  excerpt: {
                    type: "string",
                    description: "Exakter Textabschnitt aus dem Dokument.",
                  },
                  category: {
                    type: "string",
                    enum: ["name", "address", "phone", "email", "other"],
                  },
                  reason: { type: "string" },
                },
                required: ["excerpt", "category", "reason"],
              },
            },
          },
          required: ["findings"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_pii_findings" },
    messages: [
      {
        role: "user",
        content: `Pflegekraft (NICHT schwärzen): ${opts.caregiverFullName}\n\nDokumenttext:\n${opts.text}`,
      },
    ],
  });
  const input = firstToolInput(res) as { findings?: PIIFinding[] } | null;
  return Array.isArray(input?.findings) ? input.findings : [];
}

export interface ExtractedProfile {
  firstName?: string;
  lastName?: string;
  formerName?: string;
  birthDate?: string;
  languages?: string;
  specialties?: string;
  bio?: string;
}

const PROFILE_SYSTEM = `Du extrahierst Profil-Daten einer Pflegekraft aus einem Steckbrief / Profil-Dokument (PDF, Screenshot, Notizen). Gib NUR JSON zurück, keine Vorrede:
{"firstName": "string", "lastName": "string", "formerName": "Geburtsname falls genannt sonst null", "birthDate": "YYYY-MM-DD oder null", "languages": "kommagetrennt z.B. 'Polnisch (Muttersprache), Deutsch B1'", "specialties": "kommagetrennt z.B. 'Demenz, Diabetes, polnische Küche'", "bio": "1-2 Sätze persönliche Zusammenfassung wenn Material vorhanden sonst null"}

HARTE PRIVACY-REGELN — NIEMALS extrahieren oder in die Felder einbauen:
- Telefonnummern (Handy/Festnetz)
- E-Mail-Adressen
- Wohn-, Post- oder Heimatadressen (auch nicht Stadt + Land wenn als Adresse erkennbar)
- Personalausweis-, PESEL-, Sozialversicherungs- oder ähnliche Nummern
- Bankdaten / IBAN
- Familienstand, Kinder, Religion
- Namen von Angehörigen, Kindern, früheren Klienten oder Arbeitgebern (die Pflegekraft selbst darf genannt sein)

Wenn solche Daten im Quell-Dokument stehen: IGNORIEREN, nicht erwähnen, NICHT in bio einbauen.

NACHNAME-REGEL: Agenturprofile zeigen oft nur den Vornamen und einen einzelnen Anfangsbuchstaben des Nachnamens (z.B. "Klaudia W.", "Anna K.") aus Datenschutzgründen.
- Wenn der Nachname im Dokument abgekürzt ist (ein Buchstabe, oft mit Punkt), übernimm ihn so: lastName="W." oder "K."
- Wenn der Nachname im Dokument fehlt, schaue in den Dateinamen — Muster wie "Klaudia-W_PRIMUNDUS.pdf", "Anna-K.pdf" oder "Klaudia_W_AGENTUR.pdf" geben den Anfangsbuchstaben. Übernimm dann z.B. lastName="W."
- Wenn auch der Dateiname keinen Hinweis liefert, setze lastName="?".

Wenn nur ein Name ohne weitere Infos auffindbar ist, fülle nur firstName/lastName und setze den Rest auf null. Erfinde nichts.`;

export async function extractProfileFromText(
  text: string,
  opts: { filenames?: string[] } = {},
): Promise<ExtractedProfile> {
  const filenameLine = opts.filenames?.length
    ? `Quell-Dateinamen (oft enthalten sie den abgekürzten Nachnamen, z.B. "Klaudia-W_PRIMUNDUS.pdf" → Nachname "W."): ${opts.filenames.join(", ")}\n\n`
    : "";
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: PROFILE_SYSTEM,
    tools: [
      {
        name: "report_profile",
        description: "Strukturierte Profil-Daten der Pflegekraft.",
        input_schema: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            formerName: { type: ["string", "null"] },
            birthDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
            languages: { type: ["string", "null"] },
            specialties: { type: ["string", "null"] },
            bio: { type: ["string", "null"] },
          },
          required: ["firstName", "lastName"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_profile" },
    messages: [
      { role: "user", content: filenameLine + text.slice(0, 6000) },
    ],
  });
  return (firstToolInput(res) as ExtractedProfile) ?? {};
}

// --- Vision: detect document edges for auto-crop ------------------------

// Returns the axis-aligned bounding rectangle of the actual paper document in
// a phone photo (excluding desk, binder, plastic sleeve edges, background
// paper, etc.). Coordinates are normalized 0..1 from the top-left of the
// image. Returns null if no document could be identified.
export async function visionDetectDocumentBounds(opts: {
  imageBuffer: Buffer;
  mediaType: SupportedImageMime;
}): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const system = `Du bekommst ein Handy-Foto eines Pflege-Dokuments (Zertifikat, Referenz, Empfehlungsschreiben etc.). Das Dokument liegt meist auf einem anderen Untergrund — Tisch, Schreibunterlage, geöffneter Ordner, kariertes Papier oder steckt in einer Klarsichthülle.

DEINE AUFGABE: Bestimme das achsen-parallele Bounding-Rechteck der tatsächlichen Dokumentenseite. Hintergrund (Schreibtisch, anderes Papier, Ordnerrand, Heft-Lochung) MUSS außerhalb dieses Rechtecks liegen. Wenn das Dokument leicht schräg im Bild ist, gib das ENGSTE achsen-parallele Rechteck zurück, das die ganze Seite enthält.

KOORDINATEN: normalisiert 0..1, Ursprung oben-links.
- x = linke Bildkante (0) bis rechte Bildkante (1)
- y = obere Bildkante (0) bis untere Bildkante (1)
- width, height = Größe relativ zum ganzen Bild

WICHTIG:
- Wenn das Dokument fast das ganze Bild füllt → gib ein Rechteck zurück, das alle 4 Papierkanten ENGSCHLIESST (ohne 5% Hintergrund-Rand). Hintergrund muss raus.
- Sei lieber 1-2% zu großzügig als zu eng — Inhalt am Rand darf nicht abgeschnitten werden.
- Wenn KEIN klar erkennbares Dokument vorhanden ist → gib found=false zurück.`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    tools: [
      {
        name: "report_bounds",
        description:
          "Gibt das Bounding-Rechteck der Dokumentenseite zurück.",
        input_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
          required: ["found"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_bounds" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType,
              data: opts.imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Wo ist die Dokumentenkante? Tool aufrufen.",
          },
        ],
      },
    ],
  });
  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return null;
  const i = toolUse.input as {
    found?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  if (!i.found) return null;
  const x = clamp01(i.x ?? 0);
  const y = clamp01(i.y ?? 0);
  const width = clamp01(i.width ?? 1);
  const height = clamp01(i.height ?? 1);
  // Reject obviously bogus bounds (covers <30% of image, or extends beyond
  // bottom/right). Caller will skip crop in that case.
  if (width * height < 0.3) return null;
  if (x + width > 1.001 || y + height > 1.001) return null;
  return { x, y, width, height };
}

// --- Vision OCR + Auto-Rotation ------------------------------------------

const VISION_SYSTEM = `Du analysierst ein Foto eines Pflege-Dokuments (Referenz, Empfehlung, Zertifikat, Grußkarte etc.).

DEINE AUFGABE:
1. Lies ALLEN sichtbaren Text wörtlich heraus, so vollständig wie möglich. Originalsprache beibehalten (meist Deutsch oder Polnisch). Bei unleserlichen Stellen setze [unleserlich]. NICHT zusammenfassen oder umschreiben — Text wörtlich, mit Absätzen (\\n trennt Zeilen).

2. Bestimme die korrekte Bilddrehung — KRITISCH: gib die Drehung im UHRZEIGERSINN an, die nötig ist, damit das Bild aufrecht wird. Das ist eine VISUELLE Eigenschaft (wie die Pixel im Bild ausgerichtet sind), NICHT eine Eigenschaft des Texts (den du auch verkehrt lesen kannst).

   Konkrete Anleitung — fokussiere auf die FORM der Buchstaben:
   - Schau auf ein einzelnes Wort im Bild. Wenn die Oberseiten der Buchstaben (z.B. der Punkt auf dem "i", der Bogen des "P") oben sind und die Grundlinie unten → Rotation 0.
   - Wenn die Oberseiten der Buchstaben aktuell UNTEN im Bild stehen (Buchstaben auf dem Kopf) → Rotation 180.
   - Wenn die Buchstaben quer stehen und ihre Oberseiten aktuell nach LINKS zeigen → Rotation 90 (Uhrzeigersinn) bringt sie nach oben.
   - Wenn die Oberseiten der Buchstaben aktuell nach RECHTS zeigen → Rotation 270.

   WICHTIG: Lass dich NICHT davon täuschen, dass du Text auch verkehrt lesen kannst. Antworte basierend auf der visuellen Lage der Buchstaben im Bild, nicht auf deiner Lesefähigkeit. Wenn der Briefkopf/Datum aktuell visuell UNTEN im Bild ist, ist die Rotation 180, auch wenn du den Inhalt lesen kannst.

   Mental-Check: stell dir vor, das Bild wird nach deiner Rotation gedreht. Stehen jetzt die "i"-Punkte oben und ist der Briefkopf am oberen Bildrand? Wenn nein, korrigiere die Drehung.

Auch wenn das Bild körnig, schief, schwach belichtet oder verwackelt ist — lies aus, was lesbar ist. Lieber unvollständiger Text als gar keiner.

Gib das Ergebnis über das Tool report_document zurück.`;

export type SupportedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export async function visionExtractAndOrient(opts: {
  imageBuffer: Buffer;
  mediaType: SupportedImageMime;
}): Promise<{ text: string; rotation: 0 | 90 | 180 | 270 }> {
  // tool_use forces Claude to produce structured JSON via the SDK — eliminates
  // the fragility of in-prose JSON, especially when the OCR'd text itself
  // contains quotation marks that would break ad-hoc JSON parsing.
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: VISION_SYSTEM,
    tools: [
      {
        name: "report_document",
        description:
          "Gibt den vollständig erfassten Text und die erforderliche Bilddrehung zurück.",
        input_schema: {
          type: "object",
          properties: {
            rotation: {
              type: "integer",
              enum: [0, 90, 180, 270],
              description:
                "Drehung im Uhrzeigersinn, die nötig ist, damit das Bild aufrecht steht.",
            },
            text: {
              type: "string",
              description:
                "Der vollständig erfasste Dokumenttext, Originalsprache, Zeilen mit \\n getrennt.",
            },
          },
          required: ["rotation", "text"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_document" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType,
              data: opts.imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Lies das Dokument aus und rufe das Tool auf.",
          },
        ],
      },
    ],
  });
  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    console.error(
      "[visionExtractAndOrient] no tool_use block in response; stop_reason=",
      res.stop_reason,
    );
    return { text: "", rotation: 0 };
  }
  const input = toolUse.input as { text?: string; rotation?: number };
  const rot = Number(input.rotation) || 0;
  return {
    text: String(input.text ?? ""),
    rotation: ([0, 90, 180, 270].includes(rot) ? rot : 0) as 0 | 90 | 180 | 270,
  };
}

// --- Vision PII detection (with bounding boxes) -------------------------

export interface PIIBox {
  page: number; // 0-indexed (for images: always 0)
  x: number; // normalized 0..1 from left
  y: number; // normalized 0..1 from top
  width: number;
  height: number;
  category: "name" | "address" | "phone" | "email" | "id" | "other";
  excerpt: string;
}

// PII bounding-box detection benefits enormously from the stronger vision
// model. We pin this specific call to Opus 4.7 regardless of the global
// ANTHROPIC_MODEL setting — the cost (~5×) is worth it for precise PII
// coverage. Override with ANTHROPIC_VISION_MODEL if you want to use the
// global model anyway.
const VISION_PII_MODEL =
  process.env.ANTHROPIC_VISION_MODEL ?? "claude-opus-4-7";

export async function visionDetectPIIBoxes(opts: {
  imageBuffer: Buffer;
  mediaType: SupportedImageMime;
  caregiverFirstName: string;
}): Promise<PIIBox[]> {
  const systemPrompt = `Du analysierst ein Foto eines Pflege-Dokuments und identifizierst personenbezogene Daten (PII), die aus DSGVO/RODO-Gründen unleserlich gemacht werden müssen.

VORNAME DER PFLEGEKRAFT (darf STEHEN BLEIBEN, NICHT obscuren): "${opts.caregiverFirstName}"

ZU FINDEN UND ZU MARKIEREN:
- Nachnamen — von Klienten, deren Angehörigen, anderen Pflegekräften UND der Pflegekraft selbst
- Vornamen Dritter (nicht der Pflegekraft)
- Wohn-/Postadressen (Straße, Hausnummer, PLZ, Stadt wenn als private Adresse erkennbar)
- Telefonnummern
- E-Mail-Adressen
- Geburtsdaten Dritter
- Personalausweis-, PESEL-, Sozialversicherungs-Nummern
- Bankdaten

NICHT zu markieren:
- Institutionsnamen (Schulen, Kliniken, Behörden, Firmen) — Eigennamen von Organisationen dürfen sichtbar bleiben
- Allgemeine Datumsangaben (Ausstellungsdatum, Zeitraum eines Einsatzes)
- Berufstitel, Funktionen
- Der Vorname der Pflegekraft ("${opts.caregiverFirstName}") — der bleibt stehen

POSITION — KRITISCH WICHTIG:
- Koordinaten (x, y, width, height) sind normalisiert 0..1 bezogen auf das GANZE BILD, einschließlich aller weißen Ränder, Hintergrund-Verzierungen und dekorativer Rahmen.
- y=0 ist die ALLEROBERSTE Pixelzeile des Bildes (nicht „wo der Text beginnt"). y=1 ist die alleruntere Pixelzeile.
- x=0 ist die linke Bildkante. x=1 ist die rechte Bildkante.
- Wenn das Dokument einen 5 % breiten Zierrahmen oben hat und der Text dahinter beginnt, dann ist die obere Textkante bei y ≈ 0.05, NICHT bei y = 0.
- Mental-Check: zähle aus, wie weit die PII-Stelle vom oberen Bildrand entfernt ist als Bruchteil der GESAMTEN Bildhöhe (inklusive Rand). Genau dieser Wert ist y.
- Sei großzügig mit width — lieber 10 % zu breit als 1 % zu schmal.

Wenn mehrere PII-Stellen in einer Textzeile stehen, mache pro Stelle eine eigene Box.

Wenn KEINE PII gefunden wird, gib eine leere findings-Liste zurück.`;

  const res = await anthropic.messages.create({
    model: VISION_PII_MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    tools: [
      {
        name: "report_pii_boxes",
        description:
          "Liste der gefundenen PII-Stellen mit normalisierten Bounding-Box-Koordinaten.",
        input_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                  category: {
                    type: "string",
                    enum: ["name", "address", "phone", "email", "id", "other"],
                  },
                  excerpt: { type: "string" },
                },
                required: [
                  "x",
                  "y",
                  "width",
                  "height",
                  "category",
                  "excerpt",
                ],
              },
            },
          },
          required: ["findings"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_pii_boxes" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType,
              data: opts.imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Bitte alle PII-Stellen mit Bounding-Boxes über das Tool zurückgeben.",
          },
        ],
      },
    ],
  });

  const input = firstToolInput(res) as { findings?: unknown } | null;
  const findings = Array.isArray(input?.findings) ? input.findings : [];
  const boxes: PIIBox[] = [];
  for (const f of findings) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const x = clamp01(Number(o.x));
    const y = clamp01(Number(o.y));
    const width = clamp01(Number(o.width));
    const height = clamp01(Number(o.height));
    if (width <= 0 || height <= 0) continue;
    boxes.push({
      page: 0,
      x,
      y,
      width,
      height,
      category: (o.category as PIIBox["category"]) ?? "other",
      excerpt: String(o.excerpt ?? ""),
    });
  }
  return boxes;
}

function clamp01(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export interface ExtractedMetadata {
  title?: string;
  issuedBy?: string;
  issuedAt?: string;
  trainingTopic?: string;
  language?: string;
}

const METADATA_SYSTEM = `Du extrahierst Metadaten aus einem Pflegedokument: kurzer Titel, Aussteller, Datum (falls erkennbar), Schulungsthema (nur bei Zertifikaten) und Originalsprache. Wenn ein Feld nicht erkennbar ist, lass es weg oder setze null. Gib das Ergebnis über das Tool report_metadata zurück.`;

export async function extractMetadata(text: string): Promise<ExtractedMetadata> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: METADATA_SYSTEM,
    tools: [
      {
        name: "report_metadata",
        description: "Strukturierte Metadaten zum Dokument.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: ["string", "null"] },
            issuedBy: { type: ["string", "null"] },
            issuedAt: {
              type: ["string", "null"],
              description: "ISO YYYY-MM-DD oder null",
            },
            trainingTopic: { type: ["string", "null"] },
            language: { type: "string", enum: ["de", "pl", "other"] },
          },
          required: ["language"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_metadata" },
    messages: [{ role: "user", content: text.slice(0, 8000) }],
  });
  return (firstToolInput(res) as ExtractedMetadata) ?? {};
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Helper: pull the first tool_use input from a Messages API response.
// Centralizes the boilerplate for our many tool-use-backed JSON helpers.
function firstToolInput(res: Anthropic.Message): unknown {
  const tu = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  return tu?.input ?? null;
}

// Claude occasionally wraps an array tool_use field as a JSON-encoded string,
// especially when the contained strings have curly+straight quote pairs that
// confuse its own JSON escaping. Recover gracefully by trying to parse the
// string, and as a last resort regex-extract the title/blurb fields per item.
function coerceItems(v: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(v)) {
    return v.filter((x) => x && typeof x === "object") as Array<
      Record<string, unknown>
    >;
  }
  if (typeof v !== "string") return [];
  const trimmed = v.trim();
  if (!trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallthrough to regex extraction */
  }
  // Regex fallback: scan for { ... } blocks and extract "title" / "blurb"
  // values up to the next field/end-of-object marker. Lenient on quoting.
  const items: Array<Record<string, unknown>> = [];
  const objectRe = /\{[\s\S]*?\}(?=\s*[,\]])/g;
  const matches = trimmed.match(objectRe) ?? [trimmed.slice(1, -1)];
  for (const m of matches) {
    const titleMatch = m.match(
      /"title"\s*:\s*"([\s\S]*?)"\s*,\s*"blurb"/,
    );
    const blurbMatch = m.match(/"blurb"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
    if (titleMatch || blurbMatch) {
      items.push({
        title: titleMatch?.[1]?.trim() ?? "",
        blurb: blurbMatch?.[1]?.trim() ?? "",
      });
    }
  }
  return items;
}

