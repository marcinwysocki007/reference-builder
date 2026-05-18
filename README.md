# Referenzen-Tool

Internes Tool zum Aufbereiten von Referenzen, Zertifikaten, Empfehlungsschreiben und
Grußkarten von 24-Stunden-Betreuungskräften. Erzeugt ein einziges PDF mit Deckblatt
(Foto + Profil + KI-Zusammenfassung) und allen Dokumenten (PL-Original + DE-Übersetzung
+ Agentur-Bestätigung), gemäß den Spec-Vorgaben des Vermittlers (PL-Original und
DE-Übersetzung in einem Dokument, RODO/DSGVO-konform).

## Deploy auf Render — ein Klick

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/marcinwysocki007/reference-builder)

Render liest `render.yaml`, legt Postgres-DB + Web-Service + 1 GB Disk an. Danach im
Service-Settings noch `ANTHROPIC_API_KEY` setzen → fertig. Detaillierter Walk-Through
in [DEPLOY.md](DEPLOY.md).

## Features

- Pflegekraft-Profile mit Foto, Sprachen, Schwerpunkten, „ehemalig"-Name
- Upload von PDF / JPG / PNG, Auto-Verbesserung von Foto-Scans (sharp)
- OCR Polnisch + Deutsch (tesseract.js, lokal)
- Claude-API für:
  - Metadaten-Extraktion (Titel, Aussteller, Datum, Sprache, Schulungsthema)
  - Polnisch → Deutsch Übersetzung
  - Agentur-Bestätigungstext
  - Drittpersonen-PII-Erkennung (RODO / DSGVO)
  - Warme, professionelle Deckblatt-Zusammenfassung
- Inline-Editor für Übersetzung und Bestätigung — KI ist ein Vorschlag, kein Diktat
- Schwärzungs-Review (v1: textbasierte Bestätigungen; geometrisches Zeichnen geplant)
- Konfigurierbares PDF-Branding (Logo / Farben / Slogan / URL) via Env-Variablen

## Setup

```bash
npm install            # Dependencies + Prisma client
npx prisma db push     # SQLite DB anlegen
cp .env.example .env   # ANTHROPIC_API_KEY eintragen
npm run dev            # http://localhost:3000
```

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind 4
- Prisma + SQLite (lokal) → migrationsfähig zu Postgres
- Anthropic SDK (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5 — per `ANTHROPIC_MODEL`)
- pdf-lib (Composing), pdfjs-dist (Text-Extraktion), tesseract.js (OCR), sharp (Bild)

## REST API

Siehe `/api-docs` im laufenden Tool — vollständige Endpoint-Liste mit Beispiel-Flow.
Schnelltest:

```bash
# Pflegekraft anlegen
curl -X POST http://localhost:3000/api/caregivers \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Anna","lastName":"Nowak","languages":"PL, DE B1"}'

# Dokument hochladen
curl -X POST http://localhost:3000/api/documents \
  -F "caregiverId=CG_ID" \
  -F "type=REFERENZ" \
  -F "title=Referenz Familie M." \
  -F "originalLang=pl" \
  -F "file=@./referenz.pdf"

# KI-Pipeline anstoßen
curl -X POST http://localhost:3000/api/documents/DOC_ID/process \
  -H "Content-Type: application/json" -d '{}'

# Zusammenfassung + Export
curl -X POST http://localhost:3000/api/caregivers/CG_ID/summary
curl -X POST http://localhost:3000/api/exports \
  -H "Content-Type: application/json" \
  -d '{"caregiverId":"CG_ID"}'
```

## Deployment (Skizze)

- Postgres statt SQLite: `DATABASE_URL=postgresql://…`, dann `npx prisma db push`
- Persistent storage: S3-kompatibel statt lokalem `./storage` — `src/lib/storage.ts` ist der einzige Ort, der angepasst werden muss
- Auth: vor Production einen Layer davor (NextAuth / Clerk / eigener API-Key-Check)
- `sharp` braucht native libs — auf Vercel funktioniert es nativ, auf eigenen Servern Node 20 empfohlen

## Branding

Tool-UI und exportiertes PDF werden über Env-Variablen gebrandet — siehe `.env.example`.
Standardmäßig ist alles neutral („Referenzen-Tool", grauer Akzent). Setze:

```bash
BRAND_TOOL_NAME="Deine Firma · Referenzen"      # erscheint im UI-Header
BRAND_PDF_NAME="Deine Firma"                    # erscheint auf dem PDF-Deckblatt
BRAND_PDF_TAGLINE="Dein Slogan"                 # optional, unter dem Namen
BRAND_PDF_FOOTER_URL="deine-firma.de"           # rechts unten im Footer
BRAND_PDF_LOGO_PATH="./public/brand/logo.png"   # optional, ersetzt Name + Slogan im PDF
BRAND_PRIMARY="#3b3b46"                         # Hex, Akzentfarbe Tool + PDF
BRAND_PRIMARY_SOFT="#d6d6dc"                    # Hex, weichere Variante (Section-Dividers etc.)
BRAND_PRIMARY_TINT="#eeeef2"                    # Hex, ganz hellte Variante (Badges)
```

Nach Änderung Dev-Server neu starten.

## Hinweise

- **Node 18 vs. 20:** Die installierten Dev-Tools warnen bei Node 18 (Tailwind 4 oxide
  und ESLint 5 erwarten Node 20+). Tool läuft, aber für Production Node 20 LTS verwenden.
- **ANTHROPIC_API_KEY-Kollision:** Wenn das Terminal die Variable schon gesetzt hat
  (z. B. weil Claude Code in dieser Shell läuft), übernimmt Next.js den leeren / fremden Wert
  und ignoriert `.env`. Lösung: dev starten mit `env -u ANTHROPIC_API_KEY npm run dev`,
  oder ein eigenes Terminal nutzen, in dem die Variable nicht vorbelegt ist.
- **DSGVO:** Bei produktivem Einsatz Audit der KI-PII-Erkennung notwendig — KI ist
  nicht 100 % zuverlässig. Geometrisches Schwärzen kommt in v2.
- **Kosten:** Pro Dokument fallen Claude-API-Calls für OCR-Metadata, Translation,
  Attestation und PII an. Mit Sonnet 4.6 ~$0.01–0.05 pro Dokument.

## Lizenz

Internes Tool — nicht zur Weitergabe.
