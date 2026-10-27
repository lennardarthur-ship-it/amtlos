/**
 * Daten aus Rechnungen und Belegen weitergeben (E-133) – reine Funktionen ohne Gerät:
 * - EÜR übernehmen: Einnahmen nach Zahlungseingang, Ausgaben nach Zahlung, je Zeile der Anlage EÜR.
 * - Steuerberater-Paket: ZIP mit DATEV-Buchungsstapel, lesbarer Buchungsliste, Rechnungs- und Belegliste (CSV),
 *   Fragen an den Betrieb, E-Rechnungen (XRechnung) der Ausgangsrechnungen, den Originaldateien der Belege und – wenn
 *   der Aufrufer sie mitgibt – den PDFs der Rechnungen.
 * Fachlich zu prüfen: PRUEFLISTE T-79 (Zuordnung) und die Prüfpunkte in packages/fachlogik/src/buchungen.ts.
 */
import { zipSync, type Zippable } from "fflate";
import {
  EUER_KAPITALGESELLSCHAFT,
  EUER_ZEILE_STEUERFREI,
  EUER_ZEILE_STEUERPFLICHTIG,
  KONTEN_13B,
  KONTENVORGABE_FELDER,
  KU_HINWEIS,
  bilanzierend,
  buchungsVorzeichen,
  kontenFuer,
  kontenvorgabenGesetzt,
  STEUERART_NULLSATZ,
  zahlungsBuchungenRechnung,
  euAnzahlungBuchung,
  type Buchung,
  buchungenAusBelegen,
  buchungenAusRechnungen,
  buchungslisteCsv,
  belegImStapel,
  belegKennung,
  belegNummern,
  belegSummen,
  fremdBetragText,
  belegnummerNormal,
  cent,
  restGruppen,
  zahlbetrag,
  dateinamenTeil,
  datevExtf,
  datevExtfBytes,
  eRechnungAus,
  drittlandLand,
  euUnternehmenLand,
  euerFuer,
  kennzahlBefreiung,
  steuerschuldBetrag,
  VORSTEUER_AUFTEILEN,
  istKapitalgesellschaft,
  kategorieFuer,
  summen,
  xrechnungUbl,
  zahltag,
  ZAHLUNGSWEGE,
  kasseAb,
  kassenBuchungen,
  kassenSummen,
  kassenUmsatz,
  kassenVerlauf,
  kassenWarnungen,
  kassenDifferenzBuchungen,
  nacherfasstTage,
  sachentnahmeBuchungen,
  sachentnahmenFuer,
  zmBetroffen,
  zeitDe,
  standortVon,
  skontoBuchungenBelege,
  skontoBuchungenRechnung,
  tageText,
  zahlungsAnteile,
  zbonLuecken,
  type AusgangsRechnungFuerBuchung,
  type Beleg,
  type Betrieb,
  type Einnahme,
  vorlageFuer,
  type Kontenrahmen,
  type Kontenvorgaben,
  type Konten,
  type RechnungsDaten,
  belegTeilabzug,
  datevDebitorenKreditoren,
  gleicherPartner,
  istPersonenkonto,
  naechstesPersonenkonto,
  type Person,
  type PersonenkontoArt,
  type PersonenkontoStamm,
} from "@amtlos/fachlogik";
import { APP_VERSION } from "../version";
import { T as TEXT } from "../texte";
import { utf8 } from "./sicherung";
import { GUTSCHRIFT_HINWEIS, euBerichtigungen, euMeldeArtVon, istGutschrift, kuImZeitraum, periodeText, schlussZuAbschlag, zuordnungsTage } from "./ustAusRechnungen";
import { BELEG_KONFLIKT_GRUND, absenderFuer, neueId, nichtZaehlend, type ProtokollEintrag, type Stand, type Unterlage } from "./speicher";
import { kassenAbdeckung } from "./kasse";
import { MARKE } from "@amtlos/marke";

// 0 statt -0: ein Storno über 0,00 € steht als „0,00“ da, nicht als „-0,00“
const betrag = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent === 0 ? 0 : cent / 100);
const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
export { GUTSCHRIFT_HINWEIS, istGutschrift };


/**
 * Festgeschriebene (geteilte) Rechnungen – nur sie gelten als gestellt (inkl. Stornorechnungen und Gutschriften).
 * Konfliktkopien und doppelte Stornos zählen nicht (K1, K2) – so auch nicht in EÜR und DATEV-Export.
 */
export const gestellteRechnungen = (s: Stand) => {
  const aus = nichtZaehlend(s.unterlagen);
  return s.unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string" && !aus.has(u.id));
};
/** Gestellte Rechnungen ohne Gutschriften – nur sie sind Umsätze des Betriebs. */
export const umsatzRechnungen = (s: Stand) => gestellteRechnungen(s).filter((u) => !istGutschrift(u));

/**
 * Kasse laut Pflichten-Check („kasse.elektronisch“): „kasse“ (ja), „keine“ (nein) oder „unbekannt“ (nicht beantwortet).
 * Amtlos kennt nur Rechnungen und Belege – mit Kasse fehlen die Kassenumsätze in allem, was daraus gerechnet wird
 * (Voranmeldung, EÜR, Steuerberater-Paket). Dasselbe gilt für Umsätze über Onlineshop, Online-Marktplätze, App oder
 * Marktstand („vertrieb.kanaele“): dann „shop“ bzw. mit Kasse „kasse_shop“.
 */
export type KassenLage = "kasse" | "keine" | "unbekannt" | "shop" | "kasse_shop";
/** Verkaufswege, deren Umsätze ohne Rechnung aus Amtlos entstehen (Shop- und Plattformberichte, Marktkasse). */
export const SHOP_KANAELE = ["onlineshop", "marktplatz", "app", "marktstand"];
export function kassenLage(profil: Stand["profil"]): KassenLage {
  const w = profil["kasse.elektronisch"];
  const k = profil["vertrieb.kanaele"];
  const shop = Array.isArray(k) && k.some((x) => SHOP_KANAELE.includes(String(x)));
  if (shop) return w === true ? "kasse_shop" : "shop";
  return w === true ? "kasse" : w === false ? "keine" : "unbekannt";
}

/** Hinweis in der App nach einer Übernahme: mit Kasse bzw. Shop laut Check als Warnung, ohne Antwort ruhiger („Falls du …“). */
export function kassenHinweis(lage: KassenLage, art: "ust" | "euer"): { text: string; warnung: boolean } | null {
  if (lage === "keine") return null;
  if (lage === "shop") return { text: art === "ust" ? TEXT.shop_ust : TEXT.shop_euer, warnung: true };
  if (lage === "kasse_shop") return { text: art === "ust" ? TEXT.kasse_shop_ust : TEXT.kasse_shop_euer, warnung: true };
  if (art === "ust") return lage === "kasse" ? { text: TEXT.kasse_ust, warnung: true } : { text: TEXT.kasse_ust_vielleicht, warnung: false };
  return lage === "kasse" ? { text: TEXT.kasse_euer, warnung: true } : { text: TEXT.kasse_euer_vielleicht, warnung: false };
}

/**
 * R12: Hinweis nach einer Übernahme mit Blick auf die Kassenabschlüsse des Zeitraums: ohne Abschlüsse wie bisher; sind
 * alle Tage erfasst, entfällt der Kassenhinweis (Shop-Umsätze bleiben ein Hinweis); fehlen Tage, werden sie genannt.
 */
export function kassenHinweisMit(lage: KassenLage, art: "ust" | "euer", fehlend: string[] | null): { text: string; warnung: boolean } | null {
  if (fehlend === null) return kassenHinweis(lage, art);
  const shop = lage === "shop" || lage === "kasse_shop" ? (art === "ust" ? TEXT.shop_ust : TEXT.shop_euer) : "";
  const tage = fehlend.length ? TEXT.r12_kasse_tage_fehlen(tageText(fehlend)) : "";
  const text = [tage, shop].filter(Boolean).join(" ");
  return text ? { text, warnung: true } : null;
}

/** Satz für LIESMICH und Fragen im Paket – null, wenn der Betrieb laut Check weder Kasse noch Shop/Marktstand hat. */
export function kassenSatzPaket(lage: KassenLage, abdeckung?: { fehlend: string[] | null; tage: number }): string | null {
  // R12: Kassenabschlüsse in Amtlos – enthalten; nur fehlende Tage nennen
  if (abdeckung && abdeckung.fehlend !== null) {
    const teile = [
      abdeckung.tage ? `Kassenumsätze aus ${abdeckung.tage} ${abdeckung.tage === 1 ? "Tagesabschluss" : "Tagesabschlüssen"} (Z-Bons) sind enthalten: im Stapel Kasse an Erlöse, Kartenzahlungen über Geldtransit; Einzelheiten in Kassenabschluesse_*.csv.` : "",
      abdeckung.fehlend.length ? `Tage ohne Kassenabschluss: ${tageText(abdeckung.fehlend)} – diese Umsätze fehlen, bitte nachreichen.` : "",
      lage === "shop" || lage === "kasse_shop" ? "Betrieb mit Onlineshop, Online-Marktplatz, App oder Marktstand (laut Pflichten-Check): Diese Umsätze fehlen in diesem Paket. Bitte die Shop-, Plattform- und Zahlungsberichte zusätzlich liefern." : "",
    ].filter(Boolean);
    return teile.length ? teile.join("\r\n") : null;
  }
  if (lage === "keine") return null;
  const satz = "Kassenumsätze fehlen in diesem Paket. Die Umsätze laut Tagesabschlüssen (Z-Bons) bzw. Kassenexport bitte zusätzlich liefern.";
  const shop = "Betrieb mit Onlineshop, Online-Marktplatz, App oder Marktstand (laut Pflichten-Check): Diese Umsätze fehlen in diesem Paket. Bitte die Shop-, Plattform- und Zahlungsberichte (z. B. Monatsabrechnungen, Auszahlungsübersichten) bzw. das Kassenbuch des Marktstands zusätzlich liefern.";
  if (lage === "shop") return shop;
  if (lage === "kasse_shop") return `Betrieb mit Kasse: ${satz}\r\n${shop}`;
  return lage === "kasse" ? `Betrieb mit Kasse: ${satz}` : `Falls der Betrieb eine Kasse nutzt: ${satz}`;
}

/**
 * Kleinunternehmer (§ 19 UStG): laut Pflichten-Check („ust.kleinunternehmer“); ohne Antwort dort, wenn alle
 * gestellten Rechnungen als Kleinunternehmer-Rechnung geschrieben sind.
 */
export function istKleinunternehmer(s: Stand): boolean {
  const p = s.profil["ust.kleinunternehmer"];
  if (typeof p === "boolean") return p;
  const r = gestellteRechnungen(s);
  return r.length > 0 && r.every((u) => u.daten.kleinunternehmer === true);
}

/** Rechtsform laut Pflichten-Check (Wert der Antwort) als Text – für LIESMICH, wenn „Mein Betrieb“ keine hat (R10). */
const RECHTSFORM_TEXT: Record<string, string> = { einzelunternehmen: "Einzelunternehmen", freiberuf: "Freiberuflich (Einzelunternehmen)", gbr: "GbR", ek: "e. K.", ohg: "OHG", kg: "KG", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG", partg: "PartG", partg_mbb: "PartG mbB" };
/** Rechtsform aus „Mein Betrieb“, sonst aus dem Pflichten-Check (mit Herkunft). */
export function rechtsformFuer(s: Stand): { text: string; ausCheck: boolean } | null {
  const b = s.betrieb.rechtsform?.trim();
  if (b) return { text: b, ausCheck: false };
  const p = s.profil.rechtsform;
  return typeof p === "string" && RECHTSFORM_TEXT[p] ? { text: RECHTSFORM_TEXT[p]!, ausCheck: true } : null;
}
/** Kapitalgesellschaft laut „Mein Betrieb“ oder Pflichten-Check */
export const kapitalgesellschaft = (s: Stand) => istKapitalgesellschaft(rechtsformFuer(s)?.text, s.betrieb.name);
/**
 * StB-Prüfung (A-4, E-4): bilanzierender Betrieb – Kapitalgesellschaft, GmbH & Co. KG, OHG, KG, e. K. oder vom Finanzamt zur
 * Buchführung aufgefordert (Pflichten-Check „steuern.buchfuehrung_mitteilung“); die Kontenvorgabe der Kanzlei geht vor.
 * Dann gibt es keine EÜR-Übernahme und das Steuerberater-Paket enthält einen Soll-Stapel mit Zahlungseingängen.
 */
export const bilanzierendeGewinnermittlung = (s: Stand) =>
  bilanzierend({ rechtsform: rechtsformFuer(s)?.text, name: s.betrieb.name, buchfuehrungMitteilung: s.profil["steuern.buchfuehrung_mitteilung"] === true, vorgabe: s.steuerberatung.kontenvorgaben?.gewinnermittlung });

/** Ausgangsrechnung in der Form, die die Buchungen brauchen. `tage`: Zuordnung zur Steuerperiode (zuordnungsTage). */
export function rechnungFuerBuchung(u: Unterlage, betrieb: Betrieb, o: { tage?: Map<string, string | null>; betriebKu?: boolean } = {}): AusgangsRechnungFuerBuchung {
  // R12 GoBD: festgeschriebene Rechnung mit den festgehaltenen Absenderdaten
  const { daten } = eRechnungAus(u.daten, u.festgeschrieben && u.absender ? u.absender : betrieb);
  const leistung = daten.leistungsdatum ?? daten.leistungszeitraum?.bis ?? null;
  return {
    id: u.id,
    nummer: daten.nummer,
    datum: daten.rechnungsdatum,
    bezahlt: u.bezahlt ?? null,
    art: istStorno(u) ? "storno" : "rechnung",
    storniert_nummer: daten.storniert_nummer ?? null,
    gutschrift: istGutschrift(u),
    kleinunternehmer: daten.kleinunternehmer,
    kunde: daten.kunde.name,
    positionen: daten.positionen,
    steuerart: daten.steuerart,
    kunde_land: daten.kunde.land,
    kunde_ust_idnr: daten.kunde.ust_idnr ?? null,
    befreiungsgrund: daten.befreiungsgrund ?? null,
    leistungsdatum: istStorno(u) ? null : leistung,
    steuerperiode: o.tage?.get(u.id) ?? null,
    empfaenger_ku: o.betriebKu ?? false,
    // Koordination Rechnungen: Schlussrechnung (abgesetzte Abschläge) und OSS (Steuer des Bestimmungslands).
    // E-193 (8b): auch beim Storno einer Schlussrechnung – es spiegelt die Buchung des Rests (vorher: ganzer Betrag)
    ...(daten.abschlaege?.length ? { abschlaege: daten.abschlaege } : {}),
    ...(daten.oss ? { oss: daten.oss } : {}),
  };
}

/**
 * Einnahmen aus Rechnungen mit vermerktem Zahlungseingang (Zufluss, § 11 Abs. 1 EStG); Stornos negativ. Positionen zu
 * 0 % einer Rechnung mit Steuerart „igl“, „reverse_charge“ oder „befreit“ zählen als steuerfrei (eigene EÜR-Zeile).
 */
export function einnahmenAusRechnungen(s: Stand): Einnahme[] {
  // R12: Rechnungen mit einzelnen Zahlungen – je Zahlung der erhaltene Betrag (Skonto bzw. Minderung fließt nie zu)
  const mitZahlungen: Einnahme[] = umsatzRechnungen(s)
    .filter((u) => u.zahlungen?.length && !istStorno(u))
    .flatMap((u) => {
      const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
      const frei = daten.steuerart && daten.steuerart !== "standard" && daten.steuerart !== "nullsatz";
      const nichtSteuerbar = daten.kleinunternehmer && (daten.steuerart === "reverse_charge" || !!euUnternehmenLand(u.daten) || !!drittlandLand(u.daten));
      // Schlussrechnung: nur der Rest nach Abzug der Abschläge fließt zu (restGruppen, C-4)
      return zahlungsAnteile(restGruppen(daten), u.zahlungen!).map((a) => {
        const netto = a.erhalten.reduce((x, g) => x + g.netto_cent, 0);
        // OSS: im Inland nicht steuerbar – Zeile „… nicht umsatzsteuerbare Betriebseinnahmen“ (Nachtrag 22.10.2026)
        const oss = daten.oss ? a.erhalten.filter((g) => g.satz).reduce((x, g) => x + g.netto_cent, 0) : 0;
        return { tag: a.zahlung.datum, netto_cent: netto, ust_cent: a.erhalten.reduce((x, g) => x + g.ust_cent, 0), steuerfrei_cent: (frei ? a.erhalten.filter((g) => g.satz === 0).reduce((x, g) => x + g.netto_cent, 0) : 0) + oss, nicht_steuerbar_cent: nichtSteuerbar ? netto : 0, kleinunternehmer: daten.kleinunternehmer };
      });
    });
  return [...mitZahlungen, ...umsatzRechnungen(s)
    .filter((u) => u.bezahlt && !(u.zahlungen?.length && !istStorno(u)))
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
      // Schlussrechnung (C-4): Zufluss ist der Rest nach Abzug der schon gezahlten Abschläge – beim Storno ebenso (E-193)
      const rest = restGruppen(daten);
      const sm = { gruppen: rest, netto_cent: rest.reduce((a, g) => a + g.netto_cent, 0), ust_cent: rest.reduce((a, g) => a + g.ust_cent, 0) };
      const vz = istStorno(u) ? -1 : 1;
      // Nullsteuersatz (§ 12 Abs. 3 UStG) ist steuerpflichtig zu 0 % – Zeile „umsatzsteuerpflichtig“, nicht „steuerfrei“ (R10)
      // OSS-Rechnungen (Steuer des Bestimmungslands): im Inland nicht steuerbar – ebenfalls diese Zeile (Nachtrag 22.10.2026)
      const frei = (daten.steuerart && daten.steuerart !== "standard" && daten.steuerart !== "nullsatz" ? sm.gruppen.filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0) : 0) + (daten.oss ? sm.gruppen.filter((g) => g.satz).reduce((a, g) => a + g.netto_cent, 0) : 0);
      // Kleinunternehmer: Leistungen an Unternehmen im Ausland sind nicht steuerbar – eigene „davon“-Zeile der Anlage EÜR
      const nichtSteuerbar = daten.kleinunternehmer && (daten.steuerart === "reverse_charge" || euUnternehmenLand(u.daten) || drittlandLand(u.daten)) ? sm.netto_cent : 0;
      return { tag: u.bezahlt!, netto_cent: vz * sm.netto_cent, ust_cent: vz * sm.ust_cent, steuerfrei_cent: vz * frei, nicht_steuerbar_cent: vz * nichtSteuerbar, kleinunternehmer: daten.kleinunternehmer };
    })];
}

/** Gutschriften mit Zahlungsvermerk im Jahr – Ausgaben des Betriebs (bezogene Leistungen), R10. */
function gutschriftAusgaben(s: Stand, jahr: string): { netto: number; ust: number; anzahl: number } {
  let netto = 0;
  let ust = 0;
  let anzahl = 0;
  for (const u of gestellteRechnungen(s)) {
    if (!istGutschrift(u) || !u.bezahlt?.startsWith(`${jahr}-`)) continue;
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    const sm = summen(daten.positionen, daten.kleinunternehmer);
    const vz = istStorno(u) ? -1 : 1;
    netto += vz * sm.netto_cent;
    ust += vz * sm.ust_cent;
    anzahl++;
  }
  return { netto, ust, anzahl };
}

// ---------------------------------------------------------------- Personenkonten (E-165, StB-Prüfung A-3)

/** Geschäftspartner einer Rechnung bzw. eines Belegs für das Personenkonto */
interface Partner {
  name: string;
  ust_idnr?: string | null;
  anschrift?: string | null;
  land?: string | null;
  privat?: boolean;
}

/** Partner einer gestellten Rechnung: Kunde (Debitor) bzw. bei einer Gutschrift der Leistende (Kreditor). */
function rechnungsPartner(s: Stand, u: Unterlage): Partner & { art: PersonenkontoArt } {
  const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
  const anschrift = typeof u.daten.kunde_anschrift === "string" ? u.daten.kunde_anschrift : null;
  return { art: istGutschrift(u) ? "kreditor" : "debitor", name: daten.kunde.name, ust_idnr: daten.kunde.ust_idnr ?? null, anschrift, land: daten.kunde.land ?? null, privat: u.daten.kunde_art === "privat" };
}

/** Belege, die im Stapel auf das Verbindlichkeitskonto gingen – nur sie bekommen einen Kreditor. */
const belegMitKreditor = (b: Beleg) => b.zahlung === "bank" && b.kategorie !== "personal" && !!b.lieferant.trim();

/** Gespeicherter Eintrag (Kunde bzw. Lieferant), der zum Partner passt. */
const passend = (liste: readonly Person[], p: Partner) => liste.find((x) => gleicherPartner({ name: x.name, ust_idnr: x.ust_idnr }, p));

/**
 * E-165 (A-3): Personenkonten vergeben – nur mit der Kontenvorgabe „Personenkonten“. Jeder Kunde gestellter Rechnungen
 * bekommt einmal ein Debitorenkonto (10000–69999), jeder Lieferant von Belegen per Überweisung/Karte (und jeder
 * Leistende einer Gutschrift) ein Kreditorenkonto (70000–99999) – in der Reihenfolge des ersten Auftretens (Rechnungs-
 * bzw. Belegdatum). Gespeichert am Kunden (`kunden`, angelegt, wenn er fehlt) bzw. im Lieferanten-Verzeichnis
 * (`lieferanten`); eine einmal vergebene Nummer ändert sich nie. Ohne Änderung kommt derselbe Stand zurück.
 */
