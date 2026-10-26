/** Dokumentvorlagen (E-121): Verzeichnis und Hilfen für Formulare. */
import { betriebsanweisung, elektroPruefung, expositionsverzeichnis, gefaehrdungsbeurteilung, gefahrstoffverzeichnis, unterweisung } from "./arbeitsschutz.js";
import { betriebsanweisungBiostoffe, betriebsanweisungMaschine } from "./betriebsanweisungen.js";
import { formImNamen, gewerbeanmeldung, handelsregister, rechtsformAus, transparenzregister } from "./betrieb.js";
import { aufbewahrung, bilanzGuv, euer, kassenbuch, kassenmeldung, rechnung, steuererklaerung, ustVoranmeldung } from "./buchhaltung.js";
import { arbeitszeitnachweis, lohnkonto, svMeldedaten } from "./lohn.js";
import { auftragsverarbeitung, datenschutzerklaerungWebsite, impressum } from "./website.js";
import { allergenAushang, haccp, hautschutzplan, hygieneplan, ifsgBelehrung } from "./branchen.js";
import { hygieneschulung } from "./schulung.js";
import { anamnese, datenpanne, datenschutzDokumentation, datenschutzinformation, videoHinweis } from "./datenschutz.js";
import { ausweisHinweis, kiKompetenz, nachweisArbeitsbedingungen, schluesselquittung } from "./personal.js";
import { verfahrensdokumentation } from "./steuern.js";
import { oss, zusammenfassendeMeldung } from "./eumeldungen.js";
import { pdfDateiname } from "../dateinamen.js";
import { GESTALT_MARKE, GRUNDLAGE_MARKE, RAENDER, RAENDER_MARKE, SEITE_MARKE, cent, esc, festeLeerzeichen, kennungFassen, seiteCss, zahl } from "./html.js";
import type { Bereich, Betrieb, Daten, EinfachesFeld, Eintrag, Feld, Option, Vorlage, Vorschlag } from "./typen.js";
import { KURZ } from "./ablauf.js";
import { PRUEFHINWEIS } from "./html.js";
import { VORLAGEN_GEPRUEFT, fassungPasst, freigabeBestaetigt, freigabenFuer, geprueftVermerk, kanonisch, sha256, sichtbarerText, type VorlagenFreigabe } from "./geprueft.js";
import { PRUEFSTAENDE } from "./pruefstaende.js";
import { LEERER_BETRIEB } from "./typen.js";
import { EIGENE_GRUPPEN, PRUEF_LAENDER, PRUEF_RECHTSFORMEN, pruefAuspraegungenFuer, pruefstandBerechnen, type Auspraegung, type PruefstandErgebnis } from "./pruefvarianten.js";
export { EIGENE_GRUPPEN, PRUEF_LAENDER, PRUEF_RECHTSFORMEN, PRUEFSUMME_TAG, TEILSUMME_LAENGE, gedruckterText, neutralerBetrieb, pruefAuspraegungen, pruefBetriebe, pruefstandBerechnen, rechtsformBetrieb, type Auspraegung, type PruefstandApi, type PruefsummenApi } from "./pruefvarianten.js";

