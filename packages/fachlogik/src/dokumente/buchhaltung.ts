/**
 * Steuern und Buchhaltung (E-121): Rechnung, EÜR, Bilanz/GuV, USt-Voranmeldung, Steuererklärung (Zusammenstellung),
 * Kassenbuch, Kassenmeldung, Aufbewahrung. Was elektronisch ans Finanzamt geht (Voranmeldung, Anlage EÜR, Erklärungen,
 * E-Bilanz, Kassenmeldung), erstellt die App als ausgefüllte Unterlage zum Übertragen – sie übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-58).
 */
import { KU_HINWEIS, rundeCent, summen, type Position } from "../rechnung.js";
import { AUFBEWAHRUNG, EINHEITEN, EUER_AUSGABEN, EUER_EINNAHMEN, KASSEN_ARTEN, RECHNUNGS_HINWEISE, TSE_ARTEN } from "./bausteine.js";
import { LINIE, abschnitt, absatz, angaben, anschrift, auswahl, cent, datumDe, dokument, esc, euro, ja, liste, summe, tabelle, text, unterschriften, zahl, zahlText, zelle } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Daten, Eintrag, Vorlage } from "./typen.js";

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
const ZIEL: Record<string, string> = { sofort: "sofort ohne Abzug", "7": "innerhalb von 7 Tagen", "14": "innerhalb von 14 Tagen", "30": "innerhalb von 30 Tagen" };

function positionen(d: Daten): { e: Eintrag; p: Position }[] {
  return liste(d, "positionen")
    .filter((e) => text(e, "bezeichnung") || text(e, "preis"))
    .map((e) => ({ e, p: { bezeichnung: text(e, "bezeichnung"), menge: zahl(text(e, "menge")) ?? 1, einheit: "stueck", preis_cent: cent(text(e, "preis")) ?? 0, ust_satz: Number(text(e, "satz") || "19") } }));
}

