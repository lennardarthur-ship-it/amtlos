/**
 * Buchungen und DATEV-Export (E-133): aus Ausgangsrechnungen und Belegen entstehen einfache Buchungssätze (Forderung an
 * Erlös, Aufwand an Verbindlichkeit/Kasse/Privateinlage). Sie gehen als DATEV-Format „Buchungsstapel“ (EXTF, Version
 * 700, Kategorie 21) an die Steuerberatung oder als lesbare CSV an Menschen und Tabellenprogramme. Reine Funktionen
 * ohne Gerät; die Kodierung nach Windows-1252 liefert `datevExtfBytes`, das Schreiben der Datei ist Sache des Aufrufers.
 *
 * Fachlich zu prüfen – siehe `pruefpunkteBuchungen()` und PRUEFLISTE:
 * - Die Spaltenliste der Buchungszeile (125 Felder der Version 700) ist aus dem Gedächtnis nachgebaut und NICHT gegen den
 *   aktuellen DATEV-Schnittstellen-Entwicklungsleitfaden abgeglichen. Sicher sind die ersten 14 Kernfelder (Umsatz bis
 *   Buchungstext); dazu kommt die „Buchungs GUID“ (Feld 103, stabil aus Quelle und Steuersatz). Alle weiteren bleiben
 *   leer und müssen nur in Anzahl und Reihenfolge stimmen.
 * - Im Dateikopf stehen „Datum vom“ und „Datum bis“ als JJJJMMTT (wie der Wirtschaftsjahresbeginn), nicht als TTMMJJJJ;
 *   Feld 27 trägt den Kontenrahmen („03“/„04“).
 * - Konten, BU-Schlüssel 40/9/8 und die Umkehrbuchung für Stornos sind Annahmen.
 *
 * R10 (Steuerberatung): Belege mit Vorsteuer auf Konten ohne Steuerautomatik bekommen BU 9 (19 %) bzw. 8 (7 %); das
 * Erlöskonto richtet sich nach der Steuerart der Rechnung (igL, § 13b Inland, EU-Leistung, Drittland); § 13b-Eingangs-
 * leistungen gehen auf eigene Konten; Gutschriften werden als Aufwand gebucht; Personal-Belege und privat ausgelegte
 * Belege einer Kapitalgesellschaft bleiben aus dem Stapel (nur Belegliste); Leistungsdatum und Datum der Steuerperiode
 * stehen in den Feldern 115/116; Forderungen und Verbindlichkeiten auf Konten ohne Kontokorrent.
 */
import { belegKennung, belegSkonto, kategorieFuer, zahltag, type Beleg } from "./belege.js";
import { summen, type Position } from "./rechnung.js";
import { minderungNachSatz, type SatzBetrag } from "./skonto.js";

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
  /** „umbuchung“ (R12): Geld zwischen Kasse, Geldtransit und Privat – weder Einnahme noch Ausgabe */
  art: "einnahme" | "ausgabe" | "storno" | "umbuchung";
  /** ID der Rechnung oder des Belegs, aus dem die Buchung stammt */
  quelle_id: string;
  /** stabile Kennung der Buchung (36 Zeichen), abgeleitet aus Quelle und Steuersatz – DATEV-Feld „Buchungs GUID“ */
  guid?: string;
  /** Leistungsdatum (ISO) – DATEV-Feld „Leistungsdatum“ (115) */
  leistungsdatum?: string | null;
  /** Tag, nach dem die App die Umsatzsteuer dem Zeitraum zuordnet (ISO) – DATEV-Feld „Datum Zuord. Steuerperiode“ (116) */
  steuerperiode?: string | null;
  /** USt-IdNr. des Abnehmers bei innergemeinschaftlichen Lieferungen und EU-Leistungen – „EU-Land u. UStID (Bestimmung)“ */
  eu_ustid?: string | null;
  /** R12: Kostenstelle (KOST1), z. B. Filiale einer Kasse */
  kost1?: string;
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
  /** bei einem Storno: Nummer der stornierten Rechnung (für den Buchungstext „Storno … zu RE …“) */
  storniert_nummer?: string | null;
  /**
   * Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Betrieb rechnet als Leistungsempfänger ab – für ihn eine Ausgabe, kein
   * Erlös. Wird nicht als Erlös gebucht; die Ausgabe kommt aus dem Beleg bzw. von der Steuerberatung.
   */
  gutschrift?: boolean;
  kleinunternehmer: boolean;
  kunde: string;
  positionen: Position[];
  /** Grund für 0 % (aus der Rechnung); bestimmt das Erlöskonto */
  steuerart?: "standard" | "reverse_charge" | "igl" | "befreit" | "nullsatz";
  /** Land des Empfängers (ISO 3166-1 alpha-2) – Inland, übriges Gemeinschaftsgebiet oder Drittland */
  kunde_land?: string | null;
  kunde_ust_idnr?: string | null;
  /** Leistungsdatum bzw. Ende des Leistungszeitraums (ISO) */
  leistungsdatum?: string | null;
  /** Tag der Zuordnung zur Steuerperiode, wie die Voranmeldung der App ihn verwendet (ISO) */
  steuerperiode?: string | null;
  /** Gutschrift: der Betrieb (Aussteller, Leistungsempfänger) ist Kleinunternehmer – keine Vorsteuer */
  empfaenger_ku?: boolean;
  /**
   * R12 (Ist-Versteuerung mit Teilzahlungen): nur diese Beträge je Steuersatz buchen (brutto) statt der ganzen Rechnung –
   * z. B. eine Zahlung samt Skonto. `guid_zusatz` unterscheidet mehrere Buchungen derselben Rechnung.
   */
  anteil?: SatzBetrag[];
  guid_zusatz?: string;
}

