/**
 * Prüfbericht Lebensmittelhygiene (Tim Baum, 22.10.2026, Frage 12, ✎): Schulungsnachweis Lebensmittelhygiene nach § 4 LMHV.
 * Die Fachkenntnisse sind „auf Verlangen der zuständigen Behörde nachzuweisen“ (§ 4 Abs. 1 Satz 2 LMHV) – ohne Dokument
 * lässt sich das nicht nachweisen. Themen: die zehn Sachgebiete der Anlage 1 LMHV (Wortlaut der Überschriften) und die
 * Themen, die der Prüfbericht zusätzlich nennt (Personalhygiene, Schädlingsbekämpfung, Allergene). Wiederholung jährlich
 * (DIN 10514 laut Prüfbericht, L-107 ✔). Abgrenzung zur Belehrung nach § 43 IfSG und Ausnahme nach § 4 Abs. 2 LMHV im
 * Hilfetext und im Fußtext.
 */
import { teilnahmeTabelle } from "./arbeitsschutz.js";
import { abschnitt, absatz, angaben, auswahl, datumDe, dokument, liste, nachsatz, plusMonate, punkte, text, unterschriften, zeilen } from "./html.js";
import type { Option, Vorlage } from "./typen.js";

const ANLAGE_1 = "Anlage 1 LMHV";
const BERICHT = "Prüfbericht Lebensmittelhygiene 2026, Frage 12";
/** Sachgebiete der Schulung: Anlage 1 LMHV (Nr. 1–10), danach die Ergänzungen aus dem Prüfbericht. */
export const SCHULUNG_THEMEN: Option[] = [
  { wert: "eigenschaften", text: "Eigenschaften und Zusammensetzung des jeweiligen Lebensmittels", quelle: `${ANLAGE_1} Nr. 1` },
  { wert: "herstellung", text: "Hygienische Anforderungen an die Herstellung und Verarbeitung des jeweiligen Lebensmittels", quelle: `${ANLAGE_1} Nr. 2` },
  { wert: "recht", text: "Lebensmittelrecht", quelle: `${ANLAGE_1} Nr. 3` },
  { wert: "warenkontrolle", text: "Warenkontrolle, Haltbarkeitsprüfung und Kennzeichnung", quelle: `${ANLAGE_1} Nr. 4` },
  { wert: "eigenkontrollen", text: "Betriebliche Eigenkontrollen und Rückverfolgbarkeit", quelle: `${ANLAGE_1} Nr. 5` },
  { wert: "havarieplan", text: "Havarieplan, Krisenmanagement", quelle: `${ANLAGE_1} Nr. 6` },
  { wert: "behandlung", text: "Hygienische Behandlung des jeweiligen Lebensmittels", quelle: `${ANLAGE_1} Nr. 7` },
  { wert: "kuehlung_lagerung", text: "Anforderungen an Kühlung und Lagerung des jeweiligen Lebensmittels", quelle: `${ANLAGE_1} Nr. 8` },
  { wert: "abfall", text: "Vermeidung einer nachteiligen Beeinflussung des jeweiligen Lebensmittels beim Umgang mit Lebensmittelabfällen, ungenießbaren Nebenerzeugnissen und anderen Abfällen", quelle: `${ANLAGE_1} Nr. 9` },
  { wert: "reinigung", text: "Reinigung und Desinfektion", quelle: `${ANLAGE_1} Nr. 10` },
  { wert: "personalhygiene", text: "Personalhygiene", quelle: BERICHT },
  { wert: "schaedlinge", text: "Schädlingsbekämpfung", quelle: BERICHT },
  { wert: "allergene", text: "Allergene", quelle: BERICHT },
];

/** Hilfetexte (Prüfbericht Frage 12): Abgrenzung zur IfSG-Belehrung, Ausnahme § 4 Abs. 2 LMHV, Wiederholung. */
export const SCHULUNG_HILFE = {
  wer: "Wer bei dir mit leicht verderblichen Lebensmitteln arbeitet – auch du selbst –, braucht Fachkenntnisse in Lebensmittelhygiene aus einer Schulung (§ 4 Abs. 1 LMHV). Ausnahme: Wer eine Berufsausbildung abgeschlossen hat, die Kenntnisse in Lebensmittelhygiene vermittelt (z. B. Bäcker/in, Koch/Köchin), gilt für eine entsprechende Tätigkeit als geschult (§ 4 Abs. 2 LMHV).",
  abgrenzung: "Nicht verwechseln mit der Belehrung nach § 43 IfSG: Die Belehrung betrifft den Infektionsschutz (Krankheiten), die Schulung die Fachkenntnisse in Hygiene. Beides geht am selben Termin, braucht aber je eine eigene Unterschriftsliste.",
  // Nachkontrolle T. Baum (23.10.2026, Antwort 4, Hinweis 2): Empfehlung, keine gesetzliche Frist
  wiederholung: "Wiederholung jährlich empfohlen (DIN 10514) – eine gesetzliche Frist gibt es nicht.",
};