export const rechnung: Vorlage = {
  id: "rechnung",
  titel: "Rechnung",
  beschreibung: "Rechnung mit allen Pflichtangaben nach § 14 Abs. 4 UStG – Positionen, Steuersätze, Zahlungsziel und Pflichthinweise zum Auswählen.",
  bereich: "steuern",
  pflichten: ["steuern.rechnungen_pflichtangaben"],
  grundlage: "§ 14 Abs. 4 UStG",
  namensFeld: "nummer",
  abschnitte: [
    {
      hilfe: "Dieses PDF ist keine E-Rechnung. Für Rechnungen an Unternehmen gelten Übergangsfristen bis zur E-Rechnungspflicht.",
      felder: [
        { id: "nummer", art: "text", label: "Rechnungsnummer", hilfe: "fortlaufend und nur einmal vergeben, z. B. 2026-001", pflicht: true },
        { id: "datum", art: "datum", label: "Rechnungsdatum", vorbelegung: "heute", pflicht: true },
        { id: "leistung_gleich", art: "schalter", label: "Leistungsdatum entspricht dem Rechnungsdatum", vorbelegung: true },
        { id: "leistung", art: "text", label: "Datum oder Zeitraum der Leistung", hilfe: "z. B. 12.10.2026 oder Oktober 2026", pflicht: true, wenn: { feld: "leistung_gleich", nicht: true } },
        { id: "zahlungsziel", art: "wahl", label: "Zahlungsziel", optionen: optionen(ZIEL), vorbelegung: "14" },
      ],
    },
    {
      titel: "Rechnungsempfänger",
      felder: [
        { id: "kunde_name", art: "text", label: "Name oder Firma", pflicht: true },
        { id: "kunde_anschrift", art: "mehrzeilig", label: "Anschrift", hilfe: "Straße und Hausnummer, PLZ und Ort", pflicht: true },
        { id: "kunde_ust_idnr", art: "text", label: "USt-IdNr. des Empfängers", hilfe: "nur bei innergemeinschaftlichen Leistungen oder Steuerschuldnerschaft des Empfängers" },
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
        { id: "hinweise", art: "bausteine", label: "Pflichthinweise, falls zutreffend", optionen: [...RECHNUNGS_HINWEISE.filter((h) => h.wert !== "steuerfrei").map((h) => ({ wert: h.wert, text: h.text, quelle: h.quelle })), { wert: "grundstueck", text: GRUNDSTUECK_HINWEIS, quelle: "§ 14 Abs. 4 Nr. 9, § 14b Abs. 1 Satz 5 UStG" }] },
        { id: "befreiung", art: "text", label: "Hinweis auf die Steuerbefreiung (bei 0 %)", hilfe: "Pflicht, wenn eine Position steuerfrei ist – mit der Vorschrift", vorschlaege: ["Steuerfreie Leistung nach § 4 Nr. … UStG"] },
        { id: "hinweis", art: "mehrzeilig", label: "Weitere Hinweise", vorschlaege: ["Vielen Dank für Ihren Auftrag.", "Bitte geben Sie bei der Zahlung die Rechnungsnummer an."] },
      ],
    },
  ],
  pruefen(d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift des Betriebs (Mein Betrieb)");
    if (!b.steuernummer.trim() && !b.ust_idnr.trim()) f.push("Steuernummer oder USt-IdNr. (Mein Betrieb)");
    const nullProzent = positionen(d).some((x) => x.p.ust_satz === 0);
    if (nullProzent && !ja(d, "kleinunternehmer") && !text(d, "befreiung") && !auswahl(d, "hinweise").some((h) => h === "reverse_charge" || h === "igl")) f.push("Hinweis auf die Steuerbefreiung (bei 0 %)");
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
    const zeilenHtml = pos.map(({ e, p }, i) => [
      String(i + 1),
      zelle(p.bezeichnung),
      `${zahlText(p.menge)}${text(e, "einheit") ? ` ${esc(text(e, "einheit"))}` : ""}`,
      euro(p.preis_cent),
      ...(ku ? [] : [p.ust_satz === 0 ? "0 %" : `${p.ust_satz} %`]),
      euro(s.zeilen[i]!),
    ]);
    const summenZeilen = [
      `<tr><td>Summe netto</td><td>${euro(s.netto_cent)}</td></tr>`,
      ...(ku ? [] : s.gruppen.map((g) => `<tr><td>${g.satz === 0 ? "Steuerfrei bzw. 0 %" : `Umsatzsteuer ${g.satz} %`} auf ${euro(g.netto_cent)}</td><td>${euro(g.ust_cent)}</td></tr>`)),
      `<tr class="gesamt"><td>Rechnungsbetrag</td><td>${euro(s.brutto_cent)}</td></tr>`,
    ].join("");
    const leistung = ja(d, "leistung_gleich") ? "Leistungsdatum entspricht dem Rechnungsdatum" : text(d, "leistung");
    const hinweise = [
      ...(ku ? [KU_HINWEIS] : []),
      ...auswahl(d, "hinweise").map((w) => (w === "grundstueck" ? GRUNDSTUECK_HINWEIS : (RECHNUNGS_HINWEISE.find((h) => h.wert === w)?.text ?? ""))),
      text(d, "befreiung"),
      text(d, "zahlungsziel") ? `Zahlbar ${ZIEL[text(d, "zahlungsziel")]}${text(d, "zahlungsziel") !== "sofort" && text(d, "datum") ? ` (bis ${plusTage(text(d, "datum"), Number(text(d, "zahlungsziel")))})` : ""}.` : "",
      ...text(d, "hinweis").split("\n"),
    ].filter((x) => x.trim());
    const steuer = [b.steuernummer.trim() ? `Steuernummer ${b.steuernummer.trim()}` : "", b.ust_idnr.trim() ? `USt-IdNr. ${b.ust_idnr.trim()}` : ""].filter(Boolean).join(" · ");
    const fuss = [steuer, b.iban.trim() ? `IBAN ${b.iban.trim()}` : ""].filter(Boolean);
    return dokument({
      titel: `Rechnung ${text(d, "nummer")}`.trim(),
      betrieb: b,
      meta: `Rechnungsnummer: ${text(d, "nummer")}\nRechnungsdatum: ${datumDe(text(d, "datum"))}\nLeistung: ${ja(d, "leistung_gleich") ? "= Rechnungsdatum" : text(d, "leistung")}`,
      vorTitel: `<div class="empfaenger"><div class="absender">${esc([b.name, anschrift(b)].filter((x) => x.trim()).join(" · "))}</div><strong>${text(d, "kunde_name") ? esc(text(d, "kunde_name")) : LINIE}</strong><br>${text(d, "kunde_anschrift") ? esc(text(d, "kunde_anschrift")).replace(/\n/g, "<br>") : LINIE}${text(d, "kunde_ust_idnr") ? `<br>USt-IdNr. ${esc(text(d, "kunde_ust_idnr"))}` : ""}</div>`,
      inhalt:
        `<p>${esc(ja(d, "leistung_gleich") ? "Leistungsdatum entspricht dem Rechnungsdatum." : leistung ? `Leistungszeitraum: ${leistung}` : "")}</p>` +
        `<section style="margin-top:3mm">${tabelle(["Pos.", "Leistung", "Menge", "Einzelpreis", ...(ku ? [] : ["USt"]), "Betrag"], zeilenHtml, { breiten: ku ? ["7%", "48%", "15%", "15%", "15%"] : ["7%", "41%", "14%", "14%", "9%", "15%"] })}</section>` +
        `<table class="summen">${summenZeilen}</table>` +
        (hinweise.length ? `<div style="margin-top:7mm">${hinweise.map((h) => `<p>${esc(h)}</p>`).join("")}</div>` : "") +
        (fuss.length ? `<p class="klein" style="margin-top:8mm">${esc(fuss.join(" · "))}</p>` : ""),
    });
  },
};

