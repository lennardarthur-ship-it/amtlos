/**
 * Steuern und Buchhaltung (E-121): Rechnung, EÜR, Bilanz/GuV, USt-Voranmeldung, Steuererklärung (Zusammenstellung),
 * Kassenbuch, Kassenmeldung, Aufbewahrung. Was elektronisch ans Finanzamt geht (Voranmeldung, Anlage EÜR, Erklärungen,
 * E-Bilanz, Kassenmeldung), erstellt die App als ausgefüllte Unterlage zum Übertragen – sie übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-58).
 */
import { KU_HINWEIS, einheitFuerMenge, fehlendFuerERechnung, rundeCent, summen, type Position, type RechnungsDaten } from "../rechnung.js";
import { einheitCode } from "../erechnung.js";
import { giroCodeSvg } from "../girocode.js";
import { EUER_ZEILE_STEUERFREI, EUER_ZEILE_STEUERPFLICHTIG, KATEGORIEN } from "../belege.js";
import { istKapitalgesellschaft } from "./betrieb.js";
import { AUFBEWAHRUNG, EINHEITEN, EUER_AUSGABEN, EUER_EINNAHMEN, KASSEN_ARTEN, RECHNUNGS_HINWEISE, TSE_ARTEN } from "./bausteine.js";
import { KOPF_LINIE, LINIE_MITTEL, ZELLE_LINIE, abschnitt, absatz, ankreuzen, anschrift, auswahl, brief, cent, datumDe, dokument, esc, euro, felder, ibanText, kennzahlen, nachsatz, uebertragung, ja, liste, summe, tabelle, text, unterschriften, zahl, zahlText, zelle } from "./html.js";
import type { Betrieb, Daten, Eintrag, Option, Vorlage } from "./typen.js";

/** ISO-Datum plus Tage als TT.MM.JJJJ. */
function plusTage(iso: string, tage: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || !Number.isFinite(tage)) return "";
  return datumDe(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + tage)).toISOString().slice(0, 10));
}

const SAETZE = [
  { wert: "19", text: "19 %" },
  { wert: "7", text: "7 %" },
  { wert: "0", text: "0 % / steuerfrei" },
];
/** Hinweis bei steuerpflichtigen Leistungen im Zusammenhang mit einem Grundstück an Privatpersonen (§ 14 Abs. 4 Nr. 9 UStG). */
const GRUNDSTUECK_HINWEIS = "Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).";
const ZAHLUNGS_HINWEIS = "Bitte geben Sie bei der Zahlung die Rechnungsnummer an.";
/** Bezeichnung der 0-%-Zeile in der Summe: mit dem gewählten Grund statt pauschal „steuerfrei“ (Texte wie in den Pflichthinweisen). */
function nullProzentText(hinweise: string[], befreiung: string): string {
  if (hinweise.includes("reverse_charge")) return `Umsatzsteuer 0 % (${RECHNUNGS_HINWEISE.find((h) => h.wert === "reverse_charge")!.text})`;
  if (hinweise.includes("igl")) return "Umsatzsteuer 0 % (steuerfreie innergemeinschaftliche Lieferung)";
  if (befreiung) return "Umsatzsteuer 0 % (steuerfrei, siehe Hinweis)";
  return "Steuerfrei bzw. 0 %";
}
const ZIEL: Record<string, string> = { sofort: "sofort ohne Abzug", "7": "innerhalb von 7 Tagen", "14": "innerhalb von 14 Tagen", "30": "innerhalb von 30 Tagen" };

/** Hinweis auf die Steuerbefreiung – nur, wenn eine Position mit 0 % abgerechnet wird (sonst stünde er bei reinen 19-%-Rechnungen). */
function befreiungText(d: Daten): string {
  const nullProzent = liste(d, "positionen").some((e) => (text(e, "bezeichnung") || text(e, "preis")) && Number(text(e, "satz") || "19") === 0);
  return nullProzent ? text(d, "befreiung") : "";
}