export function personenkontenVergeben(s: Stand, jetzt = new Date()): Stand {
  if (!s.steuerberatung.kontenvorgaben?.personenkonten) return s;
  const iso = jetzt.toISOString();
  const listen: Record<PersonenkontoArt, Person[]> = { debitor: [...s.kunden], kreditor: [...s.lieferanten] };
  let geaendert = false;
  const belegt = () => [...listen.debitor, ...listen.kreditor].map((p) => p.personenkonto);
  const vergeben = (art: PersonenkontoArt, p: Partner) => {
    if (!p.name.trim()) return;
    const liste = listen[art];
    const da = passend(liste, p);
    if (da && istPersonenkonto(da.personenkonto, art)) return;
    const nr = naechstesPersonenkonto(belegt(), art);
    if (!nr) return;
    geaendert = true;
    if (da) listen[art] = liste.map((x) => (x === da ? { ...x, personenkonto: nr, geaendert: iso } : x));
    else listen[art] = [...liste, { id: neueId(), name: p.name.trim(), ...(p.anschrift ? { anschrift: p.anschrift } : {}), ...(p.ust_idnr ? { ust_idnr: p.ust_idnr } : {}), ...(p.land && p.land !== "DE" ? { land: p.land } : {}), ...(p.privat ? { art: "privat" } : {}), personenkonto: nr, geaendert: iso } as Person];
  };
  const vorgaenge = [
    ...gestellteRechnungen(s).map((u) => ({ datum: String(u.daten.datum), sort: `r${String(u.daten.nummer ?? "")}`, los: () => { const p = rechnungsPartner(s, u); vergeben(p.art, p); } })),
    ...s.belege.filter(belegMitKreditor).map((b) => ({ datum: b.datum, sort: `b${b.nr ?? b.id}`, los: () => vergeben("kreditor", { name: b.lieferant, ust_idnr: b.lieferant_ust_idnr ?? null, anschrift: b.lieferant_anschrift ?? null }) })),
  ].sort((a, b) => a.datum.localeCompare(b.datum) || a.sort.localeCompare(b.sort, "de", { numeric: true }));
  for (const v of vorgaenge) v.los();
  return geaendert ? { ...s, kunden: listen.debitor, lieferanten: listen.kreditor } : s;
}

/** Personenkonto einer gestellten Rechnung (Debitor bzw. bei Gutschriften Kreditor) – null ohne vergebene Nummer. */
export function personenkontoRechnung(s: Stand, u: Unterlage): string | null {
  const p = rechnungsPartner(s, u);
  const nr = passend(p.art === "debitor" ? s.kunden : s.lieferanten, p)?.personenkonto;
  return istPersonenkonto(nr, p.art) ? nr : null;
}

/** Kreditor je Beleg-ID (nur Belege per Überweisung/Karte mit vergebener Nummer). */
export function kreditorenBelege(s: Stand): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of s.belege) {
    if (!belegMitKreditor(b)) continue;
    const nr = passend(s.lieferanten, { name: b.lieferant, ust_idnr: b.lieferant_ust_idnr ?? null })?.personenkonto;
    if (istPersonenkonto(nr, "kreditor")) m.set(b.id, nr);
  }
  return m;
}

/** Alle vergebenen Personenkonten (Stammdaten) – Kunden und Lieferanten, nach Nummer. */
export function personenkontenListe(s: Pick<Stand, "kunden" | "lieferanten">): (PersonenkontoStamm & { art: PersonenkontoArt })[] {
  const eintrag = (p: Person, art: PersonenkontoArt) => (istPersonenkonto(p.personenkonto, art) ? [{ art, konto: p.personenkonto, name: p.name, anschrift: p.anschrift ?? null, land: p.land ?? null, ust_idnr: p.ust_idnr ?? null, privat: p.art === "privat" }] : []);
  return [...s.kunden.flatMap((p) => eintrag(p, "debitor")), ...s.lieferanten.flatMap((p) => eintrag(p, "kreditor"))].sort((a, b) => a.konto.localeCompare(b.konto));
}

/** Personenkonten, die zweimal vergeben sind (z. B. offline auf zwei Geräten) – für die LIESMICH. */
export const personenkontenDoppelt = (s: Pick<Stand, "kunden" | "lieferanten">) => {
  const n = personenkontenListe(s).map((e) => e.konto);
  return [...new Set(n.filter((k, i) => n.indexOf(k) !== i))];
};

/** E-165: steuerfreie Heilbehandlungen o. Ä. (Kz 48) unter den Rechnungen bzw. Branche „Gesundheit und Pflege“ */
function umsaetzeAusserhalbDerApp(s: Stand): boolean {
  const branchen = s.profil["taetigkeit.branchen"];
  if (Array.isArray(branchen) && branchen.includes("gesundheit_pflege")) return true;
  return umsatzRechnungen(s).some((u) => {
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    return daten.steuerart === "befreit" && kennzahlBefreiung(daten.befreiungsgrund) === "48";
  });
}

/** Jahre mit Daten (Zahlungen von Rechnungen, Zahltage von Belegen), neueste zuerst. */
export function jahreMitDaten(s: Stand): string[] {
  const j = new Set<string>();
  for (const u of umsatzRechnungen(s)) if (u.bezahlt) j.add(u.bezahlt.slice(0, 4));
  for (const u of umsatzRechnungen(s)) for (const z of u.zahlungen ?? []) j.add(z.datum.slice(0, 4));
  for (const b of s.belege) j.add(zahltag(b).slice(0, 4));
  for (const k of s.kasse) if (!k.geschlossen) j.add(k.datum.slice(0, 4));
  return [...j].sort((a, b) => b.localeCompare(a));
}

export interface EuerUebernahme {
  einnahmen: Record<string, string>[];
  ausgaben: Record<string, string>[];
  /** Anschaffungen über 800 € netto: keine sofortige Ausgabe – Abschreibung selbst eintragen */
  anlagen: number;
  rechnungen: number;
  belege: number;
  /** geteilte Rechnungen des Jahres ohne vermerkten Zahlungseingang */
  unbezahlt: number;
  /** Gutschriften des Jahres – nicht als Einnahme übernommen */
  gutschriften: number;
  /** was die Übernahme nicht enthält und von Hand ergänzt werden muss (bei Kapitalgesellschaften mit Warnung vorab) */
  hinweis: string;
  /** R12: übernommene Kassenabschlüsse mit Umsatz */
  kassentage: number;
  /** R12: Tage des Jahres ohne Kassenabschluss – null, wenn es keine Kassenabschlüsse gibt */
  kasseFehlend: string[] | null;
  /** StB-Prüfung (E-4): bilanzierender Betrieb – keine EÜR-Übernahme, `hinweis` sagt „Bilanz statt EÜR“ */
  gesperrt?: boolean;
  /**
   * StB-Prüfung (E-1): Vorschlag für die Zeile „An das Finanzamt gezahlte … Umsatzsteuer“ aus den Voranmeldungen in der
   * App (Zahllast abzüglich Erstattungen) – nur ein Hinweis, keine Zeile: gezählt wird nach Zahltag (§ 11 EStG).
   */
  ustVorschlag?: string;
}

/**
 * StB-Prüfung (E-1): Zahllasten der Voranmeldungen in der App, deren Zeitraum im Jahr liegt (Text „Oktober 2026“,
 * „3. Quartal 2026“ …). Der Vorschlag nennt Summe und Anzahl und weist auf die Zehn-Tage-Regel hin; null ohne Voranmeldung.
 */
export function ustZahlungenVorschlag(s: Stand, jahr: string): string | null {
  const v = vorlageFuer("ust_voranmeldung");
  if (!v?.ergebnis) return null;
  const zahllast = (u: Unterlage) => {
    const z = v.ergebnis!(u.daten).find(([titel]) => titel === "Zahllast" || titel === "Erstattung");
    if (!z) return null;
    const c = cent(z[1].replace(/[^\d,.-]/g, ""));
    return c === null ? null : (z[0] === "Erstattung" ? -c : c);
  };
  // je Zeitraum die zuletzt geänderte Voranmeldung (eine Korrektur ersetzt die erste)
  const jeZeitraum = new Map<string, Unterlage>();
  for (const u of s.unterlagen) {
    const zr = String(u.daten.zeitraum ?? "").replace(/\s+/g, " ").trim();
    if (u.vorlage !== "ust_voranmeldung" || !new RegExp(`\\b${jahr}\\b`).test(zr)) continue;
    const alt = jeZeitraum.get(zr);
    if (!alt || alt.geaendert < u.geaendert) jeZeitraum.set(zr, u);
  }
  const werte = [...jeZeitraum.values()].map(zahllast).filter((x): x is number => x !== null && x !== 0);
  if (!werte.length) return null;
  const summe = werte.reduce((a, x) => a + x, 0);
  return `Vorschlag für die Zeile „An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer“: Deine ${werte.length} ${werte.length === 1 ? "Voranmeldung" : "Voranmeldungen"} für ${jahr} in der App ergeben zusammen ${betrag(summe)} € (Zahllast abzüglich Erstattungen). Maßgeblich ist, was im Jahr tatsächlich gezahlt wurde (§ 11 EStG): die Voranmeldung für Dezember bzw. das 4. Quartal ${Number(jahr) - 1} meist im Januar ${jahr}, die für Dezember bzw. das 4. Quartal ${jahr} meist erst ${Number(jahr) + 1} – Zehn-Tage-Regel (§ 11 Abs. 2 Satz 2 EStG) beachten, mit Dauerfristverlängerung zählt die Dezember-Zahlung ins neue Jahr. Bitte mit dem Kontoauszug abgleichen.`;
}

/** StB-Prüfung (E-4): Hinweis statt EÜR-Übernahme für bilanzierende Betriebe (§ 238 HGB, § 140 AO). */
export const EUER_GESPERRT =
  "Bilanz statt EÜR: Für diesen Betrieb (Kapitalgesellschaft, eingetragene Kaufleute oder Buchführungspflicht laut Finanzamt) gilt die Buchführungspflicht nach § 238 HGB bzw. § 140/141 AO – die Einnahmen-Überschuss-Rechnung entfällt, die Bilanz erstellt die Steuerberatung aus der Buchführung. Deshalb übernimmt die App hier keine Werte. Ist das falsch (z. B. e. K. unter den Grenzen des § 241a HGB), stellt die Kanzlei die Gewinnermittlung in den Kontenvorgaben auf „EÜR“.";

/** Steht nach jeder Übernahme sichtbar da: Amtlos rechnet diese Posten nicht aus. */
export const EUER_NICHT_ENTHALTEN =
  "Nicht enthalten: die an das Finanzamt gezahlten Umsatzsteuer-Vorauszahlungen (Zeile „An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer“), eine Erstattung vom Finanzamt und die Abschreibungen (AfA) – bitte selbst ergänzen.";
/** Zusatz mit Onlineshop, Marktplatz, App oder Marktstand laut Pflichten-Check: diese Einnahmen kennt Amtlos nicht. */
export const EUER_SHOP_NICHT_ENTHALTEN =
  "Ebenfalls nicht enthalten: Einnahmen aus Onlineshop, Online-Marktplätzen, App und Marktstand (laut Shop-, Plattform- und Zahlungsberichten bzw. Kassenbuch), auch Fernverkäufe in andere EU-Länder (OSS) und die dafür gezahlte Umsatzsteuer – bitte selbst ergänzen.";

/** „davon“-Zeile zur Kleinunternehmer-Zeile der Anlage EÜR (Wortlaut aus der Zeilenliste) */
export const EUER_KU_DAVON = "Nicht steuerbare Umsätze sowie Umsätze nach § 19 Absatz 3 Satz 1 Nummer 1 und 2 UStG";

/** Einträge für die Vorlage „EÜR“ (Listen `einnahmen` und `ausgaben`) aus den Daten eines Jahres. */
export function euerUebernahme(s: Stand, jahr: string): EuerUebernahme {
  // StB-Prüfung (E-4): keine EÜR für bilanzierende Betriebe – gesperrt mit Hinweis „Bilanz statt EÜR“
  if (bilanzierendeGewinnermittlung(s)) return { einnahmen: [], ausgaben: [], anlagen: 0, rechnungen: 0, belege: 0, unbezahlt: 0, gutschriften: 0, hinweis: EUER_GESPERRT, kassentage: 0, kasseFehlend: null, gesperrt: true };
  const einnahmen = einnahmenAusRechnungen(s);
  const e = euerFuer(einnahmen, s.belege, jahr);
  const ku = einnahmen.some((x) => x.kleinunternehmer && x.tag.startsWith(`${jahr}-`));
  const ein: Record<string, string>[] = [];
  const pflichtig = e.einnahmen_netto_cent - e.einnahmen_steuerfrei_cent;
  if (ku) {
    // ohne „(netto)“: bei Kleinunternehmern gibt es keine Umsatzsteuer, der Betrag ist der Rechnungsbetrag. Nicht steuerbare
    // Umsätze (Ausland) als eigene Zeile – in der Anlage EÜR die „davon“-Zeile zur Kleinunternehmer-Zeile
    // R11: Die Kleinunternehmer-Zeile enthält den Gesamtbetrag; die nicht steuerbaren Umsätze sind in der Anlage EÜR nur
    // eine „davon“-Zeile – hier im Text, damit die Summe der Einnahmen nicht doppelt zählt
    const ns = e.einnahmen_nicht_steuerbar_cent;
    if (e.einnahmen_netto_cent) ein.push({ datum: "", text: ns ? `Umsätze aus Rechnungen – davon nicht steuerbar (Leistungen an Unternehmen im Ausland): ${betrag(ns)} €, in der Anlage EÜR in die „davon“-Zeile „${EUER_KU_DAVON}“` : "Umsätze aus Rechnungen", kategorie: "Umsatzsteuerlicher Kleinunternehmer", betrag: betrag(e.einnahmen_netto_cent) });
  } else {
    if (pflichtig) ein.push({ datum: "", text: "Umsätze aus Rechnungen (netto)", kategorie: EUER_ZEILE_STEUERPFLICHTIG, betrag: betrag(pflichtig) });
    // ohne Beispiel: die Zeile sammelt igL, § 13b-Umsätze, Steuerbefreiungen (z. B. Heilbehandlungen) und OSS-Fernverkäufe
    if (e.einnahmen_steuerfrei_cent) ein.push({ datum: "", text: "Steuerfreie und nicht steuerbare Umsätze aus Rechnungen", kategorie: EUER_ZEILE_STEUERFREI, betrag: betrag(e.einnahmen_steuerfrei_cent) });
  }
  if (e.ust_vereinnahmt_cent) ein.push({ datum: "", text: "Vereinnahmte Umsatzsteuer", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: betrag(e.ust_vereinnahmt_cent) });
  // R12: Kasseneinnahmen laut Tagesabschlüssen – Zufluss am Tag des Abschlusses, eigene Zeilen
  const kuKasse = istKleinunternehmer(s);
  // R12 GoBD: Kassenüberschüsse wie im Stapel als Einnahme zum Regelsatz, Fehlbeträge als Ausgabe
  const diffJahr = kassenWarnungen(s.kasse, s.belege).differenzen.filter((d) => d.datum.startsWith(`${jahr}-`));
  // StB-Prüfung (B-9): Überschüsse mit Kontenvorgabe auf ein Ertragskonto ohne Umsatzsteuer – dann nicht als Kassenumsatz 19 %
  const ueberschussOhneUst = !!kontenFuer(s.steuerberatung.kontenrahmen, s.steuerberatung.kontenvorgaben).kassendifferenzErtrag;
  const ka = kassenUmsatz(s.kasse, `${jahr}-01-01`, `${jahr}-12-31`, kuKasse, { ueberschuesse: ueberschussOhneUst ? [] : diffJahr.filter((d) => d.cent > 0) });
  const ueberschuss = ueberschussOhneUst ? diffJahr.filter((d) => d.cent > 0).reduce((a, d) => a + d.cent, 0) : 0;
  if (ueberschuss) ein.push({ datum: "", text: "Kassendifferenzen laut Zählung (Überschüsse, ohne Umsatzsteuer)", kategorie: EUER_ZEILE_STEUERFREI, betrag: betrag(ueberschuss) });
  if (ka.tage) {
    if (kuKasse) ein.push({ datum: "", text: `Kasseneinnahmen laut Tagesabschlüssen (${ka.tage} Tage)`, kategorie: "Umsatzsteuerlicher Kleinunternehmer", betrag: betrag(ka.je[0].brutto) });
    else {
      const netto = ka.je[19].netto + ka.je[7].netto;
      if (netto) ein.push({ datum: "", text: `Kasseneinnahmen laut Tagesabschlüssen (netto, ${ka.tage} Tage)`, kategorie: EUER_ZEILE_STEUERPFLICHTIG, betrag: betrag(netto) });
      if (ka.je[0].brutto) ein.push({ datum: "", text: "Kasseneinnahmen ohne Umsatzsteuer", kategorie: EUER_ZEILE_STEUERFREI, betrag: betrag(ka.je[0].brutto) });
      const ust = ka.je[19].ust + ka.je[7].ust;
      if (ust) ein.push({ datum: "", text: "Umsatzsteuer auf Kasseneinnahmen", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: betrag(ust) });
    }
  }
  // R12 GoBD: Sachentnahmen – netto als Entnahme, Steuer zur vereinnahmten Umsatzsteuer
  const se = sachentnahmenFuer(s.sachentnahmen, `${jahr}-01-01`, `${jahr}-12-31`);
  if (se.anzahl) {
    ein.push({ datum: "", text: `Sachentnahmen (unentgeltliche Wertabgaben, ${se.anzahl} ${se.anzahl === 1 ? "Buchung" : "Buchungen"})`, kategorie: "Sonstige Sach-, Nutzungs- und Leistungsentnahmen", betrag: betrag(se.netto7 + se.netto19) });
    if (!kuKasse && se.ust7 + se.ust19) ein.push({ datum: "", text: "Umsatzsteuer auf Sachentnahmen", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: betrag(se.ust7 + se.ust19) });
  }
  // StB-Prüfung (E-3): nur teilweise abziehbare Ausgaben (Bewirtung 70 %, § 4 Abs. 5 Nr. 2 EStG) mit dem abziehbaren Teil –
  // der nicht abziehbare Teil steht im Text (Anlage EÜR: Spalte „nicht abziehbar“), sonst wäre der Gewinn zu niedrig.
  // Die Vorsteuer bleibt voll abziehbar (Zeile „Gezahlte Vorsteuerbeträge“).
  const aus: Record<string, string>[] = e.ausgaben.zeilen.map((z) => {
    const belegeText = `${z.anzahl} ${z.anzahl === 1 ? "Beleg" : "Belege"}`;
    if (!z.kategorie.abziehbar || z.kategorie.abziehbar >= 100) return { datum: "", text: `${z.kategorie.titel} (${belegeText})`, kategorie: z.kategorie.euer, betrag: betrag(z.netto_cent) };
    const abziehbar = Math.round((z.netto_cent * z.kategorie.abziehbar) / 100);
    return { datum: "", text: `${z.kategorie.titel} (${belegeText}): abziehbar ${z.kategorie.abziehbar} % von ${betrag(z.netto_cent)} €; nicht abziehbar ${betrag(z.netto_cent - abziehbar)} € – in der Anlage EÜR in die Spalte „nicht abziehbar“`, kategorie: z.kategorie.euer, betrag: betrag(abziehbar) };
  });
  const fehl = -diffJahr.filter((d) => d.cent < 0).reduce((a, d) => a + d.cent, 0);
  if (fehl) aus.push({ datum: "", text: "Kassendifferenzen laut Zählung (Fehlbeträge)", kategorie: "Übrige unbeschränkt abziehbare Betriebsausgaben", betrag: betrag(fehl) });
  // Gutschriften (bezahlt im Jahr) sind Ausgaben: bezogene Leistungen; ausgewiesene Steuer des Leistenden als Vorsteuer, außer als Kleinunternehmer
  const gs = gutschriftAusgaben(s, jahr);
  const betriebKu = istKleinunternehmer(s);
  if (gs.netto || gs.ust) aus.push({ datum: "", text: `Gutschriften an Leistende (${gs.anzahl} ${gs.anzahl === 1 ? "Gutschrift" : "Gutschriften"})`, kategorie: "Bezogene Leistungen", betrag: betrag(betriebKu ? gs.netto + gs.ust : gs.netto) });
  const vorsteuer = e.ausgaben.vorsteuer_cent + (betriebKu ? 0 : gs.ust);
  if (vorsteuer) aus.push({ datum: "", text: gs.ust && !betriebKu ? "Gezahlte Vorsteuer aus Belegen und Gutschriften" : "Gezahlte Vorsteuer aus Belegen", kategorie: "Gezahlte Vorsteuerbeträge", betrag: betrag(vorsteuer) });
  const imJahr = gestellteRechnungen(s).filter((u) => String(u.daten.datum).startsWith(`${jahr}-`));
  const gutschriften = imJahr.filter(istGutschrift).length;
  const lage = kassenLage(s.profil);
  const hinweis = [kapitalgesellschaft(s) ? EUER_KAPITALGESELLSCHAFT : "", gutschriften ? GUTSCHRIFT_HINWEIS : "", EUER_NICHT_ENTHALTEN, lage === "shop" || lage === "kasse_shop" ? EUER_SHOP_NICHT_ENTHALTEN : ""].filter(Boolean).join(" ");
  return {
    einnahmen: ein,
    ausgaben: aus,
    anlagen: e.ausgaben.anlagen.length,
    rechnungen: e.anzahl_einnahmen,
    belege: s.belege.filter((b) => zahltag(b).startsWith(`${jahr}-`)).length,
    unbezahlt: imJahr.filter((u) => !u.bezahlt && !u.storniertDurch && !istStorno(u) && !istGutschrift(u)).length,
    gutschriften,
    hinweis,
    kassentage: ka.tage,
    kasseFehlend: kassenAbdeckung(s, `${jahr}-01-01`, `${jahr}-12-31`),
    ...(ustZahlungenVorschlag(s, jahr) ? { ustVorschlag: ustZahlungenVorschlag(s, jahr)! } : {}),
  };
}