// ---------------------------------------------------------------- EÜR

export const euer: Vorlage = {
  id: "euer",
  titel: "Einnahmen-Überschuss-Rechnung (EÜR)",
  beschreibung: "Einnahmen und Ausgaben eines Jahres mit Überschuss – als Aufstellung für deine Unterlagen und zum Übertragen in die Anlage EÜR.",
  bereich: "steuern",
  pflichten: ["steuern.euer"],
  grundlage: "§ 4 Abs. 3 EStG; § 60 Abs. 4 EStDV",
  namensFeld: "jahr",
  abschnitte: [
    {
      hilfe: "Die Anlage EÜR übermittelst du elektronisch über ELSTER. Diese Aufstellung sammelt die Zahlen dafür.",
      felder: [{ id: "jahr", art: "text", label: "Jahr", hilfe: "z. B. 2026", pflicht: true }],
    },
    {
      titel: "Einnahmen",
      hilfe: "Was im Jahr eingegangen ist.",
      felder: [{ id: "einnahmen", art: "liste", label: "Einnahmen", eintrag: "Einnahme", titelFeld: "text", pflicht: true, felder: [{ id: "datum", art: "datum", label: "Datum" }, { id: "text", art: "text", label: "Bezeichnung", hilfe: "z. B. Umsätze Oktober", pflicht: true }, { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_EINNAHMEN }, { id: "betrag", art: "betrag", label: "Betrag (€)", pflicht: true }] }],
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
            { id: "kategorie", art: "text", label: "Zeile der Anlage EÜR", vorschlaege: EUER_AUSGABEN },
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
  ergebnis(d) {
    const e = summe(liste(d, "einnahmen"), "betrag");
    const a = summe(liste(d, "ausgaben"), "betrag") + summe(liste(d, "afa"), "betrag");
    return [["Einnahmen", euro(e)], ["Ausgaben", euro(a)], [e - a >= 0 ? "Überschuss" : "Verlust", euro(e - a)]];
  },
  html(d, b) {
    const ein = liste(d, "einnahmen").filter((x) => text(x, "text") || text(x, "betrag"));
    const aus = liste(d, "ausgaben").filter((x) => text(x, "text") || text(x, "betrag"));
    const afa = liste(d, "afa").filter((x) => text(x, "text") || text(x, "betrag"));
    const e = summe(ein, "betrag");
    const a = summe(aus, "betrag");
    const f = summe(afa, "betrag");
    const kategorien = [...new Set(aus.map((x) => text(x, "kategorie") || "ohne Kategorie"))];
    const z = (l: Eintrag[]) => l.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "text")), `<span style="float:right">${euro(cent(text(x, "betrag")) ?? 0)}</span>`]);
    return dokument({
      titel: "Einnahmen-Überschuss-Rechnung",
      betrieb: b,
      unter: text(d, "jahr") ? `Jahr ${text(d, "jahr")}` : undefined,
      inhalt:
        abschnitt("Ergebnis", `<table class="angaben"><tr><th>Betriebseinnahmen</th><td style="text-align:right">${euro(e)}</td></tr><tr><th>Betriebsausgaben</th><td style="text-align:right">${euro(a)}</td></tr><tr><th>Abschreibungen</th><td style="text-align:right">${euro(f)}</td></tr><tr><th><strong>${e - a - f >= 0 ? "Überschuss" : "Verlust"}</strong></th><td style="text-align:right"><strong>${euro(e - a - f)}</strong></td></tr></table>`) +
        (kategorien.length > 1 ? abschnitt("Ausgaben nach Kategorie", angaben(kategorien.map((k) => [k, euro(summe(aus.filter((x) => (text(x, "kategorie") || "ohne Kategorie") === k), "betrag"))]))) : "") +
        abschnitt("Einnahmen", ein.length ? tabelle(["Datum", "Bezeichnung", "Betrag"], z(ein), { breiten: ["18%", "57%", "25%"] }) : absatz("", "Keine Einnahmen erfasst.")) +
        abschnitt("Ausgaben", aus.length ? tabelle(["Datum", "Bezeichnung", "Betrag"], z(aus), { breiten: ["18%", "57%", "25%"] }) : absatz("", "Keine Ausgaben erfasst.")) +
        (afa.length ? abschnitt("Abschreibungen", tabelle(["Wirtschaftsgut", "Betrag"], afa.map((x) => [zelle(text(x, "text")), `<span style="float:right">${euro(cent(text(x, "betrag")) ?? 0)}</span>`]), { breiten: ["75%", "25%"] })) : ""),
    });
  },
};

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
  titel: "Bilanz und Gewinn- und Verlustrechnung",
  beschreibung: "Jahresabschluss für Kaufleute: Erträge und Aufwendungen, Vermögen und Kapital – mit Prüfung, ob Aktiva und Passiva aufgehen.",
  bereich: "steuern",
  pflichten: ["steuern.buchfuehrungspflicht", "steuern.e_bilanz"],
  grundlage: "§§ 238, 242 HGB; § 5b EStG",
  namensFeld: "stichtag",
  abschnitte: [
    {
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
    return [[j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", euro(j)], ["Summe Aktiva", euro(akt)], ["Summe Passiva", euro(pas)], ...(akt !== pas ? ([["Differenz – bitte prüfen", euro(akt - pas)]] as [string, string][]) : [])];
  },
  html(d, b) {
    const l = (k: string) => liste(d, k).filter((x) => text(x, "posten") || text(x, "betrag"));
    const t = (k: string, kopf: string) => {
      const x = l(k);
      return tabelle([kopf, "Betrag"], [...x.map((e) => [zelle(text(e, "posten")), `<span style="float:right">${euro(cent(text(e, "betrag")) ?? 0)}</span>`]), [`<strong>Summe</strong>`, `<strong style="float:right">${euro(summe(x, "betrag"))}</strong>`]], { breiten: ["70%", "30%"] });
    };
    const j = summe(l("ertraege"), "betrag") - summe(l("aufwendungen"), "betrag");
    const akt = summe(l("aktiva"), "betrag");
    const pas = summe(l("passiva"), "betrag");
    return dokument({
      titel: "Jahresabschluss",
      betrieb: b,
      unter: text(d, "stichtag") ? `zum ${datumDe(text(d, "stichtag"))}` : undefined,
      inhalt:
        abschnitt("Gewinn- und Verlustrechnung", `<h3>Erträge</h3>${t("ertraege", "Posten")}<h3>Aufwendungen</h3>${t("aufwendungen", "Posten")}${angaben([[j >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag", euro(j)]])}`) +
        abschnitt("Bilanz", `<h3>Aktiva</h3>${t("aktiva", "Posten")}<h3>Passiva</h3>${t("passiva", "Posten")}${akt !== pas ? `<p><strong>Aktiva und Passiva weichen um ${euro(akt - pas)} ab.</strong></p>` : ""}`) +
        unterschriften(["Ort, Datum", "Unterschrift"]),
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

export const ustVoranmeldung: Vorlage = {
  id: "ust_voranmeldung",
  titel: "Umsatzsteuer-Voranmeldung",
  beschreibung: "Umsätze nach Steuersatz und Vorsteuer – die App rechnet Umsatzsteuer und Zahllast aus, du überträgst die Zahlen in ELSTER.",
  bereich: "steuern",
  pflichten: ["steuern.ust_voranmeldung"],
  grundlage: "§ 18 Abs. 1 UStG",
  namensFeld: "zeitraum",
  abschnitte: [
    {
      hilfe: "Die Voranmeldung übermittelst du elektronisch über ELSTER. Diese Unterlage rechnet die Zahlen dafür aus und bleibt bei deinen Unterlagen.",
      felder: [{ id: "zeitraum", art: "text", label: "Zeitraum", hilfe: "z. B. Oktober 2026 oder 3. Quartal 2026", pflicht: true }],
    },
    {
      titel: "Umsätze (netto)",
      felder: [
        { id: "umsatz_19", art: "betrag", label: "Umsätze zu 19 % (€)" },
        { id: "umsatz_7", art: "betrag", label: "Umsätze zu 7 % (€)", hilfe: "seit 2026 auch Speisen in Restaurant und Café (ohne Getränke)" },
        { id: "umsatz_frei", art: "betrag", label: "Umsätze ohne Umsatzsteuer (€)", hilfe: "z. B. steuerfreie Umsätze – welche Zeile in ELSTER gilt, hängt von der Art ab" },
      ],
    },
    {
      titel: "Vorsteuer",
      felder: [
        { id: "vorsteuer", art: "betrag", label: "Vorsteuer aus Eingangsrechnungen (€)", pflicht: true },
        { id: "notiz", art: "mehrzeilig", label: "Notiz", hilfe: "z. B. Besonderheiten in diesem Zeitraum" },
      ],
    },
  ],
  ergebnis(d) {
    const x = ust(d);
    return [["Umsatzsteuer", euro(x.s19 + x.s7)], ["Vorsteuer", euro(x.vst)], [x.zahllast >= 0 ? "Zahllast" : "Erstattung", euro(Math.abs(x.zahllast))]];
  },
  html(d, b) {
    const x = ust(d);
    return dokument({
      titel: "Umsatzsteuer-Voranmeldung",
      betrieb: b,
      unter: text(d, "zeitraum") || undefined,
      meta: b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : undefined,
      inhalt:
        abschnitt(
          "Berechnung",
          tabelle(
            ["", "Bemessungsgrundlage", "Steuer"],
            [
              ["Umsätze zu 19 %", euro(x.u19), euro(x.s19)],
              ["Umsätze zu 7 %", euro(x.u7), euro(x.s7)],
              ["Umsätze ohne Umsatzsteuer", euro(cent(text(d, "umsatz_frei")) ?? 0), "–"],
              ["Umsatzsteuer gesamt", "", `<strong>${euro(x.s19 + x.s7)}</strong>`],
              ["abzüglich Vorsteuer", "", euro(x.vst)],
              [`<strong>${x.zahllast >= 0 ? "Zahllast" : "Erstattung"}</strong>`, "", `<strong>${euro(Math.abs(x.zahllast))}</strong>`],
            ],
            { breiten: ["45%", "30%", "25%"] },
          ),
        ) +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        `<p style="margin-top:6mm;font-size:8.5pt;color:#4a5868">Übermittlung elektronisch über ELSTER. Übermittelt am: ________________</p>`,
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
  titel: "Unterlagen zur Steuererklärung",
  beschreibung: "Alle Zahlen und Belege für die Jahreserklärungen an einem Ort – zum Übertragen in ELSTER oder für die Steuerberatung.",
  bereich: "steuern",
  pflichten: ["steuern.est_erklaerung", "steuern.gewst_erklaerung", "steuern.ust_jahreserklaerung", "steuern.kst_erklaerung"],
  grundlage: "§ 25 EStG; § 31 KStG; § 14a GewStG; § 18 Abs. 3 UStG",
  namensFeld: "jahr",
  abschnitte: [
    {
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
        { id: "ust_jahr", art: "betrag", label: "Umsatzsteuer im Jahr (€)", wenn: { feld: "arten" } },
        { id: "vorsteuer_jahr", art: "betrag", label: "Vorsteuer im Jahr (€)", wenn: { feld: "arten" } },
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
    return dokument({
      titel: "Unterlagen zur Steuererklärung",
      betrieb: b,
      unter: text(d, "jahr") ? `Jahr ${text(d, "jahr")}` : undefined,
      meta: b.steuernummer.trim() ? `Steuernummer: ${b.steuernummer.trim()}` : undefined,
      inhalt:
        angaben([
          ["Erklärungen", arten.join(", ")],
          ["Gewinn oder Verlust", text(d, "gewinn") ? euro(cent(text(d, "gewinn")) ?? 0) : ""],
          ["Umsätze (netto)", text(d, "umsatz") ? euro(cent(text(d, "umsatz")) ?? 0) : null],
          ["Umsatzsteuer im Jahr", text(d, "ust_jahr") ? euro(cent(text(d, "ust_jahr")) ?? 0) : null],
          ["Vorsteuer im Jahr", text(d, "vorsteuer_jahr") ? euro(cent(text(d, "vorsteuer_jahr")) ?? 0) : null],
        ]) +
        (vz.length ? abschnitt("Vorauszahlungen", tabelle(["Steuer", "Betrag"], [...vz.map((x) => [zelle(text(x, "art")), euro(cent(text(x, "betrag")) ?? 0)]), ["<strong>Summe</strong>", `<strong>${euro(summe(vz, "betrag"))}</strong>`]], { breiten: ["70%", "30%"] })) : "") +
        (we.length ? abschnitt("Weitere Angaben und Belege", tabelle(["Was", "Betrag", "Beleg"], we.map((x) => [zelle(text(x, "was")), text(x, "betrag") ? euro(cent(text(x, "betrag")) ?? 0) : "", ja(x, "beleg") ? "liegt vor" : "<strong>fehlt</strong>"]), { breiten: ["55%", "25%", "20%"] })) : "") +
        (text(d, "notiz") ? abschnitt("Notizen", absatz(text(d, "notiz"))) : ""),
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
  titel: "Kassenbuch",
  beschreibung: "Bargeld-Einnahmen und -Ausgaben mit laufendem Bestand – für Betriebe mit offener Ladenkasse.",
  bereich: "steuern",
  pflichten: [],
  namensFeld: "zeitraum",
  abschnitte: [
    {
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
    return dokument({
      titel: "Kassenbuch",
      betrieb: b,
      unter: text(d, "zeitraum") || undefined,
      quer: true,
      inhalt:
        tabelle(
          ["Datum", "Beleg", "Vorgang", "Einnahme", "Ausgabe", "Bestand"],
          [["", "", "<strong>Anfangsbestand</strong>", "", "", `<strong>${euro(anfang)}</strong>`], ...k.zeilen.map((z) => [datumDe(text(z.x, "datum")), zelle(text(z.x, "beleg")), zelle(text(z.x, "text")), z.ein ? euro(z.ein) : "", z.aus ? euro(z.aus) : "", z.bestand < 0 ? `<strong>${euro(z.bestand)}</strong>` : euro(z.bestand)])],
          { breiten: ["11%", "10%", "39%", "13%", "13%", "14%"] },
        ) +
        angaben([["Endbestand", euro(k.ende)]]) +
        (k.negativ ? `<p><strong>Der Bestand war zwischendurch negativ – bitte prüfen.</strong></p>` : "") +
        unterschriften(["Geprüft am", "Unterschrift"]),
    });
  },
};

// ---------------------------------------------------------------- Kassenmeldung

export const kassenmeldung: Vorlage = {
  id: "kassenmeldung",
  titel: "Kassenmeldung (Datenblatt)",
  beschreibung: "Alle Angaben zu deinen elektronischen Kassen und Sicherheitseinrichtungen (TSE) für die Meldung ans Finanzamt – auch bei Außerbetriebnahme.",
  bereich: "steuern",
  pflichten: ["steuern.kassenmeldung", "steuern.kassenmeldung_ausserbetriebnahme"],
  grundlage: "§ 146a Abs. 4 AO",
  abschnitte: [
    {
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
            { id: "software", art: "text", label: "Software und Version" },
            { id: "anschaffung", art: "datum", label: "Angeschafft am", pflicht: true },
            { id: "tse_art", art: "text", label: "Art der zertifizierten technischen Sicherheitseinrichtung (TSE)", pflicht: true, vorschlaege: TSE_ARTEN },
            { id: "tse_seriennummer", art: "text", label: "Seriennummer der TSE", pflicht: true },
            { id: "tse_zertifikat", art: "text", label: "Zertifizierungs-ID der TSE", hilfe: "z. B. BSI-K-TR-…" },
            { id: "ausser_betrieb", art: "datum", label: "Außer Betrieb genommen am", hilfe: "nur bei Außerbetriebnahme" },
            { id: "grund", art: "text", label: "Grund der Außerbetriebnahme", wenn: { feld: "ausser_betrieb" } },
          ],
        },
      ],
    },
  ],
  pruefen: (_d, b) => (b.steuernummer.trim() ? [] : ["Steuernummer (Mein Betrieb)"]),
  html(d, b) {
    const k = liste(d, "kassen").filter((x) => text(x, "modell") || text(x, "seriennummer"));
    return dokument({
      titel: "Kassenmeldung – Datenblatt",
      betrieb: b,
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        angaben([["Steuernummer", b.steuernummer], ["Betriebsstätte", [b.name, anschrift(b)].filter((x) => x.trim()).join(", ")], ["Anzahl Kassen", String(k.length)]]) +
        (k.length
          ? k
              .map((x, i) =>
                abschnitt(
                  `Kasse ${i + 1}`,
                  angaben([
                    ["Art", text(x, "art")],
                    ["Hersteller / Modell", [text(x, "hersteller"), text(x, "modell")].filter(Boolean).join(" ")],
                    ["Seriennummer", text(x, "seriennummer")],
                    ["Software", text(x, "software") || null],
                    ["Angeschafft am", datumDe(text(x, "anschaffung"))],
                    ["TSE", [text(x, "tse_art"), text(x, "tse_seriennummer") ? `Seriennummer ${text(x, "tse_seriennummer")}` : ""].filter(Boolean).join(" · ")],
                    ["Zertifizierungs-ID", text(x, "tse_zertifikat") || null],
                    ["Außer Betrieb", text(x, "ausser_betrieb") ? `${datumDe(text(x, "ausser_betrieb"))}${text(x, "grund") ? ` – ${text(x, "grund")}` : ""}` : null],
                  ]),
                ),
              )
              .join("")
          : absatz("", "Keine Kassen erfasst.")) +
        `<p style="margin-top:6mm;font-size:8.5pt;color:#4a5868">Gemeldet über Mein ELSTER am: ________________</p>`,
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
            { id: "letzte", art: "text", label: "Jahr, in dem die Frist beginnt", hilfe: "Jahr der letzten Eintragung, der Aufstellung, des Belegs oder des Briefs, z. B. 2026" },
            { id: "ort", art: "text", label: "Wo aufbewahrt", hilfe: "z. B. Ordner im Büro, Buchhaltungsprogramm" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const l = liste(d, "eintraege").filter((x) => text(x, "art"));
    return dokument({
      titel: "Aufbewahrungsplan",
      betrieb: b,
      inhalt:
        tabelle(["Unterlagen", "Frist", "Fristbeginn (Jahr)", "Aufbewahren mindestens bis", "Wo"], l.map((x) => [zelle(text(x, "art")), text(x, "jahre") ? `${esc(text(x, "jahre"))} Jahre` : "", zelle(text(x, "letzte")), aufbewahrenBis(text(x, "letzte"), text(x, "jahre")) ?? "", zelle(text(x, "ort"))]), { breiten: ["32%", "12%", "16%", "16%", "24%"] }) +
        `<p style="margin-top:4mm">Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die letzte Eintragung gemacht, das Inventar aufgestellt, der Jahresabschluss festgestellt, der Brief empfangen oder abgesandt oder der Buchungsbeleg entstanden ist (§ 147 Abs. 4 AO). Sie läuft nicht ab, solange die Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO).</p>`,
    });
  },
};
