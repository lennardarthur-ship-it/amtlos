/**
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026, Abschnitt 5.2, C-9, Frage 14): Meldungen an das Bundeszentralamt für
 * Steuern zu Umsätzen mit dem übrigen Gemeinschaftsgebiet – als Übertragungshilfe wie die Voranmeldung:
 *
 * - OSS-Erklärung (One-Stop-Shop, § 18j UStG): Fernverkäufe und Leistungen an Privatpersonen im EU-Ausland, die dort
 *   steuerbar sind (EU-weit über 10.000 € im Vorjahr oder laufenden Jahr, § 3c Abs. 4 UStG, oder nach Verzicht) – je
 *   Land und Steuersatz. Besteuerungszeitraum ist das Kalendervierteljahr (§ 16 Abs. 1d UStG); Erklärung und Zahlung
 *   bis zum letzten Tag des Folgemonats (§ 18j Abs. 4 UStG). Die Frist verschiebt sich nicht auf den nächsten Werktag
 *   (EU-einheitlich). Die Umsätze gehören nicht in die deutsche Voranmeldung.
 * - Zusammenfassende Meldung (§ 18a UStG): innergemeinschaftliche Lieferungen (L), sonstige Leistungen an Unternehmen
 *   im EU-Ausland, für die der Empfänger die Steuer schuldet (S), und Dreiecksgeschäfte (D) je USt-IdNr. des Erwerbers;
 *   bis zum 25. Tag nach Ablauf des Meldezeitraums (Monat; Quartal bei Lieferungen bis 50.000 € im laufenden und den
 *   vier vorangegangenen Quartalen bzw. nur sonstigen Leistungen, § 18a Abs. 1 Satz 2 UStG). Beträge in vollen Euro.
 *
 * Die Werte trägt die App aus den geteilten Rechnungen ein („Aus Rechnungen übernehmen“, apps/mobile
 * src/unterlagen/euMeldungen.ts) – sie übermittelt nichts. Fachlich zu prüfen: Kennzeichnung der Länder und Sätze.
 */
import { rundeCent } from "../rechnung.js";
import { KOPF_LINIE, abschnitt, absatz, cent, dokument, esc, euro, kennzahlen, liste, nachsatz, steuerHinweis, tabelle, text, uebertragung, zelle } from "./html.js";
import type { Daten, Eintrag, Option, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";

/** Länder des übrigen Gemeinschaftsgebiets (ISO 3166-1 alpha-2, Griechenland im OSS als „EL“ gemeldet) → Name */
export const EU_LAENDER_NAMEN: Record<string, string> = {
  AT: "Österreich", BE: "Belgien", BG: "Bulgarien", CY: "Zypern", CZ: "Tschechien", DK: "Dänemark", EE: "Estland", ES: "Spanien", FI: "Finnland",
  FR: "Frankreich", GR: "Griechenland", HR: "Kroatien", HU: "Ungarn", IE: "Irland", IT: "Italien", LT: "Litauen", LU: "Luxemburg", LV: "Lettland",
  MT: "Malta", NL: "Niederlande", PL: "Polen", PT: "Portugal", RO: "Rumänien", SE: "Schweden", SI: "Slowenien", SK: "Slowakei",
};
/** Ländername für die Anzeige; unbekannte Angaben wie eingegeben */
export const landName = (t: string) => EU_LAENDER_NAMEN[t.trim().toUpperCase() === "EL" ? "GR" : t.trim().toUpperCase()] ?? t.trim();

/** OSS: Frist und Hinweise (für Vorlage, App und Tests) */
export const OSS_FRIST = "bis zum letzten Tag des Monats nach Ablauf des Quartals über das BZStOnline-Portal zu übermitteln und zu zahlen (§ 18j Abs. 4 UStG) – die Frist verschiebt sich nicht, wenn sie auf ein Wochenende oder einen Feiertag fällt";
export const OSS_NICHT_VA = "OSS-Umsätze gehören nicht in die deutsche Umsatzsteuer-Voranmeldung; die Steuer zahlst du an das BZSt, das sie an die Bestimmungsländer weiterleitet.";
export const ZM_FRIST = "bis zum 25. Tag nach Ablauf des Meldezeitraums elektronisch an das BZSt zu übermitteln (§ 18a Abs. 1 UStG)";
/** Steuerberater (Durchsicht 23.10.2026): Lieferschwelle nach § 3c Abs. 4 UStG (Wortlaut des Prüfers). */
export const OSS_LIEFERSCHWELLE = "Die Lieferschwelle von 10.000 € gilt EU-weit für Fernverkäufe von Waren sowie Telekommunikations-, Rundfunk- und elektronische Dienstleistungen an Privatpersonen; sie ist überschritten, wenn diese Umsätze im Vorjahr oder im laufenden Jahr insgesamt mehr als 10.000 € betragen (§ 3c Abs. 4 UStG).";
/** Steuerberater (Durchsicht 23.10.2026): Korrekturen früherer Quartale. */
export const OSS_KORREKTUR = "Korrekturen früherer Quartale gehören nicht als negative Beträge in das laufende Quartal, sondern in den Berichtigungsteil einer späteren Erklärung.";
/** Steuerberater (Durchsicht 23.10.2026): Meldezeitraum nach § 18a Abs. 1 Satz 2 UStG. */
export const ZM_ZEITRAUM = "Meldezeitraum ist der Kalendermonat; vierteljährlich ist wählbar, wenn die innergemeinschaftlichen Lieferungen weder im laufenden noch in einem der vier vorangegangenen Quartale jeweils 50.000 € übersteigen (§ 18a Abs. 1 Satz 2 UStG), und bei nur sonstigen Leistungen. Wird die Grenze im laufenden Quartal überschritten, ist ab dem Monat der Überschreitung monatlich zu melden.";
export const ZM_SKONTO = "Ändert sich die Bemessungsgrundlage später (z. B. Skonto, Rabatt, Rücksendung), ist die Meldung für den ursprünglichen Meldezeitraum innerhalb eines Monats zu berichtigen (§ 18a Abs. 10 UStG).";

/** Steuersatz in Prozent aus dem Feld („20“, „5,5“) – null, wenn nicht lesbar */
export function satzAus(t: string): number | null {
  const s = t.trim().replace(/\s*%$/, "").replace(",", ".");
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(s)) return null;
  const x = Number(s);
  return x >= 0 && x < 50 ? x : null;
}