export * from "./typen.js";
export { ALLERGENE, GETREIDEARTEN, NUSSARTEN, WARNFARBSTOFFE, WEIZENARTEN_FUSSNOTE, ZUSATZSTOFFE, ZUSATZSTOFFE_QUELLE, DATENPANNE_RISIKO, GEFAEHRDUNGSFAKTOREN, HANDLUNGSBEDARF, RISIKO_MATRIX, RISIKO_STUFEN, SCHUTZZIELE, SCHWERE, SONSTIGE_UNTERPUNKTE, WAHRSCHEINLICHKEIT, risikoAus } from "./konstanten.js";
// E-167 (Sifa-Durchsicht Arbeitsschutz)
export { ELEKTRO_GRENZWERTE, EXPO_HINWEIS, GHS, PRUEF_VORSCHLAEGE, RISIKO_SKALA, UNTERSCHRIFT_FEHLT, UNTERSCHRIFT_TEXT, UNTERSCHRIFT_THEMEN, mitUnterschriftPflicht, naechstePruefung, risikoEintrag } from "./arbeitsschutz.js";
export { HAUTSCHUTZ_WEITERE } from "./branchen.js";
export { SIFA_PRUEFUNG, type SifaEintrag } from "./sifa.js";
export { HAUSFARBEN, PRUEFHINWEIS, RAENDER, akzent, fussSpalten, type Gestalt } from "./html.js";
export { BUNDESLAENDER, aufsichtFuer, berlinZuUtc } from "./datenschutz.js";
export { NACHWG_AUSSCHLUSSFRIST_BEISPIEL, NACHWG_AUSSCHLUSSFRIST_UEBERSTUNDEN, NACHWG_SCHRIFTFORM_HINWEIS, NACHWG_SCHRIFTFORM_PDF, mindestlohnAm, mindesturlaub, minijobGrenzeAm, stundenlohn } from "./personal.js";
export { HYGIENE_LEBENSMITTEL, HYGIENE_LM_GRUPPEN, HYGIENE_THEMEN_LEBENSMITTEL, HYGIENE_THEMEN_NEU, HYGIENE_VERWEIS_HACCP } from "./branchen.js";
// Prüfbericht Lebensmittelhygiene (22.10.2026): Allergenliste mit Arten und Zusatzstoffen, IfSG-Ergänzungen, Schulungsnachweis § 4 LMHV
export { ALLERGENE_HILFE, IFSG_HAUSHALT, IFSG_WER, ohneLatein } from "./branchen.js";
export { SCHULUNG_HILFE, SCHULUNG_THEMEN } from "./schulung.js";
// E-166: HACCP-Kern (Gefahrenanalyse, CCP, Verifizierung) und Hygieneplan-Zeilen für Bäckerei und Foodtruck
export { AUFZEICHNUNGEN, CCP_BEGRUENDUNG, CCP_EINSTUFUNG, CCP_FRAGEN, CCP_FRAGEN_QUELLE, CCP_HINWEIS, CCP_VORSCHLAEGE, GEFAHRENANALYSE, GEFAHR_ARTEN, GHP_HINWEIS, GHP_KURZ, GRENZWERT_HACCP, GRENZWERT_HILFE, HACCP_AUFBEWAHRUNG, HACCP_AUFBEWAHRUNG_QUELLE, HACCP_FLEXIBEL, HACCP_RUECKRUF, HACCP_VEREINFACHT, HYGIENE_BAECKEREI, HYGIENE_FOODTRUCK, PROZESSSCHRITTE, VERIFIZIERUNG } from "./haccp.js";
export { bausteinText } from "./website.js";
export { EUER_KAPITALGESELLSCHAFT, GUTSCHRIFT_AUSWAHL, RECHNUNG_NEGATIV, RECHNUNG_NULL, RECHNUNG_PLZ_FEHLT, VERSTEUERUNG, VORSTEUER_AUFTEILEN, aufbewahrenBis, eRechnungAus, faelligAm, kennzahlBefreiung, leistungszeitraumAus, rechnungsTitel } from "./buchhaltung.js";
// R10 Steuer
export { NULLSATZ_HINWEIS, RECHNUNG_13B_TEXT, RECHNUNG_EU_19, RECHNUNG_GUTSCHRIFT_STEUER, RECHNUNG_KU_DRITTLAND, RECHNUNG_KU_EU, RECHNUNG_KU_IGL, RECHNUNG_KU_PROFIL, RECHNUNG_KU_RC, RECHNUNG_LEITWEG, UST_FRIST, UST_FRIST_DFV, drittlandLand, euUnternehmenLand, istNullsatzText, istOeffentlicherEmpfaenger, kuFuer } from "./buchhaltung.js";
export { RECHNUNG_SKONTO_FALSCH, RECHNUNG_SKONTO_FRIST, RECHNUNG_SKONTO_HOCH, skontoFuer } from "./buchhaltung.js";
// R12 UX
export { GMBH_ANGABEN, KG_ANGABEN, KG_REGISTERGERICHT, KG_REGISTERNUMMER, komplementaerAngabenFehlen, STORNO_ABSCHLAEGE, RECHNUNG_KU_GUTSCHEIN, RECHNUNG_MONAT_ZEITRAUM, gmbhAngabenFehlen, istPrivatperson, kleinbetrag, standardAnrede } from "./buchhaltung.js";
export { istCoKg, komplementaerZeile, vertretungLabel } from "./html.js";
export { REGISTER_FORMEN, istKapitalgesellschaft, mitVertretung, rechtsformAus, registerAus } from "./betrieb.js";
export { RECHTSFORMEN } from "./bausteine.js";
export { BESCHAEFTIGUNGSARTEN, ENTGELT_ARTEN, STEUERKLASSEN, arbeitsminuten, arbeitszeitPruefung, monatAus, monatSchluessel, stunden } from "./lohn.js";
export { ANLAESSE, KURZ, PERSONEN_FELDER, kurztitel, kurztitelListe, naechsteNummer, personAus, personIn, personMerken, type Anlass } from "./ablauf.js";
export { cent, euroPreis, fassungText, preisCent, zahl } from "./html.js";
export { PRUEF_ROLLEN, VORLAGEN_GEPRUEFT, freigabeBestaetigt, freigabenFuer, geprueftVermerk, sha256, type PruefRolle, type VorlagenFreigabe, type VorlagenNachweis } from "./geprueft.js";
export { PRUEFSTAENDE } from "./pruefstaende.js";
// StB-Prüfung Steuerberatungskanzlei (21.10.2026): Rechnungen, Voranmeldung, OSS und ZM
export { GUTSCHRIFT_PRAEFIX, KUNDEN_ARTEN, NULLSATZ_HINWEIS as NULLSATZ_TEXT, RECHNUNG_EINHEIT_CODE, RECHNUNG_GUTSCHRIFT_NUMMER, RECHNUNG_LEITWEG_FEHLT, RECHNUNG_LEITWEG_FORMAT, RECHNUNG_NULLSATZ_GEMISCHT, RECHNUNG_OSS_LAND, RECHNUNG_OSS_SATZ, RECHNUNG_OSS_VORSCHLAG, RECHNUNG_SCHLUSS_HOCH, RECHNUNG_SCHLUSS_LEER, RECHNUNG_SCHLUSS_SATZ, SATZ_NULLSATZ, abschlaegeAus, euPrivatLand, istGutschriftNummer, leitwegFormatOk, mitGrundstueckHinweis, ossSatz, satzZahl, vollEuro } from "./buchhaltung.js";
export { EU_LAENDER_NAMEN, OSS_FRIST, OSS_NICHT_VA, ZM_ARTEN, ZM_FRIST, ZM_SKONTO, landName } from "./eumeldungen.js";
// Nachprüfung der Vorlagen 23.10.2026 (Steuerberater, Sifa, Rechtsanwalt)
export { OSS_KORREKTUR, OSS_LIEFERSCHWELLE, ZM_ZEITRAUM } from "./eumeldungen.js";
export { BILANZ_ANHANG, BILANZ_FORM, BILANZ_OHNE_ANHANG, BILANZ_UNTERSCHRIFT, BILANZ_UNTERSCHRIFT_GMBH_CO_KG, KASSENBUCH_BESTAND_NEGATIV, KASSENBUCH_ELEKTRONISCH, KASSENBUCH_NEGATIV, KASSENBUCH_REGELN, UST_OHNE_IGE } from "./buchhaltung.js";
export { SV_GESCHLECHT_HILFE } from "./lohn.js";
export { BIO_SCHUTZSTUFE_BLUT } from "./betriebsanweisungen.js";
export { hautschutzFriseur } from "./branchen.js";
export { HR_ALLE_MELDEN, HR_HAFTEINLAGE } from "./betrieb.js";