/** Mitgliedstaaten der EU außer Deutschland (ISO 3166-1; Griechenland als GR) – für Erlöskonten und Hinweise. */
export const EU_LAENDER = ["AT", "BE", "BG", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"] as const;
export const istEuAusland = (land: string | null | undefined) => !!land && (EU_LAENDER as readonly string[]).includes(land.toUpperCase());

/**
 * BU-Schlüssel, der die Steuerautomatik eines Automatikkontos aufhebt („keine Steuer“) – gesetzt, wenn ein Beleg keinen
 * Vorsteuerabzug erlaubt, das Kategorie-Konto aber Vorsteuer automatisch ziehen würde. Fachlich zu prüfen.
 */
export const BU_OHNE_STEUER = "40";
/** BU-Schlüssel für Vorsteuer auf Konten ohne Steuerautomatik: 9 = 19 %, 8 = 7 % (16 % und 5 % aus 2020: offen, PRUEFLISTE). */
export const BU_VORSTEUER: Record<number, string> = { 19: "9", 7: "8" };

/**
 * Automatikkonten der verwendeten Kategorien: Die Steuer rechnet DATEV aus dem Konto selbst (kein BU-Schlüssel, ohne
 * Vorsteuerabzug BU 40). Alle anderen Aufwandskonten sind ohne Automatik und brauchen BU 9/8 (fachlich zu prüfen).
 */
export const AUTOMATIKKONTEN: Record<Kontenrahmen, readonly string[]> = {
  // R12: Skontokonten mit Steuersatz (gewährte Skonti 19 %/7 %, erhaltene Skonti 19 %/7 % Vorsteuer) – PRUEFLISTE
  SKR03: ["3400", "3300", "3120", "3123", "3140", "3143", "8736", "8731", "3736", "3731"],
  SKR04: ["5400", "5300", "5920", "5923", "5940", "5943", "4736", "4731", "5736", "5731"],
};

/**
 * Konten für § 13b-Eingangsleistungen (Automatik: Umsatzsteuer, mit Vorsteuerabzug auch die Vorsteuer): Bauleistung eines
 * im Inland ansässigen Unternehmers bzw. sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers.
 * R11: auch ohne Vorsteuerabzug (Kleinunternehmer, steuerfreie Umsätze nach § 4 Nr. 8 ff.) – Konten „ohne Vorsteuer und
 * 19 % Umsatzsteuer“, sonst fehlte die Steuer (Kz 47/85) im Stapel. SKR03 3120/3123 bzw. 3140/3143, SKR04 5920/5923
 * bzw. 5940/5943 – nach Angabe der Steuerberatung, gegen den Kontenrahmen prüfen (PRUEFLISTE).
 */
export const KONTEN_13B: Record<Kontenrahmen, { mit: { bau: string; eu: string }; ohne: { bau: string; eu: string } }> = {
  SKR03: { mit: { bau: "3120", eu: "3123" }, ohne: { bau: "3140", eu: "3143" } },
  SKR04: { mit: { bau: "5920", eu: "5923" }, ohne: { bau: "5940", eu: "5943" } },
};

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
    /** R12: Privatentnahmen allgemein (Bargeld aus der Kasse) */
    privatentnahmen: string;
    /** R12: Geldtransit – Kartenzahlungen der Kasse bis zur Gutschrift auf dem Bankkonto, Bargeld auf dem Weg zur Bank */
    geldtransit: string;
    /** R12: gewährte Skonti je Steuersatz (0 = ohne Umsatzsteuer, auch Kleinunternehmer) – Minderung der Erlöse */
    skontiGewaehrt: { 19: string; 7: string; 0: string };
    /** R12: erhaltene Skonti je Steuersatz der Vorsteuer (0 = ohne Vorsteuer) – Minderung des Aufwands */
    skontiErhalten: { 19: string; 7: string; 0: string };
    /**
     * Erlöskonten je Steuersatz; `ku` für Kleinunternehmer (§ 19 UStG), `0` für steuerfreie Umsätze (§ 4 Nr. 8 ff. UStG
     * und vorerst der Nullsteuersatz), `igl` innergemeinschaftliche Lieferung, `rc13b` § 13b-Umsatz im Inland, `eu`
     * sonstige Leistung an Unternehmen im übrigen Gemeinschaftsgebiet (Empfänger schuldet die Steuer), `drittland`
     * im Drittland steuerbare Leistung (im Inland nicht steuerbar)
     */
    erloese: { 19: string; 7: string; 0: string; ku: string; igl: string; rc13b: string; eu: string; drittland: string };
    /** Aufwandskonto für Gutschriften (bezogene Leistungen) */
    gutschrift: string;
  }
