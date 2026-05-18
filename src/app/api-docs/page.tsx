export const dynamic = "force-static";

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  body?: string;
}

const groups: Array<{ title: string; endpoints: Endpoint[] }> = [
  {
    title: "Pflegekräfte",
    endpoints: [
      {
        method: "GET",
        path: "/api/caregivers",
        desc: "Liste aller Pflegekräfte inkl. Dokument-Anzahl.",
      },
      {
        method: "POST",
        path: "/api/caregivers/from-file",
        desc: "Pflegekraft aus Profil-PDF/Bild anlegen. KI extrahiert Name, Geburtsname, Sprachen, Schwerpunkte, Bio — Kontaktdaten/PII werden gestrippt. Zusätzlich wird das eingebettete Portrait-Foto erkannt, zugeschnitten und als Profilfoto gespeichert. Quell-Dateien werden nicht persistiert.",
        body: 'multipart: files (1 oder mehrere, PDF/JPG/PNG)',
      },
      {
        method: "POST",
        path: "/api/caregivers/from-text",
        desc: "Pflegekraft aus freiem Text anlegen (Notizen, E-Mail, kurzer Steckbrief). KI extrahiert Felder. Kontaktdaten/PII werden ignoriert.",
        body: 'JSON: { text: string }',
      },
      {
        method: "POST",
        path: "/api/caregivers",
        desc: "Pflegekraft direkt mit strukturierten Feldern anlegen — für Integrationen, die Felder schon haben.",
        body: "JSON: { firstName, lastName, formerName?, languages?, specialties?, bio? }",
      },
      {
        method: "GET",
        path: "/api/caregivers/:id",
        desc: "Pflegekraft inkl. aller Dokumente und Exports.",
      },
      {
        method: "PATCH",
        path: "/api/caregivers/:id",
        desc: "Pflegekraft-Felder aktualisieren.",
      },
      {
        method: "DELETE",
        path: "/api/caregivers/:id",
        desc: "Pflegekraft + alle Dokumente + Foto + Exports löschen.",
      },
      {
        method: "POST",
        path: "/api/caregivers/:id/photo",
        desc: "Foto manuell setzen oder ersetzen.",
        body: "multipart: photo",
      },
      {
        method: "GET",
        path: "/api/caregivers/:id/photo/file",
        desc: "Foto-Binary (JPEG).",
      },
    ],
  },
  {
    title: "Dokumente",
    endpoints: [
      {
        method: "POST",
        path: "/api/documents",
        desc: "Dokument hochladen. type = REFERENZ | EMPFEHLUNG | ZERTIFIKAT | GRUSSKARTE. Wenn kein title mitgegeben wird, fällt das System auf den Dateinamen zurück; die KI-Verarbeitung überschreibt den Titel anschließend mit dem extrahierten echten Titel.",
        body: "multipart: file, caregiverId, type, title?, issuedBy?, issuedAt?, trainingTopic?, originalLang?",
      },
      {
        method: "GET",
        path: "/api/documents/:id",
        desc: "Dokument-Details inkl. RedactionBoxes.",
      },
      {
        method: "PATCH",
        path: "/api/documents/:id",
        desc: "Metadaten / translationText / agencyAttestation manuell editieren.",
      },
      {
        method: "DELETE",
        path: "/api/documents/:id",
        desc: "Dokument + Datei löschen.",
      },
      {
        method: "GET",
        path: "/api/documents/:id/file",
        desc: "Original-Binary.",
      },
      {
        method: "POST",
        path: "/api/documents/:id/process",
        desc: "KI-Pipeline: OCR → Metadaten → Übersetzung → Agentur-Bestätigung → PII-Vorschläge. Wird beim Upload aus dem UI automatisch ausgelöst.",
        body: 'JSON: { steps?: ["ocr","metadata","translate","attest","pii"], force?: boolean }',
      },
      {
        method: "GET",
        path: "/api/documents/:id/redactions",
        desc: "Liste aller Schwärzungs-Boxen + KI-Vorschläge.",
      },
      {
        method: "PUT",
        path: "/api/documents/:id/redactions",
        desc: "Komplette Liste ersetzen. Geometrie normalisiert 0..1 vom Seiten-Top-Left.",
        body: 'JSON: { boxes: [{ page, x, y, width, height, source: "ai"|"manual", reason?, approved }] }',
      },
    ],
  },
  {
    title: "PDF-Export (pro Sektion)",
    endpoints: [
      {
        method: "POST",
        path: "/api/caregivers/:id/sections/REFERENZ/export",
        desc: "Rendert die Referenzen-Sektion als eigenständige PDF: Cover (Foto+Name+KI-Übersicht+Liste mit Blurbs) + alle Original-Referenzen dahinter.",
      },
      {
        method: "POST",
        path: "/api/caregivers/:id/sections/EMPFEHLUNG/export",
        desc: "Rendert die Empfehlungsschreiben-Sektion.",
      },
      {
        method: "POST",
        path: "/api/caregivers/:id/sections/ZERTIFIKAT/export",
        desc: "Rendert die Zertifikate-Sektion.",
      },
      {
        method: "POST",
        path: "/api/caregivers/:id/sections/GRUSSKARTE/export",
        desc: "Rendert die Grußkarten-Sektion.",
      },
      {
        method: "GET",
        path: "/api/exports/:id",
        desc: "ExportJob-Status: { id, caregiverId, status, outputPath, summaryFinal, … }.",
      },
      {
        method: "GET",
        path: "/api/exports/:id/file",
        desc: "Generiertes PDF herunterladen (application/pdf).",
      },
    ],
  },
];

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">REST API</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Alle Endpoints sind JSON, soweit nicht anders angegeben. Datei-Uploads sind multipart/form-data.
          Authentifizierung ist im MVP nicht eingebaut — vor Production einen Auth-Layer davor.
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="card overflow-x-auto">
          <h2 className="font-semibold mb-3" style={{ color: "var(--brand)" }}>
            {g.title}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--muted)" }}>
                <th className="text-left py-2 pr-3 w-20">Method</th>
                <th className="text-left py-2 pr-3">Path</th>
                <th className="text-left py-2">Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              {g.endpoints.map((e) => (
                <tr
                  key={`${e.method}-${e.path}`}
                  className="border-t align-top"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="py-2 pr-3">
                    <span className="badge" style={methodStyle(e.method)}>
                      {e.method}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                    {e.path}
                  </td>
                  <td className="py-2">
                    <div>{e.desc}</div>
                    {e.body && (
                      <div
                        className="mt-1 text-xs font-mono"
                        style={{ color: "var(--muted)" }}
                      >
                        {e.body}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="card">
        <h2 className="font-semibold mb-2">Typischer End-to-End-Flow</h2>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>
            <span className="font-mono">POST /api/caregivers/from-file</span>{" "}
            (Profil-PDF rein) → Pflegekraft + Foto angelegt
          </li>
          <li>
            <span className="font-mono">POST /api/documents</span>{" "}
            (für jedes Referenz-/Empfehlungs-/Zertifikats-Dokument)
          </li>
          <li>
            <span className="font-mono">POST /api/documents/:id/process</span>{" "}
            (UI macht das automatisch beim Upload)
          </li>
          <li>
            <span className="font-mono">
              POST /api/caregivers/:id/sections/&lt;type&gt;/export
            </span>{" "}
            → fertige PDF pro Sektion
          </li>
          <li>
            <span className="font-mono">GET /api/exports/:id/file</span> →
            Download
          </li>
        </ol>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">cURL-Schnelltest</h2>
        <pre
          className="text-xs overflow-x-auto p-3 rounded"
          style={{ background: "#1f1f1f", color: "#e8e8e8" }}
        >{`# 1. Pflegekraft aus Profil-PDF (extrahiert Name, Sprachen, Foto, ...)
CG=$(curl -s -X POST http://localhost:3000/api/caregivers/from-file \\
  -F "files=@./Klaudia_W_Profil.pdf" | jq -r .caregiver.id)

# 2. Zertifikate hochladen (mehrere)
for f in ./certs/*.pdf; do
  DOC=$(curl -s -X POST http://localhost:3000/api/documents \\
    -F "caregiverId=$CG" -F "type=ZERTIFIKAT" -F "file=@$f" | jq -r .document.id)
  curl -s -X POST "http://localhost:3000/api/documents/$DOC/process" \\
    -H "Content-Type: application/json" -d '{}'
done

# 3. Sektion-PDF erstellen + herunterladen
EXP=$(curl -s -X POST "http://localhost:3000/api/caregivers/$CG/sections/ZERTIFIKAT/export" \\
  -H "Content-Type: application/json" -d '{}' | jq -r .exportJob.id)
curl -o Zertifikate.pdf "http://localhost:3000/api/exports/$EXP/file"`}</pre>
      </div>
    </div>
  );
}

function methodStyle(m: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    GET: { background: "#e3f2fd", color: "#0d47a1" },
    POST: { background: "#e8f5e9", color: "#1b5e20" },
    PATCH: { background: "#fff3e0", color: "#b25b00" },
    PUT: { background: "#fff3e0", color: "#b25b00" },
    DELETE: { background: "#ffebee", color: "#b71c1c" },
  };
  return map[m] ?? {};
}