// ---------------------------------------------------------------- Steuerberater-Paket

export interface Zeitraum {
  von: string;
  bis: string;
  /** für Dateinamen und Anzeige, z. B. „2026“, „2026-Q3“, „2026-10“ */
  name: string;
}

export interface Steuerberatung {
  kontenrahmen: Kontenrahmen;
  beraternummer: string;
  mandantennummer: string;
  /** StB-Prüfung (B-4/B-6/B-9/B-10/B-11): abweichende Konten und Optionen der Kanzlei */
  kontenvorgaben?: Kontenvorgaben;
}
export const LEERE_STEUERBERATUNG: Steuerberatung = { kontenrahmen: "SKR03", beraternummer: "", mandantennummer: "" };

const imZeitraum = (iso: string, z: Zeitraum) => iso >= z.von && iso <= z.bis;
/** Ganzes Kalenderjahr (Jahrespaket) – dann enthält es dieselben Buchungen wie die Monats-/Quartalspakete */
const istJahr = (z: Zeitraum) => z.von.slice(5) === "01-01" && z.bis.slice(5) === "12-31" && z.von.slice(0, 4) === z.bis.slice(0, 4);
// Text, den Excel als Formel lesen würde (=, +, @, - ohne Zahl), bekommt ein Hochkomma davor; Beträge wie „-12,50“ bleiben
const entschaerft = (s: string) => (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-[\d.,]+$/.test(s)) ? `'${s}` : s);
const csvFeld = (roh: string) => {
  const s = entschaerft(roh);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (kopf: string[], zeilen: string[][]) => "﻿" + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(";")).join("\r\n") + "\r\n";

/**
 * E-200: Spalte einer Liste mit Beschreibung – dieselbe Definition ergibt die Kopfzeile der CSV-Dateien (Paket für die
 * Steuerberatung, Daten für die Betriebsprüfung) und die Feldbeschreibung im Export für die Betriebsprüfung.
 */
export interface Spalte {
  name: string;
  beschreibung: string;
}
export const kopfAus = (l: readonly Spalte[]) => l.map((x) => x.name);
const EURO = "Euro, Tausenderpunkt und Dezimalkomma";

/** Spalten der Rechnungsliste bzw. der Liste der Gutschriften (E-200: auch Feldbeschreibung). */
export function rechnungsSpalten(o: { gutschriften: boolean; bis: string; datei: boolean }): Spalte[] {
  return [
    { name: "Nummer", beschreibung: "Rechnungsnummer, wie auf der Rechnung" },
    { name: "Datum", beschreibung: "Rechnungsdatum (TT.MM.JJJJ)" },
    { name: "Leistungsdatum", beschreibung: "Tag der Leistung, wenn ein einzelner Tag angegeben ist" },
    { name: "Leistungszeitraum", beschreibung: "Leistungszeitraum, wie in der Rechnung eingetragen (leer, wenn er schon als Leistungsdatum dasteht)" },
    { name: o.gutschriften ? "Leistender (Empfänger der Gutschrift)" : "Kunde", beschreibung: o.gutschriften ? "Name des Leistenden, über dessen Leistung die Gutschrift abrechnet" : "Name des Rechnungsempfängers" },
    { name: o.gutschriften ? "USt-IdNr. Leistender" : "USt-IdNr. Kunde", beschreibung: "Umsatzsteuer-Identifikationsnummer, falls angegeben" },
    { name: "Steuerart", beschreibung: "wie in der Rechnung gewählt: Standard, igL (innergemeinschaftliche Lieferung), Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers), befreit, Nullsteuersatz (§ 12 Abs. 3 UStG) oder § 19 (Kleinunternehmer)" },
    { name: "Netto", beschreibung: `Summe der Entgelte (${EURO}; Stornorechnungen negativ)` },
    { name: "USt", beschreibung: `Umsatzsteuer (${EURO})` },
    { name: "Brutto", beschreibung: `Rechnungsbetrag (${EURO}); bei einer Schlussrechnung vor Abzug der Abschläge` },
    { name: "Steuersätze", beschreibung: "Steuersätze der Positionen" },
    { name: "Fällig am", beschreibung: "Fälligkeit aus dem Zahlungsziel (leer bei Stornorechnungen)" },
    { name: "Bezahlt am", beschreibung: "vermerkter Zahlungseingang" },
    { name: `Offener Betrag zum ${datumDe(o.bis)}`, beschreibung: "an diesem Tag laut Zahlungsvermerken noch offener Betrag (Schlussrechnung: nach Abzug der Abschläge; storniert: 0)" },
    { name: "Storno zu", beschreibung: "bei Stornorechnungen die Nummer der stornierten Rechnung" },
    ...(o.datei ? [{ name: "Datei", beschreibung: "Name der PDF-Datei der Rechnung im Ordner Rechnungen/" }] : []),
  ];
}

/** Spalten der Belegliste (E-200: auch Feldbeschreibung). */
export const BELEG_SPALTEN: readonly Spalte[] = [
  { name: `${MARKE.name}-Belegnr.`, beschreibung: "fortlaufende Belegnummer der App (z. B. B2026-001); bleibt vergeben, auch wenn der Beleg gelöscht oder als ungültig markiert wird" },
  { name: "Datum", beschreibung: "Belegdatum (TT.MM.JJJJ)" },
  { name: "Lieferant", beschreibung: "Aussteller des Belegs" },
  { name: "Belegnummer (Lieferant)", beschreibung: "Rechnungs- bzw. Belegnummer des Lieferanten" },
  { name: "Belegfeld 1 (DATEV)", beschreibung: "Belegkennung wie im DATEV-Buchungsstapel (Belegnummer des Lieferanten, ohne sie die Belegnummer der App)" },
  { name: "Kategorie", beschreibung: "Ausgabenkategorie in der App" },
  { name: "Zeile Anlage EÜR", beschreibung: "Zeile der Anlage EÜR, der die Kategorie in der App zugeordnet ist" },
  { name: "Konto (DATEV)", beschreibung: "Sachkonto im eingestellten Kontenrahmen" },
  { name: "Netto", beschreibung: `Nettobetrag (${EURO})` },
  { name: "USt", beschreibung: `Umsatzsteuer laut Beleg (${EURO})` },
  { name: "Vorsteuer", beschreibung: `davon als Vorsteuer angesetzt (${EURO})` },
  { name: "Brutto", beschreibung: `Bruttobetrag (${EURO})` },
  { name: "Steuersätze", beschreibung: "Steuersätze laut Beleg" },
  { name: "Zahlung", beschreibung: "Zahlungsweg (z. B. bar, Karte, Überweisung, privat)" },
  { name: "Zahltag (für EÜR verwendet)", beschreibung: "Tag der Zahlung; fehlt er, steht das Belegdatum mit Vermerk" },
  { name: "Datei", beschreibung: "Name bzw. Pfad der Originaldatei (Foto, PDF, E-Rechnung)" },
  { name: "Notiz", beschreibung: "Notiz zum Beleg" },
  { name: "Steuerschuldnerschaft", beschreibung: "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) mit Art und Steuerbetrag, falls angegeben" },
  { name: "Im Buchungsstapel", beschreibung: "ob der Beleg in den DATEV-Buchungsstapel der App geht" },
  { name: "Erfasst am", beschreibung: "Zeitpunkt der Erfassung in der App (TT.MM.JJJJ, HH:MM, deutsche Zeit)" },
  { name: "Festgeschrieben am", beschreibung: "Zeitpunkt der Festschreibung (danach Änderungen nur mit Grund)" },
  { name: "Änderungen (siehe Änderungsprotokoll)", beschreibung: "Anzahl früherer Fassungen; ihr Inhalt steht im Änderungsprotokoll" },
  { name: "Vorsteuerabzug", beschreibung: "voll, keine oder anteilig (mit Anteil bzw. abziehbarem Betrag)" },
];

/** Spalten der Liste der Kassenabschlüsse (E-200: auch Feldbeschreibung). */
export const KASSEN_SPALTEN: readonly Spalte[] = [
  { name: "Datum", beschreibung: "Geschäftstag (TT.MM.JJJJ)" },
  { name: "Standort/Kasse", beschreibung: "Betriebsstätte und Bezeichnung der Kasse" },
  { name: "Z-Bon", beschreibung: "Nummer des Tagesabschlusses (Z-Bon) bzw. „geschlossen“" },
  { name: "Umsatz 19 % brutto", beschreibung: `Umsatz zum Steuersatz 19 % (${EURO})` },
  { name: "Umsatz 7 % brutto", beschreibung: `Umsatz zum Steuersatz 7 % (${EURO})` },
  { name: "Umsatz 0 % brutto", beschreibung: `Umsatz zu 0 % (${EURO})` },
  { name: "Karte (mit Trinkgeld)", beschreibung: `Kartenzahlungen einschließlich Kartentrinkgeld (${EURO})` },
  { name: "davon Kartentrinkgeld (an Personal bar ausgezahlt)", beschreibung: `per Karte gezahltes, bar an das Personal ausgezahltes Trinkgeld (${EURO})` },
  { name: "App", beschreibung: `Zahlungen per App (${EURO})` },
  { name: "Auf Rechnung", beschreibung: `Umsatz auf Rechnung (${EURO})` },
  { name: "Gutscheine", beschreibung: "Verkauf und Einlösung von Gutscheinen (Art, Steuersatz, Betrag)" },
  { name: "Sonstige Zahlungsarten (ältere Daten)", beschreibung: `sonstige Zahlungsarten aus älteren App-Versionen (${EURO})` },
  { name: "Bar (Umsatz)", beschreibung: `Barumsatz (${EURO})` },
  { name: "Bar auf Rechnungen (kein Umsatz)", beschreibung: `bar kassierte Rechnungen – kein Umsatz des Tags (${EURO})` },
  { name: "Rechnungsnummern", beschreibung: "Nummern der bar kassierten Rechnungen" },
  { name: "Privatentnahme", beschreibung: `Privatentnahmen aus der Kasse (${EURO})` },
  { name: "Privateinlage", beschreibung: `Privateinlagen in die Kasse (${EURO})` },
  { name: "Geldtransit zur Bank", beschreibung: `Einzahlungen zur Bank (${EURO})` },
  { name: "Eigenbelege", beschreibung: "Nummern der Eigenbelege zu diesen Bewegungen" },
  { name: "Anfangsbestand", beschreibung: `Bargeldbestand zu Beginn des Tags (${EURO}; beim ersten Abschluss des Tags)` },
  { name: "Barausgaben (Belege)", beschreibung: `bar bezahlte Belege des Tags (${EURO})` },
  { name: "Bestand rechnerisch", beschreibung: `rechnerischer Bargeldbestand am Ende des Tags (${EURO}; beim letzten Abschluss des Tags)` },
  { name: "Bestand gezählt", beschreibung: `gezählter Bargeldbestand, falls gezählt (${EURO})` },
  { name: "Differenz", beschreibung: `Differenz zwischen gezähltem und rechnerischem Bestand (${EURO})` },
  { name: "Art", beschreibung: "„Kassenbericht (retrograd)“, wenn statt eines Z-Bons ein Kassenbericht erfasst ist" },
  { name: "TSE/Bediener", beschreibung: "Seriennummer der TSE, Transaktionsnummern und Bediener, falls angegeben" },
  { name: "Erfasst am", beschreibung: "Zeitpunkt der Erfassung in der App (TT.MM.JJJJ, HH:MM, deutsche Zeit)" },
  { name: "Festgeschrieben am", beschreibung: "Zeitpunkt der Festschreibung" },
  { name: "Nacherfasst", beschreibung: "Nacherfassung mit Anzahl der Tage nach dem Geschäftstag und Grund" },
  { name: "Korrigiert (Anzahl)", beschreibung: "Anzahl der Korrekturen" },
  { name: "Korrekturen (Zeitpunkt: Grund)", beschreibung: "Zeitpunkt und Grund jeder Korrektur; die Werte davor stehen im Änderungsprotokoll" },
];

/** Spalten des Änderungsprotokolls (E-200: auch Feldbeschreibung). */
export const PROTOKOLL_SPALTEN: readonly Spalte[] = [
  { name: "Zeitpunkt", beschreibung: "Zeitpunkt des Vorgangs (TT.MM.JJJJ, HH:MM, deutsche Zeit)" },
  { name: "Bereich", beschreibung: "Beleg, Kasse, Sachentnahme oder Rechnung" },
  { name: "Beleg/Tag", beschreibung: "Belegnummer, Lieferant und Datum, Geschäftstag bzw. Rechnungsnummer" },
  { name: "Vorgang", beschreibung: "Art des Vorgangs (geändert, korrigiert, gelöscht, als ungültig markiert, nacherfasst, Entwurf nach dem Teilen gelöscht, Korrektur bei der Zusammenführung nicht übernommen)" },
  { name: "Grund bzw. Inhalt", beschreibung: "Grund und die Werte bis zur Änderung; bei einer nicht übernommenen Korrektur deren Zeitpunkt (Uhr des Geräts), Gerät, Eingang beim Server und Grund, welche Fassung stattdessen gilt und warum, und der nicht übernommene Inhalt (vollständig auch in der Historie des Belegs bzw. als Konfliktkopie)" },
  // E-214 (Steuerberater 26.10.2026): Gerät und Eingang beim Server – bisher nur bei nicht übernommenen Korrekturen gefüllt
  { name: "Gerät", beschreibung: "Kennung des Geräts (letzte 8 Zeichen), auf dem die nicht übernommene Fassung entstand – zufällig je Gerät vergeben, ohne Bezug zu Person oder Gerätenummer; sonst leer" },
  { name: "Eingang beim Server", beschreibung: "Eingang der nicht übernommenen Fassung beim Synchronisationsserver: Version (Zähler des Servers, nimmt nur die jeweils nächste an) und Serverzeit (TT.MM.JJJJ, HH:MM, deutsche Zeit); „spätestens mit“: nur die obere Grenze bekannt; „ohne Eingang beim Server“: nicht über den Server synchronisiert (z. B. Sicherung oder Datei) – dann entschied die Uhr der Geräte. Sonst leer" },
];

/** E-214: Eingang beim Server für das Änderungsprotokoll */
const eingangDe = (e: ProtokollEintrag["eingang"]) => (e ? `${e.spaetestens ? "spätestens mit " : ""}Version ${e.version}${e.zeit ? `, ${zeitDe(e.zeit)}` : ""}` : "ohne Eingang beim Server");

/**
 * E-202 (Steuerberater, 26.10.2026): Kassenstürze (Zählprotokolle) als eigene Liste im Export für die Betriebsprüfung –
 * Aufzeichnungen nach § 147 Abs. 1 AO, nicht nur im Offenen Archiv.
 */
export const KASSENSTURZ_SPALTEN: readonly Spalte[] = [
  { name: "Nr.", beschreibung: "laufende Nummer der Zählung, nach Zeitpunkt" },
  { name: "Zeitpunkt", beschreibung: "Zeitpunkt der Zählung (TT.MM.JJJJ, HH:MM, deutsche Zeit)" },
  { name: "Standort", beschreibung: "Betriebsstätte bzw. Kasse, falls angegeben" },
  { name: "Gezählter Bestand", beschreibung: `gezählter Bargeldbestand (${EURO})` },
  { name: "Stückelung", beschreibung: "Anzahl je Schein und Münze (Wert: Anzahl), falls einzeln gezählt; die Summe ergibt den gezählten Bestand" },
  { name: "Endbestand letzter Abschluss", beschreibung: `Bargeldbestand laut letztem Tagesabschluss vor der Zählung (${EURO}) – zur Erläuterung; Barbelege und Bewegungen seit diesem Abschluss sind nicht berücksichtigt` },
  { name: "Anwesend", beschreibung: "wer gezählt hat bzw. wer anwesend war" },
  { name: "Notiz", beschreibung: "Bemerkung zur Zählung" },
];

/** E-202 (Steuerberater, 26.10.2026): Sachentnahmen (unentgeltliche Wertabgaben) als eigene Liste im Export für die Betriebsprüfung. */
export const SACHENTNAHME_SPALTEN: readonly Spalte[] = [
  { name: "Datum", beschreibung: "Tag der Buchung (TT.MM.JJJJ), z. B. Jahreswert zum 31.12. oder monatlich je ein Zwölftel" },
  { name: "Bemessungsgrundlage 7 %", beschreibung: `Wert der Entnahme zum ermäßigten Steuersatz, netto (${EURO})` },
  { name: "Umsatzsteuer 7 %", beschreibung: `darauf entfallende Umsatzsteuer (${EURO})` },
  { name: "Bemessungsgrundlage 19 %", beschreibung: `Wert der Entnahme zum Regelsteuersatz, netto (${EURO})` },
  { name: "Umsatzsteuer 19 %", beschreibung: `darauf entfallende Umsatzsteuer (${EURO})` },
  { name: "Bezeichnung", beschreibung: "Angabe des Betriebs, z. B. Pauschbetrag mit Jahr, Personen und Gewerbeklasse" },
  { name: "Erfasst am", beschreibung: "Zeitpunkt der Erfassung in der App (TT.MM.JJJJ, HH:MM, deutsche Zeit)" },
];

/** Spalten der Liste der ungültig markierten Belege (E-200: auch Feldbeschreibung). */
export const UNGUELTIG_SPALTEN: readonly Spalte[] = [
  { name: `${MARKE.name}-Belegnr.`, beschreibung: "Belegnummer der App" },
  { name: "Datum", beschreibung: "Belegdatum (TT.MM.JJJJ)" },
  { name: "Lieferant", beschreibung: "Aussteller des Belegs" },
  { name: "Brutto", beschreibung: `Bruttobetrag (${EURO})` },
  { name: "Ungültig seit", beschreibung: "Zeitpunkt, zu dem der Beleg als ungültig markiert wurde" },
  { name: "Grund", beschreibung: "Grund der Markierung" },
  { name: "Datei vorhanden", beschreibung: "ob eine Originaldatei vorliegt" },
];

/** Teil eines Dateinamens im Paket: Umlaute umgeschrieben („Söhne“ → „Soehne“), höchstens 60 Zeichen */
const sicher = (s: string) => dateinamenTeil(s, 60, "._-") || "ohne-name";
/** Nummern wie „2026-002“ und „2026-010“ in natürlicher Reihenfolge */
const nachNummer = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true });

const STEUERART_TEXT: Record<NonNullable<RechnungsDaten["steuerart"]>, string> = { standard: "Standard", igl: "igL", reverse_charge: "Reverse Charge", befreit: "befreit", nullsatz: "Nullsteuersatz (§ 12 Abs. 3 UStG)" };
/** Steuerart einer Rechnung für die Listen: Standard, igL, Reverse Charge, § 19 oder befreit */
const steuerartText = (d: RechnungsDaten) => (d.kleinunternehmer ? "§ 19" : STEUERART_TEXT[d.steuerart ?? "standard"]);

/** Dateiname der Belegdatei im Paket: AmtlosNr_Datum_Lieferant_Nummer.endung (Nummer normalisiert wie in DATEV und Belegliste) */
export const belegDateiname = (b: Beleg, amtlosNr = "") => {
  const nr = belegnummerNormal(b.nummer);
  return `${amtlosNr ? `${amtlosNr}_` : ""}${b.datum}_${sicher(b.lieferant)}${nr ? `_${nr}` : ""}.${(b.datei ?? "").split(".").pop() || "bin"}`;
};

/** Dateiname des Rechnungs-PDFs im Paket: Nummer_Kunde.pdf */
export const rechnungDateiname = (nummer: string, kunde: string) => `${sicher(nummer)}_${dateinamenTeil(kunde, 40, "._-") || "ohne-name"}.pdf`;

/** Offener Betrag einer Rechnung zum Stichtag: ohne Zahlungseingang bis dahin, nicht storniert, keine Stornorechnung. */
function offenAm(s: Stand, u: Unterlage, bis: string, brutto: number): number {
  if (istStorno(u) || (u.bezahlt && u.bezahlt <= bis)) return 0;
  // R12: Teilzahlungen und Minderungen bis zum Stichtag
  if (u.zahlungen?.length) {
    const storno0 = u.storniertDurch ? s.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
    if (storno0 && String(storno0.daten.datum) <= bis) return 0;
    return Math.max(0, brutto - u.zahlungen.filter((z) => z.datum <= bis).reduce((a, z) => a + z.betrag_cent + (z.minderung_cent ?? 0), 0));
  }
  const storno = u.storniertDurch ? s.unterlagen.find((x) => x.id === u.storniertDurch) : undefined;
  if (storno && String(storno.daten.datum) <= bis) return 0;
  return brutto;
}

/** Leistungszeitraum, wie in der Rechnung eingetragen – nur wenn er nicht schon als Leistungsdatum dasteht. */
function leistungszeitraum(u: Unterlage, leistungsdatum: string | null | undefined): string {
  if (u.daten.leistung_gleich === true) return "";
  const t = typeof u.daten.leistung === "string" ? u.daten.leistung.replace(/\s+/g, " ").trim() : "";
  return leistungsdatum && t === datumDe(leistungsdatum) ? "" : t;
}