> = {
  // Forderungen/Verbindlichkeiten ohne Kontokorrent (1410/1610 bzw. 1210/3310), damit beim Bankabruf kein OPOS nötig ist
  SKR03: { forderungen: "1410", verbindlichkeiten: "1610", kasse: "1000", privateinlagen: "1890", privatentnahmen: "1800", geldtransit: "1360", skontiGewaehrt: { 19: "8736", 7: "8731", 0: "8730" }, skontiErhalten: { 19: "3736", 7: "3731", 0: "3730" }, erloese: { 19: "8400", 7: "8300", 0: "8100", ku: "8195", igl: "8125", rc13b: "8337", eu: "8336", drittland: "8338" }, gutschrift: "3100" },
  SKR04: { forderungen: "1210", verbindlichkeiten: "3310", kasse: "1600", privateinlagen: "2180", privatentnahmen: "2100", geldtransit: "1460", skontiGewaehrt: { 19: "4736", 7: "4731", 0: "4730" }, skontiErhalten: { 19: "5736", 7: "5731", 0: "5730" }, erloese: { 19: "4400", 7: "4300", 0: "4100", ku: "4185", igl: "4125", rc13b: "4337", eu: "4336", drittland: "4338" }, gutschrift: "5900" },
};

/** BU-Schlüssel eines Aufwands: Automatikkonto ohne Vorsteuerabzug 40, Konto ohne Automatik mit Vorsteuer 9/8, sonst leer. */
export function buAufwand(kontenrahmen: Kontenrahmen, konto: string, satz: number, vorsteuer: boolean): string {
  if (satz <= 0) return "";
  if (AUTOMATIKKONTEN[kontenrahmen].includes(konto)) return vorsteuer ? "" : BU_OHNE_STEUER;
  return vorsteuer ? (BU_VORSTEUER[satz] ?? "") : "";
}

const UMLAUTE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "AE", Ö: "OE", Ü: "UE", ß: "ss" };

/** Belegfeld 1: höchstens 36 Zeichen aus Ziffern, Buchstaben und $ & % * + - / (DATEV); Umlaute werden umschrieben. */
export function belegfeld1Aus(s: string): string {
  return s
    .replace(/[äöüÄÖÜß]/g, (z) => UMLAUTE[z] ?? z)
    .replace(/[^A-Za-z0-9$&%*+\-/]/g, "")
    .slice(0, 36);
}

/** Leerraum zusammenziehen und auf `n` Zeichen kürzen (Buchungstext, Bezeichnung). */
const kuerze = (s: string, n: number) => Array.from(s.replace(/\s+/g, " ").trim()).slice(0, n).join("").trimEnd(); // nach Zeichen, nicht mitten durch ein Emoji

/** Länge des Lieferanten- bzw. Kundennamens im Buchungstext */
const NAME_IM_TEXT = 40;

/**
 * Stabile Buchungs-GUID (36 Zeichen, Form 8-4-4-4-12, Version 8 nach RFC 9562) aus Quelle und Steuersatz: dieselbe
 * Rechnung bzw. derselbe Beleg ergibt in jedem Paket dieselbe GUID. Kein Zufall, keine Kryptografie – vier FNV-1a-Hashes.
 */
export function buchungsGuid(quelle_id: string, satz: number | null): string {
  const text = `amtlos|${quelle_id}|${satz === null ? "ku" : satz}`;
  const teile: string[] = [];
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    teile.push(h.toString(16).padStart(8, "0"));
  }
  const hex = teile.join("").split("");
  hex[12] = "8"; // Version 8 (frei definiert)
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16); // Variante RFC 9562
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function erloeskonto(k: (typeof BUCHUNGSKONTEN)[Kontenrahmen], satz: number | null, r?: Pick<AusgangsRechnungFuerBuchung, "steuerart" | "kunde_land">): string {
  const land = (r?.kunde_land ?? "DE").toUpperCase();
  // Leistung an ein Unternehmen im übrigen Gemeinschaftsgebiet mit Steuerschuldnerschaft des Empfängers – auch bei
  // Kleinunternehmern (Ort der Leistung im Ausland, § 3a Abs. 2 UStG)
  if ((satz === 0 || satz === null) && r?.steuerart === "reverse_charge") return istEuAusland(land) ? k.erloese.eu : land === "DE" ? k.erloese.rc13b : k.erloese.drittland;
  if (satz === null) return k.erloese.ku;
  if (satz === 7) return k.erloese[7];
  if (satz === 0) return r?.steuerart === "igl" ? k.erloese.igl : k.erloese[0];
  // Regelsatz; ein unbekannter Satz landet ebenfalls hier (die App kennt nur 19, 7 und 0)
  return k.erloese[19];
}