export const BEREICHE: { id: Bereich; titel: string }[] = [
  { id: "steuern", titel: "Steuern und Buchhaltung" },
  { id: "datenschutz", titel: "Datenschutz" },
  { id: "personal", titel: "Personal" },
  { id: "arbeitsschutz", titel: "Arbeitsschutz" },
  { id: "betrieb", titel: "Betrieb, Register und Website" },
  { id: "gastro", titel: "Gastronomie und Lebensmittel" },
  { id: "beauty", titel: "Beauty und Kosmetik" },
];

export const VORLAGEN: Vorlage[] = [
  // Steuern und Buchhaltung
  rechnung,
  euer,
  bilanzGuv,
  ustVoranmeldung,
  oss,
  zusammenfassendeMeldung,
  steuererklaerung,
  verfahrensdokumentation,
  kassenbuch,
  kassenmeldung,
  aufbewahrung,
  // Datenschutz
  datenschutzDokumentation,
  datenschutzerklaerungWebsite,
  auftragsverarbeitung,
  datenschutzinformation,
  datenpanne,
  videoHinweis,
  // Personal
  arbeitszeitnachweis,
  nachweisArbeitsbedingungen,
  svMeldedaten,
  lohnkonto,
  kiKompetenz,
  ausweisHinweis,
  schluesselquittung,
  // Arbeitsschutz
  gefaehrdungsbeurteilung,
  unterweisung,
  gefahrstoffverzeichnis,
  betriebsanweisung,
  // E-167 (Sifa-Durchsicht): Betriebsanweisungen für Maschinen und Biostoffe, Expositionsverzeichnis
  betriebsanweisungMaschine,
  betriebsanweisungBiostoffe,
  expositionsverzeichnis,
  elektroPruefung,
  // Betrieb, Register, Website
  impressum,
  gewerbeanmeldung,
  handelsregister,
  transparenzregister,
  // Branchen
  ifsgBelehrung,
  allergenAushang,
  haccp,
  hautschutzplan,
  hygieneplan,
  // Prüfbericht Lebensmittelhygiene (22.10.2026, Frage 12): Schulungsnachweis nach § 4 LMHV
  hygieneschulung,
  anamnese,
];

export function vorlageFuer(id: string): Vorlage | undefined {
  return VORLAGEN.find((v) => v.id === id);
}

/**
 * E-202: Vorschläge einer Liste, die zu den Angaben der Unterlage passen (`Vorlage.vorschlagPasst`) – z. B. beim
 * Hygieneplan in der Fassung Friseur/Kosmetik keine Zeilen eines Lebensmittelbetriebs. Ohne Regel alle.
 */
export function passendeVorschlaege(v: Vorlage | undefined, feld: { id: string; vorschlaege?: Vorschlag[] }, d: Daten): Vorschlag[] {
  const alle = feld.vorschlaege ?? [];
  return v?.vorschlagPasst ? alle.filter((x) => v.vorschlagPasst!(feld.id, x, d)) : alle;
}

/**
 * Branchengruppen der Bausteine (R10) je Branche aus dem Pflichten-Check („taetigkeit.branchen“). Ohne passende
 * Branche (z. B. Transport, Gesundheit, Andere) filtert die App nicht.
 */
export const BRANCHEN_GRUPPEN: Record<string, string[]> = {
  gastronomie_lebensmittel: ["gastro_cafe"],
  beauty_kosmetik: ["friseur", "kosmetik"],
  handwerk: ["handwerk_allgemein"],
  bau: ["handwerk_allgemein"],
  onlinehandel: ["buero_laden"],
  it_agentur_freelancer: ["buero_laden"],
  immobilien_finanzen: ["buero_laden"],
  // R11 (Reinigung): eigene Gruppe für Bausteine und Vorbelegungen der Gebäudereinigung
  gebaeudereinigung: ["gebaeudereinigung"],
  // R12 (Coach #5): Unterricht, Kurse, Sport und Coaching – eigene Gruppe (Anamnese für Kurse, Einheit „Termin“)
  unterricht_sport_coaching: ["unterricht"],
};

/** Branchengruppen eines Betriebs aus den Branchen im Pflichten-Check. */
export function gruppenAusBranchen(branchen: unknown): string[] {
  return Array.isArray(branchen) ? [...new Set(branchen.flatMap((b) => BRANCHEN_GRUPPEN[String(b)] ?? []))] : [];
}

/**
 * R12: Branchengruppen samt Gruppen, die der Check nicht unterscheidet – Transport (eigene Themen für Fahrzeugführer),
 * Kfz-Werkstatt und Bäckerei (am Namen des Betriebs bzw. Handwerk mit Lebensmitteln). Für die Bausteine der App.
 */
