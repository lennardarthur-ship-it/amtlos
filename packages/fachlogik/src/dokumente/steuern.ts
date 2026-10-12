/** Steuern: Verfahrensdokumentation nach GoBD. Gliederung fachlich zu prüfen (T-54). */
import { abschnitt, absatz, angaben, datumDe, dokument, esc, liste, tabelle, text, unterschriften, zelle } from "./html.js";
import type { Vorlage } from "./typen.js";

const TEILE: { titel: string; felder: { id: string; label: string; hilfe: string; nurFalls?: boolean }[] }[] = [
  {
    titel: "Unternehmen und Organisation",
    felder: [
      { id: "organisation", label: "Tätigkeit und Organisation", hilfe: "Was der Betrieb macht und wer welche Aufgaben in der Buchhaltung übernimmt" },
      { id: "steuerberatung", label: "Steuerberatung", hilfe: "nur falls beauftragt: wer, und was sie übernimmt", nurFalls: true },
    ],
  },
  {
    titel: "Belege und Buchführung",
    felder: [
      { id: "belegeingang", label: "Eingang der Belege", hilfe: "Wie Rechnungen und Belege ankommen (Papier, E-Mail, Portal) und wo sie zuerst landen" },
      { id: "erfassung", label: "Erfassung und Verbuchung", hilfe: "Wer Belege wann erfasst, prüft und bucht – in welchem Programm" },
      { id: "ausgang", label: "Ausgangsrechnungen", hilfe: "Wie Rechnungen geschrieben, nummeriert und abgelegt werden" },
      { id: "kasse", label: "Kassenführung", hilfe: "nur falls Bargeld: Kassensystem, Tagesabschluss, Kassenbuch", nurFalls: true },
    ],
  },
  {
    titel: "Aufbewahrung und Sicherheit",
    felder: [
      { id: "aufbewahrung", label: "Aufbewahrung", hilfe: "Wo und wie Belege und Daten aufbewahrt werden und wie sie vor Änderung geschützt sind" },
      { id: "scannen", label: "Scannen von Papierbelegen", hilfe: "nur falls gescannt wird: Ablauf, Kontrolle, was mit den Originalen passiert", nurFalls: true },
      { id: "datensicherung", label: "Datensicherung", hilfe: "Wie oft, wohin, wer prüft die Sicherung" },
      { id: "zugriff", label: "Zugriffsrechte", hilfe: "Wer worauf zugreifen darf" },
      { id: "kontrollen", label: "Kontrollen", hilfe: "Welche Prüfungen sicherstellen, dass alles vollständig und richtig ist" },
    ],
  },
];

export const verfahrensdokumentation: Vorlage = {
  id: "verfahrensdokumentation",
  titel: "Verfahrensdokumentation (GoBD)",
  beschreibung: "Wie in deinem Betrieb Belege ankommen, gebucht, aufbewahrt und gesichert werden – für das Finanzamt nachvollziehbar.",
  bereich: "steuern",
  pflichten: ["steuern.gobd_verfahrensdokumentation"],
  abschnitte: [
    {
      felder: [
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
        { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich", pflicht: true },
      ],
    },
    {
      titel: "Eingesetzte Programme und Geräte",
      felder: [
        {
          id: "systeme",
          art: "liste",
          label: "Programme und Geräte",
          eintrag: "Programm",
          titelFeld: "name",
          pflicht: true,
          felder: [
            { id: "name", art: "text", label: "Programm oder Gerät", hilfe: "z. B. Buchhaltungsprogramm, Kassensystem, Scanner-App", pflicht: true },
            { id: "zweck", art: "text", label: "Wofür" },
            { id: "version", art: "text", label: "Version / im Einsatz seit" },
          ],
        },
      ],
    },
    ...TEILE.map((t) => ({ titel: t.titel, felder: t.felder.map((f) => ({ id: f.id, art: "mehrzeilig" as const, label: f.label, hilfe: f.hilfe, pflicht: !f.nurFalls })) })),
    {
      titel: "Änderungen",
      hilfe: "Wenn sich ein Ablauf oder Programm ändert: hier mit Datum festhalten.",
      felder: [
        {
          id: "aenderungen",
          art: "liste",
          label: "Änderungen",
          eintrag: "Änderung",
          titelFeld: "aenderung",
          felder: [
            { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute" },
            { id: "aenderung", art: "mehrzeilig", label: "Was sich geändert hat", pflicht: true },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const systeme = liste(d, "systeme").filter((x) => text(x, "name"));
    const aenderungen = liste(d, "aenderungen").filter((x) => text(x, "aenderung"));
    return dokument({
      titel: "Verfahrensdokumentation",
      betrieb: b,
      unter: "zur ordnungsmäßigen Führung und Aufbewahrung von Büchern und Belegen (GoBD)",
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        angaben([["Verantwortlich", text(d, "verantwortlich")], ["Stand", datumDe(text(d, "stand"))]]) +
        abschnitt("Eingesetzte Programme und Geräte", systeme.length ? tabelle(["Programm / Gerät", "Wofür", "Version / seit"], systeme.map((x) => [zelle(text(x, "name")), zelle(text(x, "zweck")), zelle(text(x, "version"))]), { breiten: ["35%", "40%", "25%"] }) : absatz("")) +
        TEILE.map((t) => abschnitt(t.titel, t.felder.filter((f) => !f.nurFalls || text(d, f.id)).map((f) => `<h3>${esc(f.label)}</h3>${absatz(text(d, f.id))}`).join(""))).join("") +
        (aenderungen.length ? abschnitt("Änderungen", tabelle(["Datum", "Änderung"], aenderungen.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "aenderung"))]), { breiten: ["18%", "82%"] })) : "") +
        unterschriften(["Ort, Datum", "Unterschrift"]),
    });
  },
};
