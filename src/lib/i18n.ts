// Lightweight i18n: nested-key dictionaries + a t() helper.
// Locale is stored in a 'locale' cookie ('de' | 'pl'), default 'de'.
// Server components: pass locale down as a prop (read via cookies()).
// Client components: use the LocaleProvider/useLocale() context.

export const LOCALES = ["de", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  pl: "Polski",
};

// All UI strings live here. Add new strings with both locale versions.
// Keys are dot-paths; we resolve them with t(locale, "section.key").
const dict = {
  de: {
    common: {
      cancel: "Abbrechen",
      save: "Speichern",
      delete: "Löschen",
      create: "Anlegen",
      edit: "Bearbeiten",
      back: "Zurück",
      ready: "Fertig",
      error: "Fehler",
      loading: "Lade…",
      saving: "Speichere…",
      open: "Öffnen",
      remove: "Entfernen",
      optional: "optional",
      required: "Pflichtfeld",
      or: "ODER",
    },
    nav: {
      caregivers: "Pflegekräfte",
      api: "API",
    },
    home: {
      title: "Pflegekräfte",
      subtitle: "Verwalte Profile, Dokumente und Referenzen-Exporte.",
      newCaregiver: "+ Neue Pflegekraft",
      empty: "Noch keine Pflegekraft angelegt.",
      emptyAction: "Erste Pflegekraft anlegen",
      documentsCount: "Dokumente",
    },
    newCaregiver: {
      title: "Neue Pflegekraft",
      intro:
        "Entweder Profil-Datei hochladen (KI extrahiert Name, Geburtsname, Sprachen, Schwerpunkte) — oder unten direkt Vor- und Nachname eintippen. Foto ist immer optional. Kontaktdaten (Telefon, E-Mail, Adresse) werden grundsätzlich nicht übernommen.",
      profileFiles: "Profil-Datei(en) — optional, KI liest aus",
      profileDropTitle: "Profil-PDF oder -Screenshot",
      profileDropActive: "Loslassen zum Hinzufügen…",
      profileDropHint: "Dateien hierher ziehen oder klicken",
      profileDropFormats: "PDF, JPG, PNG, WebP, HEIC — mehrere Seiten/Bilder möglich",
      nameSection: "Name direkt eintragen — falls kein Profil vorliegt",
      firstNamePlaceholder: "Vorname *",
      lastNamePlaceholder: 'Nachname (oder Anfangsbuchstabe, z.B. „W.“)',
      nameDisabled:
        "(Deaktiviert weil Profil-Datei vorliegt — KI extrahiert den Namen automatisch.)",
      photoLabel: "Foto (optional)",
      readingProfile: "Liest Profil…",
      creating: "Lege an…",
      errorNoInput:
        "Bitte entweder eine Profil-Datei hochladen ODER mindestens einen Vornamen eingeben.",
      errorNoName: "Kein Name im Dokument erkennbar. Bitte Vor-/Nachname unten eintragen.",
      errorNoText:
        "Aus den Dateien konnte kein Text gelesen werden. Bitte Vor-/Nachname eintragen oder schärferes Foto/PDF nutzen.",
      errorGeneric: "Pflegekraft konnte nicht angelegt werden.",
    },
    detail: {
      former: "ehemalig",
    },
    sections: {
      REFERENZ: { label: "Referenzen", icon: "📄", hint: "Referenzen von Klienten, Familien oder Auftraggebern · PDF, JPG, PNG" },
      ZERTIFIKAT: { label: "Zertifikate", icon: "🎓", hint: "Zertifikate von Kursen, Schulungen, Sprachzertifikate, Berufsausbildung" },
      GRUSSKARTE: { label: "Grußkarten", icon: "💌", hint: "Weihnachts-, Geburtstags- und sonstige Grußkarten" },
      EMPFEHLUNG: { label: "Empfehlungsschreiben", icon: "✉️", hint: "" },
    },
    drop: {
      dragging: "Loslassen zum Hochladen…",
      hint: "Dateien hierher ziehen oder klicken",
      uploading: "Lädt hoch…",
      processing: "KI verarbeitet…",
      done: "✓ Fertig",
      error: "Fehler",
    },
    document: {
      addTitle: "Dokument hinzufügen",
      addHint: "Referenz, Zertifikat, Empfehlung oder Grußkarte (PDF, JPG, PNG).",
      uploadBtn: "+ Hochladen",
      reprocess: "Erneut von KI verarbeiten",
      reprocessLabel: "Erneut",
      rotate: "Bild um 90° drehen",
      rotateLabel: "Drehen",
      deleteLabel: "Löschen",
      deleteConfirm: "Dokument löschen?",
      deletePhoto: "Foto löschen?",
    },
    sectionPdf: {
      create: "PDF erstellen",
      creating: "Erstelle PDF…",
      openPdf: "PDF öffnen",
      missingDocs: "Noch keine Dokumente in dieser Sektion.",
      waiting: "KI verarbeitet noch…",
    },
    letter: {
      heading: "Empfehlungsschreiben",
      statusReady: "zuletzt aktualisiert",
      statusDraft: "Entwurf vorhanden",
      statusEmptyAi: "Noch kein Schreiben — KI-Entwurf möglich",
      statusEmptyManual: "Noch kein Schreiben — bitte selbst schreiben",
      generate: "KI-Entwurf",
      regenerate: "Neu generieren",
      generating: "KI denkt…",
      writeManually: "Selbst schreiben",
      placeholder: "Sehr geehrte Damen und Herren\n…",
      errorGenerate: "KI-Generierung fehlgeschlagen.",
      errorSave: "Speichern fehlgeschlagen.",
    },
    exports: {
      title: "Bisher erzeugte PDFs",
      deleteConfirm: "Erzeugtes PDF wirklich löschen?",
    },
    photo: {
      hover: "Foto ändern",
      add: "+ Foto",
    },
    caregiverActions: {
      delete: "Pflegekraft löschen",
      deleteConfirm:
        "Pflegekraft und alle Dokumente unwiderruflich löschen?",
      deleting: "Lösche…",
    },
  },
  pl: {
    common: {
      cancel: "Anuluj",
      save: "Zapisz",
      delete: "Usuń",
      create: "Utwórz",
      edit: "Edytuj",
      back: "Wstecz",
      ready: "Gotowe",
      error: "Błąd",
      loading: "Ładowanie…",
      saving: "Zapisywanie…",
      open: "Otwórz",
      remove: "Usuń",
      optional: "opcjonalne",
      required: "wymagane",
      or: "LUB",
    },
    nav: {
      caregivers: "Opiekunki",
      api: "API",
    },
    home: {
      title: "Opiekunki",
      subtitle: "Zarządzaj profilami, dokumentami i eksportami referencji.",
      newCaregiver: "+ Nowa opiekunka",
      empty: "Nie utworzono jeszcze żadnej opiekunki.",
      emptyAction: "Utwórz pierwszą opiekunkę",
      documentsCount: "dokumentów",
    },
    newCaregiver: {
      title: "Nowa opiekunka",
      intro:
        "Wgraj plik profilu (AI wyczyta imię, nazwisko panieńskie, języki, specjalizacje) — albo wpisz poniżej bezpośrednio imię i nazwisko. Zdjęcie zawsze opcjonalne. Dane kontaktowe (telefon, e-mail, adres) nie są przejmowane.",
      profileFiles: "Plik(i) profilu — opcjonalne, AI wyczyta",
      profileDropTitle: "Profil PDF lub zrzut ekranu",
      profileDropActive: "Upuść, aby dodać…",
      profileDropHint: "Przeciągnij pliki tutaj lub kliknij",
      profileDropFormats:
        "PDF, JPG, PNG, WebP, HEIC — możliwe wielostronicowe / kilka obrazów",
      nameSection: "Wpisz imię bezpośrednio — jeśli nie masz profilu",
      firstNamePlaceholder: "Imię *",
      lastNamePlaceholder: 'Nazwisko (lub inicjał, np. „W.“)',
      nameDisabled:
        "(Zablokowane, ponieważ wybrano plik profilu — AI wyodrębni nazwisko automatycznie.)",
      photoLabel: "Zdjęcie (opcjonalne)",
      readingProfile: "Czytam profil…",
      creating: "Tworzę…",
      errorNoInput:
        "Wgraj plik profilu LUB wpisz przynajmniej imię.",
      errorNoName:
        "Nie wykryto imienia w dokumencie. Wpisz imię/nazwisko poniżej.",
      errorNoText:
        "Nie udało się odczytać tekstu z plików. Wpisz imię/nazwisko lub użyj wyraźniejszego zdjęcia/PDF.",
      errorGeneric: "Nie udało się utworzyć opiekunki.",
    },
    detail: {
      former: "z domu",
    },
    sections: {
      REFERENZ: {
        label: "Referencje",
        icon: "📄",
        hint: "Referencje od klientów, rodzin lub zleceniodawców · PDF, JPG, PNG",
      },
      ZERTIFIKAT: {
        label: "Certyfikaty",
        icon: "🎓",
        hint: "Certyfikaty kursów, szkoleń, certyfikaty językowe, dyplomy zawodowe",
      },
      GRUSSKARTE: {
        label: "Kartki z życzeniami",
        icon: "💌",
        hint: "Świąteczne, urodzinowe i inne kartki",
      },
      EMPFEHLUNG: { label: "List polecający", icon: "✉️", hint: "" },
    },
    drop: {
      dragging: "Upuść, aby wgrać…",
      hint: "Przeciągnij pliki tutaj lub kliknij",
      uploading: "Wgrywanie…",
      processing: "AI przetwarza…",
      done: "✓ Gotowe",
      error: "Błąd",
    },
    document: {
      addTitle: "Dodaj dokument",
      addHint: "Referencja, certyfikat, polecenie lub kartka (PDF, JPG, PNG).",
      uploadBtn: "+ Wgraj",
      reprocess: "Przetwórz ponownie przez AI",
      reprocessLabel: "Ponownie",
      rotate: "Obróć obraz o 90°",
      rotateLabel: "Obróć",
      deleteLabel: "Usuń",
      deleteConfirm: "Usunąć dokument?",
      deletePhoto: "Usunąć zdjęcie?",
    },
    sectionPdf: {
      create: "Utwórz PDF",
      creating: "Tworzę PDF…",
      openPdf: "Otwórz PDF",
      missingDocs: "Brak dokumentów w tej sekcji.",
      waiting: "AI jeszcze przetwarza…",
    },
    letter: {
      heading: "List polecający",
      statusReady: "ostatnio zaktualizowany",
      statusDraft: "Wersja robocza dostępna",
      statusEmptyAi: "Brak listu — możliwa wersja AI",
      statusEmptyManual: "Brak listu — napisz samodzielnie",
      generate: "Wersja AI",
      regenerate: "Generuj ponownie",
      generating: "AI myśli…",
      writeManually: "Napisz samodzielnie",
      placeholder: "Szanowni Państwo\n…",
      errorGenerate: "Generowanie AI nie powiodło się.",
      errorSave: "Zapis nie powiódł się.",
    },
    exports: {
      title: "Wcześniej wygenerowane PDF-y",
      deleteConfirm: "Naprawdę usunąć wygenerowany PDF?",
    },
    photo: {
      hover: "Zmień zdjęcie",
      add: "+ Zdjęcie",
    },
    caregiverActions: {
      delete: "Usuń opiekunkę",
      deleteConfirm:
        "Nieodwracalnie usunąć opiekunkę i wszystkie dokumenty?",
      deleting: "Usuwam…",
    },
  },
} as const;

type Dict = (typeof dict)["de"];

// Resolve a dot-path like "common.cancel" against the dictionary.
// Returns the German fallback if the Polish key is missing.
export function t(locale: Locale, key: string): string {
  const parts = key.split(".");
  const get = (d: unknown): unknown => {
    let cur: unknown = d;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return cur;
  };
  const value = get(dict[locale]) ?? get(dict.de);
  return typeof value === "string" ? value : key;
}

// Section labels are objects (label, icon, hint), not strings — handled separately.
export function sectionMeta(
  locale: Locale,
  type: "REFERENZ" | "ZERTIFIKAT" | "GRUSSKARTE" | "EMPFEHLUNG",
): { label: string; icon: string; hint: string } {
  return dict[locale].sections[type] ?? dict.de.sections[type];
}

export type Dictionary = Dict;