export function gruppenFuerBetrieb(branchen: unknown, betriebName = ""): string[] {
  const l = Array.isArray(branchen) ? branchen.map(String) : [];
  const g = gruppenAusBranchen(l);
  if (l.includes("transport_logistik")) g.push("transport");
  if (/\b(kfz|auto|autohaus|werkstatt|reifen|karosserie|fahrzeug)/i.test(betriebName)) g.push("kfz_werkstatt");
  if ((l.includes("handwerk") && l.includes("gastronomie_lebensmittel")) || /bäcker|backstube|konditor/i.test(betriebName)) g.push("baeckerei");
  // E-166: Praxen (Gesundheit und Pflege) – eigene Themen der Unterweisung (Biostoffe, Nadelstich, Desinfektionsmittel)
  if (l.includes("gesundheit_pflege")) g.push("praxis");
  return [...new Set(g)];
}

/**
 * E-166: Foodtruck bzw. mobiler Verkauf von Lebensmitteln – Lebensmittelbranche mit Reisegewerbe oder Marktstand laut
 * Pflichten-Check (wie die Pflicht `branche.gastro_trinkwasser_mobil`) oder am Namen des Betriebs erkennbar.
 */
export function mobilerVerkauf(profil: Record<string, unknown>, betriebName = ""): boolean {
  const liste = (k: string) => (Array.isArray(profil[k]) ? (profil[k] as unknown[]).map(String) : []);
  if (!liste("taetigkeit.branchen").includes("gastronomie_lebensmittel")) return false;
  return liste("vertrieb.kanaele").includes("marktstand") || liste("erlaubnis.gewo_paragraphen").includes("55") || /food\s?truck|imbisswagen|verkaufswagen|street\s?food/i.test(betriebName);
}

/** Passt ein Baustein mit diesen Gruppen zum Betrieb? Ohne Gruppen am Baustein oder ohne bekannte Branche: ja. */
export function passtZuGruppen(baustein: string[] | undefined, meine: readonly string[]): boolean {
  return !baustein?.length || !meine.length || baustein.includes("alle") || baustein.some((g) => meine.includes(g));
}

/** Platzhalter „…“ in einem Vorschlag (z. B. „Guten Tag …“): wer ihn wählt, ergänzt den Namen. */
export const PLATZHALTER = "…";
/** Steht in einem Textfeld noch ein Platzhalter aus einem Vorschlag (z. B. „Sehr geehrte Frau …“)? */
export function platzhalterOffen(f: Feld, w: unknown): boolean {
  return (f.art === "text" || f.art === "mehrzeilig") && Boolean(f.vorschlaege?.some((x) => x.includes(PLATZHALTER))) && typeof w === "string" && w.includes(PLATZHALTER);
}
/** Bezeichnung für „Fehlt noch“, z. B. „Anrede: Name statt „…“ eintragen“. */
export const platzhalterText = (f: Feld) => `${f.label}: Name statt „${PLATZHALTER}“ eintragen`;
/** „Fehlt noch“, wenn der Betrieb keinen Namen hat (R10): Ohne ihn bleibt der Kopf jedes PDFs leer. */
export const BETRIEBSNAME_FEHLT = "Name des Betriebs (Mein Betrieb)";

/** Ist ein Feld angesichts der übrigen Eingaben sichtbar? */
export function sichtbar(f: Feld, d: Daten | Eintrag): boolean {
  if (!f.wenn) return true;
  const w = d[f.wenn.feld];
  const werte = f.wenn.ist === undefined ? undefined : Array.isArray(f.wenn.ist) ? f.wenn.ist : [f.wenn.ist];
  const erfuellt =
    werte !== undefined ? werte.some((ist) => (Array.isArray(w) ? (w as unknown[]).includes(ist) : w === ist)) : w === true || (typeof w === "string" && w !== "") || (Array.isArray(w) && w.length > 0);
  return f.wenn.nicht ? !erfuellt : erfuellt;
}

/**
 * Eingaben einer Feldliste (Schritt oder Listeneintrag) ohne verdeckte Felder – mit Kaskade: Hängt ein Feld an einem
 * verdeckten Feld, ist es selbst verdeckt. Formular, Papieransicht, Prüfung und Dokument sehen so dasselbe.
 */
export function ohneVerdeckteFelder<T extends Daten | Eintrag>(felder: Feld[], d: T): T {
  const r = { ...d } as Record<string, unknown>;
  for (const f of felder) if (!sichtbar(f, r as T)) delete r[f.id];
  return r as T;
}

function startwert(f: EinfachesFeld, b: Betrieb, heute: string, gruppen?: readonly string[]): string | boolean | string[] | null {
  switch (f.art) {
    case "text":
    case "mehrzeilig":
      // Vorbelegung nur für bestimmte Branchen (z. B. Inhaber als prüfende Elektrofachkraft im Handwerk)
      if (f.vorbelegungGruppen && !f.vorbelegungGruppen.some((g) => gruppen?.includes(g))) return "";
      {
        // R12: Startwert je Branche (z. B. Einheit „Pauschale“ im Salon)
        const je = f.vorbelegungJe ? gruppen?.map((g) => f.vorbelegungJe![g]).find((w) => w !== undefined) : undefined;
        if (je !== undefined) return je;
      }
      if (typeof f.vorbelegung === "object") return f.vorbelegung.text;
      return f.vorbelegung === "verantwortlich" ? b.verantwortlich : f.vorbelegung === "betrieb_kontakt" ? [b.verantwortlich, b.telefon, b.email].filter((x) => x.trim()).join(", ") : "";
    case "datum":
      return f.vorbelegung === "heute" ? heute : null;
    case "uhrzeit":
      return "";
    case "betrag":
    case "zahl":
      return f.vorbelegung ?? "";
    case "wahl": {
      const je = f.vorbelegungJe ? gruppen?.map((g) => f.vorbelegungJe![g]).find((w) => w !== undefined) : undefined;
      return je ?? f.vorbelegung ?? null;
    }
    case "schalter": {
      const je = f.vorbelegungJe ? gruppen?.map((g) => f.vorbelegungJe![g]).find((w) => w !== undefined) : undefined;
      return je ?? f.vorbelegung ?? false;
    }
    case "mehrfach":
      return [];
    case "bausteine":
      return f.vorbelegung ? [...f.vorbelegung] : [];
  }
}

