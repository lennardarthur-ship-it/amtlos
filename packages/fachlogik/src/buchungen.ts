/**
 * Buchungen und DATEV-Export (E-132): aus Ausgangsrechnungen und Belegen entstehen einfache Buchungssätze (Forderung an
 * Erlös, Aufwand an Verbindlichkeit/Kasse/Privateinlage). Sie gehen als DATEV-Format „Buchungsstapel“ (EXTF, Version
 * 700, Kategorie 21) an die Steuerberatung oder als lesbare CSV an Menschen und Tabellenprogramme. Reine Funktionen
 * ohne Gerät; die Kodierung nach Windows-1252 liefert `datevExtfBytes`, das Schreiben der Datei ist Sache des Aufrufers.
 *
 * Fachlich zu prüfen – siehe `pruefpunkteBuchungen()` und PRUEFLISTE:
 * - Die Spaltenliste der Buchungszeile (125 Felder der Version 700) ist aus dem Gedächtnis nachgebaut und NICHT gegen den
 *   aktuellen DATEV-Schnittstellen-Entwicklungsleitfaden abgeglichen. Sicher sind die ersten 14 Kernfelder (Umsatz bis
 *   Buchungstext); alle weiteren bleiben leer und müssen nur in Anzahl und Reihenfolge stimmen.
 * - Im Dateikopf stehen „Datum vom“ und „Datum bis“ als JJJJMMTT (wie der Wirtschaftsjahresbeginn), nicht als TTMMJJJJ;
 *   Feld 27 trägt den Kontenrahmen („03“/„04“).
 * - Konten, BU-Schlüssel 40 und die Umkehrbuchung für Stornos sind Annahmen.
 */
import { kategorieFuer, type Beleg } from "./belege.js";
import { summen, type Position } from "./rechnung.js";

export type Kontenrahmen = "SKR03" | "SKR04";

export interface Buchung {
  /** Belegdatum (ISO) */
  datum: string;
  /** in Cent, immer positiv – die Seite steht in `soll_haben` */
  betrag_cent: number;
  /** Soll/Haben-Kennzeichen aus Sicht des Kontos in `konto` */
  soll_haben: "S" | "H";
  konto: string;
  gegenkonto: string;
  /** meist leer, weil Automatikkonten die Steuer selbst rechnen */
  bu_schluessel: string;
  /** Rechnungs-/Belegnummer, höchstens 36 Zeichen, nur zulässige Zeichen (siehe `belegfeld1Aus`) */
  belegfeld1: string;
  /** Fälligkeit TTMMJJ (optional) */
  belegfeld2?: string;
  /** höchstens 60 Zeichen */
  buchungstext: string;
  /** Steuersatz in Prozent; null bei Kleinunternehmern */
  ust_satz: number | null;
  art: "einnahme" | "ausgabe" | "storno";
  /** ID der Rechnung oder des Belegs, aus dem die Buchung stammt */
  quelle_id: string;
}

/** Was eine Ausgangsrechnung für die Buchung braucht – Teilmenge der gespeicherten Rechnung. */
export interface AusgangsRechnungFuerBuchung {
  id: string;
  nummer: string;
  /** Rechnungsdatum (ISO) */
  datum: string;
  /** Tag des Zahlungseingangs (ISO) – für die Buchung derzeit ohne Bedeutung, siehe Prüfpunkt Ist-Versteuerung */
  bezahlt?: string | null;
  art: "rechnung" | "storno";
  kleinunternehmer: boolean;
  kunde: string;
  positionen: Position[];
}

/**
 * BU-Schlüssel, der die Steuerautomatik eines Automatikkontos aufhebt („keine Steuer“) – gesetzt, wenn ein Beleg keinen
 * Vorsteuerabzug erlaubt, das Kategorie-Konto aber Vorsteuer automatisch ziehen würde. Fachlich zu prüfen.
 */
export const BU_OHNE_STEUER = "40";

/** Sachkonten je Kontenrahmen – fachlich zu prüfen. Aufwandskonten stehen in der Kategorie (belege.ts). */
export const BUCHUNGSKONTEN: Record<
  Kontenrahmen,
  {
    /** Forderungen aus Lieferungen und Leistungen */
    forderungen: string;
    /** Verbindlichkeiten aus Lieferungen und Leistungen */
    verbindlichkeiten: string;
    kasse: string;
    privateinlagen: string;
    /** Erlöskonten je Steuersatz; `ku` für Kleinunternehmer (§ 19 UStG), `0` für steuerfreie Umsätze */
    erloese: { 19: string; 7: string; 0: string; ku: string };
  }