/**
 * Rechnungsliste (ohne Gutschriften) bzw. mit `gutschriften` die Liste der Gutschriften – gleiche Spalten. Sortiert nach
 * Datum und Nummer; am Ende Summenzeilen je Steuersatz („Summe 19 %“ …) und „Summe gesamt“. Mit `pdfs` (Rechnungs-ID →
 * Dateiname im Paket) zusätzlich die Spalte „Datei“.
 */
export function rechnungenCsv(s: Stand, z: Zeitraum, gutschriften = false, pdfs?: Map<string, string>): string {
  const summe = new Map<string, { netto: number; ust: number; brutto: number }>();
  let offenGesamt = 0;
  const zeilen = gestellteRechnungen(s)
    .filter((u) => istGutschrift(u) === gutschriften && imZeitraum(String(u.daten.datum), z))
    .sort((a, b) => String(a.daten.datum).localeCompare(String(b.daten.datum)) || nachNummer(String(a.daten.nummer ?? ""), String(b.daten.nummer ?? "")))
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
      const sm = summen(daten.positionen, daten.kleinunternehmer);
      const vz = istStorno(u) ? -1 : 1;
      const art = steuerartText(daten);
      for (const g of sm.gruppen) {
        const schluessel = g.satz === null ? "§ 19" : `${g.satz} %${g.satz === 0 && art !== "Standard" ? ` (${art})` : ""}`;
        const w = summe.get(schluessel) ?? { netto: 0, ust: 0, brutto: 0 };
        w.netto += vz * g.netto_cent;
        w.ust += vz * g.ust_cent;
        w.brutto += vz * (g.netto_cent + g.ust_cent);
        summe.set(schluessel, w);
      }
      // Schlussrechnung: offen ist höchstens der Zahlbetrag (Rechnungsbetrag abzüglich Abschläge)
      const offen = offenAm(s, u, z.bis, vz * zahlbetrag(daten));
      offenGesamt += offen;
      const saetze = sm.gruppen.map((g) => (g.satz === null ? "§ 19" : `${g.satz} %`)).join(", ");
      return [
        daten.nummer,
        datumDe(daten.rechnungsdatum),
        daten.leistungsdatum ? datumDe(daten.leistungsdatum) : "",
        leistungszeitraum(u, daten.leistungsdatum),
        daten.kunde.name,
        daten.kunde.ust_idnr ?? "",
        art,
        betrag(vz * sm.netto_cent),
        betrag(vz * sm.ust_cent),
        betrag(vz * sm.brutto_cent),
        saetze,
        daten.faellig_am && !istStorno(u) ? datumDe(daten.faellig_am) : "",
        u.bezahlt ? datumDe(u.bezahlt) : "",
        betrag(offen),
        istStorno(u) ? String(u.daten.storno_zu) : "",
        ...(pdfs ? [pdfs.get(u.id) ?? ""] : []),
      ];
    });
  const leer = (n: number) => new Array<string>(n).fill("");
  const breite = 15 + (pdfs ? 1 : 0);
  const summenZeile = (titel: string, satz: string, w: { netto: number; ust: number; brutto: number }, offen = "") => {
    const r = leer(breite);
    r[0] = titel;
    r[7] = betrag(w.netto);
    r[8] = betrag(w.ust);
    r[9] = betrag(w.brutto);
    r[10] = satz;
    r[13] = offen;
    return r;
  };
  const gesamt = { netto: 0, ust: 0, brutto: 0 };
  const summenZeilen = [...summe]
    .sort(([a], [b]) => nachNummer(b, a))
    .map(([satz, w]) => {
      gesamt.netto += w.netto;
      gesamt.ust += w.ust;
      gesamt.brutto += w.brutto;
      return summenZeile(`Summe ${satz}`, satz, w);
    });
  if (zeilen.length) summenZeilen.push(summenZeile("Summe gesamt", "", gesamt, betrag(offenGesamt)));
  return csv(
    kopfAus(rechnungsSpalten({ gutschriften, bis: z.bis, datei: Boolean(pdfs) })),
    [...zeilen, ...summenZeilen],
  );
}

/** E-165: Vorsteuerabzug eines Belegs als Text für die Belegliste */
function vorsteuerText(b: Beleg, ust: number, vorsteuer: number): string {
  if (!ust && !b.steuerschuld) return "";
  if (!b.vorsteuer) return "keine";
  if (!belegTeilabzug(b)) return "voll";
  return b.vorsteuer_betrag_cent ? `anteilig: ${betrag(b.vorsteuer_betrag_cent)} € abziehbar` : `anteilig: ${String(b.vorsteuer_anteil).replace(".", ",")} % (${betrag(vorsteuer)} € abziehbar)`;
}

/** Belege des Zeitraums nach Belegdatum, bei gleichem Datum in der Reihenfolge der Erfassung. */
const belegeImZeitraum = (s: Stand, z: Zeitraum) => s.belege.filter((b) => imZeitraum(b.datum, z)).sort((a, b) => a.datum.localeCompare(b.datum) || a.erstellt.localeCompare(b.erstellt) || a.id.localeCompare(b.id));

/** Belegkategorien, bei denen ein Beleg ohne Umsatzsteuer auf § 13b UStG hindeuten kann (Frage im Paket). */
const STEUERSCHULD_KATEGORIEN = ["waren", "fremdleistungen", "buero", "werbung", "sonstiges"];

/** Hinweis in der Belegliste, wenn der Zahltag fehlt und die EÜR das Belegdatum nimmt */
export const ZAHLTAG_FEHLT = "fehlt – Belegdatum verwendet";

/**
 * Belegliste mit Amtlos-Belegnummer, Belegfeld 1 wie im DATEV-Stapel, Aufwandskonto, Zahltag (für die EÜR) und einer
 * Summenzeile am Ende. `nummern` aus `belegNummern([...s.belege, ...s.belegArchiv])` – ohne Angabe selbst abgeleitet.
 */
export function belegeCsv(s: Stand, z: Zeitraum, dateinamen: Map<string, string> = new Map(), kontenrahmen: Kontenrahmen = s.steuerberatung.kontenrahmen, nummern: Map<string, string> = belegNummern([...s.belege, ...s.belegArchiv]), ku: boolean = istKleinunternehmer(s)): string {
  const summe = { netto: 0, ust: 0, vorsteuer: 0, brutto: 0 };
  const zeilen = belegeImZeitraum(s, z).map((b) => {
    const sm = belegSummen(b);
    summe.netto += sm.netto_cent;
    summe.ust += sm.ust_cent;
    summe.vorsteuer += sm.vorsteuer_cent;
    summe.brutto += sm.brutto_cent;
    const kat = kategorieFuer(b.kategorie);
    const konten = kontenrahmen === "SKR03" ? kat.skr03 : kat.skr04;
    // dasselbe Sachkonto wie im Stapel (auch § 13b-Konten, Kontenvorgaben) – seit A-1 im Feld „Gegenkonto“; Belege,
    // die nicht in den Stapel gehen, mit Vermerk
    const imStapel = belegImStapel(b, { kapitalgesellschaft: kapitalgesellschaft(s) });
    const gebucht = buchungenAusBelegen([b], kontenrahmen, { kleinunternehmer: ku, vorgaben: s.steuerberatung.kontenvorgaben }).map((x) => x.gegenkonto);
    const konto = [...new Set(gebucht.length ? gebucht : b.steuer.filter((x) => x.brutto_cent).map((x) => konten[x.satz] ?? konten[19] ?? ""))].join(", ");
    const nr = nummern.get(b.id) ?? "";
    return [
      nr,
      datumDe(b.datum),
      b.lieferant,
      belegnummerNormal(b.nummer),
      belegKennung(b, nr),
      kat.titel,
      kat.euer,
      konto,
      betrag(sm.netto_cent),
      betrag(sm.ust_cent),
      betrag(sm.vorsteuer_cent),
      betrag(sm.brutto_cent),
      b.steuer.map((x) => `${x.satz} %`).join(", "),
      ZAHLUNGSWEGE.find((w) => w.wert === b.zahlung)?.text ?? b.zahlung,
      b.bezahlt ? datumDe(b.bezahlt) : `${datumDe(b.datum)} (${ZAHLTAG_FEHLT})`,
      dateinamen.get(b.id) ?? "",
      (b.notiz ?? "").replace(/\s+/g, " "),
      b.steuerschuld ? `§ 13b (${b.steuerschuld === "eu" ? "sonstige Leistung EU" : "Bauleistung Inland"}), Steuer ${betrag(steuerschuldBetrag(b))}` : "",
      imStapel ? (b.zahlung === "privat" && kapitalgesellschaft(s) ? "ja – Verrechnungskonto Gesellschafter" : "ja") : "nein – Lohnbuchhaltung",
      // R12 GoBD: Erfassung, Festschreibung, Änderungen
      zeitDe(b.erstellt),
      b.festgeschrieben ? zeitDe(b.festgeschrieben) : "",
      String(b.historie?.length ?? 0),
      // E-165: Vorsteuer-Teilabzug (§ 15 Abs. 4 UStG) – Anteil bzw. Betrag; „voll“, „keine“ bei Steuer ohne Abzug
      vorsteuerText(b, sm.ust_cent, sm.vorsteuer_cent),
    ];
  });
  const summenZeile = ["Summe", "", "", "", "", "", "", "", betrag(summe.netto), betrag(summe.ust), betrag(summe.vorsteuer), betrag(summe.brutto), "", "", "", "", "", "", "", "", "", "", ""];
  return csv(
    kopfAus(BELEG_SPALTEN),
    zeilen.length ? [...zeilen, summenZeile] : [],
  );
}

/**
 * R12: Kassenabschlüsse des Zeitraums als Liste – je Abschluss Umsatz je Steuersatz, Zahlungsarten, Bewegungen,
 * Bargeldbestand, Zählung und Korrekturen; am Ende eine Summenzeile.
 */
export function kassenCsv(s: Stand, z: Zeitraum): string {
  // je Standort ein eigener Verlauf
  const tagJe = new Map<string, ReturnType<typeof kassenVerlauf>["tage"][number]>();
  for (const st of new Set(s.kasse.map(standortVon))) for (const t of kassenVerlauf(s.kasse, s.belege, st).tage) tagJe.set(`${st}|${t.datum}`, t);
  const summe = { b19: 0, b7: 0, b0: 0, karte: 0, trinkgeld: 0, app: 0, aufrechnung: 0, gs: 0, sonstige: 0, bar: 0, rechnungen: 0, entnahmen: 0, einlagen: 0, transit: 0, ausgaben: 0 };
  const zeilen = s.kasse
    .filter((k) => imZeitraum(k.datum, z))
    .map((k) => {
      const sm = kassenSummen(k);
      const je = (satz: number) => (k.geschlossen ? 0 : k.umsatz.filter((u) => u.satz === satz).reduce((a, u) => a + u.brutto_cent, 0));
      summe.b19 += je(19);
      summe.b7 += je(7);
      summe.b0 += je(0);
      summe.karte += sm.karte;
      summe.trinkgeld += sm.trinkgeld;
      summe.app += sm.app;
      summe.aufrechnung += sm.aufrechnung;
      summe.gs += sm.gsVerkaufEz + sm.gsVerkaufMz - sm.gsEinlEz - sm.gsEinlMz;
      summe.sonstige += sm.sonstige;
      summe.bar += sm.bar;
      summe.rechnungen += sm.rechnungen;
      summe.entnahmen += sm.entnahmen;
      summe.einlagen += sm.einlagen;
      summe.transit += sm.transit;
      const t = tagJe.get(`${standortVon(k)}|${k.datum}`);
      const letzter = t && t.abschluesse[t.abschluesse.length - 1]?.id === k.id;
      const erster = t && t.abschluesse[0]?.id === k.id;
      if (erster && t) summe.ausgaben += t.ausgabenBar;
      const gs = (k.gutscheine ?? []).map((g) => `${g.vorgang === "verkauf" ? "Verkauf" : "Einlösung"} ${g.art === "einzweck" ? `Einzweck ${g.satz ?? 19} %` : "Mehrzweck"} ${betrag(g.betrag_cent)}`).join(", ");
      const nach = nacherfasstTage(k.datum, k.erstellt);
      return [
        datumDe(k.datum),
        [standortVon(k), k.kasse_bez ?? ""].filter(Boolean).join(" · "),
        k.geschlossen ? "geschlossen" : (k.zbon ?? ""),
        betrag(je(19)),
        betrag(je(7)),
        betrag(je(0)),
        betrag(sm.karte),
        betrag(sm.trinkgeld),
        betrag(sm.app),
        betrag(sm.aufrechnung),
        gs,
        betrag(sm.sonstige),
        betrag(sm.bar),
        betrag(sm.rechnungen),
        (k.rechnungen_bar ?? []).map((r) => r.nummer).join(", "),
        betrag(sm.entnahmen),
        betrag(sm.einlagen),
        betrag(sm.transit),
        k.bewegungen.map((b) => b.beleg_nr ?? "").filter(Boolean).join(", "),
        erster && t ? betrag(t.anfang) : "",
        erster && t ? betrag(t.ausgabenBar) : "",
        letzter && t ? betrag(t.soll) : "",
        letzter && t && t.gezaehlt !== null ? betrag(t.gezaehlt) : "",
        letzter && t && t.differenz ? betrag(t.differenz) : "",
        k.kassenbericht ? "Kassenbericht (retrograd)" : "",
        [k.tse_seriennr ? `TSE ${k.tse_seriennr}` : "", k.tse_von || k.tse_bis ? `TA ${k.tse_von ?? ""}–${k.tse_bis ?? ""}` : "", k.bediener ? `Bediener ${k.bediener}` : ""].filter(Boolean).join(", "),
        zeitDe(k.erstellt),
        k.festgeschrieben ? zeitDe(k.festgeschrieben) : "",
        nach ? `nacherfasst (${nach} Tage)${k.nacherfasst_grund ? `: ${k.nacherfasst_grund}` : ""}` : "",
        String((k.historie ?? []).length),
        (k.historie ?? []).map((h) => `${zeitDe(h.bis)}: ${h.grund}`).join(" | "),
      ];
    });
  const sz = ["Summe", "", "", betrag(summe.b19), betrag(summe.b7), betrag(summe.b0), betrag(summe.karte), betrag(summe.trinkgeld), betrag(summe.app), betrag(summe.aufrechnung), `Saldo ${betrag(summe.gs)}`, betrag(summe.sonstige), betrag(summe.bar), betrag(summe.rechnungen), "", betrag(summe.entnahmen), betrag(summe.einlagen), betrag(summe.transit), "", "", betrag(summe.ausgaben), "", "", "", "", "", "", "", "", "", ""];
  return csv(
    kopfAus(KASSEN_SPALTEN),
    zeilen.length ? [...zeilen, sz] : [],
  );
}

/**
 * R12 GoBD: Änderungsprotokoll eines Zeitraums – frühere Fassungen der Belege (mit Grund nach der Festschreibung),
 * Korrekturen der Kassenabschlüsse, Löschungen und ungültig markierte Belege, Sachentnahmen. Nach Zeitpunkt.
 */
export function aenderungsprotokoll(s: Stand, z: Zeitraum): string[][] {
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  const zeilen: { t: string; z: string[] }[] = [];
  const bez = (b: Beleg) => `${nummern.get(b.id) ?? ""} ${b.lieferant.trim()} ${datumDe(b.datum)}`.trim();
  // E-214: nicht übernommene Korrekturen stehen mit eigenem Eintrag (Zeitpunkt der Zusammenführung) unten
  const imProtokoll = new Set(s.protokoll.filter((p) => p.art === "korrektur_nicht_uebernommen" && p.fassung_bis).map((p) => `${p.bezug}|${p.fassung_bis}`));
  for (const b of [...s.belege, ...s.belegArchiv]) {
    if (!imZeitraum(b.datum, z) && !(b.historie ?? []).some((h) => imZeitraum(h.datum, z))) continue;
    for (const h of b.historie ?? []) {
      if (h.grund === BELEG_KONFLIKT_GRUND) {
        if (imProtokoll.has(`${b.id}|${h.bis}`)) continue;
        zeilen.push({ t: h.bis, z: [zeitDe(h.bis), "Beleg", bez(b), "Korrektur bei der Zusammenführung nicht übernommen", `${h.korrektur_grund ? `Grund der Korrektur: ${h.korrektur_grund} · ` : ""}${h.vorrang === "eingang" ? "die geltende Korrektur ging später beim Server ein" : "nach der Uhr der Geräte"} · nicht übernommen: ${datumDe(h.datum)}, ${h.lieferant}, ${betrag(h.steuer.reduce((a, x) => a + x.brutto_cent, 0))} € brutto, ${h.kategorie}`, h.geraet ? h.geraet.slice(-8) : "", eingangDe(h.eingang ?? undefined)] });
        continue;
      }
      zeilen.push({ t: h.bis, z: [zeitDe(h.bis), "Beleg", bez(b), h.grund ? "nach der Festschreibung geändert" : "geändert (frühere Fassung)", `${h.grund ? `Grund: ${h.grund} · ` : ""}bis dahin: ${datumDe(h.datum)}, ${h.lieferant}, ${betrag(h.steuer.reduce((a, x) => a + x.brutto_cent, 0))} € brutto, ${h.kategorie}`, "", ""] });
    }
  }
  for (const k of s.kasse) {
    if (!imZeitraum(k.datum, z)) continue;
    for (const h of k.historie ?? []) zeilen.push({ t: h.bis, z: [zeitDe(h.bis), "Kasse", `${datumDe(k.datum)}${k.zbon ? ` Z ${k.zbon}` : ""}`, "Tagesabschluss korrigiert", `Grund: ${h.grund} · bis dahin Umsatz ${betrag(kassenSummen(h).brutto)} €, Karte ${betrag(kassenSummen(h).karte)} €`, "", ""] });
    const n = nacherfasstTage(k.datum, k.erstellt);
    if (n) zeilen.push({ t: k.erstellt, z: [zeitDe(k.erstellt), "Kasse", `${datumDe(k.datum)}${k.zbon ? ` Z ${k.zbon}` : ""}`, `nacherfasst (${n} Tage nach dem Geschäftstag)`, k.nacherfasst_grund ?? "", "", ""] });
  }
  // E-200: nach dem Teilen gelöschter, nicht als verschickt bestätigter Entwurf – Nummer bleibt vergeben (Lücke)
  const artText: Record<ProtokollEintrag["art"], [string, string]> = { beleg_geloescht: ["Beleg", "endgültig gelöscht"], beleg_ungueltig: ["Beleg", "als ungültig markiert"], beleg_korrigiert: ["Beleg", "Korrektur nach der Festschreibung"], sachentnahme_geloescht: ["Sachentnahme", "gelöscht"], entwurf_geloescht: ["Rechnung", "Entwurf nach dem Teilen gelöscht (Nummer bleibt vergeben)"], korrektur_nicht_uebernommen: ["Beleg", "Korrektur bei der Zusammenführung nicht übernommen"] };
  for (const p of s.protokoll) {
    if (p.zeitpunkt.slice(0, 10) < z.von || p.zeitpunkt.slice(0, 10) > tagNach(z.bis, 400)) continue;
    // Korrekturen stehen schon mit der früheren Fassung oben
    if (p.art === "beleg_korrigiert") continue;
    const bereich = (p.art === "entwurf_geloescht" || p.art === "korrektur_nicht_uebernommen") && p.vorlage && p.vorlage !== "rechnung" ? (vorlageFuer(p.vorlage)?.titel ?? p.vorlage) : p.art === "korrektur_nicht_uebernommen" && p.vorlage === "rechnung" ? "Rechnung" : artText[p.art][0];
    const nu = p.art === "korrektur_nicht_uebernommen";
    zeilen.push({ t: p.zeitpunkt, z: [zeitDe(p.zeitpunkt), bereich, p.nr ?? p.bezug, artText[p.art][1], p.text, nu && p.geraet ? p.geraet.slice(-8) : "", nu && !p.vorlage ? eingangDe(p.eingang) : ""] });
  }
  return zeilen.sort((a, b) => a.t.localeCompare(b.t)).map((x) => x.z);
}
const tagNach = (iso: string, n: number) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);

/** Gutschein in einer Position zu 0 % (R11, Kosmetik #5) – keine Kleinunternehmer-Rechnung, keine Gutschrift. */
function gutscheinZuNullU(u: Unterlage, betrieb: Betrieb): boolean {
  if (istGutschrift(u)) return false;
  const { daten } = eRechnungAus(u.daten, betrieb);
  return !daten.kleinunternehmer && daten.positionen.some((p) => p.ust_satz === 0 && /gutschein/i.test(p.bezeichnung));
}

/** LIESMICH (R11): wohin die § 13b-Belege im Stapel gebucht sind – mit bzw. ohne Vorsteuerabzug. */
function steuerschuldSatz(belege: Beleg[], kontenrahmen: Kontenrahmen, ku: boolean): string {
  const l = belege.filter((b) => b.steuerschuld);
  const mit = l.filter((b) => b.vorsteuer && !ku).length;
  const ohne = l.length - mit;
  const k = KONTEN_13B[kontenrahmen];
  const teile = [
    mit ? `mit Vorsteuerabzug auf ${k.mit.bau} (Bauleistung Inland) bzw. ${k.mit.eu} (sonstige Leistung EU)` : "",
    ohne ? `ohne Vorsteuerabzug${ku ? " (Kleinunternehmer)" : ""} auf ${k.ohne.bau} bzw. ${k.ohne.eu} (nur Umsatzsteuer)` : "",
  ].filter(Boolean);
  return `${l.length} ${l.length === 1 ? "Beleg" : "Belege"} mit Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) – im Stapel ${teile.join(", ")}. Kontonummern bitte gegen den Kontenrahmen prüfen.`;
}