/**
 * Neuer Listeneintrag mit Startwerten. `gruppen`: Branchengruppen (Startwerte je Branche); `vorher`: der bisher letzte
 * Eintrag – Felder mit `wieVorher` übernehmen dessen Wert (R12: Steuersatz der letzten Position).
 */
export function neuerEintrag(f: Extract<Feld, { art: "liste" }>, b: Betrieb, heute: string, gruppen?: readonly string[], vorher?: Eintrag): Eintrag {
  return Object.fromEntries(
    f.felder.map((x) => {
      const alt = x.wieVorher && vorher ? vorher[x.id] : undefined;
      return [x.id, alt !== undefined && alt !== null && alt !== "" ? alt : startwert(x, b, heute, gruppen)];
    }),
  );
}

/** R12: Ist ein Baustein angesichts der Eingaben sichtbar (`Option.wenn`, eine Bedingung genügt)? Gewählte zeigt die App immer. */
export function optionSichtbar(o: Option, d: Daten | Eintrag): boolean {
  if (!o.wenn) return true;
  const liste = Array.isArray(o.wenn) ? o.wenn : [o.wenn];
  return liste.some((w) => sichtbar({ id: "", label: "", art: "schalter", wenn: w }, d));
}

/** R12: Startwerte einer neuen Unterlage aus dem Pflichten-Check (`profilStart`), leer, wenn die Vorlage keine kennt. */
export function profilStartwerte(v: Vorlage, profil: Record<string, unknown>, betrieb?: Betrieb): Daten {
  return v.profilStart?.(profil, betrieb) ?? {};
}

/**
 * Startwerte einer neuen Unterlage, mit Angaben aus „Mein Betrieb“ und dem heutigen Datum. Listen beginnen mit einem
 * Eintrag. `gruppen`: Branchengruppen des Betriebs (für Vorbelegungen, die nur in bestimmten Branchen passen).
 */
export function leereDaten(v: Vorlage, b: Betrieb, heute: string, gruppen?: readonly string[]): Daten {
  const d: Daten = {};
  for (const a of v.abschnitte)
    for (const f of a.felder) d[f.id] = f.art === "liste" ? (f.start ? f.start.map((e) => ({ ...neuerEintrag(f, b, heute, gruppen), ...e })) : f.leerStarten ? [] : [neuerEintrag(f, b, heute, gruppen)]) : startwert(f, b, heute, gruppen);
  return d;
}

const gefuellt = (w: unknown) => (typeof w === "string" ? w.trim() !== "" : Array.isArray(w) ? w.length > 0 : w !== null && w !== undefined);

/** Hat der Nutzer in einem Listeneintrag etwas eingetragen? Vorbelegte Felder (Datum, Auswahl, Menge …) zählen nicht. */
function benutzt(f: Extract<Feld, { art: "liste" }>, e: Eintrag): boolean {
  return f.felder.some((x) => (x.art === "text" || x.art === "mehrzeilig" || x.art === "betrag" || x.art === "zahl" || x.art === "uhrzeit" || x.art === "mehrfach" || x.art === "bausteine") && !("vorbelegung" in x && x.vorbelegung) && gefuellt(e[x.id]));
}

/** Betrag oder Zahl eingetragen, aber nicht lesbar („45 Euro“, „1,234.56“) – im Dokument stünde sonst 0,00 €. */
export function unlesbar(f: Feld, w: unknown): boolean {
  if (f.art !== "betrag" && f.art !== "zahl") return false;
  return typeof w === "string" && w.trim() !== "" && (f.art === "betrag" ? cent(w) : zahl(w)) === null;
}
/** Bezeichnung für „Fehlt noch“, z. B. „Preis nicht lesbar (z. B. 45,00)“. */
export function unlesbarText(f: Feld): string {
  if (f.id === "preis") return "Preis nicht lesbar (z. B. 45,00)";
  const name = f.label.replace(/\s*\(€\)\s*$/, "");
  return f.art === "zahl" ? `${name} nicht lesbar (z. B. 1,5)` : `${name} nicht lesbar (z. B. 12,50)`;
}