> = {
  SKR03: { forderungen: "1400", verbindlichkeiten: "1600", kasse: "1000", privateinlagen: "1890", erloese: { 19: "8400", 7: "8300", 0: "8100", ku: "8195" } },
  SKR04: { forderungen: "1200", verbindlichkeiten: "3300", kasse: "1600", privateinlagen: "2180", erloese: { 19: "4400", 7: "4300", 0: "4100", ku: "4185" } },
};

const UMLAUTE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "AE", Ö: "OE", Ü: "UE", ß: "ss" };

/** Belegfeld 1: höchstens 36 Zeichen aus Ziffern, Buchstaben und $ & % * + - / (DATEV); Umlaute werden umschrieben. */
export function belegfeld1Aus(s: string): string {
  return s
    .replace(/[äöüÄÖÜß]/g, (z) => UMLAUTE[z] ?? z)
    .replace(/[^A-Za-z0-9$&%*+\-/]/g, "")
    .slice(0, 36);
}

/** Leerraum zusammenziehen und auf `n` Zeichen kürzen (Buchungstext, Bezeichnung). */
const kuerze = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

function erloeskonto(k: (typeof BUCHUNGSKONTEN)[Kontenrahmen], satz: number | null): string {
  if (satz === null) return k.erloese.ku;
  if (satz === 7) return k.erloese[7];
  if (satz === 0) return k.erloese[0];
  // Regelsatz; ein unbekannter Satz landet ebenfalls hier (die App kennt nur 19, 7 und 0)
  return k.erloese[19];
}

/**
 * Je Rechnung und Steuersatz eine Buchung Forderungen an Erlöse mit dem Bruttobetrag (das Automatikkonto rechnet die
 * Umsatzsteuer selbst). Stornos als einfache Umkehrbuchung (Soll und Haben getauscht). Die Versteuerungsart ändert die
 * Buchungen nicht – sie steht in den Mandantenstammdaten der Steuerberatung (Prüfpunkt).
 */
export function buchungenAusRechnungen(rechnungen: AusgangsRechnungFuerBuchung[], kontenrahmen: Kontenrahmen, _o?: { versteuerung?: "soll" | "ist" }): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const r of rechnungen) {
    const storno = r.art === "storno";
    const buchungstext = kuerze(`${storno ? "Storno" : "RE"} ${r.nummer} ${r.kunde}`, 60);
    for (const g of summen(r.positionen, r.kleinunternehmer).gruppen) {
      const brutto = g.netto_cent + g.ust_cent;
      if (!brutto) continue;
      // eine negative Summe (nur bei negativen Positionen) dreht die Seite ebenfalls um
      const haben = storno ? brutto > 0 : brutto < 0;
      aus.push({
        datum: r.datum,
        betrag_cent: Math.abs(brutto),
        soll_haben: haben ? "H" : "S",
        konto: k.forderungen,
        gegenkonto: erloeskonto(k, g.satz),
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext,
        ust_satz: g.satz,
        art: storno ? "storno" : "einnahme",
        quelle_id: r.id,
      });
    }
  }
  return aus;
}

/**
 * Je Beleg und Steuersatz eine Buchung Aufwandskonto (aus der Kategorie) an Verbindlichkeiten, bei Barzahlung an Kasse,
 * bei privater Zahlung an Privateinlagen – mit dem Bruttobetrag. Ohne Vorsteuerabzug bei Satz > 0: BU-Schlüssel 40.
 */
export function buchungenAusBelegen(belege: Beleg[], kontenrahmen: Kontenrahmen): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const b of belege) {
    const kat = kategorieFuer(b.kategorie);
    const konten = kontenrahmen === "SKR03" ? kat.skr03 : kat.skr04;
    const gegenkonto = b.zahlung === "bar" ? k.kasse : b.zahlung === "privat" ? k.privateinlagen : k.verbindlichkeiten;
    const buchungstext = kuerze(`${b.lieferant} ${kat.titel}`, 60);
    // Belegnummer des Lieferanten, sonst die Beleg-ID in Kurzform
    const belegfeld1 = b.nummer ? belegfeld1Aus(b.nummer) : belegfeld1Aus(b.id).slice(0, 12).toUpperCase();
    for (const s of b.steuer) {
      if (!s.brutto_cent) continue;
      aus.push({
        datum: b.datum,
        betrag_cent: Math.abs(s.brutto_cent),
        soll_haben: s.brutto_cent < 0 ? "H" : "S",
        konto: konten[s.satz] ?? konten[19] ?? "",
        gegenkonto,
        bu_schluessel: !b.vorsteuer && s.satz > 0 ? BU_OHNE_STEUER : "",
        belegfeld1,
        buchungstext,
        ust_satz: s.satz,
        art: "ausgabe",
        quelle_id: b.id,
      });
    }
  }
  return aus;
}