const ossZeilen = (d: Daten) =>
  liste(d, "umsaetze")
    .filter((e) => text(e, "land") || text(e, "netto"))
    .map((e) => {
      const netto = cent(text(e, "netto")) ?? 0;
      const satz = satzAus(text(e, "satz"));
      return { e, land: text(e, "land").trim(), satz, netto, steuer: satz === null ? 0 : rundeCent((netto * satz) / 100) };
    });

export const oss: Vorlage = {
  id: "oss_meldung",
  gestalt: "formular",
  titel: "OSS-Erklärung (One-Stop-Shop)",
  beschreibung: "Fernverkäufe und Leistungen an Privatpersonen im EU-Ausland je Land und Steuersatz – die App rechnet die Steuer, du überträgst die Zahlen ins BZStOnline-Portal.",
  bereich: "steuern",
  pflichten: ["steuern.oss_erklaerung"],
  ausEuRechnungen: "oss",
  grundlage: "§§ 3c, 18j UStG",
  namensFeld: "zeitraum",
  abschnitte: [
    {
      titel: "Quartal",
      hilfe: `Die OSS-Erklärung übermittelst du vierteljährlich über das BZStOnline-Portal des Bundeszentralamts für Steuern. Diese Unterlage stellt die Umsätze je Land und Steuersatz zusammen – aus deinen Rechnungen mit „OSS“ in ${MARKE.name} oder von Hand (z. B. aus dem Bericht deines Shopsystems).`,
      felder: [{ id: "zeitraum", art: "text", label: "Quartal", hilfe: "z. B. 3. Quartal 2026", pflicht: true }],
    },
    {
      titel: "Umsätze je Land und Steuersatz",
      felder: [
        {
          id: "umsaetze", art: "liste", label: "Umsätze", eintrag: "Zeile", titelFeld: "land", pflicht: true,
          hilfe: "je Bestimmungsland und Steuersatz eine Zeile – Bemessungsgrundlage ohne Umsatzsteuer",
          felder: [
            { id: "land", art: "text", label: "Bestimmungsland", hilfe: "z. B. AT oder Österreich", pflicht: true },
            { id: "satz", art: "zahl", label: "Steuersatz (%)", hilfe: "Satz des Bestimmungslands, z. B. 20", pflicht: true },
            { id: "netto", art: "betrag", label: "Bemessungsgrundlage netto (€)", pflicht: true },
          ],
        },
        { id: "notiz", selten: true, art: "mehrzeilig", label: "Notiz", hilfe: `z. B. Besonderheiten in diesem Quartal. ${OSS_KORREKTUR}` },
      ],
    },
  ],
  pruefen(d) {
    return ossZeilen(d).some((z) => z.satz === null && text(z.e, "satz").trim()) ? ["Steuersatz je Zeile als Zahl, z. B. 20 oder 5,5"] : [];
  },
  // Steuerberater (Durchsicht 23.10.2026): negative Beträge sind meist Korrekturen früherer Quartale
  hinweise(d) {
    return ossZeilen(d).some((z) => z.netto < 0) ? [OSS_KORREKTUR] : [];
  },
  ergebnis(d) {
    const z = ossZeilen(d);
    return [["Bemessungsgrundlage", euro(z.reduce((a, x) => a + x.netto, 0))], ["Steuer an das BZSt", euro(z.reduce((a, x) => a + x.steuer, 0))]];
  },
  html(d, b) {
    const z = ossZeilen(d);
    const leer = !z.length;
    const summe = z.reduce((a, x) => a + x.steuer, 0);
    const laender = [...new Set(z.map((x) => landName(x.land)))];
    const jeLand = laender.map((l) => [l, z.filter((x) => landName(x.land) === l).reduce((a, x) => a + x.steuer, 0)] as const);
    return dokument({
      titel: "OSS-Erklärung",
      betrieb: b,
      unter: [text(d, "zeitraum"), "Übertragungshilfe für das BZStOnline-Portal"].filter(Boolean).join(", "),
      meta: [b.ust_idnr.trim() ? `USt-IdNr.: ${b.ust_idnr.trim()}` : "USt-IdNr.: (für das OSS-Verfahren nötig)", `Quartal: ${text(d, "zeitraum") || KOPF_LINIE}`, "Verfahren: EU-Regelung (§ 18j UStG)"].join("\n"),
      inhalt:
        abschnitt(
          "Umsätze je Bestimmungsland und Steuersatz",
          tabelle(
            ["Bestimmungsland", "Steuersatz", "Bemessungsgrundlage", "Steuer"],
            z.map((x) => [zelle(landName(x.land)), x.satz === null ? "–" : `${String(x.satz).replace(".", ",")} %`, euro(x.netto), euro(x.steuer)]),
            { breiten: ["40%", "16%", "24%", "20%"], zahlen: [1, 2, 3], ...(leer ? { mindestens: 6, hoch: true } : { summe: ["<strong>Summe</strong>", "", `<strong>${euro(z.reduce((a, x) => a + x.netto, 0))}</strong>`, `<strong>${euro(summe)}</strong>`] }) },
          ),
        ) +
        abschnitt("Summe", kennzahlen([{ text: "Bemessungsgrundlage gesamt", betrag: leer ? "&nbsp;" : euro(z.reduce((a, x) => a + x.netto, 0)) }, { text: "Steuer an das BZSt", hinweis: "Erklärung und Zahlung bis zum Ende des Folgemonats", betrag: leer ? "&nbsp;" : euro(summe), fett: true }])) +
        (jeLand.length > 1 ? abschnitt("Steuer je Land", tabelle(["Bestimmungsland", "Steuer"], jeLand.map(([l, c]) => [zelle(l), euro(c)]), { breiten: ["70%", "30%"], zahlen: [1] })) : "") +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        nachsatz(`Erklärung und Zahlung ${OSS_FRIST}. ${OSS_NICHT_VA}`) +
        nachsatz(`${OSS_LIEFERSCHWELLE} ${OSS_KORREKTUR} Steuersätze und Ware je Land vor dem Übertragen prüfen.`) +
        steuerHinweis("erklaerung", MARKE.name) +
        uebertragung(["Übermittelt am (BZStOnline-Portal)", "Gezahlt am"]),
    });
  },
};