/** Fehlende Pflichtangaben als lesbare Bezeichnungen („Gefährdung 2: Maßnahme“). Hindert das Erstellen nicht. */
export function fehlendeAngaben(v: Vorlage, d: Daten, b?: Betrieb): string[] {
  const fehlt: string[] = [];
  const sichtbar_ = ohneVerdeckte(v, d);
  const frei = new Set(v.nichtPflicht?.(d) ?? []);
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (!sichtbar(f, sichtbar_)) continue;
      if (f.art === "liste") {
        const eintraege = (Array.isArray(d[f.id]) ? d[f.id] : []) as Eintrag[];
        const genutzt = eintraege.filter((e) => benutzt(f, e));
        // R11 (UX #15): ohne zweiten Doppelpunkt hinter „Fehlt:“
        if (f.pflicht && !frei.has(f.id) && !genutzt.length) fehlt.push(`mindestens ein Eintrag „${f.eintrag}“`);
        genutzt.forEach((e, i) => {
          const vor = `${f.eintrag}${genutzt.length > 1 ? ` ${i + 1}` : ""}: `;
          for (const x of f.felder) {
            if (!sichtbar(x, ohneVerdeckteFelder(f.felder, e))) continue;
            if (x.pflicht && !gefuellt(e[x.id])) fehlt.push(`${vor}${x.label}`);
            else if (unlesbar(x, e[x.id])) fehlt.push(`${vor}${unlesbarText(x)}`);
            else if (platzhalterOffen(x, e[x.id])) fehlt.push(`${vor}${platzhalterText(x)}`);
          }
        });
      } else if (f.pflicht && !frei.has(f.id) && !gefuellt(d[f.id])) fehlt.push(f.label);
      else if (unlesbar(f, d[f.id])) fehlt.push(unlesbarText(f));
      // „Guten Tag …“ (R10): ein nicht ersetzter Platzhalter stünde wörtlich auf dem PDF
      else if (platzhalterOffen(f, d[f.id])) fehlt.push(platzhalterText(f));
    }
  if (b && v.pruefen) fehlt.push(...v.pruefen(d, b));
  // ohne Namen des Betriebs bleibt der Kopf leer (R10) – eine Kontrolle kann das Blatt keinem Betrieb zuordnen. Prüfungen
  // der Vorlage, die den Namen schon nennen („Name und Anschrift …“), reichen.
  if (b && !b.name.trim() && !fehlt.some((x) => /^Name\b.*\(Mein Betrieb\)/.test(x))) fehlt.push(BETRIEBSNAME_FEHLT);
  return fehlt;
}

/** Text auf höchstens `max` Zeichen, am Wortende gekürzt mit „…“ (ein einzelnes zu langes Wort hart). */
function kuerzen(t: string, max: number): string {
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max);
  const leer = schnitt.lastIndexOf(" ");
  return `${(leer >= max / 2 ? schnitt.slice(0, leer) : schnitt).replace(/[\s,;:–-]+$/, "")}…`;
}

/** Name einer Unterlage in der Übersicht, z. B. „Gefährdungsbeurteilung · Küche“. */
export function unterlagenName(v: Vorlage, d: Daten): string {
  const roh = v.namensFeld && typeof d[v.namensFeld] === "string" ? (d[v.namensFeld] as string).trim().split("\n")[0]! : "";
  // Datum deutsch (TT.MM.JJJJ); lange Namen am Wortende kürzen („…“) statt mitten im Wort
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(roh);
  const zusatz = iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : kuerzen(roh, 40);
  const titel = v.titelFuer?.(d) ?? v.titel;
  return zusatz ? `${titel} · ${zusatz}` : titel;
}

/** Dateiname für das PDF – siehe `pdfDateiname` (Umlaute umgeschrieben, Datum genau einmal und nie gekürzt). */
export const dateiname = (v: Vorlage, d: Daten, datum: string): string => pdfDateiname(v, d, datum);

/** Vorschlag als Listeneintrag mit Startwerten für alle Felder. */
export function eintragAusVorschlag(f: Extract<Feld, { art: "liste" }>, vorschlag: Vorschlag, b: Betrieb, heute: string): Eintrag {
  return { ...neuerEintrag(f, b, heute), ...vorschlag.werte };
}

/**
 * Eingaben ohne verdeckte Felder: Was die App gerade nicht zeigt (Bedingung `wenn` nicht erfüllt), gehört nicht ins
 * Dokument – auch wenn noch ein früher eingegebener Wert gespeichert ist. In Listen gilt das je Eintrag; Felder, die an
 * einem verdeckten Feld hängen, entfallen mit. Nur für die Ausgabe; gespeicherte Daten und die Prüfung bleiben unverändert.
 */
export function ohneVerdeckte(v: Vorlage, d: Daten): Daten {
  const r: Daten = { ...d };
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      // gegen die bereits bereinigten Angaben prüfen: hängt ein Feld an einem verdeckten Feld, ist es selbst verdeckt
      if (!sichtbar(f, r)) {
        delete r[f.id];
        continue;
      }
      if (f.art === "liste" && Array.isArray(d[f.id]) && f.felder.some((x) => x.wenn))
        r[f.id] = (d[f.id] as Eintrag[]).map((e) => {
          if (!e || typeof e !== "object") return e;
          const n: Eintrag = { ...e };
          for (const x of f.felder) if (!sichtbar(x, n)) delete n[x.id];
          return n;
        });
    }
  return r;
}

/** Das fertige Dokument: Vorlage + Rechtsgrundlage und Bereich im Kopf. Die App erstellt das PDF hieraus. */
export function dokumentHtml(v: Vorlage, d: Daten, b: Betrieb): string {
  // Kundendokumente und Aushänge für Gäste: ohne Rechtsgrundlage und Bereich – das ist für die eigenen Unterlagen
  const fuerAndere = v.kundendokument || v.ohneKopfangaben;
  const rg = v.grundlageFuer?.(d, b) || v.grundlage;
  const grundlage = rg && !fuerAndere ? `<div><dt>Rechtsgrundlage</dt><dd>${festeLeerzeichen(esc(rg))}</dd></div>` : "";
  // Aushänge: ohne Bereich der App (z. B. „Beauty und Kosmetik“ auf dem Hygieneplan eines Cafés) – er sagt dem Leser
  // an der Wand nichts und passt nicht immer zur Branche
  const art = fuerAndere || v.gestalt === "aushang" ? "" : (BEREICHE.find((x) => x.id === v.bereich)?.titel ?? "");
  return kennungFassen(v.html(ohneVerdeckte(v, d), b).replace(GRUNDLAGE_MARKE, grundlage)).replace('<div class="art"></div>', `<div class="art">${esc(art)}</div>`).split(GESTALT_MARKE).join(v.gestalt ?? "nachweis").replace(SEITE_MARKE, seiteCss(v.gestalt ?? "nachweis", v.querformat))
    .replace(RAENDER_MARKE, RAENDER[v.gestalt ?? "nachweis"].join(","));
}