/**
 * Je Rechnung und Steuersatz eine Buchung Forderungen an Erlöse mit dem Bruttobetrag (das Automatikkonto rechnet die
 * Umsatzsteuer selbst). Stornos als einfache Umkehrbuchung (Soll und Haben getauscht). Gebucht wird zum Datum in
 * `datum` – bei Ist-Versteuerung ohne Bilanz und bei Abschlagsrechnungen gibt der Aufrufer den Zahltag mit und lässt
 * Unbezahltes weg (R11, Prüfpunkt). Gutschriften (auch ihre Stornos) werden als Aufwand gebucht.
 */
export function buchungenAusRechnungen(rechnungen: AusgangsRechnungFuerBuchung[], kontenrahmen: Kontenrahmen, _o?: { versteuerung?: "soll" | "ist" }): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const r of rechnungen) {
    if (r.gutschrift) {
      aus.push(...gutschriftBuchungen(r, kontenrahmen));
      continue;
    }
    const storno = r.art === "storno";
    const kunde = kuerze(r.kunde, NAME_IM_TEXT);
    const buchungstext = kuerze(storno ? `Storno ${r.nummer}${r.storniert_nummer ? ` zu RE ${r.storniert_nummer}` : ""} ${kunde}` : `RE ${r.nummer} ${kunde}`, 60);
    const gruppen = r.anteil ? r.anteil.map((a) => ({ satz: a.satz, netto_cent: a.netto_cent, ust_cent: a.ust_cent })) : summen(r.positionen, r.kleinunternehmer).gruppen;
    for (const g of gruppen) {
      const brutto = g.netto_cent + g.ust_cent;
      if (!brutto) continue;
      // eine negative Summe (nur bei negativen Positionen) dreht die Seite ebenfalls um
      const haben = storno ? brutto > 0 : brutto < 0;
      aus.push({
        datum: r.datum,
        betrag_cent: Math.abs(brutto),
        soll_haben: haben ? "H" : "S",
        konto: k.forderungen,
        gegenkonto: erloeskonto(k, g.satz, r),
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext,
        ust_satz: g.satz,
        art: storno ? "storno" : "einnahme",
        quelle_id: r.id,
        guid: buchungsGuid(r.guid_zusatz ? `${r.id}|${r.guid_zusatz}` : r.id, g.satz),
        leistungsdatum: r.leistungsdatum ?? null,
        steuerperiode: r.steuerperiode ?? null,
        // USt-IdNr. des Abnehmers für Kz 41/21 und die Zusammenfassende Meldung
        eu_ustid: (g.satz === 0 || g.satz === null) && (r.steuerart === "igl" || (r.steuerart === "reverse_charge" && istEuAusland(r.kunde_land))) && r.kunde_ust_idnr ? r.kunde_ust_idnr.replace(/\s/g, "").toUpperCase() : null,
      });
    }
  }
  return aus;
}

/**
 * Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Betrieb ist Leistungsempfänger – Aufwand (bezogene Leistungen) an
 * Verbindlichkeiten, mit Vorsteuer (BU 9/8), wenn der Leistende Umsatzsteuer ausweist und der Betrieb kein
 * Kleinunternehmer ist. Ein Storno der Gutschrift kehrt die Seiten um.
 */
function gutschriftBuchungen(r: AusgangsRechnungFuerBuchung, kontenrahmen: Kontenrahmen): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const storno = r.art === "storno";
  const text = kuerze(`${storno ? "Storno " : ""}Gutschrift ${r.nummer} ${kuerze(r.kunde, NAME_IM_TEXT)}`, 60);
  const aus: Buchung[] = [];
  for (const g of summen(r.positionen, r.kleinunternehmer).gruppen) {
    const brutto = g.netto_cent + g.ust_cent;
    if (!brutto) continue;
    const haben = storno ? brutto > 0 : brutto < 0;
    aus.push({
      datum: r.datum,
      betrag_cent: Math.abs(brutto),
      soll_haben: haben ? "H" : "S",
      konto: k.gutschrift,
      gegenkonto: k.verbindlichkeiten,
      bu_schluessel: g.satz ? buAufwand(kontenrahmen, k.gutschrift, g.satz, !r.empfaenger_ku) : "",
      belegfeld1: belegfeld1Aus(r.nummer),
      buchungstext: text,
      ust_satz: g.satz,
      art: "ausgabe",
      quelle_id: r.id,
      guid: buchungsGuid(r.id, g.satz),
      leistungsdatum: r.leistungsdatum ?? null,
    });
  }
  return aus;
}