export const hygieneschulung: Vorlage = {
  id: "hygieneschulung",
  titel: "Schulungsnachweis Lebensmittelhygiene (§ 4 LMHV)",
  beschreibung: "Wann du wen in Lebensmittelhygiene geschult hast – Themen nach Anlage 1 LMHV zum Ankreuzen, mit Unterschriften der Teilnehmenden und der schulenden Person; Wiederholung jährlich empfohlen.",
  bereich: "gastro",
  pflichten: ["branche.gastro_hygieneschulung"],
  grundlage: "§ 4 LMHV; Anhang II Kap. XII VO (EG) Nr. 852/2004",
  namensFeld: "thema",
  abschnitte: [
    {
      titel: "Schulung",
      hilfe: `${SCHULUNG_HILFE.wer} ${SCHULUNG_HILFE.abgrenzung}`,
      felder: [
        { id: "thema", art: "text", label: "Bezeichnung", vorschlaege: ["Jährliche Hygieneschulung", "Hygieneschulung vor Arbeitsbeginn", "Hygieneschulung nach Änderung im Betrieb"] },
        { id: "datum", art: "datum", label: "Datum der Schulung", vorbelegung: "heute", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", vorschlaege: ["45 Minuten", "60 Minuten", "90 Minuten", "halber Tag"] },
        { id: "geschult_von", art: "text", label: "Schulende Person", hilfe: "Person oder Anbieter", vorbelegung: "verantwortlich", pflicht: true },
      ],
    },
    {
      titel: "Inhalte",
      hilfe: "Kreuze an, was in der Schulung behandelt wurde – die Sachgebiete der Anlage 1 LMHV passend zu deiner Tätigkeit.",
      felder: [
        { id: "themen", art: "bausteine", label: "Themen der Schulung", optionen: SCHULUNG_THEMEN, pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Betriebsspezifische Ergänzungen", hilfe: "z. B. Abläufe, Geräte und Produkte in deinem Betrieb" },
      ],
    },
    {
      titel: "Teilnehmende",
      hilfe: `Namen eintragen – im ausgedruckten PDF unterschreibt jede Person eigenhändig daneben. ${SCHULUNG_HILFE.wiederholung}`,
      felder: [
        {
          id: "teilnehmer",
          art: "liste",
          ausMitarbeitern: true,
          label: "Teilnehmende",
          eintrag: "Person",
          titelFeld: "name",
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "taetigkeit", art: "text", label: "Tätigkeit", vorschlaege: ["Küche", "Backstube", "Service und Theke", "Verkauf", "Spülküche"] },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const themen = auswahl(d, "themen").map((w) => SCHULUNG_THEMEN.find((t) => t.wert === w)?.text ?? w);
    const naechste = plusMonate(text(d, "datum"), 12);
    return dokument({
      titel: "Schulungsnachweis Lebensmittelhygiene",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      meta: `Datum: ${datumDe(text(d, "datum"))}\nGeschult von: ${text(d, "geschult_von")}\nDauer: ${text(d, "dauer")}\nNächste Schulung: ${naechste ? `bis ${naechste}` : ""}`,
      inhalt:
        // Datum, schulende Person und Dauer stehen in der Kennungsleiste; dort entfallen leere Angaben – dann hier als Linie
        ((a) => (a ? abschnitt("Angaben", a) : ""))(angaben([["Datum", text(d, "datum") ? null : ""], ["Dauer", text(d, "dauer") ? null : ""], ["Geschult von", text(d, "geschult_von") ? null : ""]])) +
        abschnitt("Themen der Schulung", (themen.length ? punkte(themen) : absatz("")) + (text(d, "inhalt") ? zeilen(text(d, "inhalt")) : "")) +
        abschnitt("Teilnahme", `<p class="vor-tabelle">Mit meiner Unterschrift bestätige ich die Teilnahme an der Schulung zur Lebensmittelhygiene.</p>${teilnahmeTabelle(liste(d, "teilnehmer"), { kopf: "Tätigkeit", feld: "taetigkeit" })}`) +
        nachsatz(`Schulung nach § 4 Abs. 1 LMHV; die Fachkenntnisse sind der Behörde auf Verlangen nachzuweisen. Wiederholung jährlich empfohlen (DIN 10514)${naechste ? `, nächste Schulung bis ${naechste}` : ""}. Die Belehrung nach § 43 IfSG (Infektionsschutz) ist ein eigener Nachweis. Als geschult gilt nach § 4 Abs. 2 LMHV auch, wer eine Berufsausbildung mit Lebensmittelhygiene abgeschlossen hat (z. B. Bäcker/in, Koch/Köchin).`) +
        unterschriften(["Ort, Datum", "Unterschrift der schulenden Person"]),
    });
  },
};
