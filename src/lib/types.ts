export const DOCUMENT_TYPES = [
  "REFERENZ",
  "ZERTIFIKAT",
  "EMPFEHLUNG",
  "GRUSSKARTE",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS_DE: Record<DocumentType, string> = {
  REFERENZ: "Referenz",
  ZERTIFIKAT: "Zertifikat",
  EMPFEHLUNG: "Empfehlungsschreiben",
  GRUSSKARTE: "Grußkarte",
};

export const DOCUMENT_TYPE_LABELS_DE_PLURAL: Record<DocumentType, string> = {
  REFERENZ: "Referenzen",
  ZERTIFIKAT: "Zertifikate",
  EMPFEHLUNG: "Empfehlungsschreiben",
  GRUSSKARTE: "Grußkarten",
};

export const DOCUMENT_TYPE_LABELS_PL: Record<DocumentType, string> = {
  REFERENZ: "Referencja",
  ZERTIFIKAT: "Certyfikat / świadectwo",
  EMPFEHLUNG: "List polecający",
  GRUSSKARTE: "Kartka z życzeniami",
};

export const DOCUMENT_TYPE_SUBTYPES: Record<DocumentType, string[]> = {
  REFERENZ: [
    "Od klientów / rodziny",
    "Od innych zleceniodawców",
    "Świadectwo pracy",
  ],
  ZERTIFIKAT: ["Kurs doskonalący", "Kurs językowy", "Kurs zawodowy"],
  EMPFEHLUNG: [
    "Poświadczające dotychczasową współpracę",
    "Wrażenie zdobyte podczas procesu rekrutacji",
  ],
  GRUSSKARTE: ["Świąteczne", "Z okazji urodzin", "Inne"],
};

export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PROCESSING",
  "READY",
  "ERROR",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXPORT_STATUSES = [
  "DRAFT",
  "RENDERING",
  "READY",
  "ERROR",
] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];