/** Skontokonto je Steuersatz – 16 % und 5 % (2020) wie 19 % bzw. 7 % (PRUEFLISTE), ohne Satz das Konto ohne Steuer. */
const skontoKonto = (konten: { 19: string; 7: string; 0: string }, satz: number | null) => (satz === null || satz <= 0 ? konten[0] : satz <= 7 ? konten[7] : konten[19]);

/**
 * R12: gewährtes Skonto bzw. andere Minderung beim Zahlungseingang einer Ausgangsrechnung (§ 17 Abs. 1 UStG) – je
 * Steuersatz „Gewährte Skonti“ an Forderungen, zum Tag der Zahlung (Feld 116 ebenso). Die Skontokonten mit Steuersatz
 * sind Automatikkonten (kein BU-Schlüssel); Kleinunternehmer und 0 % auf das Konto ohne Umsatzsteuer.
 */
export function skontoBuchungenRechnung(r: Pick<AusgangsRechnungFuerBuchung, "id" | "nummer" | "kunde" | "kleinunternehmer" | "positionen">, minderungen: { id: string; datum: string; brutto_cent: number }[], kontenrahmen: Kontenrahmen): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const gruppen = summen(r.positionen, r.kleinunternehmer).gruppen;
  const aus: Buchung[] = [];
  for (const m of minderungen) {
    if (!m.brutto_cent) continue;
    for (const a of minderungNachSatz(m.brutto_cent, gruppen)) {
      if (!a.brutto_cent) continue;
      aus.push({
        datum: m.datum,
        betrag_cent: Math.abs(a.brutto_cent),
        soll_haben: a.brutto_cent < 0 ? "H" : "S",
        konto: skontoKonto(k.skontiGewaehrt, r.kleinunternehmer ? null : a.satz),
        gegenkonto: k.forderungen,
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext: kuerze(`Skonto RE ${r.nummer} ${kuerze(r.kunde, NAME_IM_TEXT)}`, 60),
        ust_satz: r.kleinunternehmer ? null : a.satz,
        art: "einnahme",
        quelle_id: r.id,
        guid: buchungsGuid(`${r.id}|skonto|${m.id}`, a.satz),
        steuerperiode: m.datum,
      });
    }
  }
  return aus;
}

/** Gegenkonto eines Belegs nach Zahlungsweg – bar nur gegen Kasse, wenn Amtlos die Kasse an diesem Tag führt (R12). */
function belegGegenkonto(b: Beleg, k: (typeof BUCHUNGSKONTEN)[Kontenrahmen], kasseAb: string | null | undefined): string {
  if (b.zahlung === "privat") return k.privateinlagen;
  if (b.zahlung !== "bar") return k.verbindlichkeiten;
  // ohne Angabe wie bisher Kasse; mit Angabe: ab dem ersten Kassenabschluss Kasse, sonst Geldtransit (kein Kassenminus)
  if (kasseAb === undefined) return k.kasse;
  return kasseAb && zahltag(b) >= kasseAb ? k.kasse : k.geldtransit;
}

/**
 * R12: erhaltenes Skonto eines Belegs – je Steuersatz Gegenkonto des Belegs (Verbindlichkeiten, Kasse, Privat) an
 * „Erhaltene Skonti“, zum Zahltag. Mit Vorsteuerabzug die Konten mit Vorsteuer (Automatik), sonst das Konto ohne.
 */
export function skontoBuchungenBelege(belege: Beleg[], kontenrahmen: Kontenrahmen, o?: { nummern?: Map<string, string>; kapitalgesellschaft?: boolean; kleinunternehmer?: boolean; kasseAb?: string | null }): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const b of belege) {
    if (!b.skonto_cent || !belegImStapel(b, o)) continue;
    const kat = kategorieFuer(b.kategorie);
    const belegfeld1 = belegfeld1Aus(belegKennung(b, o?.nummern?.get(b.id) ?? belegfeld1Aus(b.id).slice(0, 12).toUpperCase()));
    for (const a of belegSkonto(b)) {
      const mitVst = b.vorsteuer && !o?.kleinunternehmer;
      aus.push({
        datum: zahltag(b),
        betrag_cent: Math.abs(a.brutto_cent),
        soll_haben: a.brutto_cent < 0 ? "H" : "S",
        konto: belegGegenkonto(b, k, o?.kasseAb),
        gegenkonto: skontoKonto(k.skontiErhalten, mitVst ? a.satz : null),
        bu_schluessel: "",
        belegfeld1,
        buchungstext: kuerze(`Skonto ${kuerze(b.lieferant, NAME_IM_TEXT)} ${kat.kurz}`, 60),
        ust_satz: a.satz,
        art: "ausgabe",
        quelle_id: b.id,
        guid: buchungsGuid(`${b.id}|skonto`, a.satz),
      });
    }
  }
  return aus;
}