/** Merkliste je Vorlage und Freigabe (Objekt aus VORLAGEN_GEPRUEFT) – eigene Freigaben (Tests, Werkzeuge) rechnen neu */
const pruefstaende = new WeakMap<Vorlage, Map<object, Pruefstand>>();
/** Markierung offener Prüfpunkte im gedruckten Text einer Vorlage (Bausteine mit Prüfstand „offen“) */
export const OFFEN_MARKE = "fachlich zu prüfen";

/** SHA-256 über alle Teilsummen, Teilsumme je Variantengruppe und Zahl der Stellen mit „fachlich zu prüfen“ (pruefvarianten.ts) */
export type Pruefstand = PruefstandErgebnis;

/**
 * Prüfsumme der Bausteine und Texte einer Vorlage (Nachkontrolle Lebensmittelfachbeauftragter, 23.10.2026; E-196):
 * SHA-256 über
 *   1. die Formularbeschreibung als JSON mit sortierten Schlüsseln (Titel, Beschreibung, Rechtsgrundlage, alle Abschnitte
 *      mit Hilfetexten, Feldern, Auswahllisten, Textbausteinen und Vorschlägen; Funktionen entfallen),
 *   2. den Kurztext der Vorlage in der App (KURZ),
 *   3. den gedruckten Text (sichtbarer Text samt Fußzeile und Kopfangaben) jeder Ausprägung aus `pruefAuspraegungen`
 *      (pruefvarianten.ts): Startwerte und alles ausgewählt ohne Betrieb und für Beispielbetriebe je Rechtsform, jede
 *      einzelne Auswahl, Listen mit Beispieleinträgen, verdeckte Angaben wie Storno – Stichtag 1.1.2026.
 * Bei einer Freigabe nur für eine Fassung (`fassung`) wird mit dieser Fassung gerechnet, bei `gruppen` zählen nur
 * Vorschläge dieser Gruppen, bei `rechtsformen` nur Beispielbetriebe dieser Rechtsformen. Ohne Angabe: die erste Freigabe
 * der Vorlage (bei mehreren Freigaben die übrigen mit `vorlagenPruefsumme(v, f)`).
 */
export function vorlagenPruefstand(v: Vorlage, freigabe: Pick<VorlagenFreigabe, "fassung" | "gruppen" | "rechtsformen"> | undefined = VORLAGEN_GEPRUEFT[v.id]): Pruefstand {
  const merken = freigabe !== undefined && freigabenFuer(v.id).includes(freigabe as VorlagenFreigabe);
  const gemerkt = merken ? pruefstaende.get(v)?.get(freigabe) : undefined;
  if (gemerkt) return gemerkt;
  const stand: Pruefstand = pruefstandBerechnen(v, freigabe, { dokumentHtml, leereDaten, eintragAusVorschlag, leererBetrieb: LEERER_BETRIEB, kurz: KURZ, kanonisch, sha256, sichtbarerText });
  if (merken) {
    if (!pruefstaende.has(v)) pruefstaende.set(v, new Map());
    pruefstaende.get(v)!.set(freigabe, stand);
  }
  return stand;
}

/** Alle Ausprägungen (Daten, Betrieb, Variantengruppe), über die `vorlagenPruefstand` rechnet – z. B. für Beispiel-PDFs zur Nachprüfung. */
export function vorlagenAuspraegungen(v: Vorlage, freigabe: Pick<VorlagenFreigabe, "fassung" | "gruppen" | "rechtsformen"> | undefined = VORLAGEN_GEPRUEFT[v.id]): Auspraegung[] {
  return pruefAuspraegungenFuer(v, freigabe, { dokumentHtml, leereDaten, eintragAusVorschlag, leererBetrieb: LEERER_BETRIEB });
}

/** Prüfsumme einer Vorlage (siehe `vorlagenPruefstand`). */
export function vorlagenPruefsumme(v: Vorlage, freigabe: Pick<VorlagenFreigabe, "fassung" | "gruppen" | "rechtsformen"> | undefined = VORLAGEN_GEPRUEFT[v.id]): string {
  return vorlagenPruefstand(v, freigabe).summe;
}

/**
 * Freigabe einer Vorlage, solange ihr Inhalt dem freigegebenen Stand entspricht (Prüfsumme) und – bei einer Freigabe
 * nur für eine Fassung – die Unterlage diese Fassung hat. Bei mehreren Freigaben (`weitere`) die erste, deren Fassung
 * zu den Daten passt und deren Prüfsumme stimmt. Sonst `undefined`. E-201: Eine ausgesetzte Freigabe (`vermerk_ausgesetzt`) zählt nicht.
 */
export function vorlageGeprueft(v: Vorlage, d?: Daten, liste: Readonly<Record<string, VorlagenFreigabe>> = VORLAGEN_GEPRUEFT, betrieb?: Betrieb): Omit<VorlagenFreigabe, "weitere"> | undefined {
  return freigabenFuer(v.id, liste).find((f) => f.pruefsumme && freigabeBestaetigt(f) && !f.vermerk_ausgesetzt && fassungPasst(f, d) && rechtsformPasst(f, d, betrieb) && variantenPassen(v, f, liste, d, betrieb));
}

/**
 * E-196: Passen die Teilsummen der Varianten, die diese Unterlage braucht (`pruefGruppenFuer`), zur Freigabe? Ohne
 * gespeicherte Teilsummen (eigene Freigaben in Tests und Werkzeugen) muss die ganze Prüfsumme passen.
 */