/** Zusammenfassende Meldung: Art der Leistung (Kennzeichnung im Vordruck) */
export const ZM_ARTEN: Option[] = [
  { wert: "L", text: "L – innergemeinschaftliche Lieferung" },
  { wert: "S", text: "S – sonstige Leistung (Empfänger schuldet die Steuer)" },
  { wert: "D", text: "D – innergemeinschaftliches Dreiecksgeschäft" },
];

const zmZeilen = (d: Daten) =>
  liste(d, "meldungen")
    .filter((e: Eintrag) => text(e, "ust_idnr") || text(e, "betrag"))
    .map((e) => ({ e, ust: text(e, "ust_idnr").replace(/\s/g, "").toUpperCase(), art: text(e, "art") || "L", betrag: Math.trunc((cent(text(e, "betrag")) ?? 0) / 100) * 100 }));

export const zusammenfassendeMeldung: Vorlage = {
  id: "zm_meldung",
  gestalt: "formular",
  titel: "Zusammenfassende Meldung",
  beschreibung: "Innergemeinschaftliche Lieferungen und Leistungen an Unternehmen im EU-Ausland je USt-IdNr. – du überträgst die Zahlen über ELSTER an das BZSt.",
  bereich: "steuern",
  pflichten: ["steuern.zusammenfassende_meldung"],
  ausEuRechnungen: "zm",
  grundlage: "§ 18a UStG",
  namensFeld: "zeitraum",
  abschnitte: [
    {
      titel: "Meldezeitraum",
      hilfe: `Die Zusammenfassende Meldung übermittelst du elektronisch an das Bundeszentralamt für Steuern (ELSTER). Diese Unterlage stellt die Beträge je USt-IdNr. zusammen – aus deinen Rechnungen in ${MARKE.name} oder von Hand.`,
      felder: [{ id: "zeitraum", art: "text", label: "Meldezeitraum", hilfe: "z. B. Oktober 2026 oder 4. Quartal 2026", pflicht: true }],
    },
    {
      titel: "Meldungen je Erwerber",
      felder: [
        {
          id: "meldungen", art: "liste", label: "Meldungen", eintrag: "Zeile", titelFeld: "ust_idnr", pflicht: true,
          hilfe: "je USt-IdNr. des Kunden und Art eine Zeile – Summe der Bemessungsgrundlagen in vollen Euro",
          felder: [
            { id: "ust_idnr", art: "text", label: "USt-IdNr. des Kunden", hilfe: "mit Länderkennzeichen, z. B. ATU12345678", pflicht: true },
            { id: "art", art: "wahl", label: "Art", optionen: ZM_ARTEN, vorbelegung: "L" },
            { id: "betrag", art: "betrag", label: "Summe der Bemessungsgrundlagen (€)", pflicht: true },
          ],
        },
        { id: "notiz", selten: true, art: "mehrzeilig", label: "Notiz", hilfe: "z. B. Berichtigung eines früheren Meldezeitraums" },
      ],
    },
  ],
  pruefen(d) {
    return zmZeilen(d).some((z) => z.ust && !/^[A-Z]{2}[0-9A-Z+*]{2,13}$/.test(z.ust)) ? ["USt-IdNr. mit Länderkennzeichen, z. B. ATU12345678"] : [];
  },
  ergebnis(d) {
    const z = zmZeilen(d);
    return [["Summe der Meldungen", euro(z.reduce((a, x) => a + x.betrag, 0))]];
  },
  html(d, b) {
    const z = zmZeilen(d);
    const leer = !z.length;
    const voll = (c: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.trunc(c / 100))} €`;
    return dokument({
      titel: "Zusammenfassende Meldung",
      betrieb: b,
      unter: [text(d, "zeitraum"), "Übertragungshilfe für ELSTER"].filter(Boolean).join(", "),
      meta: [b.ust_idnr.trim() ? `USt-IdNr.: ${b.ust_idnr.trim()}` : "USt-IdNr.: (für die Meldung nötig)", `Meldezeitraum: ${text(d, "zeitraum") || KOPF_LINIE}`].join("\n"),
      inhalt:
        abschnitt(
          "Meldungen je USt-IdNr.",
          tabelle(
            ["USt-IdNr. des Erwerbers bzw. Empfängers", "Art", "Summe der Bemessungsgrundlagen"],
            z.map((x) => [zelle(x.ust), esc(x.art), voll(x.betrag)]),
            { breiten: ["50%", "14%", "36%"], zahlen: [2], ...(leer ? { mindestens: 6, hoch: true } : { summe: ["<strong>Summe</strong>", "", `<strong>${voll(z.reduce((a, x) => a + x.betrag, 0))}</strong>`] }) },
          ),
        ) +
        abschnitt("Summe", kennzahlen([{ text: "Summe aller Meldungen", hinweis: "in vollen Euro", betrag: leer ? "&nbsp;" : voll(z.reduce((a, x) => a + x.betrag, 0)), fett: true }])) +
        (text(d, "notiz") ? abschnitt("Notiz", absatz(text(d, "notiz"))) : "") +
        nachsatz(`Die Meldung ist ${ZM_FRIST}. ${ZM_ZEITRAUM} Lieferungen zählen im Zeitraum der Rechnung, spätestens im Monat nach der Lieferung; sonstige Leistungen im Zeitraum der Ausführung. Kleinunternehmer geben keine Zusammenfassende Meldung ab.`) +
        nachsatz(ZM_SKONTO) +
        steuerHinweis("erklaerung", MARKE.name) +
        uebertragung(["Übermittelt am", "Transferticket (ELSTER)"]),
    });
  },
};
