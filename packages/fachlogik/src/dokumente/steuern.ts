/**
 * Steuern: Verfahrensdokumentation nach GoBD (E-121, E-123). Gliederung nach GoBD Rz. 153 (allgemeine Beschreibung,
 * Anwenderdokumentation, technische Systemdokumentation, Betriebsdokumentation); Auswahloptionen nach den Mustern
 * zur Belegablage (AWV) und zum ersetzenden Scannen (BStBK/DStV). Fachlich zu prüfen (T-54).
 */
import { GOBD } from "./bausteine.js";
import { abschnitte, absatz, angaben, auswahl, datumDe, dokument, esc, ja, liste, punkte, tabelle, text, unterschriften, zelle, zeilen } from "./html.js";
import type { Option, Vorlage } from "./typen.js";

const opt = (l: string[]): Option[] => l.map((t) => ({ wert: t, text: t }));
const PROGRAMME = ["Buchhaltungsprogramm", "Kassensystem", "Rechnungsprogramm", "Online-Banking", "Belegscanner-App", "Upload-Portal der Steuerberatung", "Lohnprogramm", "Tabellenkalkulation"];

export const verfahrensdokumentation: Vorlage = {
  id: "verfahrensdokumentation",
  gestalt: "handbuch",
  titel: "Verfahrensdokumentation (GoBD)",
  beschreibung: "Wie in deinem Betrieb Belege ankommen, gebucht, aufbewahrt und gesichert werden – Abläufe zum Ankreuzen nach den Mustern von AWV und Steuerberaterkammer.",
  bereich: "steuern",
  pflichten: ["steuern.gobd_verfahrensdokumentation"],
  grundlage: "§§ 145–147 AO; GoBD",
  abschnitte: [
    { titel: "Stand und Verantwortung",
      felder: [
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
        { id: "version", selten: true, art: "text", label: "Version", vorschlaege: ["1.0", "1.1", "2.0"] },
        { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich", pflicht: true },
      ],
    },
    {
      titel: "Allgemeine Beschreibung",
      felder: [
        { id: "organisation", art: "mehrzeilig", label: "Tätigkeit und Organisation", hilfe: "Was der Betrieb macht, wer welche Aufgaben in der Buchhaltung übernimmt", pflicht: true },
        { id: "steuerberatung", art: "text", label: "Steuerberatung", hilfe: "falls beauftragt: Kanzlei und Umfang", vorschlaege: ["Buchführung und Jahresabschluss durch die Steuerberatung", "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb"] },
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
            { id: "name", art: "text", label: "Programm oder Gerät (Hersteller, Produkt)", pflicht: true },
            { id: "zweck", art: "text", label: "Wofür", vorschlaege: PROGRAMME },
            { id: "version", art: "text", label: "Version / im Einsatz seit" },
          ],
        },
      ],
    },
    {
      titel: "Anwenderdokumentation: Belege",
      felder: [
        { id: "belegeingang", art: "bausteine", label: "Wie Belege eingehen", optionen: opt(GOBD.belegeingang), pflicht: true },
        { id: "belegart", art: "bausteine", label: "Art der Belegablage", optionen: opt(GOBD.belegart), pflicht: true },
        { id: "ablage", art: "bausteine", label: "Wo Belege abgelegt werden", optionen: opt(GOBD.ablage), pflicht: true },
        { id: "erfassung", art: "mehrzeilig", label: "Erfassung, Prüfung und Verbuchung", hilfe: "Wer erfasst Belege wann, wer prüft, wie wird gebucht", pflicht: true, vorschlaege: ["Belege werden wöchentlich erfasst und an die Steuerberatung übermittelt.", "Eingangsrechnungen werden vor der Zahlung sachlich und rechnerisch geprüft.", "Ausgangsrechnungen werden fortlaufend nummeriert im Rechnungsprogramm erstellt."] },
        { id: "scannen", art: "schalter", label: "Papierbelege werden gescannt (ersetzendes Scannen)" },
        { id: "papier", art: "wahl", label: "Was mit dem Papier nach dem Scannen passiert", optionen: opt(GOBD.papier), wenn: { feld: "scannen" } },
        { id: "scan_ablauf", art: "mehrzeilig", label: "Ablauf des Scannens und Kontrolle", wenn: { feld: "scannen" }, vorschlaege: ["Scan zeitnah nach Eingang, vollständige und lesbare Wiedergabe wird vor der Ablage geprüft."] },
      ],
    },
    {
      titel: "Technische Systemdokumentation und Betriebsdokumentation",
      felder: [
        { id: "sicherung_intervall", art: "wahl", label: "Datensicherung – wie oft", optionen: opt(GOBD.sicherungIntervall), vorbelegung: GOBD.sicherungIntervall[0], pflicht: true },
        { id: "sicherung_ort", art: "bausteine", label: "Datensicherung – wohin", optionen: opt(GOBD.sicherungOrt), pflicht: true },
        { id: "e_rechnung", art: "schalter", label: "E-Rechnungen werden empfangen", vorbelegung: true },
        { id: "zugriff", art: "mehrzeilig", label: "Zugriffsrechte", pflicht: true, vorschlaege: ["Zugriff auf Buchhaltung und Belege nur für Inhaber/in und Steuerberatung", "Jede Person hat ein eigenes Benutzerkonto mit Passwort"] },
        { id: "kontrollen", art: "mehrzeilig", label: "Internes Kontrollsystem", hilfe: "Welche Prüfungen sicherstellen, dass alles vollständig und richtig ist", pflicht: true, vorschlaege: ["Monatlicher Abgleich von Kontoauszügen und Buchungen", "Tägliches Zählen der Kasse und Abgleich mit dem Kassenbericht", "Vier-Augen-Prinzip bei Zahlungen über einem festgelegten Betrag"] },
      ],
    },
    {
      titel: "Änderungen",
      hilfe: "Wenn sich ein Ablauf oder Programm ändert: hier mit Datum festhalten (die Verfahrensdokumentation wird versioniert aufbewahrt).",
      felder: [
        {
          id: "aenderungen",
          art: "liste",
          label: "Änderungen",
          eintrag: "Änderung",
          titelFeld: "aenderung",
          leerStarten: true,
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
    const l = (k: string) => (auswahl(d, k).length ? punkte(auswahl(d, k)) : absatz(""));
    // Zwischenüberschrift bleibt mit ihrem Inhalt auf einer Seite (nicht allein am Seitenende)
    const teil = (titel: string, inhalt: string) => `<div class="zusammen"><h3>${esc(titel)}</h3>${inhalt}</div>`;
    return dokument({
      titel: "Verfahrensdokumentation",
      betrieb: b,
      unter: "zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form (GoBD)",
      meta: `Stand: ${datumDe(text(d, "stand"))}\nVersion: ${text(d, "version")}\nVerantwortlich: ${text(d, "verantwortlich")}`,
      inhalt:
        abschnitte([
          { titel: "Allgemeine Beschreibung", rand: "GoBD Tz. 10.1", inhalt: angaben([["Betrieb", b.name], ["Tätigkeit und Organisation", text(d, "organisation")], ["Steuerberatung", text(d, "steuerberatung") || null], ["Verantwortlich", text(d, "verantwortlich")]]) },
          { titel: "Eingesetzte Programme und Geräte", rand: "GoBD Tz. 10.1", inhalt: tabelle(["Programm, Gerät", "Wofür", "Version, seit"], systeme.map((x) => [zelle(text(x, "name")), zelle(text(x, "zweck")), zelle(text(x, "version"))]), { breiten: ["38%", "38%", "24%"], ...(systeme.length ? {} : { mindestens: 4, hoch: true }) }) },
          {
            titel: "Anwenderdokumentation: Belegeingang, Erfassung und Ablage",
            rand: "GoBD Tz. 10.1",
            inhalt:
              teil("Eingang der Belege", l("belegeingang")) + teil("Art der Belegablage", l("belegart")) + teil("Ablage", l("ablage")) + teil("Erfassung, Prüfung und Verbuchung", zeilen(text(d, "erfassung"))) +
              (ja(d, "scannen") ? teil("Ersetzendes Scannen", `${text(d, "papier") ? `<p>${esc(text(d, "papier"))}.</p>` : ""}${zeilen(text(d, "scan_ablauf"))}`) : ""),
          },
          {
            titel: "Technische Systemdokumentation und Betriebsdokumentation",
            rand: "GoBD Tz. 10.1",
            inhalt:
              teil("Datensicherung", `<p>Die Daten werden ${esc(text(d, "sicherung_intervall") || "____")} gesichert:</p>${l("sicherung_ort")}`) +
              (ja(d, "e_rechnung") ? teil("E-Rechnungen", `<p>${esc(GOBD.eRechnung)}</p>`) : "") +
              teil("Zugriffsrechte", zeilen(text(d, "zugriff"))) + teil("Internes Kontrollsystem", zeilen(text(d, "kontrollen"))),
          },
          {
            titel: "Aufbewahrung und Änderungen",
            rand: "GoBD Tz. 10.1, 10.2",
            inhalt: `<div${aenderungen.length <= 8 ? ' class="zusammen"' : ""}><p>Diese Verfahrensdokumentation wird als Organisationsunterlage aufbewahrt; Änderungen werden mit Datum festgehalten.</p>${aenderungen.length ? tabelle(["Datum", "Änderung"], aenderungen.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "aenderung"))]), { breiten: ["18%", "82%"] }) : tabelle(["Datum", "Änderung"], [], { breiten: ["18%", "82%"], mindestens: 4, hoch: true })}</div>`,
          },
        ]) +
        unterschriften(["Unterschrift"], { ortDatum: true }),
    });
  },
};