// ---------------------------------------------------------------------------------------------------------------------
// DATEV-Format „Buchungsstapel“ (EXTF, Version 700, Kategorie 21)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Spaltenüberschriften der Buchungszeile, Version 700 (125 Felder). Aus dem Gedächtnis nachgebaut – gegen den
 * DATEV-Schnittstellen-Entwicklungsleitfaden prüfen. Gefüllt werden nur die Felder 1–14; die übrigen bleiben leer.
 */
export const DATEV_SPALTEN: readonly string[] = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [`Beleginfo - Art ${i}`, `Beleginfo - Inhalt ${i}`]),
  "KOST1 - Kostenstelle",
  "KOST2 - Kostenstelle",
  "Kost-Menge",
  "EU-Land u. UStID (Bestimmung)",
  "EU-Steuersatz (Bestimmung)",
  "Abw. Versteuerungsart",
  "Sachverhalt L+L",
  "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  ...Array.from({ length: 20 }, (_, i) => i + 1).flatMap((i) => [`Zusatzinformation - Art ${i}`, `Zusatzinformation- Inhalt ${i}`]),
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp",
  "USt-Schlüssel (Anzahlungen)",
  "EU-Land (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)",
  "Erlöskonto (Anzahlungen)",
  "Herkunft-Kz",
  "Buchungs GUID",
  "KOST-Datum",
  "SEPA-Mandatsreferenz",
  "Skontosperre",
  "Gesellschaftername",
  "Beteiligtennummer",
  "Identifikationsnummer",
  "Zeichnernummer",
  "Postensperre bis",
  "Bezeichnung SoBil-Sachverhalt",
  "Kennzeichen SoBil-Buchung",
  "Festschreibung",
  "Leistungsdatum",
  "Datum Zuord. Steuerperiode",
  "Fälligkeit",
  "Generalumkehr (GU)",
  "Steuersatz",
  "Land",
  "Abrechnungsreferenz",
  "BVV-Position",
  "EU-Land u. UStID (Ursprung)",
  "EU-Steuersatz (Ursprung)",
  "Abw. Skontokonto",
];

export interface DatevExtfOptionen {
  beraternummer?: string;
  mandantennummer?: string;
  /** Beginn des Wirtschaftsjahres (ISO), z. B. "2026-01-01" */
  wjBeginn: string;
  /** Zeitraum des Stapels (ISO); alle Belegdaten müssen darin liegen */
  von: string;
  bis: string;
  kontenrahmen: Kontenrahmen;
  /** Stellen der Sachkonten, Standard 4 */
  sachkontenlaenge?: number;
  /** Bezeichnung des Stapels, höchstens 30 Zeichen */
  bezeichnung?: string;
  /** Zeitpunkt der Erzeugung (ISO) – wird ohne Zeitzonenumrechnung übernommen */
  erzeugtAm: string;
}