function variantenPassen(v: Vorlage, f: Omit<VorlagenFreigabe, "weitere">, liste: Readonly<Record<string, VorlagenFreigabe>>, d?: Daten, betrieb?: Betrieb): boolean {
  const heute = aktuellerPruefstand(v, f, liste);
  if (!f.teilsummen) return heute.summe === f.pruefsumme;
  return pruefGruppenFuer(v, f.teilsummen, d, betrieb).every((g) => Boolean(f.teilsummen![g]) && heute.teile[g] === f.teilsummen![g]);
}

/**
 * E-196: Variantengruppen (pruefvarianten.ts), die eine Unterlage braucht: immer `basis`; die Rechtsform aus „Mein Betrieb“
 * (ohne Angabe aus dem Namen, sonst Einzelunternehmen – ohne Rechtsformzusatz im Namen ist der Betrieb nicht eingetragen);
 * das Land; `ku` bei Kleinunternehmern mit Wechseldatum; bei der Rechnung die Gruppe der Rechnungsart (Schlussrechnung,
 * Storno, Storno einer Schlussrechnung mit Abschlägen). Ohne Betrieb (allgemeine Ansicht ohne Angaben) alle Gruppen der
 * Freigabe – der Vermerk erscheint dann nur, wenn keine Variante geändert ist.
 */
export function pruefGruppenFuer(v: Vorlage, freigegeben: Readonly<Record<string, string>>, d?: Daten, betrieb?: Betrieb): string[] {
  const gesetzt = (x: unknown) => x === true || (typeof x === "string" && x.trim() !== "");
  const eigene = (EIGENE_GRUPPEN[v.id] ?? [])
    .filter((x) => (x.verdeckt && Object.keys(x.verdeckt).every((k) => gesetzt(d?.[k]))) || (x.auswahl && Object.entries(x.auswahl).every(([k, w]) => d?.[k] === w)))
    .sort((a, b) => Object.keys(b.verdeckt ?? {}).length - Object.keys(a.verdeckt ?? {}).length)[0];
  // E-200: ohne Betrieb alle Gruppen der Freigabe außer den Rechnungsarten – und die Rechnungsart dieser Daten (z. B. Storno
  // einer Schlussrechnung), damit sie auch ohne Betrieb nicht ungeprüft durchrutscht
  if (!betrieb) return [...Object.keys(freigegeben).filter((g) => !EIGENE_GRUPPEN[v.id]?.some((x) => x.gruppe === g)), ...(eigene ? [eigene.gruppe] : [])];
  const g = ["basis"];
  const name = betrieb.name ?? "";
  const ugCoKg = /\bUG\b/.test(name) && /&\s*Co\.?\s*KG\b/.test(name) ? "UG (haftungsbeschränkt) & Co. KG" : null;
  const roh = betrieb.rechtsform || ugCoKg || formImNamen(name) || "Einzelunternehmen";
  g.push(`rf:${rechtsformAus(roh, PRUEF_RECHTSFORMEN)}`);
  if (PRUEF_LAENDER.includes(betrieb.bundesland)) g.push(`land:${betrieb.bundesland}`);
  if (betrieb.ku_bis) g.push("ku");
  if (eigene) g.push(eigene.gruppe);
  return g;
}

/**
 * Prüfstand der Vorlage für eine Freigabe: für die Vorlagen und Freigaben der App aus der erzeugten Liste PRUEFSTAENDE
 * (die Rechnung über alle Ausprägungen dauert für große Vorlagen auf dem Gerät zu lange; ein Test prüft, dass die Liste
 * zur Rechnung passt), sonst neu gerechnet (Tests, Werkzeuge, geänderte Vorlagen).
 */
export function aktuellerPruefstand(v: Vorlage, f: Omit<VorlagenFreigabe, "weitere">, liste: Readonly<Record<string, VorlagenFreigabe>> = VORLAGEN_GEPRUEFT): Pruefstand {
  if (liste === VORLAGEN_GEPRUEFT && vorlageFuer(v.id) === v) {
    const i = freigabenFuer(v.id).indexOf(f);
    const gemerkt = i >= 0 ? PRUEFSTAENDE[i ? `${v.id}#${i}` : v.id] : undefined;
    if (gemerkt) return gemerkt;
  }
  return vorlagenPruefstand(v, f);
}

/** Freigabe auf Rechtsformen beschränkt (Rechtsanwalt 25.10.2026, Handelsregister nur GmbH, OHG, KG)? */
function rechtsformPasst(f: Pick<VorlagenFreigabe, "rechtsformen">, d?: Daten, betrieb?: Betrieb): boolean {
  if (!f.rechtsformen?.length) return true;
  const roh = (typeof d?.rechtsform === "string" && d.rechtsform) || betrieb?.rechtsform || (betrieb?.name ? formImNamen(betrieb.name) ?? "" : "");
  const rf = rechtsformAus(roh, [...f.rechtsformen]);
  return Boolean(rf) && f.rechtsformen.includes(rf);
}

/** Hinweis in der App unter einer Vorlage: „Vorlagen fachlich durchgesehen (Stand …)“ oder der allgemeine Prüfhinweis. */
export function pruefHinweisFuer(v: Vorlage, d?: Daten, betrieb?: Betrieb): string {
  const f = vorlageGeprueft(v, d, VORLAGEN_GEPRUEFT, betrieb);
  return f ? geprueftVermerk(f.stand, f, aktuellerPruefstand(v, f).offen) : PRUEFHINWEIS;
}