/** Grund, warum eine Rechnung keine E-Rechnung im Paket hat – Privatkunde (nur die E-Mail fehlt) oder fehlende Angaben. */
export function grundOhneXml(fehlt: string[], kundeUstId: string | null | undefined): string {
  if (fehlt.length === 1 && fehlt[0] === "E-Mail des Empfängers" && !kundeUstId) return "Privatkunde (ohne E-Mail erfasst) – keine E-Rechnung nötig; falls Unternehmen: E-Mail ergänzen";
  return `Angaben fehlen: ${fehlt.join(", ")}`;
}

/**
 * Fragen an den Betrieb, die sich aus den Daten ergeben – nur Sachverhalte, keine steuerliche Bewertung. Abschnitte ohne
 * Einträge entfallen; ohne Fragen ein Satz „Keine offenen Punkte“.
 */
export function fragenText(s: Stand, z: Zeitraum, nummern: Map<string, string> = belegNummern([...s.belege, ...s.belegArchiv])): { text: string; anzahl: number } {
  const belege = belegeImZeitraum(s, z);
  const bz = (b: Beleg, zusatz = "") => `- ${nummern.get(b.id) ?? ""} · ${datumDe(b.datum)} · ${b.lieferant.trim() || "ohne Lieferant"} · ${betrag(belegSummen(b).brutto_cent)} € brutto${b.notiz ? ` · Notiz: ${b.notiz.replace(/\s+/g, " ").trim()}` : ""}${zusatz}`;
  const rz = (u: Unterlage, zusatz = "") => {
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    const sm = summen(daten.positionen, daten.kleinunternehmer);
    return `- ${daten.nummer} · ${datumDe(daten.rechnungsdatum)} · ${daten.kunde.name || "ohne Namen"} · ${betrag((istStorno(u) ? -1 : 1) * sm.brutto_cent)} € brutto${zusatz}`;
  };
  const abschnitte: { titel: string; zeilen: string[] }[] = [];
  const dazu = (titel: string, zeilen: string[]) => zeilen.length && abschnitte.push({ titel, zeilen });

  dazu("Belege mit Zahlungsweg Überweisung/Karte ohne Zahltag – für die EÜR wurde das Belegdatum verwendet. Wann wurde bezahlt?", belege.filter((b) => b.zahlung === "bank" && !b.bezahlt).map((b) => bz(b)));
  // E-221 Befund 3: Rechnungen in fremder Währung – Originalbetrag, Euro-Betrag und Kurs zum Prüfen
  dazu(
    "Belege aus Rechnungen in fremder Währung (umgerechnet nach § 16 Abs. 6 UStG; ohne Euro-Betrag zählen sie noch nirgends mit): Stimmen Euro-Betrag und Kurs?",
    belege.filter((b) => b.fremd).map((b) => bz(b, ` · Original ${fremdBetragText(b.fremd!.steuer.reduce((a, x) => a + x.brutto_cent, 0), b.fremd!.waehrung)}${b.fremd!.kurs ? ` · Kurs 1 € = ${String(b.fremd!.kurs).replace(".", ",")} ${b.fremd!.waehrung}${b.fremd!.kurs_datum ? ` (${datumDe(b.fremd!.kurs_datum)})` : ""}` : " · ohne Kurs"}${belegSummen(b).brutto_cent ? "" : " · EURO-BETRAG FEHLT"}`)),
  );
  dazu(`Belege ohne Belegnummer des Lieferanten – im Buchungsstapel steht die ${MARKE.name}-Belegnummer. Hat der Beleg eine Nummer?`, belege.filter((b) => !belegnummerNormal(b.nummer)).map((b) => bz(b)));
  const offen = gestellteRechnungen(s)
    .filter((u) => !istGutschrift(u) && String(u.daten.datum) <= z.bis)
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
      return { u, daten, offen: offenAm(s, u, z.bis, zahlbetrag(daten)) };
    })
    .filter((x) => x.offen)
    .sort((a, b) => a.daten.rechnungsdatum.localeCompare(b.daten.rechnungsdatum) || nachNummer(a.daten.nummer, b.daten.nummer));
  dazu(
    `Rechnungen ohne vermerkten Zahlungseingang zum ${datumDe(z.bis)}:`,
    offen.map((x) => rz(x.u, `${x.daten.faellig_am ? ` · fällig ${datumDe(x.daten.faellig_am)}` : ""}${x.u.bezahlt ? ` · bezahlt erst am ${datumDe(x.u.bezahlt)}` : ""}${x.daten.rechnungsdatum < z.von ? " · aus früherem Zeitraum" : ""}`)),
  );
  dazu(
    kapitalgesellschaft(s) ? `Privat ausgelegte Belege (Kapitalgesellschaft – im Buchungsstapel auf dem Verrechnungskonto Gesellschafter ${kontenFuer(s.steuerberatung.kontenrahmen, s.steuerberatung.kontenvorgaben).verrechnungGesellschafter}): Wer hat ausgelegt – passt das Konto?` : "Privat bezahlte Belege (Zahlungsweg „privat bezahlt“):",
    belege.filter((b) => b.zahlung === "privat").map((b) => bz(b)),
  );
  dazu(
    "Rechnungen über Gutscheine zu 0 % (nicht im Buchungsstapel): Einzweck-Gutschein (Leistung und Steuersatz stehen beim Verkauf fest, Umsatzsteuer schon bei Ausgabe, § 3 Abs. 14 UStG) oder Mehrzweck-Gutschein (Umsatzsteuer erst bei Einlösung, § 3 Abs. 15 UStG)?",
    gestellteRechnungen(s).filter((u) => imZeitraum(String(u.daten.datum), z) && gutscheinZuNullU(u, s.betrieb)).map((u) => rz(u)),
  );
  // R12: Barbelege ab dem ersten Kassenabschluss stehen im Kassenbuch der App – nur die übrigen sind eine Frage
  const ab = kasseAb(s.kasse);
  dazu(
    kapitalgesellschaft(s) ? `Bar bezahlte Belege ohne Kassenbuch in ${MARKE.name} (im Stapel gegen das Verrechnungskonto Gesellschafter): Aus welcher Kasse wurde bezahlt – von einer Gesellschafterin ausgelegt oder aus einer Geschäftskasse mit Kassenbuch (bitte liefern)?` : `Bar bezahlte Belege ohne Kassenbuch in ${MARKE.name} (im Stapel gegen Privateinlage – aus eigener Tasche bezahlt): Stimmt das, oder wurde aus einer Geschäftskasse mit eigenem Kassenbuch bezahlt (bitte liefern)?`,
    belege.filter((b) => b.zahlung === "bar" && belegImStapel(b, { kapitalgesellschaft: kapitalgesellschaft(s) }) && !(ab && zahltag(b) >= ab)).map((b) => bz(b)),
  );
  const kz = s.kasse.filter((k) => imZeitraum(k.datum, z));
  const luecken = zbonLuecken(kz);
  if (luecken.length) dazu("Z-Bon-Nummern fehlen in der Folge der Kassenabschlüsse – gibt es dafür Tagesabschlüsse (z. B. Testbons, zweite Kasse)?", [`- ${luecken.slice(0, 20).join(", ")}${luecken.length > 20 ? " …" : ""}`]);
  const diffs = kassenWarnungen(s.kasse, s.belege).differenzen.filter((d) => imZeitraum(d.datum, z));
  if (diffs.length) dazu(`Kassendifferenzen laut Zählung (gebucht: Überschuss ${kontenFuer(s.steuerberatung.kontenrahmen, s.steuerberatung.kontenvorgaben).kassendifferenzErtrag ? "als sonstiger Ertrag ohne Umsatzsteuer" : "als Erlös 19 %"}, Fehlbetrag als Aufwand) – Ursache, und passt die Buchung?`, diffs.map((d) => `- ${datumDe(d.datum)}${d.standort ? ` · ${d.standort}` : ""} · ${betrag(d.cent)} €`));
  dazu("Kfz-Kosten: Fahrzeug und privater Anteil?", belege.filter((b) => b.kategorie === "fahrzeug").map((b) => bz(b)));
  dazu("Bewirtung: Anlass und Teilnehmer?", belege.filter((b) => b.kategorie === "bewirtung").map((b) => bz(b)));
  dazu(
    "Anschaffungen über 800 € netto: Was wurde angeschafft, Nutzungsdauer? (Computerhardware und Software: auch 1 Jahr möglich, BMF 22.02.2022)",
    // Kategorie „Anschaffung über 800 €“ oder als GWG erfasst, aber über 800 € netto
    belege.filter((b) => kategorieFuer(b.kategorie).anlage || (b.kategorie === "gwg" && belegSummen(b).netto_cent > 80000)).map((b) => bz(b, ` · ${betrag(belegSummen(b).netto_cent)} € netto · Kategorie „${kategorieFuer(b.kategorie).titel}“`)),
  );
  dazu(
    "Gutschriften (der Betrieb rechnet als Leistungsempfänger ab; im Stapel als Aufwand „bezogene Leistungen“). Art der Leistung – passt das Konto?",
    gestellteRechnungen(s).filter((u) => istGutschrift(u) && imZeitraum(String(u.daten.datum), z)).map((u) => rz(u, u.bezahlt ? ` · bezahlt am ${datumDe(u.bezahlt)}` : " · ohne Zahlungsvermerk")),
  );
  const stornoZeilen: string[] = [];
  for (const u of gestellteRechnungen(s)) {
    const datum = String(u.daten.datum);
    if (istStorno(u) && imZeitraum(datum, z)) {
      const orig = typeof u.daten.storno_zu_datum === "string" ? u.daten.storno_zu_datum : "";
      if (orig && !imZeitraum(orig, z)) stornoZeilen.push(rz(u, ` · storniert RE ${String(u.daten.storno_zu)} vom ${datumDe(orig)} (anderer Zeitraum)`));
    } else if (!istStorno(u) && u.storniertDurch && imZeitraum(datum, z)) {
      const st = s.unterlagen.find((x) => x.id === u.storniertDurch);
      const sd = st && typeof st.daten.datum === "string" ? st.daten.datum : "";
      if (st?.festgeschrieben && sd && !imZeitraum(sd, z)) stornoZeilen.push(rz(u, ` · storniert durch ${String(st.daten.nummer ?? "")} vom ${datumDe(sd)} (anderer Zeitraum)`));
    }
  }
  dazu("Stornos mit Bezug zu einem anderen Zeitraum – gibt es eine Ersatzrechnung, und in welchem Zeitraum?", stornoZeilen);
  // steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8–29 UStG) und Belege mit Vorsteuer: abziehbar nur, soweit sie nicht diesen Umsätzen dienen
  const kz48 = umsatzRechnungen(s).some((u) => {
    if (!imZeitraum(String(u.daten.datum), z)) return false;
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    return daten.steuerart === "befreit" && kennzahlBefreiung(daten.befreiungsgrund) === "48";
  });
  if (kz48) dazu(`${VORSTEUER_AUFTEILEN} Belege mit Vorsteuer im Zeitraum – wofür werden sie verwendet?`, belege.filter((b) => belegSummen(b).vorsteuer_cent > 0).map((b) => bz(b, ` · Vorsteuer ${betrag(belegSummen(b).vorsteuer_cent)} €`)));
  // Belege ohne Umsatzsteuer für Leistungen, bei denen der Empfänger die Steuer schulden kann (Subunternehmer, ausländische Anbieter)
  dazu(
    "Belege ohne Umsatzsteuer (Waren, Fremdleistungen, Büro/Software, Werbung, Sonstiges): Schuldet der Betrieb die Umsatzsteuer als Leistungsempfänger (§ 13b UStG, z. B. Bauleistung eines Subunternehmers oder Leistung eines Unternehmens aus dem Ausland)?",
    belege.filter((b) => !b.steuerschuld && STEUERSCHULD_KATEGORIEN.includes(b.kategorie) && b.steuer.some((x) => x.brutto_cent) && b.steuer.every((x) => !x.brutto_cent || x.satz === 0)).map((b) => bz(b)),
  );
  // als § 13b erfasst: Konto steht im Stapel nur für SKR03 fest (3120/3123), Kleinunternehmer ohne Vorsteuer
  dazu(
    `Belege mit Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) – Kz 46/47 bzw. 84/85${istKleinunternehmer(s) ? " (Kleinunternehmer: ohne Vorsteuerabzug)" : ", Vorsteuer Kz 67"}. Bitte Art der Leistung und Konto prüfen:`,
    belege.filter((b) => b.steuerschuld).map((b) => bz(b, ` · ${b.steuerschuld === "eu" ? "sonstige Leistung EU" : "Bauleistung Inland"} · Steuer ${betrag(steuerschuldBetrag(b))} €`)),
  );

  // R11 (Kosmetik #11): Wechsel von der Kleinunternehmerregelung – Vorsteuerberichtigung nur als Frage (unsicher, § 44 UStDV)
  const kuBisF = (s.betrieb.ku_bis ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(kuBisF) && kuBisF >= `${Number(z.von.slice(0, 4)) - 1}-01-01` && kuBisF <= z.bis)
    dazu(
      `Wechsel von der Kleinunternehmerregelung zur Regelbesteuerung nach dem ${datumDe(kuBisF)}: Gibt es Waren- oder Materialbestand und Anlagegüter aus der Kleinunternehmerzeit, die jetzt für steuerpflichtige Umsätze genutzt werden? Dann ist eine Vorsteuerberichtigung nach § 15a UStG möglich (Bagatellgrenzen nach § 44 UStDV – bitte prüfen).`,
      ["- (Angabe des Betriebs)"],
    );
  const anzahl = abschnitte.reduce((a, x) => a + x.zeilen.length, 0);
  const text = [
    `${MARKE.name} – Fragen zum Zeitraum ${datumDe(z.von)} bis ${datumDe(z.bis)}`,
    `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
    ``,
    `Automatisch aus den erfassten Daten zusammengestellt: nur Sachverhalte, keine steuerliche Bewertung. Belege mit ${MARKE.name}-Belegnummer (wie in Belege_${z.name}.csv und im Dateinamen unter Belege/).`,
    // Kasse/Shop: steht einmal im LIESMICH unter „Wichtig“ (R10 – nicht doppelt)
    ...(abschnitte.length ? abschnitte.flatMap((a) => ["", a.titel, ...a.zeilen]) : ["", "Keine offenen Punkte gefunden."]),
  ].join("\r\n");
  return { text: text + "\r\n", anzahl };
}

export interface PaketErgebnis {
  zip: Uint8Array;
  dateiname: string;
  rechnungen: number;
  /** Gutschriften im Zeitraum – eigene Liste, nicht als Erlös gebucht */
  gutschriften: number;
  belege: number;
  /** Rechnungen, für die keine E-Rechnung erzeugt werden konnte (Angaben fehlen oder Privatkunde) */
  ohneXml: number;
  buchungen: number;
  /** Einträge in Fragen_<Zeitraum>.txt */
  fragen: number;
  /** Rechnungs-PDFs im Paket (nur mit `rechnungsPdfs`) */
  pdfs: number;
}

export interface PaketOptionen {
  /**
   * PDFs der Rechnungen und Gutschriften des Zeitraums, Schlüssel = ID der Unterlage. Sie entstehen auf dem Gerät
   * (expo-print) und damit nur asynchron – der Aufrufer erzeugt sie vorab; fehlt eines, bleibt die Spalte „Datei“ leer.
   */
  rechnungsPdfs?: Record<string, Uint8Array>;
}

const ja = (b: boolean) => (b ? "ja" : "nein");

/** LIESMICH: welche Kontenvorgaben der Kanzlei der Stapel verwendet (oder „keine – Standardkonten“). */
export function kontenvorgabenText(v: Kontenvorgaben | undefined, k: ReturnType<typeof kontenFuer>): string {
  if (!kontenvorgabenGesetzt(v)) return "keine – Standardkonten des Kontenrahmens";
  const konto = (id: string) => {
    switch (id) {
      case "erloesNullsatz": return k.erloese.nullsatz;
      case "erloesOss": return k.erloese.oss;
      case "erloesAusfuhr": return k.erloese.ausfuhr;
      case "erloesKz43": return k.erloese.befreit43;
      case "anlageMaschinen": return k.anlagen.maschinen;
      case "anlageBga": return k.anlagen.bga;
      case "anlageKfz": return k.anlagen.kfz;
      case "anlageSoftware": return k.anlagen.software;
      default: return String((k as unknown as Record<string, string>)[id] ?? "");
    }
  };
  const teile = KONTENVORGABE_FELDER.filter((f) => v!.konten?.[f.id]).map((f) => `${f.titel} ${konto(f.id) || v!.konten![f.id]}`);
  if (v!.belegeGegenBank !== undefined) teile.push(`Belege gegen Bank: ${ja(v!.belegeGegenBank)}`);
  if (v!.zahlungenBuchen !== undefined) teile.push(`Zahlungseingänge buchen: ${ja(v!.zahlungenBuchen)}`);
  if (v!.personenkonten !== undefined) teile.push(`Personenkonten für Kunden und Lieferanten: ${ja(v!.personenkonten)}`);
  if (v!.gewinnermittlung) teile.push(`Gewinnermittlung: ${v!.gewinnermittlung === "bilanz" ? "Bilanz" : "EÜR"}`);
  const herkunft = [v!.kanzlei, v!.stand ? `Stand ${datumDe(v!.stand)}` : ""].filter(Boolean).join(", ");
  return `${herkunft ? `${herkunft}: ` : ""}${teile.join("; ")}`;
}
/** Folgetag (ISO) */
const tagDanach = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + 1)).toISOString().slice(0, 10);

/** E-218: Buchungen für Anzahlungen auf EU-Umsätze und was dabei auffällt (LIESMICH). */
interface EuAnzahlungen {
  buchungen: Buchung[];
  /** Schlussrechnungen (und ihr Storno), deren Anzahlungen verrechnet werden – bei Bilanz mit vollem Entgelt gebucht */
  schluesse: Set<string>;
  /** EÜR ohne Erlöskonto ohne Umsatzsteuerfunktion (Kontenvorgabe): Buchungen, die deshalb im Stapel fehlen */
  fehlend: { text: string; datum: string; cent: number; nummer: string }[];
  /** Nummern der Abschlagsrechnungen mit Skonto vor der Meldung der Lieferung bzw. Leistung (im Zeitraum) */
  skontoVorMeldung: string[];
}

/**
 * E-218 (Steuerberater 27.10.2026, T-274): Anzahlungen bzw. Abschläge auf innergemeinschaftliche Lieferungen und
 * EU-Leistungen im Stapel – nicht mehr zum Zahltag auf dem Erlöskonto (8125/8336 bzw. 4125/4336).
 * - Bilanz: bezahlte Anzahlung zum Zahltag Forderungen an „Erhaltene Anzahlungen auf Bestellungen“ (SKR03 1710 / SKR04
 *   3250) ohne Steuerschlüssel; mit der Schlussrechnung das volle Entgelt auf das Erlöskonto (Feld 116 nach § 18b UStG,
 *   `vollesEntgelt`) und die Anzahlungen gegen die Forderung verrechnet.
 * - EÜR: Einnahme mit der Zahlung (§ 11 EStG) auf das Erlöskonto ohne Umsatzsteuerfunktion aus den Kontenvorgaben (kein
 *   Standard), mit dem Datum der Schlussrechnung auf das Erlöskonto umgebucht (Feld 116 nach § 18b UStG). Ohne Konto
 *   fehlen diese Buchungen und LIESMICH nennt sie. Eine Zahlung nach dem Datum der Schlussrechnung steht direkt auf dem
 *   Erlöskonto (Feld 116 wie die Schlussrechnung).
 * - Skonto auf die Anzahlung vor der Meldung (Zahltag nicht nach dem Tag der Schlussrechnung nach § 18b): zum Zahltag
 *   gegen das Anzahlungskonto, ohne Steuer; bei Bilanz mindert es mit der Schlussrechnung die Erlöse (Skontokonto, Feld
 *   116 der Schlussrechnung), bei EÜR wird nur der Rest umgebucht. Danach wie jedes Skonto im Zeitraum der Zahlung.
 */
function euAnzahlungsBuchungen(s: Stand, z: Zeitraum, o: { bilanz: boolean; istEuer: boolean; tage: Map<string, string | null>; ku: boolean; kontenrahmen: Kontenrahmen; bo: { vorgaben?: Kontenvorgaben }; k: Konten; mitPk: (u: Unterlage, r: AusgangsRechnungFuerBuchung) => AusgangsRechnungFuerBuchung; stornoImStapel: Set<string> }): EuAnzahlungen {
  const aus: Buchung[] = [];
  const fehlend: EuAnzahlungen["fehlend"] = [];
  const schluesse = new Set<string>();
  const skontoVor = new Set<string>();
  const konto = o.bilanz ? o.k.anzahlungenErhalten : o.k.anzahlungEuEuer;
  const rf = (u: Unterlage) => o.mitPk(u, rechnungFuerBuchung(u, s.betrieb, { tage: o.tage, betriebKu: o.ku }));
  const eu = (u: Unterlage) => !istGutschrift(u) && !!euMeldeArtVon(u, s.betrieb);
  const buchen = (art: "zahlung" | "skonto" | "verrechnung" | "umbuchung", r: AusgangsRechnungFuerBuchung, b: { id: string; datum: string; betrag_cent: number }, text: string) => {
    if (!b.betrag_cent) return;
    if (konto) aus.push(euAnzahlungBuchung(art, r, b, konto, o.kontenrahmen, o.bo));
    else fehlend.push({ text, datum: b.datum, cent: b.betrag_cent, nummer: r.nummer });
  };
  const summe = (l: { brutto_cent: number }[]) => l.reduce((a, x) => a + x.brutto_cent, 0);
  const alle = gestellteRechnungen(s);
  const abschlaege = alle.filter((u) => u.daten.abschlag === true && !istStorno(u) && eu(u));
  // je Abschlag: Zahlungen (Tag, Brutto je Steuersatz einschließlich Skonto, Skonto) und die Schlussrechnung
  const info = abschlaege.map((u) => {
    const r = rf(u);
    const schluss = schlussZuAbschlag(s.unterlagen, u);
    const zahlungen = u.zahlungen?.length
      ? zahlungsAnteile(restGruppen(r), u.zahlungen).map((a) => ({ id: a.zahlung.id, datum: a.zahlung.datum, anteil: a.erhalten.map((e, i) => ({ satz: e.satz, brutto_cent: e.brutto_cent + a.minderung[i]!.brutto_cent, netto_cent: e.netto_cent + a.minderung[i]!.netto_cent, ust_cent: e.ust_cent + a.minderung[i]!.ust_cent })), skonto: summe(a.minderung) }))
      : u.bezahlt
        ? [{ id: "bezahlt", datum: u.bezahlt, anteil: restGruppen(r).map((g) => ({ satz: g.satz, brutto_cent: g.netto_cent + g.ust_cent, netto_cent: g.netto_cent, ust_cent: g.ust_cent })), skonto: 0 }]
        : [];
    return { u, r, schluss, datum: schluss ? String(schluss.daten.datum) : null, tag: schluss ? (o.tage.get(schluss.id) ?? null) : null, zahlungen };
  });
  const vorMeldung = (p: { datum: string }, tag: string | null) => !tag || p.datum <= tag;
  for (const a of info) {
    for (const p of a.zahlungen) {
      if (!imZeitraum(p.datum, z)) continue;
      const nachSchluss = !!a.datum && p.datum > a.datum;
      // EÜR: nach dem Datum der Schlussrechnung direkt auf das Erlöskonto (die Umbuchung ist schon gebucht)
      if (!o.bilanz && nachSchluss) aus.push(...buchungenAusRechnungen([{ ...a.r, datum: p.datum, steuerperiode: a.tag, guid_zusatz: p.id, anteil: p.anteil }], o.kontenrahmen, o.bo));
      else buchen("zahlung", a.r, { id: p.id, datum: p.datum, betrag_cent: summe(p.anteil) }, "Anzahlung (Einnahme, § 11 EStG) zum Zahltag");
      if (!p.skonto) continue;
      const vor = vorMeldung(p, a.tag);
      if (vor) skontoVor.add(a.r.nummer);
      if (vor && !nachSchluss) buchen("skonto", a.r, { id: p.id, datum: p.datum, betrag_cent: p.skonto }, "Skonto auf die Anzahlung (mindert das Anzahlungskonto)");
      else aus.push(...skontoBuchungenRechnung(a.r, [{ id: p.id, datum: p.datum, brutto_cent: p.skonto, ...(vor && a.tag ? { steuerperiode: a.tag } : {}) }], o.kontenrahmen, o.bo));
    }
  }
  // Stornos von bezahlten Abschlägen: die Anzahlungsbuchung als Generalumkehr
  for (const st of alle.filter((u) => o.stornoImStapel.has(u.id))) {
    const r = rf(st);
    buchen("zahlung", r, { id: "storno", datum: o.istEuer ? st.bezahlt! : r.datum, betrag_cent: summe(restGruppen(r).map((g) => ({ brutto_cent: g.netto_cent + g.ust_cent }))) }, "Storno der Anzahlung");
  }
  // Schlussrechnungen (und ihr Storno) mit Datum im Zeitraum: Verrechnung (Bilanz) bzw. Umbuchung (EÜR)
  for (const sr of alle.filter((u) => eu(u) && u.daten.schluss === true && u.daten.abschlag !== true && imZeitraum(String(u.daten.datum), z))) {
    const orig = istStorno(sr) ? alle.find((x) => x.id === sr.stornoZuId) : sr;
    if (!orig) continue;
    const r = rf(sr);
    const nummern = new Set((rechnungFuerBuchung(orig, s.betrieb).abschlaege ?? []).map((x) => x.nummer.trim()).filter(Boolean));
    const zug = info.filter((a) => nummern.has(String(a.u.daten.nummer ?? "").trim()));
    const origDatum = String(orig.daten.datum);
    const origTag = o.tage.get(orig.id) ?? null;
    // Skonto vor der Meldung, gezahlt bis zum Datum der Schlussrechnung
    const skVor = zug.reduce((x, a) => x + a.zahlungen.filter((p) => p.datum <= origDatum && vorMeldung(p, origTag)).reduce((y, p) => y + p.skonto, 0), 0);
    for (const a of zug) if (a.zahlungen.some((p) => p.skonto && p.datum <= origDatum && vorMeldung(p, origTag))) skontoVor.add(a.r.nummer);
    if (o.bilanz) {
      if (!r.abschlaege?.length) continue;
      schluesse.add(sr.id);
      buchen("verrechnung", r, { id: "schluss", datum: r.datum, betrag_cent: summe(r.abschlaege.map((x) => ({ brutto_cent: x.netto_cent + x.ust_cent }))) - skVor }, "Verrechnung der Anzahlungen");
      if (skVor) {
        const sk = skontoBuchungenRechnung({ ...r, abschlaege: [] }, [{ id: "schluss", datum: r.datum, brutto_cent: skVor, guid_zusatz: "anzahlungen", ...(r.steuerperiode ? { steuerperiode: r.steuerperiode } : {}) }], o.kontenrahmen, o.bo);
        aus.push(...(istStorno(sr) ? sk.map((b): Buchung => ({ ...b, art: "storno", generalumkehr: true, buchungstext: `Storno ${b.buchungstext}`.slice(0, 60) })) : sk));
      }
    } else {
      const umbuchen = zug.reduce((x, a) => x + a.zahlungen.filter((p) => p.datum <= origDatum).reduce((y, p) => y + summe(p.anteil) - (vorMeldung(p, origTag) ? p.skonto : 0), 0), 0);
      buchen("umbuchung", r, { id: "schluss", datum: r.datum, betrag_cent: umbuchen }, "Umbuchung der Anzahlungen auf das Erlöskonto");
    }
  }
  return { buchungen: aus, schluesse, fehlend, skontoVorMeldung: [...skontoVor] };
}

/**
 * ZIP des Pakets (R9 Performance): Fotos, PDFs und andere schon komprimierte Dateien unkomprimiert ablegen (Level 0) –
 * sie werden mit Level 6 kaum kleiner, das Komprimieren kostete aber rund 90 % der Zeit. Texte (CSV, XML, TXT) wie
 * bisher mit Level 6. Der Inhalt des ZIP bleibt derselbe.
 */
const SCHON_KOMPRIMIERT = /\.(jpe?g|png|heic|heif|webp|gif|pdf|zip)$/i;
export function paketZippen(inhalt: Record<string, Uint8Array>): Uint8Array {
  const z: Zippable = {};
  for (const [name, bytes] of Object.entries(inhalt)) z[name] = SCHON_KOMPRIMIERT.test(name) ? [bytes, { level: 0 }] : [bytes, { level: 6 }];
  return zipSync(z);
}

/**
 * Das Paket für die Steuerberatung. `dateien` liefert die Bytes einer Belegdatei (verschlüsselt abgelegt, vom Aufrufer
 * entschlüsselt). `jetzt` als ISO-Zeitpunkt für den DATEV-Kopf. Mit `o.rechnungsPdfs` kommen die Rechnungs-PDFs dazu.
 */
export function steuerpaket(standRoh: Stand, z: Zeitraum, sb: Steuerberatung, dateien: Record<string, Uint8Array>, jetzt: string, o: PaketOptionen = {}): PaketErgebnis {
  // E-165 (A-3): mit der Kontenvorgabe „Personenkonten“ fehlende Nummern vergeben (der Aufrufer speichert sie vorher,
  // dann ändert sich hier nichts) – Rechnungen auf Debitoren, Belege per Überweisung/Karte auf Kreditoren
  const personenkonten = sb.kontenvorgaben?.personenkonten === true;
  const s = personenkonten ? personenkontenVergeben({ ...standRoh, steuerberatung: { ...standRoh.steuerberatung, kontenvorgaben: sb.kontenvorgaben } }, new Date(jetzt)) : standRoh;
  const kreditoren = personenkonten ? kreditorenBelege(s) : undefined;
  const mitPk = (u: Unterlage, r: AusgangsRechnungFuerBuchung): AusgangsRechnungFuerBuchung => (personenkonten ? { ...r, personenkonto: personenkontoRechnung(s, u) } : r);
  const alle = gestellteRechnungen(s)
    .filter((u) => imZeitraum(String(u.daten.datum), z))
    .sort((a, b) => String(a.daten.datum).localeCompare(String(b.daten.datum)) || nachNummer(String(a.daten.nummer ?? ""), String(b.daten.nummer ?? "")));
  // Gutschriften sind Ausgaben des Betriebs: nicht in Rechnungsliste und Erlösbuchungen, sondern in einer eigenen Liste
  const rechnungen = alle.filter((u) => !istGutschrift(u));
  const gutschriften = alle.filter(istGutschrift);
  // Kleinunternehmer je Zeitraum: die Rechnungen des Zeitraums entscheiden, sonst der Pflichten-Check (Lea, Befund 4)
  const profilKu = s.profil["ust.kleinunternehmer"];
  const ku = kuImZeitraum(rechnungen, typeof profilKu === "boolean" ? profilKu : undefined) ?? istKleinunternehmer(s);
  const ist = s.betrieb.versteuerung === "ist";
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  const belege = belegeImZeitraum(s, z);
  const kapital = kapitalgesellschaft(s);
  // StB-Prüfung (A-4): bilanzierende Betriebe bekommen einen Soll-Stapel (Erlös mit der Rechnung) mit Zahlungseingängen
  const bilanz = bilanzierendeGewinnermittlung(s);
  // StB-Prüfung (B-4/B-6/B-9/B-10/B-11): Kontenvorgaben der Kanzlei – alle Buchungen und Texte mit denselben Konten
  const vorgaben = sb.kontenvorgaben;
  const k = kontenFuer(sb.kontenrahmen, vorgaben);
  const bo = { vorgaben };
  const tage = zuordnungsTage(s.unterlagen, s.betrieb, ist ? "ist" : "soll");
  // R11: Ist-Versteuerung ohne Bilanz und Abschlagsrechnungen (Steuer entsteht mit der Zahlung): Erlös erst mit dem
  // Zahlungseingang, zum Zahltag – Unbezahltes steht nur in der Rechnungsliste. Ein Storno eines Abschlags (Soll) zählt
  // nur, wenn der Abschlag bezahlt war.
  const istEuer = ist && !bilanz;
  const abschlagU = (u: Unterlage) => u.daten.abschlag === true;
  const nachZahlung = (u: Unterlage) => !istGutschrift(u) && (istEuer || (abschlagU(u) && !istStorno(u)));
  const abschlagStornoOhneZahlung = (u: Unterlage) => !istEuer && !istGutschrift(u) && abschlagU(u) && istStorno(u) && !s.unterlagen.find((x) => x.id === u.stornoZuId)?.bezahlt;
  // R11 (Kosmetik #5): Gutschein zu 0 % ist kein steuerfreier Umsatz – nicht auf 8100/4100 buchen, nur Liste und Frage
  const gutscheine = new Set(alle.filter((u) => gutscheinZuNullU(u, s.betrieb)).map((u) => u.id));
  // R12: nach Zahlung mit einzelnen Zahlungen – je Zahlung gebucht (unten), nicht als Ganzes
  const jeZahlung = (u: Unterlage) => nachZahlung(u) && !istStorno(u) && !!u.zahlungen?.length;
  // E-218 (Steuerberater 27.10.2026, T-274): Anzahlungen auf EU-Umsätze (und ihr Storno) nicht auf das Erlöskonto –
  // eigene Buchungen unten (`euAnz`)
  const euAbschlag = (u: Unterlage) => abschlagU(u) && !istGutschrift(u) && !!euMeldeArtVon(u, s.betrieb);
  const imStapelAlle = gestellteRechnungen(s).filter((u) => !gutscheine.has(u.id) && !jeZahlung(u) && (nachZahlung(u) ? !!u.bezahlt && imZeitraum(u.bezahlt, z) : imZeitraum(String(u.daten.datum), z) && !abschlagStornoOhneZahlung(u)));
  const imStapel = imStapelAlle.filter((u) => !euAbschlag(u));
  const ohneZahlung = alle.filter((u) => nachZahlung(u) && !u.bezahlt && !u.zahlungen?.length);
  const ohneZahlungAbschlag = ohneZahlung.filter(abschlagU).length;
  // R12: Zahlungen mit Skonto bzw. Minderung (§ 17 UStG) und Teilzahlungen
  const zahlungsBuchungen = gestellteRechnungen(s)
    .filter((u) => !gutscheine.has(u.id) && !istGutschrift(u) && !istStorno(u) && u.zahlungen?.length && !euAbschlag(u))
    .flatMap((u) => {
      const r = mitPk(u, rechnungFuerBuchung(u, s.betrieb, { tage, betriebKu: ku }));
      const anteile = zahlungsAnteile(restGruppen(r), u.zahlungen!).filter((a) => imZeitraum(a.zahlung.datum, z));
      const minderungen = anteile.filter((a) => a.zahlung.minderung_cent).map((a) => ({ id: a.zahlung.id, datum: a.zahlung.datum, brutto_cent: a.minderung.reduce((x, m) => x + m.brutto_cent, 0) }));
      // Ist: Erlös je Zahlung mit erhaltenem Betrag plus Skonto, zum Zahltag; Soll: der Erlös steht schon mit der Rechnung
      // E-214: EU-Umsätze (ZM) – gebucht zum Zahltag, Feld 116 trägt den Tag nach § 18b UStG (Steuerberater 26.10.2026)
      const eu116 = euMeldeArtVon(u, s.betrieb) ? r.steuerperiode : null;
      const erloese = jeZahlung(u) ? buchungenAusRechnungen(anteile.map((a) => ({ ...r, datum: a.zahlung.datum, steuerperiode: eu116 ?? a.zahlung.datum, guid_zusatz: a.zahlung.id, anteil: a.erhalten.map((e, i) => ({ satz: e.satz, brutto_cent: e.brutto_cent + a.minderung[i]!.brutto_cent, netto_cent: e.netto_cent + a.minderung[i]!.netto_cent, ust_cent: e.ust_cent + a.minderung[i]!.ust_cent })) })), sb.kontenrahmen, bo) : [];
      return [...erloese, ...skontoBuchungenRechnung(r, minderungen, sb.kontenrahmen, bo)];
    });
  const euAnz = euAnzahlungsBuchungen(s, z, { bilanz, istEuer, tage, ku, kontenrahmen: sb.kontenrahmen, bo, k, mitPk, stornoImStapel: new Set(imStapelAlle.filter((u) => euAbschlag(u) && istStorno(u)).map((u) => u.id)) });
  // StB-Prüfung (A-4): bilanzierende Betriebe – Zahlungseingänge Bank an Forderungen nur mit der Kontenvorgabe
  // „Zahlungseingänge buchen“. Nachtrag 22.10.2026 (Steuerberatungskanzlei): Standard AUS – Kanzleien buchen die Bank
  // aus dem Kontoauszug; sonst stünden die Zahlungen doppelt im Mandanten. Bar an der Kasse kassierte Rechnungen bucht
  // schon die Kasse (Kasse an Forderungen); Gutschriften und Gutscheine zu 0 % nicht.
  const zahlungenBuchen = bilanz && vorgaben?.zahlungenBuchen === true;
  const barKassiert = new Set(s.kasse.flatMap((x) => (x.rechnungen_bar ?? []).map((r) => r.id)).filter(Boolean));
  const zahlungsEingaenge = zahlungenBuchen
    ? gestellteRechnungen(s)
        .filter((u) => !gutscheine.has(u.id) && !istGutschrift(u) && !barKassiert.has(u.id))
        .flatMap((u) => {
          const r = mitPk(u, rechnungFuerBuchung(u, s.betrieb, { tage, betriebKu: ku }));
          const zl = !istStorno(u) && u.zahlungen?.length ? u.zahlungen.filter((x) => imZeitraum(x.datum, z)).map((x) => ({ id: x.id, datum: x.datum, betrag_cent: x.betrag_cent })) : u.bezahlt && imZeitraum(u.bezahlt, z) ? [{ id: "bezahlt", datum: u.bezahlt, betrag_cent: zahlbetrag(r) }] : [];
          return zahlungsBuchungenRechnung(r, zl, sb.kontenrahmen, bo);
        })
    : [];
  // R12: Kassenabschlüsse; Barbelege gegen Kasse erst ab dem ersten Abschluss in Amtlos
  const ab = kasseAb(s.kasse);
  const kasseImZeitraum = s.kasse.filter((k) => imZeitraum(k.datum, z));
  const skontoBelege = s.belege.filter((b) => b.skonto_cent && imZeitraum(zahltag(b), z));
  // Gutschriften gehen als Aufwand in den Stapel (R10), Rechnungen als Erlös
  const buchungen = [
    ...buchungenAusRechnungen(imStapel.map((u) => ({ ...mitPk(u, rechnungFuerBuchung(u, s.betrieb, { tage, betriebKu: ku })), ...(nachZahlung(u) ? { datum: u.bezahlt! } : {}), ...(bilanz && euAnz.schluesse.has(u.id) ? { vollesEntgelt: true } : {}) })), sb.kontenrahmen, bo),
    ...zahlungsBuchungen,
    ...euAnz.buchungen,
    ...zahlungsEingaenge,
    ...buchungenAusBelegen(belege, sb.kontenrahmen, { ...bo, nummern, kapitalgesellschaft: kapital, kleinunternehmer: ku, kasseAb: ab, kreditoren }),
    ...skontoBuchungenBelege(skontoBelege, sb.kontenrahmen, { ...bo, nummern, kapitalgesellschaft: kapital, kleinunternehmer: ku, kasseAb: ab, kreditoren }),
    ...kassenBuchungen(kasseImZeitraum, sb.kontenrahmen, { ...bo, kleinunternehmer: ku, kapitalgesellschaft: kapital }),
    // R12 GoBD: Kassendifferenzen (Kassenbuch = Kassenkonto) und Sachentnahmen
    ...kassenDifferenzBuchungen(kassenWarnungen(s.kasse, s.belege).differenzen.filter((d) => imZeitraum(d.datum, z)), sb.kontenrahmen, { ...bo, kleinunternehmer: ku }),
    ...sachentnahmeBuchungen(s.sachentnahmen.filter((x) => imZeitraum(x.datum, z)), sb.kontenrahmen, { ...bo, kleinunternehmer: ku }),
  ].sort((a, b) => a.datum.localeCompare(b.datum));
  // StB-Prüfung (A-4): Saldo des Forderungskontos im Stapel (Generalumkehr mit umgekehrtem Vorzeichen) – bei
  // bilanzierenden Betrieben mit Zahlungseingängen die offenen Forderungen aus Rechnungen des Zeitraums zum Stichtag
  const saldoVon = (passt: (konto: string) => boolean) => buchungen.reduce((a, b) => a + (passt(b.konto) ? buchungsVorzeichen(b) * b.betrag_cent : 0) - (passt(b.gegenkonto) ? buchungsVorzeichen(b) * b.betrag_cent : 0), 0);
  // E-165: mit Personenkonten stehen die Forderungen auf den Debitoren – Saldo über alle Debitorenkonten
  const saldo = (konto: string) => (personenkonten && konto === k.forderungen ? saldoVon((x) => x === konto || istPersonenkonto(x, "debitor")) : saldoVon((x) => x === konto));
  const forderungsKonto = personenkonten ? `${k.forderungen} bzw. Debitoren` : k.forderungen;
  // A-4 (Nachtrag 22.10.2026): offene Forderungen zum Stichtag aus den Rechnungen des Zeitraums – wie die Rechnungsliste
  const offenZumEnde = rechnungen.reduce((a, u) => {
    const r = rechnungFuerBuchung(u, s.betrieb);
    return a + offenAm(s, u, z.bis, zahlbetrag(r));
  }, 0);
  const nichtImStapel = belege.filter((b) => !belegImStapel(b, { kapitalgesellschaft: kapital }));
  const kuBis = /^\d{4}-\d{2}-\d{2}$/.test((s.betrieb.ku_bis ?? "").trim()) ? s.betrieb.ku_bis!.trim() : "";
  // R11 (Kosmetik #10): Buchungen, deren Steuerperiode (Feld 116) außerhalb des Stapelzeitraums liegt – zur Kontrolle nennen
  const fremdePeriode = buchungen.filter((b) => b.steuerperiode && !imZeitraum(b.steuerperiode, z));
  // R12: Barbelege ohne Kassenführung in Amtlos (vor dem ersten Abschluss) gehen gegen Geldtransit – kein Kassenminus
  const barOhneKasse = belege.filter((b) => b.zahlung === "bar" && belegImStapel(b, { kapitalgesellschaft: kapital }) && !(ab && zahltag(b) >= ab)).length;
  const warnungen = kassenWarnungen(s.kasse, s.belege);
  const negativ = warnungen.negativ.filter((d) => imZeitraum(d.datum, z)).map((d) => d.datum);
  const differenzen = warnungen.differenzen.filter((d) => imZeitraum(d.datum, z));
  const mit13b = belege.filter((b) => b.steuerschuld).length;
  const rechtsform = rechtsformFuer(s);
  const dfv = s.profil["ust.dauerfristverlaengerung"] === true;
  const inhalt: Record<string, Uint8Array> = {};
  // E-165: Stammdaten der Personenkonten, die in diesem Stapel vorkommen
  const imStapelKonten = new Set(buchungen.flatMap((b) => [b.konto, b.gegenkonto]));
  const stamm = personenkonten ? personenkontenListe(s).filter((e) => imStapelKonten.has(e.konto)) : [];
  const doppelt = personenkonten ? personenkontenDoppelt(s) : [];
  if (stamm.length) inhalt[`EXTF_Debitoren_Kreditoren_${z.name}.csv`] = datevExtfBytes(datevDebitorenKreditoren(stamm, { beraternummer: sb.beraternummer, mandantennummer: sb.mandantennummer, wjBeginn: `${z.von.slice(0, 4)}-01-01`, erzeugtAm: jetzt }));
  const teilabzug = belege.filter((b) => belegTeilabzug(b) && !ku);
  inhalt[`EXTF_Buchungsstapel_${z.name}.csv`] = datevExtfBytes(datevExtf(buchungen, { beraternummer: sb.beraternummer, mandantennummer: sb.mandantennummer, wjBeginn: `${z.von.slice(0, 4)}-01-01`, von: z.von, bis: z.bis, kontenrahmen: sb.kontenrahmen, bezeichnung: `${MARKE.name} ${z.name}`, erzeugtAm: jetzt }));
  inhalt[`Buchungsliste_${z.name}.csv`] = utf8(buchungslisteCsv(buchungen));
  // Rechnungs-PDFs (vom Aufrufer erzeugt): Rechnungen/<Nummer>_<Kunde>.pdf, dieselben Namen in der Spalte „Datei“
  const pdfs = o.rechnungsPdfs ? new Map<string, string>() : undefined;
  if (o.rechnungsPdfs && pdfs) {
    for (const u of alle) {
      const bytes = o.rechnungsPdfs[u.id];
      if (!bytes) continue;
      const basis = rechnungDateiname(String(u.daten.nummer ?? ""), String(u.daten.kunde_name ?? ""));
      let name = basis;
      for (let i = 2; inhalt[`Rechnungen/${name}`]; i++) name = basis.replace(/\.pdf$/, `_${i}.pdf`);
      inhalt[`Rechnungen/${name}`] = bytes;
      pdfs.set(u.id, name);
    }
  }
  inhalt[`Rechnungen_${z.name}.csv`] = utf8(rechnungenCsv(s, z, false, pdfs));
  if (gutschriften.length) inhalt[`Gutschriften_${z.name}.csv`] = utf8(rechnungenCsv(s, z, true, pdfs));
  // Dateinamen einmal vergeben (doppelte durchnummeriert) – dieselben stehen in der Belegliste
  const dateinamen = new Map<string, string>();
  const vergeben = new Set<string>();
  for (const b of belege) {
    if (!b.datei || !dateien[b.datei]) continue;
    const basis = belegDateiname(b, nummern.get(b.id));
    let name = basis;
    for (let i = 2; vergeben.has(name); i++) name = basis.replace(/(\.\w+)$/, `_${i}$1`);
    vergeben.add(name);
    dateinamen.set(b.id, name);
    inhalt[`Belege/${name}`] = dateien[b.datei]!;
  }
  inhalt[`Belege_${z.name}.csv`] = utf8(belegeCsv(s, z, dateinamen, sb.kontenrahmen, nummern, ku));
  const fragen = fragenText(s, z, nummern);
  inhalt[`Fragen_${z.name}.txt`] = utf8(fragen.text);
  const ohneXmlListe: string[] = [];
  const xmlNeu: string[] = [];
  for (const u of alle) {
    const { daten, fehlt } = eRechnungAus(u.daten, absenderFuer(s, u));
    // E-221 Befund 9: ein festgehaltenes Original geht immer mit – auch wenn die Daten heute nicht mehr für eine E-Rechnung reichen
    if (fehlt.length && !u.xml) {
      ohneXmlListe.push(`- ${daten.nummer || "ohne Nummer"} (${daten.kunde.name || "ohne Namen"}): ${grundOhneXml(fehlt, daten.kunde.ust_idnr)}`);
      continue;
    }
    let pfad = `E-Rechnungen/${sicher(daten.nummer)}.xml`;
    for (let i = 2; inhalt[pfad]; i++) pfad = `E-Rechnungen/${sicher(daten.nummer)}_${i}.xml`; // „2026/001“ und „2026-001“
    // R12 GoBD: das bei der Festschreibung festgehaltene Original; ältere Rechnungen ohne Original aus den festgeschriebenen Daten
    if (u.xml) inhalt[pfad] = utf8(u.xml);
    else {
      inhalt[pfad] = utf8(xrechnungUbl(daten, KU_HINWEIS));
      xmlNeu.push(daten.nummer);
    }
  }
  const ohneXml = ohneXmlListe.length;
  const versteuerung = s.betrieb.versteuerung === "ist" ? "Ist (vereinnahmte Entgelte, § 20 UStG)" : s.betrieb.versteuerung === "soll" ? "Soll (vereinbarte Entgelte)" : "nicht angegeben (Soll angenommen)";
  const uhrzeit = /T(\d{2}):(\d{2})/.exec(jetzt);
  const kassenSatz = kassenSatzPaket(kassenLage(s.profil), { fehlend: kassenAbdeckung(s, z.von, z.bis, jetzt.slice(0, 10) > z.bis ? undefined : jetzt.slice(0, 10)), tage: kasseImZeitraum.filter((k) => !k.geschlossen).length });
  if (kasseImZeitraum.length) inhalt[`Kassenabschluesse_${z.name}.csv`] = utf8(kassenCsv(s, z));
  // R12 GoBD: Änderungsprotokoll (Belege, Kasse, Löschungen) und ungültig markierte Belege mit Grund
  const protokollZeilen = aenderungsprotokoll(s, z);
  if (protokollZeilen.length) inhalt[`Aenderungsprotokoll_${z.name}.csv`] = utf8(csv(kopfAus(PROTOKOLL_SPALTEN), protokollZeilen));
  const ungueltig = s.belegArchiv.filter((b) => imZeitraum(b.datum, z));
  if (ungueltig.length) inhalt[`Belege_ungueltig_${z.name}.csv`] = utf8(csv(kopfAus(UNGUELTIG_SPALTEN), ungueltig.map((b) => [nummern.get(b.id) ?? "", datumDe(b.datum), b.lieferant, betrag(belegSummen(b).brutto_cent), b.ungueltig ? zeitDe(b.ungueltig) : "", b.ungueltig_grund ?? "", b.datei ? "ja (beim Betrieb)" : "nein"])));
  const se = sachentnahmenFuer(s.sachentnahmen, z.von, z.bis);
  // E-214: Stornos „Fehler in der Rechnung“ bei EU-Umsätzen – Storno bzw. Datum im Zeitraum; Anzahlungen auf EU-Umsätze
  const berichtigungen = euBerichtigungen(s.unterlagen, s.betrieb).filter((b) => imZeitraum(b.stornoDatum, z) || imZeitraum(b.tag, z));
  const euAbschlaege = gestellteRechnungen(s).filter((u) => u.daten.abschlag === true && euMeldeArtVon(u, s.betrieb) && ((u.bezahlt && imZeitraum(u.bezahlt, z)) || imZeitraum(String(u.daten.datum), z) || (u.zahlungen ?? []).some((x) => imZeitraum(x.datum, z))));
  // E-218: Skonto auf Anzahlungen vor der Meldung steht in einem eigenen Satz (mindert mit der Schlussrechnung)
  const skontoZm = gestellteRechnungen(s).filter((u) => (u.zahlungen ?? []).some((x) => x.minderung_cent && imZeitraum(x.datum, z)) && zmBetroffen(rechnungFuerBuchung(u, s.betrieb)) && !(euAbschlag(u) && euAnz.skontoVorMeldung.includes(String(u.daten.nummer ?? ""))));
  // „Wichtig“: an fester Stelle direkt nach den Mandantendaten, jeder Punkt nur einmal (R10)
  const wichtig = [
    ...(kassenSatz ? kassenSatz.split("\r\n") : []),
    ...(nichtImStapel.length ? [`${nichtImStapel.length} ${nichtImStapel.length === 1 ? "Beleg steht" : "Belege stehen"} nur in der Belegliste, nicht im Buchungsstapel: Personal (Lohn bucht die Lohnbuchhaltung).`] : []),
    // StB-Prüfung (B-6): privat ausgelegte Belege einer Kapitalgesellschaft auf dem Verrechnungskonto Gesellschafter
    ...(kapital && belege.some((b) => b.zahlung === "privat") ? [`Privat ausgelegte Belege der Gesellschaft stehen im Stapel auf dem Verrechnungskonto Gesellschafter (${k.verrechnungGesellschafter}) – ein Verrechnungskonto je Gesellschafter bitte in den Kontenvorgaben festlegen oder umbuchen (siehe Fragen).`] : []),
    // R11: Konten je nach Vorsteuerabzug – der Satz beschreibt, was im Stapel tatsächlich steht
    ...(mit13b ? [steuerschuldSatz(belege, sb.kontenrahmen, ku)] : []),
    ...(ohneZahlung.length
      ? [
          istEuer
            ? `Ist-Versteuerung: Rechnungen stehen erst mit dem Zahlungseingang im Buchungsstapel (Belegdatum und Feld „Datum Zuord. Steuerperiode“ = Zahltag). ${ohneZahlung.length} ${ohneZahlung.length === 1 ? "Rechnung" : "Rechnungen"} dieses Zeitraums ohne Zahlungsvermerk ${ohneZahlung.length === 1 ? "steht" : "stehen"} nur in der Rechnungsliste. Bitte vor dem Import prüfen, ob DATEV das ohne OPOS richtig zuordnet (Testimport).`
            : `${ohneZahlungAbschlag} ${ohneZahlungAbschlag === 1 ? "Abschlagsrechnung" : "Abschlagsrechnungen"} ohne Zahlungsvermerk ${ohneZahlungAbschlag === 1 ? "steht" : "stehen"} nur in der Rechnungsliste, nicht im Buchungsstapel – die Umsatzsteuer entsteht erst mit der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG); bezahlte Abschläge stehen mit dem Zahltag im Stapel.`,
        ]
      : []),
    ...(fremdePeriode.length
      ? [`${fremdePeriode.length} ${fremdePeriode.length === 1 ? "Buchung hat" : "Buchungen haben"} im Feld „Datum Zuord. Steuerperiode“ einen Tag außerhalb des Stapelzeitraums (${[...new Set(fremdePeriode.map((b) => b.belegfeld1))].slice(0, 10).join(", ")}): Die Umsatzsteuer gehört nach der Zuordnung der App in einen anderen Voranmeldungszeitraum – bitte prüfen.`]
      : []),
    ...(gutscheine.size ? [`${gutscheine.size} ${gutscheine.size === 1 ? "Rechnung" : "Rechnungen"} über Gutscheine zu 0 % ${gutscheine.size === 1 ? "steht" : "stehen"} nur in der Rechnungsliste, nicht im Buchungsstapel – Einzweck- oder Mehrzweck-Gutschein (§ 3 Abs. 13–15 UStG)? Siehe Fragen.`] : []),
    ...(barOhneKasse
      ? [kapital
          ? `${barOhneKasse} ${barOhneKasse === 1 ? "Barbeleg steht" : "Barbelege stehen"} im Stapel gegen das Verrechnungskonto Gesellschafter (${k.verrechnungGesellschafter}), weil ${MARKE.name} ${ab ? "die Kasse erst ab " + datumDe(ab) : "keine Kasse"} führt und eine Gesellschaft keine Privatkonten hat – wurde aus einer Geschäftskasse bezahlt, bitte umbuchen (siehe Fragen).`
          : `${barOhneKasse} ${barOhneKasse === 1 ? "Barbeleg steht" : "Barbelege stehen"} im Stapel gegen Privateinlage (${k.privateinlagen}), weil ${MARKE.name} ${ab ? "die Kasse erst ab " + datumDe(ab) : "keine Kasse"} führt – so entsteht weder ein negativer Kassenbestand noch ein Restsaldo auf Geldtransit. Wurde aus einer Geschäftskasse bezahlt, bitte umbuchen (siehe Fragen).`]
      : []),
    ...(negativ.length ? [`Kassenbestand rechnerisch negativ am ${negativ.map(datumDe).slice(0, 5).join(", ")} (§ 146 Abs. 1 Satz 2 AO) – bitte Kassenbuch prüfen (fehlende Einlage oder Einnahme?).`] : []),
    ...(differenzen.length ? [`${differenzen.length} ${differenzen.length === 1 ? "Kassendifferenz" : "Kassendifferenzen"} laut Zählung (zusammen ${betrag(differenzen.reduce((a, d) => a + d.cent, 0))} €) – gebucht, damit Kassenbuch und Kassenkonto übereinstimmen: Überschuss Kasse an ${k.kassendifferenzErtrag ? `${k.kassendifferenzErtrag} (ohne Umsatzsteuer, Kontenvorgabe)` : `Erlöse 19 % (${k.erloese[19]})`}, Fehlbetrag Kasse an sonstigen Aufwand (${k.kassendifferenzAufwand}).${kontenvorgabenGesetzt(vorgaben) ? "" : " Konten und Behandlung des Überschusses bitte mit der Kanzlei abstimmen (Kontenvorgaben)."}`] : []),
    ...(kasseImZeitraum.length
      ? [
          `Kasse: Anfangsbestand der Bargeldkasse am ${datumDe(kassenVerlauf(s.kasse, s.belege).tage[0]?.datum ?? z.von)} laut App ${betrag(kassenVerlauf(s.kasse, s.belege).tage[0]?.anfang ?? 0)} € – ist nicht gebucht; bitte mit dem Saldovortrag des Kassenkontos (${k.kasse}) abgleichen.`,
          `Kasse: Im Stapel läuft nur Bargeld über die Kasse. Karten- und App-Zahlungen stehen direkt Geldtransit (${k.geldtransit}) an Erlöse, „auf Rechnung“ Forderungen an Erlöse – im Verhältnis der Umsätze je Steuersatz aufgeteilt, weil der Z-Bon die Zahlungsart nicht je Steuersatz ausweist. Kartentrinkgeld (an das Personal bar ausgezahlt, § 3 Nr. 51 EStG) Geldtransit an Kasse ohne Steuer. Bankeinzahlungen, Entnahmen und Einlagen tragen eine Eigenbeleg-Nummer (EB…) in Belegfeld 1. Geldtransit ist nach der Bankbuchung auf 0 abzustimmen.`,
          `Rundung: Die App rechnet die Umsatzsteuer der Kasse je Monat aus der Bruttosumme heraus, DATEV je Buchung – Abweichungen von einigen Cent je Voranmeldung sind normal.`,
        ]
      : []),
    ...(kasseImZeitraum.some((k) => k.gutscheine?.some((g) => g.art === "mehrzweck")) ? [`Mehrzweck-Gutscheine (§ 3 Abs. 15 UStG): Verkauf an „sonstige Verbindlichkeiten“ (${k.gutscheinVerbindlichkeit}), Einlösung Verbindlichkeit an Erlöse${vorgaben?.konten?.gutscheinVerbindlichkeit ? "" : " – Konto bitte mit der Kanzlei abstimmen (z. B. eigenes Unterkonto, Kontenvorgaben)"}. Einzweck-Gutscheine sind beim Verkauf als Erlös gebucht, ihre Einlösung nicht noch einmal.`] : []),
    ...(se.anzahl ? [ku ? `Sachentnahmen (unentgeltliche Wertabgaben, netto ${betrag(se.netto7 + se.netto19)} €): als Kleinunternehmer nicht im Stapel – bitte mit der Kanzlei klären.` : `Sachentnahmen (unentgeltliche Wertabgaben, § 3 Abs. 1b UStG): 7 % netto ${betrag(se.netto7)} €, 19 % netto ${betrag(se.netto19)} € – im Stapel ${kapital ? "Verrechnungskonto Gesellschafter" : "Privatentnahme"} an ${k.sachentnahme[7]}/${k.sachentnahme[19]} (brutto, Konten bitte prüfen). Die Werte hat der Betrieb aus den BMF-Pauschbeträgen selbst eingetragen.`] : []),
    ...berichtigungen.map((b) => `Storno ${b.stornoNr} zu Rechnung ${b.rechnungNr}${b.ersatzNr ? ` (Ersatzrechnung ${b.ersatzNr})` : ""}: Fehler in der Rechnung mit EU-Umsatz – Zusammenfassende Meldung und Voranmeldung für ${periodeText(b.monat)} bzw. ${periodeText(b.quartal)}${b.ersatzTag && b.ersatzTag.slice(0, 7) !== b.monat && b.ersatzTag.slice(0, 7) < b.stornoDatum.slice(0, 7) ? ` (Ersatzrechnung: ${periodeText(b.ersatzTag.slice(0, 7))})` : ""} berichtigen, falls schon abgegeben – die ZM innerhalb eines Monats ab Erkennen des Fehlers (${datumDe(b.erkannt)}, also bis ${datumDe(b.zmFrist)}, § 18a Abs. 10 UStG), die Voranmeldung für denselben Zeitraum wie die ZM (das Finanzamt gleicht Kz 41 bzw. 21 und die ZM je Zeitraum ab; eine Korrektur in der laufenden Voranmeldung genügt nicht). Im Stapel zum Datum des Stornos gebucht, Feld „Datum Zuord. Steuerperiode“ = ${datumDe(b.tag)} (Tag, der den ursprünglichen Zeitraum bestimmt, § 18b UStG).${b.tag.slice(0, 4) !== b.stornoDatum.slice(0, 4) && imZeitraum(b.stornoDatum, z) ? ` Der ursprüngliche Zeitraum liegt in einem anderen Geschäftsjahr (${b.tag.slice(0, 4)}) als die Buchung (${b.stornoDatum.slice(0, 4)}) – die Umsatzsteuer gehört in die berichtigte Voranmeldung für ${periodeText(b.monat)}, nicht in die laufende; bitte im Testimport prüfen, wie DATEV Feld 116 aus dem Vorjahr zuordnet.` : ""}`),
    ...(euAbschlaege.length || euAnz.buchungen.length || euAnz.fehlend.length
      ? [
          `Anzahlungen bzw. Abschläge auf innergemeinschaftliche Lieferungen bzw. Leistungen an Unternehmen im EU-Ausland${euAbschlaege.length ? ` (${euAbschlaege.map((u) => String(u.daten.nummer ?? "")).join(", ")})` : ""}: Sie gehören nicht in Kz 41/21 und nicht in die Zusammenfassende Meldung – gemeldet wird erst die Lieferung bzw. Leistung mit dem vollen Entgelt (Schlussrechnung, § 18b Satz 2 und 3 UStG). ${
            bilanz
              ? `Im Stapel: bezahlte Anzahlung zum Zahltag Forderungen an „Erhaltene Anzahlungen auf Bestellungen“ (${k.anzahlungenErhalten}) ohne Steuerschlüssel; mit der Schlussrechnung das volle Entgelt auf ${k.erloese.igl} bzw. ${k.erloese.eu} (Feld „Datum Zuord. Steuerperiode“ nach § 18b UStG) und die Anzahlungen ${k.anzahlungenErhalten} an Forderungen verrechnet.`
              : k.anzahlungEuEuer
                ? `Einnahmen-Überschuss-Rechnung: Die Anzahlung ist mit der Zahlung Einnahme (§ 11 EStG) – im Stapel zum Zahltag Forderungen an ${k.anzahlungEuEuer} (Erlöskonto ohne Umsatzsteuerfunktion, Kontenvorgabe), mit dem Datum der Schlussrechnung umgebucht auf ${k.erloese.igl} bzw. ${k.erloese.eu} (Feld „Datum Zuord. Steuerperiode“ nach § 18b UStG).`
                : `Einnahmen-Überschuss-Rechnung: Die Anzahlung ist mit der Zahlung Einnahme (§ 11 EStG), darf aber nicht auf ein Erlöskonto mit Umsatzsteuerfunktion. Das Erlöskonto ohne Umsatzsteuerfunktion ist in den Kontenvorgaben nicht festgelegt („Anzahlungen auf EU-Umsätze: Erlöskonto ohne Umsatzsteuer (EÜR)“, gibt die Kanzlei vor) – deshalb FEHLEN diese Buchungen im Stapel: ${euAnz.fehlend.map((f) => `${f.text} am ${datumDe(f.datum)} über ${betrag(f.cent)} € (RE ${f.nummer})`).join("; ") || "keine in diesem Zeitraum"}. Bitte das Konto in den Kontenvorgaben eintragen und das Paket neu erstellen oder diese Buchungen von Hand ergänzen.`
          }`,
          ...(euAnz.skontoVorMeldung.length ? [`Skonto auf Anzahlungen vor der Meldung der Lieferung bzw. Leistung (${euAnz.skontoVorMeldung.join(", ")}): mindert keinen früheren Zeitraum, sondern das mit der Schlussrechnung gemeldete Entgelt (§ 10 Abs. 1 UStG). Im Stapel zum Zahltag ohne Steuerschlüssel gegen ${bilanz ? k.anzahlungenErhalten : k.anzahlungEuEuer || "das Anzahlungskonto"}${bilanz ? `, mit der Schlussrechnung auf ${k.skontiGewaehrtIgl}/${k.skontiGewaehrtRc} mit Feld „Datum Zuord. Steuerperiode“ der Schlussrechnung` : ", umgebucht wird nur der verbleibende Betrag"}. Gibt es die Schlussrechnung noch nicht, mindert das Skonto noch keine Meldung.`] : []),
        ]
      : []),
    ...(skontoZm.length ? [`Skonto auf innergemeinschaftliche Lieferungen bzw. Leistungen an Unternehmen im EU-Ausland (${skontoZm.map((u) => String(u.daten.nummer ?? "")).join(", ")}): Die Bemessungsgrundlage hat sich geändert (§ 17, § 18b Satz 4 UStG) – Kz 41 bzw. 21 und die Zusammenfassende Meldung des Zeitraums, in dem das Skonto abgezogen wurde (Zahltag), sind gemindert; die ursprüngliche Meldung bleibt. Im Stapel auf eigenen Skontokonten (${k.skontiGewaehrtIgl}/${k.skontiGewaehrtRc}, bitte prüfen) mit USt-IdNr.`] : []),
    ...(xmlNeu.length ? [`${xmlNeu.length} ${xmlNeu.length === 1 ? "E-Rechnung wurde" : "E-Rechnungen wurden"} vor der Speicherung des Originals festgeschrieben (${xmlNeu.slice(0, 10).join(", ")}) – die XML-Datei ist aus den festgeschriebenen Daten neu erzeugt, nicht die versandte Datei.`] : []),
    ...(protokollZeilen.length || ungueltig.length ? [`Änderungen nach der Festschreibung, Löschungen und ungültig markierte Belege stehen in ${[protokollZeilen.length ? `Aenderungsprotokoll_${z.name}.csv` : "", ungueltig.length ? `Belege_ungueltig_${z.name}.csv` : ""].filter(Boolean).join(" und ")} – so erklären sich Lücken in den ${MARKE.name}-Belegnummern.`] : []),
    // StB-Prüfung (B-2): Nullsteuersatz auf eigenem Erlöskonto mit Kz 87 (nicht 8100/4100 = Kz 48)
    ...(ku ? [] : [`Nullsteuersatz-Umsätze (§ 12 Abs. 3 UStG, Kz 87) stehen auf dem Erlöskonto ${k.erloese.nullsatz}${vorgaben?.konten?.erloesNullsatz ? " (Kontenvorgabe)" : " – bitte prüfen, ob das Konto im Kontenrahmen der Kanzlei die Kz-87-Funktion hat (sonst in den Kontenvorgaben ändern)"}.`].filter(() => alle.some((u) => eRechnungAus(u.daten, absenderFuer(s, u)).daten.steuerart === STEUERART_NULLSATZ))),
    // OSS (§ 18j UStG): Erlöse mit der Steuer des Bestimmungslands auf eigenem Konto, Land und Satz in Feld 40/41
    ...((() => {
      const oss = alle.filter((u) => !istGutschrift(u) && eRechnungAus(u.daten, absenderFuer(s, u)).daten.oss);
      return oss.length ? [`${oss.length} OSS-${oss.length === 1 ? "Rechnung" : "Rechnungen"} (${oss.map((u) => String(u.daten.nummer ?? "")).slice(0, 10).join(", ")}) mit der Umsatzsteuer des Bestimmungslands: im Stapel auf ${k.erloese.oss} mit Land in Feld 40 und Steuersatz in Feld 41 – sie gehören in die OSS-Erklärung beim BZSt, nicht in die deutsche Voranmeldung. Feld 40 trägt nur das Länderkennzeichen (Privatpersonen, keine USt-IdNr.). Steuerschlüssel bitte prüfen (Konto über die Kontenvorgaben).`] : [];
    })()),
    // E-165 (5.2): Vorsteuer-Teilabzug – zwei Buchungen je Beleg und Steuersatz
    ...(teilabzug.length ? [`${teilabzug.length} ${teilabzug.length === 1 ? "Beleg ist" : "Belege sind"} nur teilweise zum Vorsteuerabzug berechtigt (§ 15 Abs. 4 UStG, Anteil laut Belegliste, Spalte „Vorsteuerabzug“): im Stapel je Steuersatz zwei Buchungen – der abziehbare Teil brutto mit BU-Schlüssel (DATEV rechnet daraus genau die abziehbare Vorsteuer), der nicht abziehbare Teil brutto ohne Steuer auf demselben Aufwandskonto (Text „ohne VSt“). Den Aufteilungsschlüssel legt die Kanzlei fest – bitte prüfen.`] : []),
    // E-165 (A-3): Personenkonten mit Stammdaten
    ...(personenkonten
      ? [
          `Personenkonten (Kontenvorgabe): Rechnungen, Skonto${zahlungenBuchen ? ", Zahlungseingänge" : ""} und Gutschriften stehen auf dem Personenkonto des Kunden (Debitoren 10000–69999) bzw. Leistenden, Belege per Überweisung oder Karte auf dem Kreditor des Lieferanten (70000–99999) statt auf ${k.forderungen}/${k.verbindlichkeiten}; bar und privat bezahlte Belege wie bisher. Belegfeld 1 = Rechnungs- bzw. Belegnummer – damit lassen sich die Zahlungen aus dem Kontoauszug ausziffern (OPOS). ${stamm.length ? `Stammdaten (Name, Anschrift, USt-IdNr.) in EXTF_Debitoren_Kreditoren_${z.name}.csv (${stamm.length} ${stamm.length === 1 ? "Konto" : "Konten"}) – vor dem Buchungsstapel importieren.` : "Im Zeitraum kommt kein Personenkonto vor."}`,
          ...(doppelt.length ? [`Personenkonten doppelt vergeben (${doppelt.join(", ")}) – vermutlich auf zwei Geräten gleichzeitig. Bitte vor dem Import klären.`] : []),
        ]
      : []),
    // StB-Prüfung (A-4): Soll-Stapel bilanzierender Betriebe mit Zahlungseingängen und offenen Forderungen zum Stichtag
    ...(bilanz
      ? [
          `Bilanzierender Betrieb${rechtsform ? ` (${rechtsform.text})` : ""}: Soll-Stapel – Rechnungen stehen mit dem Rechnungsdatum als Forderungen an Erlöse im Stapel (Leistungsdatum in Feld 115)${
            zahlungenBuchen
              ? `, Zahlungseingänge als Bank (${k.bank}) an Forderungen (${forderungsKonto}) zum Zahltag (Kontenvorgabe „Zahlungseingänge buchen“). Saldo ${forderungsKonto} aus diesem Stapel zum ${datumDe(z.bis)}: ${betrag(saldo(k.forderungen))} € (offene Forderungen, siehe Rechnungsliste). Beim Buchen der Kontoauszüge diese Zahlungseingänge nicht noch einmal buchen – oder in den Kontenvorgaben „Zahlungseingänge buchen“ ausschalten.`
              : `. Zahlungseingänge sind nicht gebucht – die Kanzlei bucht die Bank aus dem Kontoauszug (Bank an Forderungen ${forderungsKonto}). Deshalb stehen im Stapel alle Rechnungen des Zeitraums als Forderung: Saldo ${forderungsKonto} aus diesem Stapel zum ${datumDe(z.bis)}: ${betrag(saldo(k.forderungen))} €. Erst nach dem Buchen der Kontoauszüge bleiben die offenen Forderungen stehen – laut Rechnungsliste zum ${datumDe(z.bis)}: ${betrag(offenZumEnde)} €. Wer die Zahlungseingänge aus ${MARKE.name} übernehmen will: in den Kontenvorgaben „Zahlungseingänge buchen“ einschalten – dann die Zahlungen aus dem Kontoauszug nicht noch einmal buchen.`
          }${ist ? ` Ist-Versteuerung: Feld „Datum Zuord. Steuerperiode“ trägt den Zahltag; alternativ im Mandantenstamm „Ist“ mit OPOS – bitte beim Testimport prüfen. ${personenkonten ? "Personenkonten sind eingeschaltet (Kontenvorgabe) – die empfohlene Einrichtung für Ist-Versteuerung mit Bilanzierung: Die Kanzlei kann OPOS führen und die Steuer nach Zahlungseingang zuordnen." : "Empfohlene Einrichtung laut Kanzlei für Ist-Versteuerung mit Bilanzierung: Personenkonten mit OPOS – in den Kontenvorgaben „Personenkonten für Kunden und Lieferanten (OPOS)“ einschalten."}` : ""}`,
        ]
      : []),
  ];
  inhalt["LIESMICH.txt"] = utf8(
    [
      `${MARKE.name} – Unterlagen für die Steuerberatung`,
      `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
      `Zeitraum: ${datumDe(z.von)} bis ${datumDe(z.bis)}`,
      `Erstellt: ${datumDe(jetzt.slice(0, 10))}`,
      ``,
      `Mandant (Angaben aus der App)`,
      `- Name: ${s.betrieb.name.trim() || "nicht angegeben"}`,
      `- Rechtsform: ${rechtsform ? `${rechtsform.text}${rechtsform.ausCheck ? " (laut Pflichten-Check)" : ""}` : "nicht angegeben"}`,
      `- Steuernummer: ${s.betrieb.steuernummer.trim() || "nicht angegeben"}`,
      `- USt-IdNr.: ${s.betrieb.ust_idnr.trim() || "nicht angegeben"}`,
      `- Kleinunternehmer (§ 19 UStG): ${kuBis ? `bis ${datumDe(kuBis)}, ab ${datumDe(tagDanach(kuBis))} regelbesteuert (laut App)` : ja(ku)}`,
      `- Versteuerung: ${versteuerung}`,
      ...(ku ? [] : [`- Dauerfristverlängerung (laut Pflichten-Check): ${s.profil["ust.dauerfristverlaengerung"] === undefined ? "nicht angegeben" : ja(dfv)}`]),
      `- Kontenrahmen: ${sb.kontenrahmen}`,
      `- Gewinnermittlung: ${bilanz ? "Bilanz (Buchführungspflicht" + (vorgaben?.gewinnermittlung ? ", Kontenvorgabe)" : ", nach Rechtsform bzw. Mitteilung des Finanzamts)") : "Einnahmen-Überschuss-Rechnung" + (vorgaben?.gewinnermittlung ? " (Kontenvorgabe)" : "")}`,
      `- Kontenvorgaben der Kanzlei: ${kontenvorgabenText(vorgaben, k)}`,
      `- Berater-/Mandantennummer: ${sb.beraternummer || "fehlt"} / ${sb.mandantennummer || "fehlt"}`,
      `- Zeitraum: ${datumDe(z.von)} bis ${datumDe(z.bis)} (${z.name})`,
      `- App: ${MARKE.name} ${APP_VERSION}`,
      `- Erstellt am: ${datumDe(jetzt.slice(0, 10))}${uhrzeit ? ` ${uhrzeit[1]}:${uhrzeit[2]} Uhr${/Z$|[+-]00:?00$/.test(jetzt) ? " (UTC)" : ""}` : ""}`,
      ``,
      ...(wichtig.length ? [`Wichtig`, ...wichtig.map((w) => `- ${w}`), ``] : []),
      `Inhalt`,
      `- EXTF_Buchungsstapel_${z.name}.csv: DATEV-Format „Buchungsstapel“ (${sb.kontenrahmen}), ${buchungen.length} Buchungen. Festschreibung 0 (Kopf und Feld 114): Der Stapel wird beim Import nicht festgeschrieben – erst nach Prüfung in der Kanzlei festschreiben. Belegbuchungen mit dem Zahlungskonto in Feld „Konto“ und dem Sachkonto mit BU-Schlüssel in Feld „Gegenkonto“; Stornos als Generalumkehr (Feld 118 = 1). Feld 103 „Buchungs GUID“ bleibt leer, die stabile Kennung steht in Beleginfo 1 („Buchungs-GUID“). Bitte vor der Übernahme einen Testimport machen.${sb.beraternummer && sb.mandantennummer ? "" : " Berater- und Mandantennummer fehlen und sind für den Import nötig."}`,
      ...(stamm.length ? [`- EXTF_Debitoren_Kreditoren_${z.name}.csv: DATEV-Format „Debitoren/Kreditoren“ (Stammdaten der ${stamm.length} Personenkonten im Stapel: Nummer, Name, Anschrift, USt-IdNr.) – vor dem Buchungsstapel importieren.`] : []),
      `- Buchungsliste_${z.name}.csv: dieselben Buchungen zum Lesen (Semikolon, UTF-8), mit stabiler Buchungs-GUID je Buchung und Kennzeichen „Generalumkehr“.`,
      `- Rechnungen_${z.name}.csv: ${rechnungen.length} gestellte Rechnungen mit Steuerart, Netto, USt, Brutto, Fälligkeit, Zahlungseingang und offenem Betrag; Summen je Steuersatz am Ende.`,
      ...(gutschriften.length ? [`- Gutschriften_${z.name}.csv: ${gutschriften.length} ${gutschriften.length === 1 ? "Gutschrift" : "Gutschriften"}, die der Betrieb als Leistungsempfänger ausgestellt hat – nicht in der Rechnungsliste; im Buchungsstapel als Aufwand (bezogene Leistungen).`] : []),
      ...(kasseImZeitraum.length ? [`- Kassenabschluesse_${z.name}.csv: ${kasseImZeitraum.length} Tagesabschlüsse (Z-Bons) mit Umsatz je Steuersatz, Zahlungsarten, Entnahmen/Einlagen, Bargeldbestand und Korrekturen.`] : []),
      `- Belege_${z.name}.csv: ${belege.length} Belege mit ${MARKE.name}-Belegnummer, Kategorie, Konto, Vorsteuer und Zahltag; Summe am Ende.`,
      `- Fragen_${z.name}.txt: ${fragen.anzahl ? `${fragen.anzahl} ${fragen.anzahl === 1 ? "Punkt" : "Punkte"} zum Klären (nur Sachverhalte aus den Daten)` : "keine offenen Punkte gefunden"}.`,
      `- E-Rechnungen/: XRechnung der Ausgangsrechnungen${gutschriften.length ? " und Gutschriften" : ""}${ohneXml ? ` (${ohneXml} ohne, siehe unten)` : ""}.`,
      ...(pdfs ? [`- Rechnungen/: PDFs der Rechnungen${gutschriften.length ? " und Gutschriften" : ""} (${pdfs.size}), Name = Nummer_Kunde.`] : []),
      `- Nach dem Erstellen dieses Pakets schreibt ${MARKE.name} die enthaltenen Belege fest – ändern geht dann nur mit Grund (Änderungsprotokoll).`,
      `- Belege/: Originaldateien (Fotos, PDFs, E-Rechnungen) – unverändert. Der Dateiname beginnt mit der ${MARKE.name}-Belegnummer (z. B. B${z.von.slice(0, 4)}-001); im Buchungsstapel steht in Belegfeld 1 die Belegnummer des Lieferanten, ohne sie die ${MARKE.name}-Belegnummer – genauso in der Belegliste.`,
      ...(istJahr(z) ? [``, `Jahrespaket: Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren – gleiche Buchungen (gleiche Buchungs-GUID in Beleginfo 1).`] : []),
      ...(ohneXml ? [``, `Rechnungen ohne E-Rechnung (XRechnung)`, ...ohneXmlListe] : []),
      ``,
      `Nicht enthalten – bitte zusätzlich liefern`,
      // Kassenumsätze: einmal unter „Wichtig“ (R10)
      bilanz && zahlungenBuchen ? `- Kontoauszüge – gebucht sind nur die Zahlungseingänge auf Rechnungen (siehe „Wichtig“), keine Zahlungen von Belegen.` : `- Kontoauszüge – Zahlungen sind nicht gebucht.`,
      kapital ? `- Weitere Vorgänge mit Gesellschaftern (außer privat ausgelegten Belegen und Bewegungen der Kasse).` : `- Privatentnahmen und Privateinlagen (außer privat bezahlten Belegen, Bewegungen der Kasse und Sachentnahmen).`,
      `- An das Finanzamt gezahlte Umsatzsteuer-Vorauszahlungen und Erstattungen.`,
      `- Abschreibungen (AfA) und Anlagenverzeichnis.`,
      `- Lohnjournal bzw. Lohnabrechnungen.`,
      // E-165 (Praxis): Umsätze, die nicht über Rechnungen der App laufen (Abrechnungszentrum, Zuzahlungen, Empfang)
      ...(umsaetzeAusserhalbDerApp(s) ? [`- Umsätze, die nicht über Rechnungen aus ${MARKE.name} laufen: z. B. Sammelauszahlungen eines Abrechnungszentrums für Kassenpatienten (Abrechnung mit den Krankenkassen nach § 302 SGB V) samt der damit verrechneten Gebühren, Zuzahlungen der Patienten und Verkäufe am Empfang. Einnahme ist der Betrag vor Abzug der Gebühr; die Gebühr ist eine eigene Ausgabe. Diese Umsätze fehlen im Buchungsstapel und in der Voranmeldung der App.`] : []),
      ``,
      `Zuordnung: Rechnungen nach Rechnungsdatum${istEuer ? " (im Buchungsstapel nach Zahlungseingang)" : ""}, Belege nach Belegdatum. Im Buchungsstapel stehen bei Rechnungen das Leistungsdatum (Feld „Leistungsdatum“) und der Tag, nach dem die App die Umsatzsteuer zuordnet (Feld „Datum Zuord. Steuerperiode“). ${personenkonten ? `Forderungen und Verbindlichkeiten gehen auf Personenkonten (Debitoren 10000 ff., Kreditoren 70000 ff., Kontenvorgabe); Barbelege und Kasse wie bisher` : `Forderungen und Verbindlichkeiten gehen auf die Konten ohne Kontokorrent (${k.forderungen}/${k.verbindlichkeiten})`}${vorgaben?.belegeGegenBank ? `; Belege per Überweisung oder Karte direkt gegen Bank (${k.bank}, Kontenvorgabe)` : ""}.${pdfs ? "" : " Die PDFs der Ausgangsrechnungen liegen beim Betrieb."}`,
      // Kleinunternehmer geben in der Regel keine Voranmeldung ab – dann kein Satz dazu; sonst nach „Mein Betrieb“ (Soll/Ist)
      ...(ku
        ? []
        : [
            istEuer
              ? `Die Umsatzsteuer-Voranmeldung ordnet Rechnungen wie der Buchungsstapel nach dem Zahlungseingang zu (Ist-Versteuerung, § 20 UStG); eine Stornorechnung zählt mit der vermerkten Erstattung. Die Rechnungsliste bleibt nach Rechnungsdatum.`
              : ist
              ? `Die Umsatzsteuer-Voranmeldung ordnet Rechnungen dagegen nach dem Zahlungseingang zu (Ist-Versteuerung, § 20 UStG); eine Stornorechnung zählt mit der vermerkten Erstattung – an den Grenzen eines Zeitraums können die Summen dieses Pakets deshalb von der Voranmeldung abweichen.`
              : `Die Umsatzsteuer-Voranmeldung ordnet Rechnungen dagegen nach dem Leistungsdatum zu (Soll-Versteuerung) – an den Grenzen eines Zeitraums können die Summen dieses Pakets deshalb von der Voranmeldung abweichen.`,
          ]),
    ].join("\r\n"),
  );
  return { zip: paketZippen(inhalt), dateiname: `${MARKE.name}-Steuerberatung-${sicher(s.betrieb.name || "Betrieb")}-${z.name}.zip`, rechnungen: rechnungen.length, gutschriften: gutschriften.length, belege: belege.length, ohneXml, buchungen: buchungen.length, fragen: fragen.anzahl, pdfs: pdfs?.size ?? 0 };
}