/**
 * Je Beleg und Steuersatz eine Buchung Aufwandskonto (aus der Kategorie) an Verbindlichkeiten, bei Barzahlung an Kasse
 * (R12: mit `kasseAb` nur ab dem ersten Kassenabschluss in Amtlos, davor bzw. ohne Kasse an Geldtransit), bei privater
 * Zahlung an Privateinlagen – mit dem Bruttobetrag. Ohne Vorsteuerabzug bei Satz > 0: BU-Schlüssel 40.
 * Belegfeld 1: Nummer des Lieferanten (normalisiert, `belegnummerNormal`), sonst die Amtlos-Belegnummer aus
 * `o.nummern` (`belegNummern`), ohne diese die Beleg-ID in Kurzform. Buchungstext: Lieferant (höchstens 40 Zeichen)
 * und Kurzbezeichnung der Kategorie.
 */
export function buchungenAusBelegen(belege: Beleg[], kontenrahmen: Kontenrahmen, o?: { nummern?: Map<string, string>; kapitalgesellschaft?: boolean; kleinunternehmer?: boolean; kasseAb?: string | null }): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const b of belege) {
    if (!belegImStapel(b, o)) continue;
    const kat = kategorieFuer(b.kategorie);
    const konten = kontenrahmen === "SKR03" ? kat.skr03 : kat.skr04;
    // § 13b: mit Vorsteuerabzug die Konten „19 % Vorsteuer und 19 % Umsatzsteuer“, sonst „ohne Vorsteuer“ (R11)
    const k13b = b.steuerschuld ? KONTEN_13B[kontenrahmen][b.vorsteuer && !o?.kleinunternehmer ? "mit" : "ohne"] : null;
    const gegenkonto = belegGegenkonto(b, k, o?.kasseAb);
    const buchungstext = kuerze(`${kuerze(b.lieferant, NAME_IM_TEXT)} ${kat.kurz}`, 60);
    const belegfeld1 = belegfeld1Aus(belegKennung(b, o?.nummern?.get(b.id) ?? belegfeld1Aus(b.id).slice(0, 12).toUpperCase()));
    for (const s of b.steuer) {
      if (!s.brutto_cent) continue;
      // § 13b: Automatikkonto für die Steuer (und ggf. die Vorsteuer); sonst das Kategorie-Konto
      const konto = k13b ? k13b[b.steuerschuld!] : (konten[s.satz] ?? konten[19] ?? "");
      aus.push({
        datum: b.datum,
        betrag_cent: Math.abs(s.brutto_cent),
        soll_haben: s.brutto_cent < 0 ? "H" : "S",
        konto,
        gegenkonto,
        bu_schluessel: b.steuerschuld ? "" : buAufwand(kontenrahmen, konto, s.satz, b.vorsteuer),
        belegfeld1,
        buchungstext,
        ust_satz: s.satz,
        art: "ausgabe",
        quelle_id: b.id,
        guid: buchungsGuid(b.id, s.satz),
      });
    }
  }
  return aus;
}

/**
 * Gehört ein Beleg in den Buchungsstapel? Nicht: Personal (Lohn bucht die Steuerberatung aus der Lohnbuchhaltung,
 * sonst doppelt) und – bei Kapitalgesellschaften – privat ausgelegte Belege (keine Privatkonten; das Gesellschafter-
 * Verrechnungskonto legt die Steuerberatung fest). Beide stehen nur in der Belegliste.
 */