function positionen(d: Daten): { e: Eintrag; p: Position }[] {
  return liste(d, "positionen")
    .filter((e) => text(e, "bezeichnung") || text(e, "preis"))
    .map((e) => ({ e, p: { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck", preis_cent: cent(text(e, "preis")) ?? 0, ust_satz: Number(text(e, "satz") || "19") } }));
}

/** Verständliche Bezeichnungen für fehlendFuerERechnung */
const E_FEHLT: Record<string, string> = {
  "steller.anschrift": "Name und Anschrift des Betriebs (Mein Betrieb)",
  "steller.email": "E-Mail des Betriebs (Mein Betrieb)",
  "steller.telefon": "Telefon des Betriebs (Mein Betrieb)",
  "steller.steuernummer_oder_ust_idnr": "Steuernummer oder USt-IdNr. (Mein Betrieb)",
  "steller.iban": "IBAN (Mein Betrieb)",
  "kunde.anschrift": "Anschrift des Empfängers: Straße in der ersten, PLZ und Ort in der letzten Zeile",
  "kunde.email": "E-Mail des Empfängers",
  positionen: "mindestens eine Position",
  "positionen.ungueltig": "Positionen mit Bezeichnung, Menge und Preis",
  "positionen.steuersatz": "Umsatzsteuersatz je Position",
  leistungsdatum: "Leistungsdatum als Datum (TT.MM.JJJJ)",
  "steuer.grund_null": "Grund für 0 % Umsatzsteuer (Hinweis: Steuerschuldnerschaft des Empfängers, innergemeinschaftliche Lieferung oder Steuerbefreiung)",
  "steuer.befreiungsgrund": "Hinweis auf die Steuerbefreiung",
  "steller.ust_idnr": "USt-IdNr. des Betriebs (Mein Betrieb)",
  "kunde.ust_idnr": "USt-IdNr. des Empfängers",
};

const isoAus = (t: string) => {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(t);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(t.trim()) ? t.trim() : null;
};

/** Länder für die Anschrift: Name (deutsch/englisch/landessprachlich) oder Kürzel → ISO 3166-1 alpha-2. */
const LAENDER: Record<string, string> = {
  deutschland: "DE", germany: "DE", de: "DE", d: "DE",
  österreich: "AT", oesterreich: "AT", austria: "AT", at: "AT", a: "AT",
  schweiz: "CH", switzerland: "CH", suisse: "CH", svizzera: "CH", ch: "CH",
  liechtenstein: "LI", li: "LI", fl: "LI",
  belgien: "BE", belgium: "BE", belgique: "BE", belgië: "BE", be: "BE", b: "BE",
  niederlande: "NL", netherlands: "NL", nederland: "NL", holland: "NL", nl: "NL",
  luxemburg: "LU", luxembourg: "LU", lu: "LU", l: "LU",
  frankreich: "FR", france: "FR", fr: "FR", f: "FR",
  italien: "IT", italy: "IT", italia: "IT", it: "IT", i: "IT",
  spanien: "ES", spain: "ES", españa: "ES", es: "ES", e: "ES",
  portugal: "PT", pt: "PT", p: "PT",
  dänemark: "DK", daenemark: "DK", denmark: "DK", danmark: "DK", dk: "DK",
  schweden: "SE", sweden: "SE", sverige: "SE", se: "SE", s: "SE",
  finnland: "FI", finland: "FI", suomi: "FI", fi: "FI",
  polen: "PL", poland: "PL", polska: "PL", pl: "PL",
  tschechien: "CZ", czechia: "CZ", "czech republic": "CZ", česko: "CZ", cz: "CZ",
  slowakei: "SK", slovakia: "SK", slovensko: "SK", sk: "SK",
  ungarn: "HU", hungary: "HU", magyarország: "HU", hu: "HU",
  slowenien: "SI", slovenia: "SI", slovenija: "SI", si: "SI",
  kroatien: "HR", croatia: "HR", hrvatska: "HR", hr: "HR",
  irland: "IE", ireland: "IE", ie: "IE",
  griechenland: "GR", greece: "GR", gr: "GR", el: "GR",
  rumänien: "RO", rumaenien: "RO", romania: "RO", ro: "RO",
  bulgarien: "BG", bulgaria: "BG", bg: "BG",
  estland: "EE", estonia: "EE", ee: "EE",
  lettland: "LV", latvia: "LV", lv: "LV",
  litauen: "LT", lithuania: "LT", lt: "LT",
  malta: "MT", mt: "MT",
  zypern: "CY", cyprus: "CY", cy: "CY",
  "vereinigtes königreich": "GB", großbritannien: "GB", grossbritannien: "GB", "united kingdom": "GB", uk: "GB", gb: "GB",
  norwegen: "NO", norway: "NO", norge: "NO", no: "NO",
};
/** USt-IdNr.-Präfix → Land (Griechenland: EL). */
const UST_LAND: Record<string, string> = { EL: "GR", XI: "GB" };

/**
 * Anschrift aus Zeilen zerlegen (E-129): erste Zeile Straße, dann „PLZ Ort“ (auch „A-1010 Wien“, „1012 AB Amsterdam“),
 * optional eine letzte Zeile mit dem Land. Ohne Land: aus PLZ-Präfix, USt-IdNr. oder fünfstelliger PLZ (Deutschland).
 */
export function anschriftZerlegen(text_: string, ustIdnr = ""): { strasse: string | null; plz: string | null; ort: string | null; land: string | null } {
  const zeilen = text_.split("\n").map((z) => z.trim()).filter(Boolean);
  let land: string | null = null;
  const letzte = (zeilen.at(-1) ?? "").toLocaleLowerCase("de").replace(/\.$/, "");
  if (zeilen.length > 1 && LAENDER[letzte] && !/\d/.test(letzte)) {
    land = LAENDER[letzte]!;
    zeilen.pop();
  }
  const m = /^(?:([A-Za-z]{1,3})\s?-\s?)?(\d{4,5}(?:\s?[A-Z]{2})?)\s+(.+)$/.exec(zeilen.at(-1) ?? "");
  const praefix = m?.[1] ? LAENDER[m[1].toLowerCase()] : undefined;
  const ust = /^([A-Z]{2})/.exec(ustIdnr.replace(/\s/g, "").toUpperCase())?.[1];
  land ??= praefix ?? (ust ? (UST_LAND[ust] ?? ust) : null) ?? (m && /^\d{5}$/.test(m[2]!) ? "DE" : null);
  return { strasse: zeilen.length > 1 ? zeilen[0]! : null, plz: m?.[2] ?? null, ort: m?.[3] ?? null, land };
}

/**
 * Rechnung aus der App → Daten für die E-Rechnung (E-128) und was dafür noch fehlt. Unterstützt 19 %, 7 % und
 * Kleinunternehmer; 0 % aus anderen Gründen (z. B. Reverse Charge) noch nicht.
 */
export function eRechnungAus(d: Daten, b: Betrieb): { daten: RechnungsDaten; fehlt: string[] } {
  const a = anschriftZerlegen(text(d, "kunde_anschrift"), text(d, "kunde_ust_idnr"));
  const ku = ja(d, "kleinunternehmer");
  const hw = auswahl(d, "hinweise");
  const befreiung = befreiungText(d);
  const steuerart = hw.includes("reverse_charge") ? "reverse_charge" : hw.includes("igl") ? "igl" : befreiung ? "befreit" : "standard";
  const storno = text(d, "storno_zu");
  const pos = liste(d, "positionen").filter((e) => text(e, "bezeichnung") || text(e, "preis"));
  const datum = text(d, "datum");
  const ziel = text(d, "zahlungsziel");
  const daten: RechnungsDaten = {
    nummer: text(d, "nummer"),
    rechnungsdatum: datum,
    leistungsdatum: ja(d, "leistung_gleich") ? datum || null : isoAus(text(d, "leistung")),
    faellig_am: datum && ziel && ziel !== "sofort" ? plusTageIso(datum, Number(ziel)) : null,
    steller: { name: b.name.trim(), strasse: b.strasse.trim(), plz: b.plz.trim(), ort: b.ort.trim(), land: "DE", email: b.email.trim(), telefon: b.telefon.trim() || null, steuernummer: b.steuernummer.trim() || null, ust_idnr: b.ust_idnr.trim() || null, iban: b.iban.trim() || null },
    kunde: { name: text(d, "kunde_name"), strasse: a.strasse, plz: a.plz, ort: a.ort, land: a.land ?? "DE", email: text(d, "kunde_email") || null, ust_idnr: text(d, "kunde_ust_idnr") || null, geschaeftskunde: true },
    positionen: pos.map((e) => {
      const preis = cent(text(e, "preis")) ?? 0;
      // Storno: die Positionen tragen schon das umgedrehte Vorzeichen; `art: "storno"` dreht es für USt und XRechnung zurück
      return { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck" as const, einheit_code: einheitCode(text(e, "einheit")), preis_cent: storno ? -preis : preis, ust_satz: ku ? null : Number(text(e, "satz") || "19") };
    }),
    kleinunternehmer: ku,
    hinweis: [befreiung, ...text(d, "hinweis").split("\n").filter((h) => !(storno && h.trim() === ZAHLUNGS_HINWEIS))].filter(Boolean).join("\n") || null,
    ...(storno ? { art: "storno" as const, storniert_nummer: storno } : {}),
    steuerart,
    befreiungsgrund: befreiung || null,
  };
  const fehlt = fehlendFuerERechnung(daten).map((c) => E_FEHLT[c] ?? c);
  if (!a.land && a.plz) fehlt.push("Land des Empfängers in der letzten Zeile der Anschrift (z. B. Österreich)");
  if (!daten.nummer) fehlt.unshift("Rechnungsnummer");
  if (!datum) fehlt.unshift("Rechnungsdatum");
  return { daten, fehlt };
}

/** Art der Rechnung aus den Daten: Stornorechnung (storniert eine andere), Gutschrift (Hinweis „gutschrift“) oder Rechnung. */
export function rechnungsTitel(d: Daten): "Rechnung" | "Stornorechnung" | "Gutschrift" {
  return text(d, "storno_zu") ? "Stornorechnung" : auswahl(d, "hinweise").includes("gutschrift") ? "Gutschrift" : "Rechnung";
}

function plusTageIso(iso: string, tage: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

export const rechnung: Vorlage = {
  id: "rechnung",
  gestalt: "brief",
  titel: "Rechnung",
  beschreibung: "Rechnung mit allen Pflichtangaben nach § 14 Abs. 4 UStG – Positionen, Steuersätze, Zahlungsziel und Pflichthinweise zum Auswählen.",
  bereich: "steuern",
  pflichten: ["steuern.rechnungen_pflichtangaben"],
  person: { art: "kunde", felder: { name: "kunde_name", anschrift: "kunde_anschrift", email: "kunde_email", ust_idnr: "kunde_ust_idnr" } },
  fortlaufend: "nummer",
  kundendokument: true,
  festschreiben: true,
  storno: true,
  eRechnung: true,
  ausProfil: { kleinunternehmer: "ust.kleinunternehmer" },
  grundlage: "§ 14 Abs. 4 UStG",
  namensFeld: "nummer",
  titelFuer: rechnungsTitel,
  abschnitte: [
    { titel: "Eckdaten",
      hilfe: "Am Ende teilst du die Rechnung als PDF – an Unternehmen zusätzlich als E-Rechnung (XRechnung).",
      felder: [
        { id: "nummer", art: "text", label: "Rechnungsnummer", hilfe: "fortlaufend und nur einmal vergeben, z. B. 2026-001", pflicht: true },
        { id: "datum", art: "datum", label: "Rechnungsdatum", vorbelegung: "heute", pflicht: true },
        { id: "leistung_gleich", art: "schalter", label: "Leistungsdatum entspricht dem Rechnungsdatum", vorbelegung: true },
        { id: "leistung", art: "text", label: "Datum oder Zeitraum der Leistung", hilfe: "z. B. 12.10.2026 oder Oktober 2026", pflicht: true, wenn: { feld: "leistung_gleich", nicht: true } },
        { id: "zahlungsziel", art: "wahl", label: "Zahlungsziel", optionen: [{ wert: "7", text: "7 Tage" }, { wert: "14", text: "14 Tage" }, { wert: "30", text: "30 Tage" }, { wert: "sofort", text: "Sofort" }], vorbelegung: "14", hilfe: "Steht auf der Rechnung als „Zahlbar innerhalb von … Tagen“ mit dem Datum." },
      ],
    },
    {
      titel: "Rechnungsempfänger",
      felder: [
        { id: "kunde_name", art: "text", label: "Name oder Firma", pflicht: true },
        { id: "kunde_anschrift", art: "mehrzeilig", label: "Anschrift", hilfe: "Straße und Hausnummer, PLZ und Ort – im Ausland das Land in die letzte Zeile", pflicht: true },
        { id: "kunde_email", art: "text", label: "E-Mail des Empfängers", hilfe: "nötig für die E-Rechnung an Unternehmen" },
        { id: "kunde_ust_idnr", selten: true, art: "text", label: "USt-IdNr. des Empfängers", hilfe: "nur bei innergemeinschaftlichen Leistungen oder Steuerschuldnerschaft des Empfängers" },
      ],
    },
    {
      titel: "Positionen",
      felder: [
        {
          id: "positionen",
          art: "liste",
          label: "Positionen",
          eintrag: "Position",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Leistung oder Ware", hilfe: "handelsübliche Bezeichnung bzw. Art und Umfang der Leistung", pflicht: true },
            { id: "menge", art: "zahl", label: "Menge", vorbelegung: "1" },
            { id: "einheit", art: "text", label: "Einheit", vorschlaege: EINHEITEN.slice(0, 8) },
            { id: "preis", art: "betrag", label: "Einzelpreis netto (€)", pflicht: true },
            { id: "satz", art: "wahl", label: "Umsatzsteuer", optionen: SAETZE, vorbelegung: "19" },
          ],
        },
      ],
    },
    {
      titel: "Steuer und Hinweise",
      felder: [
        { id: "kleinunternehmer", art: "schalter", label: "Kleinunternehmer (§ 19 UStG)", hilfe: "Dann wird keine Umsatzsteuer ausgewiesen; der Hinweis auf die Steuerbefreiung steht auf der Rechnung." },
        { id: "hinweise", selten: true, art: "bausteine", label: "Pflichthinweise, falls zutreffend", optionen: [...RECHNUNGS_HINWEISE.filter((h) => h.wert !== "steuerfrei").map((h) => ({ wert: h.wert, text: h.text, quelle: h.quelle })), { wert: "grundstueck", text: GRUNDSTUECK_HINWEIS, quelle: "§ 14 Abs. 4 Nr. 9, § 14b Abs. 1 Satz 5 UStG" }] },
        { id: "befreiung", selten: true, art: "text", label: "Hinweis auf die Steuerbefreiung (bei 0 %)", hilfe: "Pflicht, wenn eine Position steuerfrei ist – mit der Vorschrift", vorschlaege: ["Steuerfreie Leistung nach § 4 Nr. … UStG"] },
        { id: "hinweis", art: "mehrzeilig", label: "Weitere Hinweise", vorschlaege: ["Vielen Dank für Ihren Auftrag.", ZAHLUNGS_HINWEIS] },
      ],
    },
  ],
  pruefen(d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift des Betriebs (Mein Betrieb)");
    if (!b.steuernummer.trim() && !b.ust_idnr.trim()) f.push("Steuernummer oder USt-IdNr. (Mein Betrieb)");
    const nullProzent = positionen(d).some((x) => x.p.ust_satz === 0);
    if (nullProzent && !ja(d, "kleinunternehmer") && !text(d, "befreiung") && !auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl")) f.push("Hinweis auf die Steuerbefreiung (bei 0 %)");
    // Hinweis, kein Hindernis: beides zusammen ist selten richtig
    if (ja(d, "kleinunternehmer") && auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl")) f.push("Kleinunternehmerregelung zusammen mit Steuerschuldnerschaft des Leistungsempfängers bzw. innergemeinschaftlicher Lieferung gewählt – bitte prüfen.");
    return f;
  },
  ergebnis(d) {
    const s = summen(positionen(d).map((x) => x.p), ja(d, "kleinunternehmer"));
    return [["Netto", euro(s.netto_cent)], ...(ja(d, "kleinunternehmer") ? [] : ([["Umsatzsteuer", euro(s.ust_cent)]] as [string, string][])), ["Rechnungsbetrag", euro(s.brutto_cent)]];
  },
  html(d, b) {
    const ku = ja(d, "kleinunternehmer");
    const pos = positionen(d);
    const s = summen(pos.map((x) => x.p), ku);
    // Vorlage zum Ausfüllen (noch keine Position): Beträge leer statt „0,00 €“
    const leer = !pos.length;
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const storno = text(d, "storno_zu");
    // Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Leistungsempfänger rechnet ab und zahlt – keine Zahlungsaufforderung
    const gutschrift = auswahl(d, "hinweise").includes("gutschrift");
    const zeilenHtml = pos.map(({ e, p }, i) => [
      String(i + 1),
      zelle(p.bezeichnung),
      `${zahlText(p.menge, 4)}${text(e, "einheit") ? ` ${esc(einheitFuerMenge(text(e, "einheit"), p.menge))}` : ""}`,
      euro(p.preis_cent),
      ...(ku ? [] : [p.ust_satz === 0 ? "0 %" : `${p.ust_satz} %`]),
      euro(s.zeilen[i]!),
    ]);
    const summenZeilen = [
      // Kleinunternehmer: ohne Umsatzsteuer gibt es kein „netto“
      `<tr><td>${ku ? "Summe" : "Summe netto"}</td><td>${betrag(s.netto_cent)}</td></tr>`,
      ...(ku ? [] : s.gruppen.map((g) => `<tr><td>${g.satz === 0 ? nullProzentText(auswahl(d, "hinweise"), befreiungText(d)) : `Umsatzsteuer ${g.satz} %`} auf ${euro(g.netto_cent)}</td><td>${euro(g.ust_cent)}</td></tr>`)),
      // leere Vorlage: Zeile für die Umsatzsteuer mit Steuersatz zum Eintragen
      ...(leer && !ku ? [`<tr><td>Umsatzsteuer <span class="fuellen kurz"></span> %</td><td>&nbsp;</td></tr>`] : []),
      `<tr class="gesamt"><td>${gutschrift ? "Gutschriftsbetrag" : "Rechnungsbetrag"}</td><td>${betrag(s.brutto_cent)}</td></tr>`,
    ].join("");
    const leistung = text(d, "leistung");
    // Zahlungsaufforderung mit Verwendungszweck „Rechnung <Nummer>“ (unten, bei hinterlegter IBAN)
    const mitVerwendungszweck = !storno && !gutschrift && !!b.iban.trim() && (s.brutto_cent > 0 || leer);
    const hinweise = [
      ...(ku ? [KU_HINWEIS] : []),
      // „Gutschrift“ steht schon als Titel im Betreff
      ...auswahl(d, "hinweise").filter((w) => !(w === "gutschrift" && !storno)).map((w) => (w === "grundstueck" ? GRUNDSTUECK_HINWEIS : (RECHNUNGS_HINWEISE.find((h) => h.wert === w)?.text ?? ""))),
      befreiungText(d),
      // leere Vorlage: statt „Zahlbar …“ die Zahlungsaufforderung mit Linie für das Datum (unten)
      text(d, "zahlungsziel") && !storno && !gutschrift && !b.iban.trim() && !leer ? `Zahlbar ${ZIEL[text(d, "zahlungsziel")]}${text(d, "zahlungsziel") !== "sofort" && text(d, "datum") ? ` (bis ${plusTage(text(d, "datum"), Number(text(d, "zahlungsziel")))})` : ""}.` : "",
      // Stornorechnung: der Hinweis zur Zahlung aus der ursprünglichen Rechnung passt nicht mehr; mit Zahlungsaufforderung
      // steht die Rechnungsnummer schon als Verwendungszweck darin – der Satz wäre doppelt und kostete eine Zeile
      ...text(d, "hinweis").split("\n").filter((h) => !((text(d, "storno_zu") || mitVerwendungszweck) && h.trim() === ZAHLUNGS_HINWEIS)),
    ].filter((x) => x.trim());
    const datum = text(d, "datum");
    const ziel = text(d, "zahlungsziel");
    const faellig = ziel && ziel !== "sofort" && datum ? plusTage(datum, Number(ziel)) : "";
    const iban = b.iban.trim();
    // Zahlungsaufforderung mit Bankverbindung und GiroCode – nur aus den Angaben in „Mein Betrieb“ und der Rechnung
    const qr = !storno && !gutschrift && iban && s.brutto_cent > 0 ? giroCodeSvg({ name: b.name.trim(), iban, bic: b.bic ?? null, betragCent: s.brutto_cent, verwendungszweck: `Rechnung ${text(d, "nummer")}` }, 28) : null;
    const zahlung =
      !storno && !gutschrift && iban && s.brutto_cent > 0
        ? `<div class="zahlung">${qr ? `<div class="qr">${qr}<small>GiroCode – mit der Banking-App scannen</small></div>` : ""}<div class="text"><p>Bitte überweisen Sie <strong>${euro(s.brutto_cent)}</strong>${faellig ? ` bis zum <strong>${esc(faellig)}</strong>` : ziel === "sofort" ? " sofort ohne Abzug" : ""} auf das Konto</p><p><strong>IBAN ${esc(ibanText(iban))}</strong>${b.bic?.trim() ? `<br>BIC ${esc(b.bic.trim())}` : ""}${b.bank?.trim() ? `<br>${esc(b.bank.trim())}` : ""}<br>Verwendungszweck: Rechnung ${esc(text(d, "nummer"))}</p></div></div>`
        : // leere Vorlage: Zahlungsaufforderung mit Linie für das Datum, mit Bankverbindung nur, wenn eine IBAN hinterlegt ist
          leer && !storno && !gutschrift
          ? `<div class="zahlung"><div class="text"><p>Bitte überweisen Sie den Rechnungsbetrag bis zum ${LINIE_MITTEL}${iban ? " auf das Konto" : "."}</p>${iban ? `<p><strong>IBAN ${esc(ibanText(iban))}</strong>${b.bic?.trim() ? `<br>BIC ${esc(b.bic.trim())}` : ""}${b.bank?.trim() ? `<br>${esc(b.bank.trim())}` : ""}<br>Verwendungszweck: Rechnung ${text(d, "nummer") ? esc(text(d, "nummer")) : LINIE_MITTEL}</p>` : ""}</div></div>`
          : "";
    const anrede = text(d, "kunde_name") ? (storno ? `wir stornieren hiermit die unten genannte Rechnung und stellen den Betrag wie folgt gut.` : gutschrift ? `wir rechnen über die folgenden Leistungen ab und schreiben Ihnen den Betrag gut:` : `wir bedanken uns für Ihren Auftrag und stellen Ihnen folgende Leistungen in Rechnung:`) : "";
    const titel = `${rechnungsTitel(d)} ${text(d, "nummer")}`.trim();
    return brief({
      titel,
      betreff: titel,
      // der Leistungszeitraum steht im Informationsblock („Leistungsdatum“ bzw. „Leistungszeitraum“), nicht noch einmal unter dem Betreff
      unterBetreff: storno ? `Diese Rechnung storniert die Rechnung Nr. ${storno}${text(d, "storno_zu_datum") ? ` vom ${datumDe(text(d, "storno_zu_datum"))}` : ""}.` : undefined,
      betrieb: b,
      stand: datumDe(datum),
      empfaenger: { name: text(d, "kunde_name"), anschrift: text(d, "kunde_anschrift"), zusatz: text(d, "kunde_ust_idnr") ? `USt-IdNr. ${text(d, "kunde_ust_idnr")}` : undefined },
      info: [
        ["Rechnungsnummer", text(d, "nummer"), true],
        ["Rechnungsdatum", datumDe(datum)],
        // ein einzelnes Datum heißt „Leistungsdatum“, alles andere (z. B. „Oktober 2026“, „02.03. – 27.03.2026“) „Leistungszeitraum“
        [ja(d, "leistung_gleich") || isoAus(leistung) || !leistung.trim() ? "Leistungsdatum" : "Leistungszeitraum", ja(d, "leistung_gleich") ? datumDe(datum) : leistung],
        ["Steuernummer", b.steuernummer.trim()],
        ["USt-IdNr.", b.ust_idnr.trim()],
        ["Ansprechpartner", b.verantwortlich.trim()],
        ["Telefon", b.telefon.trim()],
        ["E-Mail", b.email.trim()],
      ],
      anrede: anrede ? `Sehr geehrte Damen und Herren,` : undefined,
      inhalt:
        (anrede ? `<p>${esc(anrede)}</p>` : "") +
        `<section>${tabelle(["Pos.", "Leistung", "Menge", "Einzelpreis", ...(ku ? [] : ["USt"]), "Betrag"], zeilenHtml, { breiten: ku ? ["7%", "48%", "15%", "15%", "15%"] : ["7%", "41%", "14%", "14%", "9%", "15%"], zahlen: ku ? [2, 3, 4] : [2, 3, 4, 5], ...(leer ? { mindestens: 5, hoch: true } : {}) })}</section>` +
        `<table class="summen">${summenZeilen}</table>` +
        // Zahlungsaufforderung, Hinweise und Gruß bleiben beisammen: Passt der Schluss nicht mehr auf die Seite, geht die
        // Zahlungsaufforderung mit, statt Hinweise und Gruß allein auf eine Folgeseite zu stellen
        `<div class="abschluss">` +
        zahlung +
        `<div class="schluss">` +
        (hinweise.length ? `<div class="gruss">${hinweise.map((h) => `<p>${esc(h)}</p>`).join("")}</div>` : "") +
        `<p class="gruss">Mit freundlichen Grüßen<br>${esc(b.verantwortlich.trim() || b.name.trim())}${b.verantwortlich.trim() && b.name.trim() ? `<br><span class="klein">${esc(b.name.trim())}</span>` : ""}</p></div></div>`,
    });
  },
};

// ---------------------------------------------------------------- EÜR

/**
 * Zeilen der Anlage EÜR zum Auswählen: die Liste aus der Recherche, ergänzt um jede Zeile, die „EÜR übernehmen“ aus den
 * Belegkategorien (belege.ts) einträgt – wortgleich, damit übernommene Zeilen in der Vorschlagsliste stehen. Fehlende
 * Zeilen stehen vor der Zeile, bei der sie im Vordruck einsortiert sind (sonst am Ende).
 */
function zeilenMit(liste: string[], dazu: string[], vor: Record<string, string> = {}): string[] {
  const r = [...liste];
  for (const z of new Set(dazu)) {
    if (r.includes(z)) continue;
    const i = vor[z] ? r.indexOf(vor[z]) : -1;
    if (i >= 0) r.splice(i, 0, z);
    else r.push(z);
  }
  return r;
}
const EUER_AUSGABEN_ZEILEN = zeilenMit(
  EUER_AUSGABEN,
  KATEGORIEN.map((k) => k.euer),
  {
    "Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke": "Miete/Aufwendungen für doppelte Haushaltsführung",
    "Kraftfahrzeugkosten und andere Fahrtkosten": "Fahrtkosten für nicht zum Betriebsvermögen gehörende Fahrzeuge",
  },
);
const EUER_EINNAHMEN_ZEILEN = zeilenMit(EUER_EINNAHMEN, [EUER_ZEILE_STEUERPFLICHTIG, EUER_ZEILE_STEUERFREI]);

/** Warnung bei der EÜR, wenn „Mein Betrieb“ eine Kapitalgesellschaft ist (Rechtsform bzw. Zusatz im Namen). */
export const EUER_KAPITALGESELLSCHAFT = "Kapitalgesellschaften erstellen eine Bilanz statt einer EÜR – bitte prüfen.";

export const euer: Vorlage = {
  id: "euer",
  gestalt: "formular",
  titel: "Einnahmen-Überschuss-Rechnung (EÜR)",
  beschreibung: "Einnahmen und Ausgaben eines Jahres mit Überschuss – als Aufstellung für deine Unterlagen und zum Übertragen in die Anlage EÜR.",
  bereich: "steuern",
  pflichten: ["steuern.euer"],
  grundlage: "§ 4 Abs. 3 EStG; § 60 Abs. 4 EStDV",
  namensFeld: "jahr",
  abschnitte: [
    { titel: "Jahr",
      hilfe: "Die Anlage EÜR übermittelst du elektronisch über ELSTER. Diese Aufstellung sammelt die Zahlen dafür.",
      felder: [{ id: "jahr", art: "text", label: "Jahr", hilfe: "z. B. 2026", pflicht: true }],
    },
    {
      titel: "Einnahmen",
      hilfe: "Was im Jahr eingegangen ist.",
      felder: [{ id: "einnahmen", art: "liste", label: "Einnahmen", eintrag: "Einnahme", titelFeld: "text", pflicht: true, felder: [{ id: "datum", art: "datum", label: "Datum" }, { id: "text", art: "text", label: "Bezeichnung", hilfe: "z. B. Umsätze Oktober", pflicht: true }, { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_EINNAHMEN_ZEILEN }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
    },
    {
      titel: "Ausgaben",
      hilfe: "Was im Jahr bezahlt wurde.",
      felder: [
        {
          id: "ausgaben",
          art: "liste",
          label: "Ausgaben",
          eintrag: "Ausgabe",
          titelFeld: "text",
          felder: [
            { id: "datum", art: "datum", label: "Datum" },
            { id: "text", art: "text", label: "Bezeichnung", hilfe: "z. B. Miete Oktober", pflicht: true },
            { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_AUSGABEN_ZEILEN },
            { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true },
          ],
        },
      ],
    },
    {
      titel: "Abschreibungen",
      hilfe: "Für größere Anschaffungen, die über mehrere Jahre abgeschrieben werden: nur der Betrag für dieses Jahr.",
      felder: [{ id: "afa", art: "liste", label: "Abschreibungen", eintrag: "Abschreibung", titelFeld: "text", felder: [{ id: "text", art: "text", label: "Wirtschaftsgut", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag dieses Jahr (€)", pflicht: true }] }],
    },
  ],
  pruefen(_d, b) {
    // Hinweis, kein Hindernis: die Vorlage bleibt nutzbar (z. B. für eine Gesellschaft, die die Rechtsform noch wechselt)
    return istKapitalgesellschaft(b.rechtsform, b.name) ? [EUER_KAPITALGESELLSCHAFT] : [];
  },
  ergebnis(d) {
    // wie im Dokument: Betriebsausgaben ohne AfA, AfA eigens, Ergebnis nach Abzug beider
    const e = summe(liste(d, "einnahmen"), "betrag");
    const a = summe(liste(d, "ausgaben"), "betrag");
    const f = summe(liste(d, "afa"), "betrag");
    const g = e - a - f;
    return [["Einnahmen", euro(e)], ["Ausgaben", euro(a)], ["AfA", euro(f)], [g >= 0 ? "Gewinn" : "Verlust", euro(Math.abs(g))]];
  },
  html(d, b) {
    const ein = liste(d, "einnahmen").filter((x) => text(x, "text") || text(x, "betrag"));
    const aus = liste(d, "ausgaben").filter((x) => text(x, "text") || text(x, "betrag"));
    const afa = liste(d, "afa").filter((x) => text(x, "text") || text(x, "betrag"));
    const e = summe(ein, "betrag");
    const a = summe(aus, "betrag");
    const f = summe(afa, "betrag");
    const kategorie = (x: Eintrag) => text(x, "kategorie") || "ohne Kategorie";
    const kategorien = [...new Set(aus.map(kategorie))];
    const kategorienEin = [...new Set(ein.map(kategorie))];
    // Summen je Zeile der Anlage EÜR (nur bei mehr als einer Zeile – sonst stünde dieselbe Summe zweimal da)
    const nachZeilen = (titel: string, l: Eintrag[], k: string[]) => (k.length > 1 ? abschnitt(titel, kennzahlen(k.map((z) => ({ text: z, betrag: euro(summe(l.filter((x) => kategorie(x) === z), "betrag")) })))) : "");
    const z = (l: Eintrag[]) => l.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "text")), zelle(text(x, "kategorie")), euro(cent(text(x, "betrag")) ?? 0)]);
    const ergebnis = e - a - f;
    // Vorlage zum Ausfüllen (nichts erfasst): Beträge leer statt „0,00 €“, Tabellen mit Zeilen zum Eintragen
    const leer = !ein.length && !aus.length && !afa.length;
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const kopfZeile = ["Datum", "Bezeichnung", "Zeile der Anlage EÜR", "Betrag"];
    const breiten = ["14%", "42%", "26%", "18%"];
    // leere Tabelle: Summenzeile mit Linie zum Eintragen
    const summeLeer = ["<strong>Summe</strong>", "", "", ZELLE_LINIE];
    return dokument({
      titel: "Einnahmen-Überschuss-Rechnung",
      betrieb: b,
      unter: text(d, "jahr") ? `Gewinnermittlung nach § 4 Abs. 3 EStG für ${text(d, "jahr")}` : undefined,
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Jahr: ${text(d, "jahr") || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Ergebnis",
          kennzahlen([
            { text: "Summe der Betriebseinnahmen", betrag: betrag(e) },
            { text: "Summe der Betriebsausgaben", betrag: betrag(a) },
            { text: "Absetzungen für Abnutzung (AfA)", betrag: betrag(f) },
            { text: leer ? "Gewinn bzw. Verlust" : ergebnis >= 0 ? "Gewinn" : "Verlust", hinweis: "Betriebseinnahmen abzüglich Betriebsausgaben und AfA", betrag: betrag(Math.abs(ergebnis)), fett: true },
          ]),
        ) +
        nachZeilen("Betriebseinnahmen nach Zeilen der Anlage EÜR", ein, kategorienEin) +
        nachZeilen("Betriebsausgaben nach Zeilen der Anlage EÜR", aus, kategorien) +
        abschnitt("Betriebseinnahmen", ein.length ? tabelle(kopfZeile, z(ein), { breiten, zahlen: [3], summe: ["<strong>Summe</strong>", "", "", `<strong>${euro(e)}</strong>`] }) : leer ? tabelle(kopfZeile, [], { breiten, zahlen: [3], mindestens: EUER_LEER_EINNAHMEN, hoch: true, summe: summeLeer }) : absatz("", "Keine Einnahmen erfasst.")) +
        abschnitt("Betriebsausgaben", aus.length ? tabelle(kopfZeile, z(aus), { breiten, zahlen: [3], summe: ["<strong>Summe</strong>", "", "", `<strong>${euro(a)}</strong>`] }) : leer ? tabelle(kopfZeile, [], { breiten, zahlen: [3], mindestens: EUER_LEER_AUSGABEN, hoch: true, summe: summeLeer }) : absatz("", "Keine Ausgaben erfasst.")) +
        (leer ? abschnitt("Absetzungen für Abnutzung", tabelle(["Wirtschaftsgut", "Betrag dieses Jahr"], [], { breiten: ["75%", "25%"], zahlen: [1], mindestens: 3, hoch: true, summe: ["<strong>Summe</strong>", ZELLE_LINIE] })) : "") +
        (afa.length ? abschnitt("Absetzungen für Abnutzung", tabelle(["Wirtschaftsgut", "Betrag dieses Jahr"], afa.map((x) => [zelle(text(x, "text")), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["75%", "25%"], zahlen: [1], summe: ["<strong>Summe</strong>", `<strong>${euro(f)}</strong>`] })) : "") +
        uebertragung(["Anlage EÜR übermittelt am", "Transferticket (ELSTER)"]),
    });
  },
};

/** Leere EÜR: Zeilen zum Eintragen – so viele, dass auch Seite 2 (Ausgaben, AfA) gefüllt ist. */
const EUER_LEER_EINNAHMEN = 8;
const EUER_LEER_AUSGABEN = 24;

// ---------------------------------------------------------------- Bilanz und GuV

const posten = (id: string, label: string, eintrag: string, hilfe: string) => ({
  id,
  art: "liste" as const,
  label,
  eintrag,
  titelFeld: "posten",
  felder: [{ id: "posten", art: "text" as const, label: "Posten", hilfe, pflicht: true }, { id: "betrag", art: "betrag" as const, label: "Betrag (€)", pflicht: true }],
});

export const bilanzGuv: Vorlage = {
  id: "bilanz_guv",
  gestalt: "formular",
  titel: "Bilanz und Gewinn- und Verlustrechnung",
  beschreibung: "Jahresabschluss für Kaufleute: Erträge und Aufwendungen, Vermögen und Kapital – mit Prüfung, ob Aktiva und Passiva aufgehen.",
  bereich: "steuern",
  pflichten: ["steuern.buchfuehrungspflicht", "steuern.e_bilanz"],
  grundlage: "§§ 238, 242 HGB; § 5b EStG",
  namensFeld: "stichtag",
  abschnitte: [
    { titel: "Stichtag",
      hilfe: "Die Zahlen kommen aus deiner Buchführung. Die E-Bilanz geht elektronisch ans Finanzamt, meist über Buchhaltungsprogramm oder Steuerberatung.",
      felder: [{ id: "stichtag", art: "datum", label: "Bilanzstichtag", pflicht: true }],
    },
    { titel: "Gewinn- und Verlustrechnung", felder: [posten("ertraege", "Erträge", "Ertrag", "z. B. Umsatzerlöse"), posten("aufwendungen", "Aufwendungen", "Aufwand", "z. B. Materialaufwand, Personalaufwand")] },
    { titel: "Bilanz", felder: [posten("aktiva", "Aktiva", "Aktivposten", "z. B. Betriebs- und Geschäftsausstattung, Bank"), posten("passiva", "Passiva", "Passivposten", "z. B. Eigenkapital, Verbindlichkeiten")] },
  ],
  ergebnis(d) {
    const j = summe(liste(d, "ertraege"), "betrag") - summe(liste(d, "aufwendungen"), "betrag");
    const akt = summe(liste(d, "aktiva"), "betrag");
    const pas = summe(liste(d, "passiva"), "betrag");
    return [[j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", euro(Math.abs(j))], ["Summe Aktiva", euro(akt)], ["Summe Passiva", euro(pas)], ...(akt !== pas ? ([["Differenz – bitte prüfen", euro(akt - pas)]] as [string, string][]) : [])];
  },
  html(d, b) {
    const l = (k: string) => liste(d, k).filter((x) => text(x, "posten") || text(x, "betrag"));
    // Aktiva und Passiva gleich lang, damit die Summen auf einer Linie stehen (mit Doppellinie)
    const bilanzZeilen = Math.max(l("aktiva").length, l("passiva").length);
    const t = (k: string) => {
      const x = l(k);
      const bilanz = k === "aktiva" || k === "passiva";
      // leer (Vorlage zum Ausfüllen): hohe Leerzeilen (GuV je 8, Aktiva und Passiva je 12 – bzw. so viele wie die andere
      // Seite der Bilanz), Summenzeile mit Linie zum Eintragen statt „0,00 €“
      if (!x.length) return tabelle(["Posten", "Betrag"], [], { breiten: ["72%", "28%"], zahlen: [1], mindestens: bilanz ? bilanzZeilen || 12 : 8, hoch: true, summe: ["<strong>Summe</strong>", ZELLE_LINIE], ...(bilanz ? { klasse: "doppelt" } : {}) });
      return tabelle(["Posten", "Betrag"], x.map((e) => [zelle(text(e, "posten")), euro(cent(text(e, "betrag")) ?? 0)]), { breiten: ["72%", "28%"], zahlen: [1], summe: ["<strong>Summe</strong>", `<strong>${euro(summe(x, "betrag"))}</strong>`], ...(bilanz ? { mindestens: bilanzZeilen, klasse: "doppelt" } : {}) });
    };
    const j = summe(l("ertraege"), "betrag") - summe(l("aufwendungen"), "betrag");
    // Vorlage zum Ausfüllen: kein errechnetes Ergebnis „0,00 €“
    const guvLeer = !l("ertraege").length && !l("aufwendungen").length;
    const akt = summe(l("aktiva"), "betrag");
    const pas = summe(l("passiva"), "betrag");
    return dokument({
      titel: "Jahresabschluss",
      betrieb: b,
      // in der Reihenfolge der Abschnitte: erst die GuV, dann die Bilanz
      unter: text(d, "stichtag") ? `Gewinn- und Verlustrechnung und Bilanz zum ${datumDe(text(d, "stichtag"))}` : "Gewinn- und Verlustrechnung und Bilanz",
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Bilanzstichtag: ${datumDe(text(d, "stichtag")) || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt("Gewinn- und Verlustrechnung", `<h3>Erträge</h3>${t("ertraege")}<h3>Aufwendungen</h3>${t("aufwendungen")}${kennzahlen([{ text: guvLeer ? "Jahresüberschuss bzw. Jahresfehlbetrag" : j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", betrag: guvLeer ? "&nbsp;" : euro(Math.abs(j)), fett: true }])}`) +
        abschnitt("Bilanz", `<div class="bilanz"><div><h3>Aktiva</h3>${t("aktiva")}</div><div><h3>Passiva</h3>${t("passiva")}</div></div>${akt !== pas ? `<p class="nachsatz"><strong>Aktiva und Passiva weichen um ${euro(akt - pas)} ab – bitte prüfen.</strong></p>` : ""}`) +
        unterschriften(["Unterschrift"], { ortDatum: true }),
    });
  },
};

// ---------------------------------------------------------------- Umsatzsteuer-Voranmeldung

function ust(d: Daten) {
  const u19 = cent(text(d, "umsatz_19")) ?? 0;
  const u7 = cent(text(d, "umsatz_7")) ?? 0;
  const s19 = rundeCent((u19 * 19) / 100);
  const s7 = rundeCent((u7 * 7) / 100);
  const vst = cent(text(d, "vorsteuer")) ?? 0;
  return { u19, u7, s19, s7, vst, zahllast: s19 + s7 - vst };
}

export const VERSTEUERUNG: Option[] = [
  { wert: "soll", text: "Soll – der Normalfall" },
  { wert: "ist", text: "Ist – nur mit Genehmigung" },
];

export const ustVoranmeldung: Vorlage = {
  id: "ust_voranmeldung",
  gestalt: "formular",
  titel: "Umsatzsteuer-Voranmeldung",
  beschreibung: "Umsätze nach Steuersatz und Vorsteuer – die App rechnet Umsatzsteuer und Zahllast aus, du überträgst die Zahlen in ELSTER.",
  bereich: "steuern",
  pflichten: ["steuern.ust_voranmeldung"],
  ausRechnungen: true,
  ausBetrieb: { versteuerung: "versteuerung" },
  grundlage: "§ 18 Abs. 1 UStG",
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum",
      hilfe: "Die Voranmeldung übermittelst du elektronisch über ELSTER. Diese Unterlage rechnet die Zahlen dafür aus – aus deinen Rechnungen in Amtlos oder von Hand – und bleibt bei deinen Unterlagen.",
      felder: [
        { id: "versteuerung", art: "wahl", label: "Wie versteuerst du?", optionen: VERSTEUERUNG, vorbelegung: "soll", hilfe: "Soll: Umsätze zählen im Zeitraum, in dem du die Leistung erbracht hast (§ 13 Abs. 1 Nr. 1 a UStG). Ist: im Zeitraum, in dem das Geld eingegangen ist (§ 13 Abs. 1 Nr. 1 b, § 20 UStG) – nur, wenn das Finanzamt es dir genehmigt hat." },
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026 oder 3. Quartal 2026", pflicht: true },
      ],
    },
    {
      titel: "Umsätze (netto)",
      felder: [
        { id: "umsatz_19", art: "betrag", label: "Umsätze zu 19 % (€)" },
        { id: "umsatz_7", art: "betrag", label: "Umsätze zu 7 % (€)", hilfe: "seit 2026 auch Speisen in Restaurant und Café (ohne Getränke)" },
        { id: "umsatz_frei", selten: true, art: "betrag", label: "Umsätze ohne Umsatzsteuer (€)", hilfe: "z. B. steuerfreie Umsätze – welche Zeile in ELSTER gilt, hängt von der Art ab" },
      ],
    },
    {
      titel: "Vorsteuer",
      felder: [
        { id: "vorsteuer", art: "betrag", label: "Vorsteuer aus Eingangsrechnungen (€)", pflicht: true },
        { id: "notiz", selten: true, art: "mehrzeilig", label: "Notiz", hilfe: "z. B. Besonderheiten in diesem Zeitraum" },
      ],
    },
  ],
  ergebnis(d) {
    const x = ust(d);
    return [["Umsatzsteuer", euro(x.s19 + x.s7)], ["Vorsteuer", euro(x.vst)], [x.zahllast >= 0 ? "Zahllast" : "Erstattung", euro(Math.abs(x.zahllast))]];
  },
  html(d, b) {
    const x = ust(d);
    const frei = cent(text(d, "umsatz_frei")) ?? 0;
    const ist = text(d, "versteuerung") === "ist";
    // Vorlage zum Ausfüllen (keine Beträge eingegeben): Beträge leer statt „0,00 €“
    const leer = !["umsatz_19", "umsatz_7", "umsatz_frei", "vorsteuer"].some((k) => text(d, k));
    const betrag = (c: number) => (leer ? "&nbsp;" : euro(c));
    const ueberschuss = !leer && x.zahllast < 0;
    return dokument({
      titel: "Umsatzsteuer-Voranmeldung",
      betrieb: b,
      unter: [text(d, "zeitraum"), "Übertragungshilfe für ELSTER"].filter(Boolean).join(", "),
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Zeitraum: ${text(d, "zeitraum") || KOPF_LINIE}`, `Besteuerung: ${ist ? "nach vereinnahmten Entgelten (§ 20 UStG)" : "nach vereinbarten Entgelten"}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Steuerpflichtige Umsätze",
          kennzahlen([
            { kz: "81", text: "Umsätze zum Steuersatz 19 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer, im Vordruck in vollen Euro", betrag: betrag(x.u19) },
            { text: "darauf Umsatzsteuer 19 % (rechnet ELSTER)", betrag: betrag(x.s19) },
            { kz: "86", text: "Umsätze zum Steuersatz 7 %", hinweis: "Bemessungsgrundlage ohne Umsatzsteuer, im Vordruck in vollen Euro", betrag: betrag(x.u7) },
            { text: "darauf Umsatzsteuer 7 % (rechnet ELSTER)", betrag: betrag(x.s7) },
          ]),
        ) +
        (frei
          ? abschnitt("Umsätze ohne Umsatzsteuer", kennzahlen([{ text: "Steuerfreie oder nicht steuerbare Umsätze", hinweis: "Welche Kennzahl gilt (z. B. 41 innergemeinschaftliche Lieferungen, 43 weitere steuerfreie Umsätze, 21 Leistungen nach § 18b UStG), hängt von der Art des Umsatzes ab", betrag: euro(frei) }]))
          : "") +
        abschnitt(
          "Vorsteuer und Zahllast",
          kennzahlen([
            { text: "Umsatzsteuer gesamt", betrag: betrag(x.s19 + x.s7) },
            { kz: "66", text: "Vorsteuerbeträge aus Rechnungen anderer Unternehmer", hinweis: "§ 15 Abs. 1 Satz 1 Nr. 1 UStG", betrag: betrag(x.vst) },
            {
              kz: "83",
              text: leer ? "Verbleibende Umsatzsteuer-Vorauszahlung bzw. Überschuss" : ueberschuss ? "Verbleibender Überschuss (Erstattung)" : "Verbleibende Umsatzsteuer-Vorauszahlung",
              hinweis: ueberschuss ? "Überschuss: Betrag mit Minuszeichen übertragen" : leer ? "Vorauszahlung bis zum 10. Tag nach Ablauf des Zeitraums (§ 18 Abs. 1 UStG); Überschuss mit Minuszeichen übertragen" : "bis zum 10. Tag nach Ablauf des Zeitraums zu übermitteln und zu zahlen (§ 18 Abs. 1 UStG)",
              betrag: betrag(x.zahllast),
              fett: true,
            },
          ]),
        ) +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        nachsatz("Kennzahlen nach dem Vordruckmuster USt 1 A für 2026. Vor dem Übertragen gegen das aktuelle ELSTER-Formular prüfen; das Formular rechnet die Steuerbeträge selbst. ELSTER rechnet aus vollen Euro; maßgeblich ist der Betrag, den ELSTER errechnet.") +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)", ueberschuss ? "Erstattung erhalten am" : "Gezahlt am"]),
    });
  },
};

// ---------------------------------------------------------------- Steuererklärung (Zusammenstellung)

const ERKLAERUNGEN = [
  { wert: "est", text: "Einkommensteuer" },
  { wert: "gewst", text: "Gewerbesteuer" },
  { wert: "ust", text: "Umsatzsteuer (Jahr)" },
  { wert: "kst", text: "Körperschaftsteuer" },
];

export const steuererklaerung: Vorlage = {
  id: "steuererklaerung",
  gestalt: "formular",
  titel: "Unterlagen zur Steuererklärung",
  beschreibung: "Alle Zahlen und Belege für die Jahreserklärungen an einem Ort – zum Übertragen in ELSTER oder für die Steuerberatung.",
  bereich: "steuern",
  pflichten: ["steuern.est_erklaerung", "steuern.gewst_erklaerung", "steuern.ust_jahreserklaerung", "steuern.kst_erklaerung"],
  grundlage: "§ 25 EStG; § 31 KStG; § 14a GewStG; § 18 Abs. 3 UStG",
  namensFeld: "jahr",
  abschnitte: [
    { titel: "Jahr und Erklärungen",
      hilfe: "Die Erklärungen übermittelst du elektronisch über ELSTER. Diese Zusammenstellung sammelt, was du dafür brauchst.",
      felder: [
        { id: "jahr", art: "text", label: "Jahr", pflicht: true },
        { id: "arten", art: "mehrfach", label: "Welche Erklärungen", optionen: ERKLAERUNGEN },
      ],
    },
    {
      titel: "Zahlen",
      felder: [
        { id: "gewinn", art: "betrag", label: "Gewinn oder Verlust (aus EÜR bzw. Bilanz) (€)", pflicht: true },
        { id: "umsatz", art: "betrag", label: "Umsätze im Jahr (netto) (€)" },
        { id: "ust_jahr", art: "betrag", label: "Umsatzsteuer im Jahr (€)", wenn: { feld: "arten", ist: "ust" } },
        { id: "vorsteuer_jahr", art: "betrag", label: "Vorsteuer im Jahr (€)", wenn: { feld: "arten", ist: "ust" } },
      ],
    },
    {
      titel: "Vorauszahlungen",
      felder: [{ id: "vorauszahlungen", art: "liste", label: "Vorauszahlungen", eintrag: "Vorauszahlung", titelFeld: "art", felder: [{ id: "art", art: "text", label: "Steuer", hilfe: "z. B. Einkommensteuer Q1", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
    },
    {
      titel: "Weitere Angaben und Belege",
      hilfe: "z. B. Krankenversicherung, Altersvorsorge, Spenden, Arbeitszimmer – was für deine Erklärung wichtig ist.",
      felder: [
        { id: "weiteres", art: "liste", label: "Weitere Angaben", eintrag: "Angabe", titelFeld: "was", felder: [{ id: "was", art: "text", label: "Was", pflicht: true }, { id: "betrag", art: "betrag", label: "Betrag (€)" }, { id: "beleg", art: "schalter", label: "Beleg liegt vor" }] },
        { id: "notiz", art: "mehrzeilig", label: "Notizen" },
      ],
    },
  ],
  html(d, b) {
    const arten = auswahl(d, "arten").map((a) => ERKLAERUNGEN.find((x) => x.wert === a)?.text ?? a);
    const vz = liste(d, "vorauszahlungen").filter((x) => text(x, "art"));
    const we = liste(d, "weiteres").filter((x) => text(x, "was"));
    // Blatt zum Ausfüllen (keine Zahlen eingegeben): Erklärungen zum Ankreuzen, alle Zeilen und Tabellen zum Eintragen
    const leer = !["gewinn", "umsatz", "ust_jahr", "vorsteuer_jahr"].some((k) => text(d, k)) && !vz.length && !we.length;
    // Steuerart einer Vorauszahlung: das erste Wort („Einkommensteuer Q1“ → „einkommensteuer“)
    const steuerart = (t: string) => t.trim().split(/\s+/)[0]!.toLocaleLowerCase("de");
    const verschiedene = new Set(vz.map((x) => steuerart(text(x, "art")))).size > 1;
    return dokument({
      titel: "Unterlagen zur Steuererklärung",
      betrieb: b,
      unter: [text(d, "jahr") ? `Jahr ${text(d, "jahr")}` : "", arten.join(", ")].filter(Boolean).join(": "),
      meta: [b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : "", `Jahr: ${text(d, "jahr") || KOPF_LINIE}`].filter(Boolean).join("\n"),
      inhalt:
        abschnitt(
          "Kennzahlen",
          // leeres Blatt: die Erklärungen zum Ankreuzen (ohne eigenen Abschnitt, damit alles auf eine Seite passt)
          (leer && !arten.length ? `<p class="klein">Erklärungen:</p>${ankreuzen(ERKLAERUNGEN.map((x) => x.text), { nebeneinander: true })}` : "") +
          kennzahlen([
            { text: "Gewinn oder Verlust", hinweis: "aus EÜR bzw. Bilanz", betrag: text(d, "gewinn") ? euro(cent(text(d, "gewinn")) ?? 0) : "&nbsp;" },
            ...(text(d, "umsatz") || leer ? [{ text: "Umsätze im Jahr (netto)", betrag: text(d, "umsatz") ? euro(cent(text(d, "umsatz")) ?? 0) : "&nbsp;" }] : []),
            ...(text(d, "ust_jahr") || leer ? [{ text: "Umsatzsteuer im Jahr", betrag: text(d, "ust_jahr") ? euro(cent(text(d, "ust_jahr")) ?? 0) : "&nbsp;" }] : []),
            ...(text(d, "vorsteuer_jahr") || leer ? [{ text: "Vorsteuer im Jahr", betrag: text(d, "vorsteuer_jahr") ? euro(cent(text(d, "vorsteuer_jahr")) ?? 0) : "&nbsp;" }] : []),
          ]),
        ) +
        (vz.length
          ? abschnitt("Geleistete Vorauszahlungen", tabelle(["Steuer", "Betrag"], vz.map((x) => [zelle(text(x, "art")), euro(cent(text(x, "betrag")) ?? 0)]), { breiten: ["70%", "30%"], zahlen: [1], summe: [verschiedene ? "<strong>Summe aller Vorauszahlungen (verschiedene Steuern)</strong>" : "<strong>Summe</strong>", `<strong>${euro(summe(vz, "betrag"))}</strong>`] }))
          : leer
            ? abschnitt("Geleistete Vorauszahlungen", tabelle(["Steuer", "Betrag"], [], { breiten: ["70%", "30%"], zahlen: [1], mindestens: 4, hoch: true }))
            : "") +
        (we.length
          ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], we.map((x) => [zelle(text(x, "was")), text(x, "betrag") ? euro(cent(text(x, "betrag")) ?? 0) : "", ja(x, "beleg") ? "liegt vor" : "<strong>fehlt</strong>"]), { breiten: ["55%", "25%", "20%"], zahlen: [1] }))
          : leer
            ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], [], { breiten: ["55%", "25%", "20%"], zahlen: [1], mindestens: 5, hoch: true }))
            : "") +
        (text(d, "notiz") ? abschnitt("Notizen", absatz(text(d, "notiz"))) : "") +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)", "Bescheid vom"]),
    });
  },
};

// ---------------------------------------------------------------- Kassenbuch

function kasse(d: Daten) {
  let bestand = cent(text(d, "anfang")) ?? 0;
  const zeilen = liste(d, "eintraege")
    .filter((x) => text(x, "text") || text(x, "einnahme") || text(x, "ausgabe"))
    .map((x) => {
      const ein = cent(text(x, "einnahme")) ?? 0;
      const aus = cent(text(x, "ausgabe")) ?? 0;
      bestand += ein - aus;
      return { x, ein, aus, bestand };
    });
  return { zeilen, ende: bestand, negativ: zeilen.some((z) => z.bestand < 0) };
}

export const kassenbuch: Vorlage = {
  id: "kassenbuch",
  grundlage: "§ 146 Abs. 1 AO",
  querformat: true,
  titel: "Kassenbuch (Vorlage zum Ausdrucken)",
  beschreibung: "Bargeld-Einnahmen und -Ausgaben mit laufendem Bestand – für Betriebe mit offener Ladenkasse. Ausgedruckt bzw. geteilt wird es festgeschrieben; ein laufend geführtes elektronisches Kassenbuch ersetzt es nicht.",
  festschreiben: true,
  bereich: "steuern",
  pflichten: [],
  namensFeld: "zeitraum",
  abschnitte: [
    { titel: "Zeitraum und Anfangsbestand",
      hilfe: "Vorlage zum Ausdrucken: Sobald du das Kassenbuch teilst oder druckst, schreibt Amtlos es fest – danach lässt es sich nicht mehr ändern. Ein laufend geführtes, unveränderbares elektronisches Kassenbuch ist es nicht.",
      felder: [
        { id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026", pflicht: true },
        { id: "anfang", art: "betrag", label: "Anfangsbestand (€)", pflicht: true },
      ],
    },
    {
      titel: "Einträge",
      hilfe: "Jeder Vorgang einzeln, in zeitlicher Reihenfolge, mit Beleg.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Einträge",
          eintrag: "Eintrag",
          titelFeld: "text",
          pflicht: true,
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
            { id: "beleg", art: "text", label: "Beleg-Nr." },
            { id: "text", art: "text", label: "Vorgang", hilfe: "z. B. Tageseinnahmen, Einkauf Milch", pflicht: true },
            { id: "einnahme", art: "betrag", label: "Einnahme (€)" },
            { id: "ausgabe", art: "betrag", label: "Ausgabe (€)" },
          ],
        },
      ],
    },
  ],
  ergebnis(d) {
    const k = kasse(d);
    return [["Endbestand", euro(k.ende)], ...(k.negativ ? ([["Achtung", "Bestand zwischendurch negativ – bitte prüfen"]] as [string, string][]) : [])];
  },
  html(d, b) {
    const k = kasse(d);
    const anfang = cent(text(d, "anfang")) ?? 0;
    // ohne Einträge: Blatt zum Eintragen von Hand mit hohen Leerzeilen
    const leer = !k.zeilen.length;
    return dokument({
      titel: "Kassenbuch",
      betrieb: b,
      unter: [text(d, "zeitraum"), leer ? "Vorlage zum Ausdrucken" : ""].filter(Boolean).join(" · ") || undefined,
      // ohne Zeitraum: Linie zum Eintragen in der Kennungsleiste
      meta: text(d, "zeitraum") ? undefined : `Zeitraum: ${KOPF_LINIE}`,
      quer: true,
      inhalt:
        tabelle(
          ["Datum", "Beleg", "Vorgang", "Einnahme", "Ausgabe", "Bestand"],
          [["", "", "<strong>Anfangsbestand</strong>", "", "", text(d, "anfang") ? `<strong>${euro(anfang)}</strong>` : ""], ...k.zeilen.map((z) => [datumDe(text(z.x, "datum")), zelle(text(z.x, "beleg")), zelle(text(z.x, "text")), z.ein ? euro(z.ein) : "", z.aus ? euro(z.aus) : "", z.bestand < 0 ? `<strong>${euro(z.bestand)}</strong>` : euro(z.bestand)])],
          { breiten: ["11%", "10%", "39%", "13%", "13%", "14%"], zahlen: [3, 4, 5], ...(leer ? { mindestens: KASSENBUCH_LEER, hoch: true } : {}), summe: ["", "", `Summen und Endbestand ${esc(text(d, "zeitraum"))}`, ...(leer ? [ZELLE_LINIE, ZELLE_LINIE, ZELLE_LINIE] : [euro(k.zeilen.reduce((a, z) => a + z.ein, 0)), euro(k.zeilen.reduce((a, z) => a + z.aus, 0)), euro(k.ende)])] },
        ) +
        (k.negativ ? `<p><strong>Der Bestand war zwischendurch negativ – bitte prüfen.</strong></p>` : "") +
        unterschriften(["Geprüft am", "Unterschrift"]),
    });
  },
};

/** Leeres Kassenbuch: Zeilen (samt Anfangsbestand) für zwei volle Querformatseiten – Seite 2 endet mit Summe und Unterschriften. */
const KASSENBUCH_LEER = 29;

// ---------------------------------------------------------------- Kassenmeldung

export const kassenmeldung: Vorlage = {
  id: "kassenmeldung",
  gestalt: "formular",
  titel: "Kassenmeldung (Datenblatt)",
  beschreibung: "Alle Angaben zu deinen elektronischen Kassen und Sicherheitseinrichtungen (TSE) für die Meldung ans Finanzamt – auch bei Außerbetriebnahme.",
  bereich: "steuern",
  pflichten: ["steuern.kassenmeldung", "steuern.kassenmeldung_ausserbetriebnahme"],
  grundlage: "§ 146a Abs. 4 AO",
  abschnitte: [
    { titel: "Stand",
      hilfe: "Die Meldung selbst geht elektronisch über „Mein ELSTER“. Die Angaben stehen auf der Kasse, in der Rechnung und in den Unterlagen zur TSE.",
      felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" }],
    },
    {
      titel: "Kassen",
      felder: [
        {
          id: "kassen",
          art: "liste",
          label: "Kassen",
          eintrag: "Kasse",
          titelFeld: "modell",
          pflicht: true,
          felder: [
            { id: "art", art: "text", label: "Art des elektronischen Aufzeichnungssystems", pflicht: true, vorschlaege: KASSEN_ARTEN },
            { id: "hersteller", art: "text", label: "Hersteller", pflicht: true },
            { id: "modell", art: "text", label: "Modell", pflicht: true },
            { id: "seriennummer", art: "text", label: "Seriennummer der Kasse", pflicht: true },
            { id: "software", selten: true, art: "text", label: "Software und Version" },
            { id: "anschaffung", art: "datum", label: "Angeschafft am", pflicht: true },
            { id: "tse_art", art: "text", label: "Art der zertifizierten technischen Sicherheitseinrichtung (TSE)", pflicht: true, vorschlaege: TSE_ARTEN },
            { id: "tse_seriennummer", art: "text", label: "Seriennummer der TSE", pflicht: true },
            { id: "tse_zertifikat", selten: true, art: "text", label: "Zertifizierungs-ID der TSE", hilfe: "z. B. BSI-K-TR-…" },
            { id: "ausser_betrieb", selten: true, art: "datum", label: "Außer Betrieb genommen am", hilfe: "nur bei Außerbetriebnahme" },
            { id: "grund", selten: true, art: "text", label: "Grund der Außerbetriebnahme", wenn: { feld: "ausser_betrieb" } },
          ],
        },
      ],
    },
  ],
  pruefen: (_d, b) => (b.steuernummer.trim() ? [] : ["Steuernummer (Mein Betrieb)"]),
  html(d, b) {
    const k = liste(d, "kassen").filter((x) => text(x, "modell") || text(x, "seriennummer"));
    // je Aufzeichnungssystem die Feldzeilen; ohne Kasse ein leerer Block zum Ausfüllen von Hand
    const bloecke: { titel: string; zeilen: [string, string | null][] }[] = k.length
      ? k.map((x, i) => ({
          titel: `Aufzeichnungssystem ${i + 1}${text(x, "ausser_betrieb") ? " (außer Betrieb)" : ""}`,
          zeilen: [
            ["Art", text(x, "art")],
            ["Hersteller / Modell", [text(x, "hersteller"), text(x, "modell")].filter(Boolean).join(", ")],
            ["Seriennummer", text(x, "seriennummer")],
            ["Software", text(x, "software") || null],
            ["Angeschafft am", datumDe(text(x, "anschaffung"))],
            ["TSE", [text(x, "tse_art"), text(x, "tse_seriennummer") ? `Seriennummer ${text(x, "tse_seriennummer")}` : ""].filter(Boolean).join(" · ")],
            ["Zertifizierungs-ID", text(x, "tse_zertifikat") || null],
            ["Außer Betrieb genommen", text(x, "ausser_betrieb") ? `${datumDe(text(x, "ausser_betrieb"))}${text(x, "grund") ? `, ${text(x, "grund")}` : ""}` : null],
          ],
        }))
      : // leeres Blatt: ein Aufzeichnungssystem zum Ausfüllen von Hand (ein zweiter Block passt nicht mehr auf die Seite),
        // die TSE mit Art und Seriennummer in eigenen Zeilen
        [1].map((i) => ({ titel: `Aufzeichnungssystem ${i}`, zeilen: ["Art", "Hersteller / Modell", "Seriennummer", "Software", "Angeschafft am", "TSE – Art", "TSE – Seriennummer", "Zertifizierungs-ID", "Außer Betrieb genommen"].map((t): [string, string] => [t, ""]) }));
    // Feldnummern laufen durch – gezählt werden nur die tatsächlich gedruckten Zeilen (Betriebsstätte: 01–03)
    let nr = 4;
    return dokument({
      titel: "Kassenmeldung – Datenblatt",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        `<p class="klein">Zum Übertragen in „Mein ELSTER“ (Mitteilung über elektronische Aufzeichnungssysteme nach § 146a Abs. 4 AO). Je Betriebsstätte eine Mitteilung mit allen Kassen.</p>` +
        abschnitt("Betriebsstätte", felder([["Steuernummer", b.steuernummer], ["Name und Anschrift", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")], ["Anzahl der Aufzeichnungssysteme", k.length ? String(k.length) : ""]])) +
        bloecke
          .map((x) => {
            const start = nr;
            nr += x.zeilen.filter(([, w]) => w !== null).length;
            // jedes Aufzeichnungssystem bleibt mit seiner Überschrift auf einer Seite
            return `<div class="zusammen">${abschnitt(x.titel, felder(x.zeilen, { start }))}</div>`;
          })
          .join("") +
        uebertragung(["Gemeldet über Mein ELSTER am", "Transferticket"]),
    });
  },
};

// ---------------------------------------------------------------- Aufbewahrung

/** Fristen nach § 147 AO / § 257 HGB in der Fassung ab 2025 (BEG IV), aus der Recherche (T-58). */
const AUFBEWAHRUNG_START: Eintrag[] = AUFBEWAHRUNG.map((x) => ({ art: x.art.replace(/^§[^:]*:\s*/, ""), jahre: x.jahre }));

/** Aufbewahren bis Ende des Jahres „letzte Eintragung + Frist“ (Frist beginnt mit Ende des Kalenderjahres). */
export function aufbewahrenBis(letzteJahr: string, jahre: string): string | null {
  const j = Number(letzteJahr);
  const f = Number(jahre);
  if (!Number.isInteger(j) || j < 1900 || !Number.isInteger(f) || f <= 0) return null;
  return `31.12.${j + f}`;
}

export const aufbewahrung: Vorlage = {
  id: "aufbewahrung",
  gestalt: "handbuch",
  titel: "Aufbewahrungsplan",
  beschreibung: "Welche Unterlagen wie lange aufzubewahren sind, wo sie liegen und ab wann sie frühestens weg dürfen.",
  bereich: "steuern",
  pflichten: ["steuern.aufbewahrung"],
  grundlage: "§ 147 AO; § 257 HGB",
  abschnitte: [
    {
      titel: "Unterlagen",
      hilfe: "Die Frist beginnt mit dem Ende des Kalenderjahres der letzten Eintragung. Die vorgeschlagenen Fristen bitte prüfen.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Unterlagen",
          eintrag: "Unterlagenart",
          titelFeld: "art",
          pflicht: true,
          start: AUFBEWAHRUNG_START,
          felder: [
            { id: "art", art: "text", label: "Unterlagen", pflicht: true },
            { id: "jahre", art: "zahl", label: "Aufbewahrungsfrist (Jahre)", pflicht: true },
            { id: "letzte", art: "zahl", label: "Jahr, in dem die Frist beginnt", hilfe: "Jahr der letzten Eintragung, der Aufstellung, des Belegs oder des Briefs, z. B. 2026" },
            { id: "ort", art: "text", label: "Wo aufbewahrt", hilfe: "z. B. Ordner im Büro, Buchhaltungsprogramm" },
          ],
        },
      ],
    },
  ],
  pruefen(d) {
    // Fristbeginn eingetragen, aber kein Jahr: dann bleibt „Aufbewahren mindestens bis“ leer
    return liste(d, "eintraege")
      .filter((x) => text(x, "letzte") && !(/^\d{4}$/.test(text(x, "letzte")) && Number(text(x, "letzte")) >= 1900))
      .map((x) => `Fristbeginn „${text(x, "letzte")}“${text(x, "art") ? ` bei „${text(x, "art").slice(0, 60)}${text(x, "art").length > 60 ? "…" : ""}“` : ""} ist kein Jahr – bitte vierstellig eintragen (z. B. 2026)`);
  },
  html(d, b) {
    const l = liste(d, "eintraege").filter((x) => text(x, "art"));
    // Blatt zum Ausfüllen (noch kein Jahr und kein Ort eingetragen): drei leere Zeilen für weitere Unterlagen
    const leer = !l.some((x) => text(x, "letzte") || text(x, "ort"));
    return dokument({
      titel: "Aufbewahrungsplan",
      betrieb: b,
      inhalt:
        tabelle(["Unterlagen", "Frist", "Jahr der letzten Eintragung bzw. des Belegs", "Aufbewahren mindestens bis", "Wo"], l.map((x) => [zelle(text(x, "art")), text(x, "jahre") ? `${esc(text(x, "jahre"))} ${zahl(text(x, "jahre")) === 1 ? "Jahr" : "Jahre"}` : ZELLE_LINIE, text(x, "letzte") ? zelle(text(x, "letzte")) : ZELLE_LINIE, aufbewahrenBis(text(x, "letzte"), text(x, "jahre")) ?? ZELLE_LINIE, text(x, "ort") ? zelle(text(x, "ort")) : ZELLE_LINIE]), { breiten: ["42%", "10%", "17%", "14%", "17%"], leerzeilen: leer ? 3 : 0 }) +
        nachsatz("Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die letzte Eintragung gemacht, das Inventar aufgestellt, der Jahresabschluss festgestellt, der Brief empfangen oder abgesandt oder der Buchungsbeleg entstanden ist (§ 147 Abs. 4 AO). Sie läuft nicht ab, solange die Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO)."),
    });
  },
};