/** Zeiträume zur Auswahl: aktuelles und letztes Jahr, Quartale und Monate des laufenden Jahres bis heute. */
export function zeitraeume(heute: string): Zeitraum[] {
  const j = Number(heute.slice(0, 4));
  const m = Number(heute.slice(5, 7));
  const ende = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10);
  const zwei = (n: number) => String(n).padStart(2, "0");
  const z: Zeitraum[] = [];
  // laufender und zwei vorherige Monate, über den Jahreswechsel hinweg (im Januar gehört der Dezember dazu)
  for (let i = 0; i < 3; i++) {
    const jahr = m - i >= 1 ? j : j - 1;
    const monat = ((m - i - 1 + 12) % 12) + 1;
    z.push({ von: `${jahr}-${zwei(monat)}-01`, bis: ende(jahr, monat), name: `${jahr}-${zwei(monat)}` });
  }
  // laufendes und drei vorherige Quartale, ebenfalls über den Jahreswechsel (im Januar: Q4 des Vorjahrs)
  const q0 = Math.ceil(m / 3);
  for (let i = 0; i < 4; i++) {
    const jahr = q0 - i >= 1 ? j : j - 1;
    const q = ((q0 - i - 1 + 4) % 4) + 1;
    z.push({ von: `${jahr}-${zwei(q * 3 - 2)}-01`, bis: ende(jahr, q * 3), name: `${jahr}-Q${q}` });
  }
  z.push({ von: `${j}-01-01`, bis: `${j}-12-31`, name: String(j) }, { von: `${j - 1}-01-01`, bis: `${j - 1}-12-31`, name: String(j - 1) });
  return z;
}

/** Vorauswahl: das zuletzt abgeschlossene Quartal – das braucht die Steuerberatung für die Voranmeldung. */
export function standardZeitraum(heute: string): string {
  const j = Number(heute.slice(0, 4));
  const q = Math.ceil(Number(heute.slice(5, 7)) / 3) - 1;
  return q >= 1 ? `${j}-Q${q}` : `${j - 1}-Q4`;
}