export function belegImStapel(b: Pick<Beleg, "kategorie" | "zahlung">, o?: { kapitalgesellschaft?: boolean }): boolean {
  if (b.kategorie === "personal") return false;
  if (o?.kapitalgesellschaft && b.zahlung === "privat") return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// DATEV-Format „Buchungsstapel“ (EXTF, Version 700, Kategorie 21)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Spaltenüberschriften der Buchungszeile, Version 700 (125 Felder). Aus dem Gedächtnis nachgebaut – gegen den
 * DATEV-Schnittstellen-Entwicklungsleitfaden prüfen. Gefüllt werden die Felder 1–14 und „Buchungs GUID“; die übrigen bleiben leer.
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

/** Index des Felds „Buchungs GUID“ in der Buchungszeile (Feld 103 der Version 700 – fachlich zu prüfen) */
export const DATEV_GUID = DATEV_SPALTEN.indexOf("Buchungs GUID");
/** Felder 115 „Leistungsdatum“, 116 „Datum Zuord. Steuerperiode“ und 40 „EU-Land u. UStID (Bestimmung)“ */
export const DATEV_LEISTUNGSDATUM = DATEV_SPALTEN.indexOf("Leistungsdatum");
export const DATEV_STEUERPERIODE = DATEV_SPALTEN.indexOf("Datum Zuord. Steuerperiode");
export const DATEV_EU_USTID = DATEV_SPALTEN.indexOf("EU-Land u. UStID (Bestimmung)");
/** Feld „KOST1 - Kostenstelle“ (R12, Filiale einer Kasse) */
export const DATEV_KOST1 = DATEV_SPALTEN.indexOf("KOST1 - Kostenstelle");

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
const ttmmjjjjOhnePunkt = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
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
    if (b.guid) f[DATEV_GUID] = inAnfz(b.guid.slice(0, 36));
    if (b.eu_ustid) f[DATEV_EU_USTID] = inAnfz(b.eu_ustid.slice(0, 15));
    if (b.kost1) f[DATEV_KOST1] = inAnfz(b.kost1.slice(0, 36));
    // Datumsfelder TTMMJJJJ – damit ordnet DATEV die Umsatzsteuer wie die Voranmeldung der App zu
    if (b.leistungsdatum) f[DATEV_LEISTUNGSDATUM] = ttmmjjjjOhnePunkt(b.leistungsdatum);
    if (b.steuerperiode) f[DATEV_STEUERPERIODE] = ttmmjjjjOhnePunkt(b.steuerperiode);
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
    [ttmmjjjj(b.datum), betragMitKomma(b.betrag_cent), b.soll_haben, b.konto, b.gegenkonto, b.bu_schluessel, b.belegfeld1, b.buchungstext, b.ust_satz === null ? "" : String(b.ust_satz), b.guid ?? ""]
      .map(feld)
      .join(";"),
  );
  return "﻿" + ["Datum;Betrag;S/H;Konto;Gegenkonto;BU;Beleg;Text;USt;Buchungs-GUID", ...zeilen].join("\r\n") + "\r\n";
}