/** Textfeld im DATEV-Format: in doppelten Anführungszeichen, innere Anführungszeichen verdoppelt. */
const inAnfz = (s: string) => `"${s.replace(/"/g, '""')}"`;
const inAnfzOderLeer = (s: string | undefined) => (s ? inAnfz(s) : "");
/** Betrag „1234,56“ (Komma, kein Tausenderpunkt) */
const betragMitKomma = (cent: number) => {
  const c = Math.round(Math.abs(cent));
  return `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;
};
const nurZiffern = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
const jjjjmmtt = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
/** Belegdatum im DATEV-Format TTMM – das Jahr ergibt sich aus dem Stapelzeitraum */
const ttmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7);
const ttmmjjjj = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** „Erzeugt am“ als JJJJMMTThhmmssfff aus einem ISO-Zeitpunkt; fehlende Teile werden mit Nullen gefüllt. */
function erzeugtAmAus(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?/.exec(iso);
  if (!m) return "";
  return `${m[1]}${m[2]}${m[3]}${m[4] ?? "00"}${m[5] ?? "00"}${m[6] ?? "00"}${(m[7] ?? "").padEnd(3, "0")}`;
}

/**
 * DATEV-Format „Buchungsstapel“ als Text: Kopfzeile mit 31 Feldern, Spaltenüberschriften, je Buchung eine Zeile mit
 * 125 Feldern; Zeilenende CRLF. Textfelder stehen in Anführungszeichen, Zahlen nicht. Die Kodierung nach Windows-1252
 * übernimmt `datevExtfBytes`.
 */
export function datevExtf(buchungen: Buchung[], o: DatevExtfOptionen): string {
  const kopf = [
    inAnfz("EXTF"), // 1 Kennzeichen
    "700", // 2 Versionsnummer
    "21", // 3 Datenkategorie: Buchungsstapel
    inAnfz("Buchungsstapel"), // 4 Formatname
    "13", // 5 Formatversion
    erzeugtAmAus(o.erzeugtAm), // 6 Erzeugt am
    "", // 7 Importiert
    inAnfz("RE"), // 8 Herkunft
    inAnfz("Amtlos"), // 9 Exportiert von
    "", // 10 Importiert von
    nurZiffern(o.beraternummer), // 11 Beraternummer
    nurZiffern(o.mandantennummer), // 12 Mandantennummer
    jjjjmmtt(o.wjBeginn), // 13 WJ-Beginn
    String(o.sachkontenlaenge ?? 4), // 14 Sachkontenlänge
    jjjjmmtt(o.von), // 15 Datum vom (JJJJMMTT – fachlich zu prüfen)
    jjjjmmtt(o.bis), // 16 Datum bis
    inAnfz(kuerze(o.bezeichnung ?? "Amtlos Rechnungen und Belege", 30)), // 17 Bezeichnung
    "", // 18 Diktatkürzel
    "1", // 19 Buchungstyp: Finanzbuchführung
    "0", // 20 Rechnungslegungszweck: unabhängig
    "0", // 21 Festschreibung: keine
    inAnfz("EUR"), // 22 Währungskennzeichen
    "", // 23 reserviert
    "", // 24 Derivatskennzeichen
    "", // 25 reserviert
    "", // 26 reserviert
    inAnfz(o.kontenrahmen === "SKR03" ? "03" : "04"), // 27 Sachkontenrahmen
    "", // 28 ID der Branchenlösung
    "", // 29 reserviert
    "", // 30 reserviert
    "", // 31 Anwendungsinformation
  ];
  const zeilen = buchungen.map((b) => {
    const f = new Array<string>(DATEV_SPALTEN.length).fill("");
    f[0] = betragMitKomma(b.betrag_cent);
    f[1] = inAnfz(b.soll_haben);
    f[2] = inAnfz("EUR");
    f[6] = b.konto;
    f[7] = b.gegenkonto;
    f[8] = inAnfzOderLeer(b.bu_schluessel);
    f[9] = ttmm(b.datum);
    f[10] = inAnfzOderLeer(belegfeld1Aus(b.belegfeld1));
    f[11] = inAnfzOderLeer(b.belegfeld2 ? belegfeld1Aus(b.belegfeld2).slice(0, 12) : "");
    f[13] = inAnfz(kuerze(b.buchungstext, 60));
    return f.join(";");
  });
  return [kopf.join(";"), DATEV_SPALTEN.join(";"), ...zeilen].join("\r\n") + "\r\n";
}

/** Zeichen außerhalb von Latin-1, die Windows-1252 in 0x80–0x9F ablegt (Euro, typografische Anführungszeichen, Gedankenstrich …). */
const CP1252_SONDERZEICHEN: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Text nach Windows-1252 (ANSI) kodieren, wie DATEV es erwartet: ASCII und Latin-1 (Ä Ö Ü ä ö ü ß …) unverändert, das
 * Euro-Zeichen als 0x80, typografische Zeichen nach Tabelle, alles andere als „?“.
 */
export function datevExtfBytes(inhalt: string): Uint8Array {
  const aus = new Uint8Array(inhalt.length);
  let n = 0;
  for (const zeichen of inhalt) {
    const cp = zeichen.codePointAt(0)!;
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) aus[n++] = cp;
    else aus[n++] = CP1252_SONDERZEICHEN[cp] ?? 0x3f;
  }
  return aus.slice(0, n);
}

/** Lesbare Buchungsliste mit Semikolon für Menschen und Tabellenprogramme: UTF-8 mit BOM, Zeilenende CRLF. */
export function buchungslisteCsv(buchungen: Buchung[]): string {
  const feld = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const zeilen = buchungen.map((b) =>
    [ttmmjjjj(b.datum), betragMitKomma(b.betrag_cent), b.soll_haben, b.konto, b.gegenkonto, b.bu_schluessel, b.belegfeld1, b.buchungstext, b.ust_satz === null ? "" : String(b.ust_satz)]
      .map(feld)
      .join(";"),
  );
  return "﻿" + ["Datum;Betrag;S/H;Konto;Gegenkonto;BU;Beleg;Text;USt", ...zeilen].join("\r\n") + "\r\n";
}

/** Fachlich unsichere Punkte dieser Datei als Sätze – für die PRUEFLISTE. */
export function pruefpunkteBuchungen(): string[] {
  return [
    "Sachkonten: Forderungen aus L+L (SKR03 1400, SKR04 1200), Verbindlichkeiten aus L+L (1600/3300), Kasse (1000/1600), Privateinlagen (1890/2180) und Erlöskonten 19 % (8400/4400), 7 % (8300/4300), Kleinunternehmer § 19 UStG (8195/4185) gegen den aktuellen DATEV-Kontenrahmen prüfen.",
    "Umsätze mit 0 % ohne Kleinunternehmerregelung landen pauschal auf „Steuerfreie Umsätze“ (SKR03 8100, SKR04 4100); innergemeinschaftliche Lieferungen (§ 4 Nr. 1b UStG) und Leistungen nach § 13b UStG bräuchten eigene Konten (z. B. 8125/4125, 8337/4337) – die Buchung kennt die Steuerart der Rechnung nicht.",
    "Die Kategorie-Konten werden als Automatikkonten behandelt (Bruttobetrag, kein BU-Schlüssel). Für Konten ohne Steuerautomatik (SKR03 z. B. 4930 Bürobedarf, 4600 Werbekosten) wäre stattdessen BU 9 (19 % Vorsteuer) bzw. 8 (7 %) nötig; dort ist BU 40 unzulässig.",
    "BU-Schlüssel 40 („keine Steuer“ bei Automatikkonten) wird gesetzt, wenn ein Beleg keinen Vorsteuerabzug erlaubt und der Satz größer 0 ist – richtig und bei allen verwendeten Konten zulässig?",
    "Stornos werden als einfache Umkehrbuchung (Soll und Haben getauscht) ausgegeben, nicht als Generalumkehr (Feld „Generalumkehr (GU)“ bzw. negativer Umsatz). Folgen für Verkehrszahlen und Umsatzstatistik mit der Steuerberatung klären.",
    "Die Spaltenliste der Buchungszeile (125 Felder, Version 700, Formatversion 13) ist aus dem Gedächtnis nachgebaut; nur die ersten 14 Felder werden gefüllt. Reihenfolge, Anzahl und Bezeichnungen gegen den DATEV-Schnittstellen-Entwicklungsleitfaden prüfen.",
    "Dateikopf: „Datum vom“ und „Datum bis“ stehen als JJJJMMTT (nicht TTMMJJJJ), Feld 27 trägt den Kontenrahmen („03“/„04“), Festschreibung 0, Rechnungslegungszweck 0, Herkunft „RE“ – gegen die Formatbeschreibung prüfen. Berater- und Mandantennummer sind beim Import Pflicht.",
    "Ist-Versteuerung (§ 20 UStG) ändert die Buchungen nicht: gebucht wird Forderung an Erlös zum Rechnungsdatum, die Versteuerungsart steht in den Mandantenstammdaten. Reicht das, oder soll bei Ist-Versteuerung erst mit der Zahlung gebucht werden (Zufluss, § 11 EStG)?",
    "Belegdatum im Format TTMM: das Jahr ergibt sich aus dem Stapelzeitraum. Alle Buchungen eines Stapels müssen in „Datum vom/bis“ und im Wirtschaftsjahr liegen – der Aufrufer muss je Zeitraum (Monat oder Jahr) einen eigenen Stapel erzeugen.",
    "Belege mit Zahlungsweg Bank werden gegen Verbindlichkeiten aus L+L gebucht, die Zahlung selbst nicht (sie kommt aus dem Kontoauszug der Steuerberatung). Bei Einnahmen-Überschuss-Rechnung ist der Zahlungstag maßgeblich – ob stattdessen direkt gegen Bank (SKR03 1200, SKR04 1800) gebucht werden soll, mit der Steuerberatung klären.",
    "Belegfeld 1 wird auf die DATEV-zulässigen Zeichen (Ziffern, Buchstaben, $ & % * + - /) gekürzt, Umlaute werden umschrieben – stimmt die Zeichenliste? Textfelder werden nach Windows-1252 kodiert; andere Zeichen werden „?“.",
  ];
}