/** Fachlich unsichere Punkte dieser Datei als Sätze – für die PRUEFLISTE. */
export function pruefpunkteBuchungen(): string[] {
  return [
    "Sachkonten: Forderungen aus L+L ohne Kontokorrent (SKR03 1410, SKR04 1210), Verbindlichkeiten aus L+L ohne Kontokorrent (1610/3310), Kasse (1000/1600), Privateinlagen (1890/2180) und Erlöskonten 19 % (8400/4400), 7 % (8300/4300), Kleinunternehmer § 19 UStG (8195/4185) gegen den aktuellen DATEV-Kontenrahmen prüfen.",
    "Erlöskonten nach Steuerart: igL 8125/4125 (mit „EU-Land u. UStID“), § 13b im Inland 8337/4337, sonstige Leistung an Unternehmen im übrigen Gemeinschaftsgebiet (Empfänger schuldet die Steuer, Kz 21) 8336/4336, im Drittland steuerbare Leistung 8338/4338 – die Steuerberatung nannte 8338 für die EU-Leistung; nach unserem Stand ist 8338 das Drittlandkonto und 8336 das EU-Konto. Bitte prüfen. Nullsteuersatz (§ 12 Abs. 3 UStG, Kz 87) bleibt vorerst auf 8100/4100 – Konto für Kz 87 offen.",
    "Automatikkonten: nur SKR03 3400/3300 (Wareneingang 19/7 %), 3120/3123 (§ 13b) und SKR04 5400/5300 gelten als Automatikkonten (kein BU, ohne Vorsteuerabzug BU 40). Alle anderen Kategorie-Konten (z. B. 4930, 4600, 4210, 3100, 0420) gelten als Konten ohne Automatik und bekommen bei Vorsteuer BU 9 (19 %) bzw. 8 (7 %). Für die Sätze 16 % und 5 % (2. Halbjahr 2020) setzt der Export keinen BU-Schlüssel.",
    "BU-Schlüssel 40 („keine Steuer“ bei Automatikkonten) wird nur noch auf Automatikkonten gesetzt, wenn ein Beleg keinen Vorsteuerabzug erlaubt – weist DATEV BU 40 auf Konten ohne Automatik ab oder warnt es nur?",
    "§ 13b-Eingangsleistungen (R11): mit Vorsteuerabzug SKR03 3120 (Bauleistung eines im Inland ansässigen Unternehmers) bzw. 3123 (sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers), SKR04 5920/5923; ohne Vorsteuerabzug (Kleinunternehmer, Belege mit „Vorsteuer abziehbar“ aus) SKR03 3140/3143, SKR04 5940/5943 – alle als Automatikkonten für die Umsatzsteuer (und ggf. Vorsteuer) 19 %. Kontonummern nach Angabe der simulierten Steuerberatung („nach meinem Stand“), gegen den aktuellen Kontenrahmen prüfen; 7-%-Fälle sind nicht abgebildet.",
    "Gutschriften (§ 14 Abs. 2 Satz 2 UStG) werden als Aufwand auf „bezogene Leistungen“ (SKR03 3100, SKR04 5900) an Verbindlichkeiten gebucht, mit BU 9/8 bei ausgewiesener Steuer – passendes Aufwandskonto je nach Leistung mit der Steuerberatung klären.",
    "Personal-Belege und privat ausgelegte Belege einer Kapitalgesellschaft stehen nur in der Belegliste, nicht im Stapel. Verrechnungskonto Gesellschafter (z. B. SKR03 0755) mit der Steuerberatung festlegen.",
    "Felder 115 „Leistungsdatum“ und 116 „Datum Zuord. Steuerperiode“ (TTMMJJJJ) sind bei Ausgangsrechnungen gefüllt; Feld 40 „EU-Land u. UStID (Bestimmung)“ bei igL und EU-Leistungen – Format und Feldnummern prüfen.",
    "Stornos werden als einfache Umkehrbuchung (Soll und Haben getauscht) ausgegeben, nicht als Generalumkehr (Feld „Generalumkehr (GU)“ bzw. negativer Umsatz). Folgen für Verkehrszahlen und Umsatzstatistik mit der Steuerberatung klären.",
    "Die Spaltenliste der Buchungszeile (125 Felder, Version 700, Formatversion 13) ist aus dem Gedächtnis nachgebaut; gefüllt werden die ersten 14 Felder und „Buchungs GUID“ (Feld 103, stabile GUID aus Quelle und Steuersatz – darf der Export sie setzen, und steht sie an der richtigen Stelle?). Reihenfolge, Anzahl und Bezeichnungen gegen den DATEV-Schnittstellen-Entwicklungsleitfaden prüfen.",
    "Dateikopf: „Datum vom“ und „Datum bis“ stehen als JJJJMMTT (nicht TTMMJJJJ), Feld 27 trägt den Kontenrahmen („03“/„04“), Festschreibung 0, Rechnungslegungszweck 0, Herkunft „RE“ – gegen die Formatbeschreibung prüfen. Berater- und Mandantennummer sind beim Import Pflicht.",
    "Ist-Versteuerung (§ 20 UStG) ohne Bilanz (R11): Rechnungen stehen erst mit dem Zahlungseingang im Stapel – Forderungen (1410/1210) an Erlös mit dem Zahltag als Belegdatum und in Feld 116; unbezahlte Rechnungen stehen nur in der Rechnungsliste. Abschlagsrechnungen ebenso (auch bei Soll), weil die Steuer erst mit der Zahlung entsteht. Ob DATEV die Ist-Versteuerung so ohne OPOS richtig auflöst, ist offen – Testimport.",
    "Belegdatum im Format TTMM: das Jahr ergibt sich aus dem Stapelzeitraum. Alle Buchungen eines Stapels müssen in „Datum vom/bis“ und im Wirtschaftsjahr liegen – der Aufrufer muss je Zeitraum (Monat oder Jahr) einen eigenen Stapel erzeugen.",
    "Belege mit Zahlungsweg Bank werden gegen Verbindlichkeiten aus L+L ohne Kontokorrent gebucht, die Zahlung selbst nicht (sie kommt aus dem Kontoauszug der Steuerberatung). Bei Einnahmen-Überschuss-Rechnung ist der Zahlungstag maßgeblich – ob stattdessen direkt gegen Bank (SKR03 1200, SKR04 1800) gebucht werden soll, mit der Steuerberatung klären.",
    "R12 Kasse: Tageseinnahmen je Steuersatz Kasse (1000/1600) an Erlöse 19 %/7 % (8400/8300 bzw. 4400/4300), 0 % an 8100/4100, Kleinunternehmer an 8195/4185; der Kartenanteil (und „sonstige“ Zahlungsarten) Geldtransit (1360/1460) an Kasse; Bargeld zur Bank Geldtransit an Kasse; Privatentnahme 1800/2100 an Kasse; Privateinlage Kasse an 1890/2180. Leistungsdatum und Feld 116 = Tag des Z-Bons. Kassendifferenzen laut Zählung werden nicht gebucht. Barbelege nur ab dem ersten Kassenabschluss gegen Kasse, sonst gegen Geldtransit.",
    "R12 Skonto: gewährte Skonti SKR03 8736 (19 %), 8731 (7 %), 8730 (ohne USt, Kleinunternehmer, 0 %), SKR04 4736/4731/4730 an Forderungen zum Zahltag; erhaltene Skonti SKR03 3736/3731/3730, SKR04 5736/5731/5730 vom Gegenkonto des Belegs. Die Konten mit Steuersatz gelten als Automatikkonten (kein BU-Schlüssel). Bei Ist-Versteuerung wird je Zahlung der erhaltene Betrag plus Skonto als Erlös und das Skonto als Minderung gebucht.",
    "Belegfeld 1 wird auf die DATEV-zulässigen Zeichen (Ziffern, Buchstaben, $ & % * + - /) gekürzt, Umlaute werden umschrieben – stimmt die Zeichenliste? Textfelder werden nach Windows-1252 kodiert; andere Zeichen werden „?“.",
  ];
}
