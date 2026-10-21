/**
 * Steuern: Verfahrensdokumentation nach GoBD (E-121, E-123). Gliederung nach GoBD Rz. 153 (allgemeine Beschreibung,
 * Anwenderdokumentation, technische Systemdokumentation, Betriebsdokumentation); Auswahloptionen nach den Mustern
 * zur Belegablage (AWV) und zum ersetzenden Scannen (BStBK/DStV). Fachlich zu prüfen (T-54).
 */
import { GOBD } from "./bausteine.js";
import { mitVertretung } from "./betrieb.js";
import { abschnitte, angaben, ankreuzen, auswahl, datumDe, dokument, esc, ja, liste, neufassung, punkte, stabileOption, tabelle, text, unterschriften, zelle, zeilen } from "./html.js";
import type { Option, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";

// Wert bleibt der frühere Text (gespeicherte Auswahlen), Anzeige und Druck in der Neufassung
const opt = (l: string[]): Option[] => l.map((t) => stabileOption(t));
const PROGRAMME = ["Buchhaltungsprogramm", "Kassensystem", "Rechnungsprogramm", "Online-Banking", "Belegscanner-App", "Upload-Portal der Steuerberatung", "Lohnprogramm", "Tabellenkalkulation"];

/** R12 GoBD: Art der Kasse (Kassenkapitel). */
const KASSEN_ARTEN = ["Elektronisches Kassensystem mit TSE (Einzelaufzeichnung je Verkauf)", "Offene Ladenkasse ohne elektronisches Kassensystem (Kassenbericht mit Zählung)", "Keine Bareinnahmen"];
/** R12 GoBD: Bausteine zum Ablauf an der Kasse. */
const KASSEN_ABLAUF = [
  `Jeden Abend Tagesabschluss (Z-Bon) und Übernahme der Summen je Steuersatz, Karte, Trinkgeld, Gutscheine und Entnahmen in ${MARKE.name} am selben Tag`,
  "Der Bargeldbestand wird am Ende jedes Tages gezählt; Kassendifferenzen werden mit Grund vermerkt und gebucht",
  "Offene Ladenkasse: Kassenbericht täglich mit Zählprotokoll; Bareinnahmen werden aus dem gezählten Bestand zurückgerechnet",
  "Z-Bons, Einzelaufzeichnungen, DSFinV-K- und TSE-Export werden 10 Jahre aufbewahrt (§ 147 Abs. 1 Nr. 1, Abs. 3 AO)",
  "Bankeinzahlungen, Privatentnahmen und -einlagen bekommen einen Eigenbeleg mit fortlaufender Nummer (Quittung als Foto)",
  "Kartentrinkgeld für das Personal wird bar ausgezahlt und gesondert erfasst; Trinkgeld für die Inhaberin gehört zum Umsatz",
  "Gutscheine: Einzweck-Gutscheine werden beim Verkauf versteuert, Mehrzweck-Gutscheine bei der Einlösung",
  "Bei Ausfall der Kasse oder der TSE wird der Ausfall mit Beginn, Ende und Grund dokumentiert und die Einnahmen werden in dieser Zeit von Hand aufgezeichnet",
];
/** R12 GoBD: Abläufe in Amtlos (fester Text, wenn Amtlos genutzt wird). */
const AMTLOS_ABLAEUFE = [
  "Rechnungen bekommen fortlaufende Nummern und werden beim ersten Teilen festgeschrieben – mit den Absenderdaten, dem Hash des geteilten PDFs und der XRechnung. Korrigiert wird nur per Stornorechnung.",
  "Tagesabschlüsse der Kasse sind ab dem Speichern festgeschrieben; „erfasst am“ und „festgeschrieben am“ werden gespeichert. Korrekturen sind nur mit Grund möglich, die vorige Fassung bleibt erhalten; Nacherfassungen werden gekennzeichnet. Tage nach dem aktuellen Datum lassen sich nicht erfassen.",
  "Das Kassenbuch wird nur lesbar aus den Tagesabschlüssen erzeugt und beim ersten Teilen festgeschrieben (Inhalt mit SHA-256); nach einer Korrektur entsteht eine neue Fassung.",
  `Belege bekommen beim Erfassen eine feste ${MARKE.name}-Belegnummer. Endgültig löschen lässt sich ein Beleg nur innerhalb von 24 Stunden und vor jeder Weitergabe; danach wird er mit Grund als ungültig markiert und bleibt samt Datei erhalten. Jede Löschung steht im Änderungsprotokoll.`,
  "Mit dem Steuerberater-Paket bzw. einer abgegebenen Voranmeldung werden die enthaltenen Belege festgeschrieben; Änderungen danach nur mit Grund (Änderungsprotokoll im Paket).",
  `Die Daten liegen verschlüsselt auf dem Gerät. Gesichert wird verschlüsselt (Datei oder iCloud) mit einem Passwort, das getrennt und sicher hinterlegt ist; zusätzlich gibt es ein offenes Archiv (CSV, JSON, PDF, XML) zum Lesen ohne ${MARKE.name}.`,
  "„Alle Daten löschen“ ist gesperrt, solange aufbewahrungspflichtige Daten ohne aktuelle Sicherung auf dem Gerät liegen.",
  "Diese Verfahrensdokumentation wird beim Teilen festgeschrieben; Änderungen sind neue Fassungen mit Datum und Grund.",
];

/** Optionen der Auswahlfelder (wie im Formular) – auf dem leeren Blatt zum Ankreuzen. */
const AUSWAHL_OPTIONEN: Record<string, string[]> = { belegeingang: GOBD.belegeingang, belegart: GOBD.belegart, ablage: GOBD.ablage, sicherung_ort: GOBD.sicherungOrt, sicherung_intervall: GOBD.sicherungIntervall };

export const verfahrensdokumentation: Vorlage = {
  id: "verfahrensdokumentation",
  gestalt: "handbuch",
  titel: "Verfahrensdokumentation (GoBD)",
  beschreibung: "Wie in deinem Betrieb Belege ankommen, gebucht, aufbewahrt und gesichert werden – Abläufe zum Ankreuzen nach den Mustern von AWV und Steuerberaterkammer.",
  bereich: "steuern",
  pflichten: ["steuern.gobd_verfahrensdokumentation"],
  grundlage: "§§ 145–147 AO; GoBD",
  // R12 GoBD (Betriebsprüfung #11): beim ersten Teilen festgeschrieben; Änderungen als neue Fassung mit Datum und Grund,
  // jede frühere Fassung bleibt erhalten (GoBD Rz. 154: Änderungen versioniert nachvollziehbar)
  festschreiben: true,
  korrektur: true,
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
      titel: "Kasse",
      hilfe: "Wie Bareinnahmen aufgezeichnet werden. Bei einer elektronischen Kasse gehören deren Bedienungsanleitung, Programmierprotokolle und die Kassenmeldung zur Verfahrensdokumentation.",
      felder: [
        { id: "kasse_art", art: "wahl", label: "Art der Kasse", optionen: KASSEN_ARTEN.map((t) => ({ wert: t, text: t })) },
        { id: "kasse_ablauf", art: "bausteine", label: "Ablauf an der Kasse", optionen: opt(KASSEN_ABLAUF), wenn: { feld: "kasse_art", ist: [KASSEN_ARTEN[0]!, KASSEN_ARTEN[1]!] } },
        { id: "kasse_zusatz", selten: true, art: "mehrzeilig", label: "Weitere Regeln zur Kasse", hilfe: "z. B. Wechselgeldbestand, wer zählt, Ausfall der Kasse oder der TSE", wenn: { feld: "kasse_art", ist: [KASSEN_ARTEN[0]!, KASSEN_ARTEN[1]!] } },
        { id: "amtlos", art: "schalter", label: `Rechnungen, Belege und Kassenabschlüsse werden in ${MARKE.name} geführt`, vorbelegung: true, hilfe: `Dann beschreibt die Verfahrensdokumentation auch die Abläufe in ${MARKE.name}: Festschreibung, Korrektur mit Grund, Storno, ungültige Belege, Sicherung und Löschsperre.` },
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
      hilfe: `Wenn sich ein Ablauf oder Programm ändert: hier mit Datum festhalten. Geteilt wird die Verfahrensdokumentation festgeschrieben; jede Änderung danach ist eine neue Fassung mit Grund, die alten Fassungen bleiben in ${MARKE.name} erhalten.`,
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
    // Blatt zum Ausfüllen: noch keine Belegablage und keine Datensicherung gewählt
    const leer = !["belegeingang", "belegart", "ablage", "sicherung_ort"].some((k) => auswahl(d, k).length);
    // nichts ausgewählt: die Optionen zum Ankreuzen von Hand statt leerer Linien
    const optionenVon = (k: string) => AUSWAHL_OPTIONEN[k] ?? [];
    const l = (k: string) => (auswahl(d, k).length ? punkte(auswahl(d, k).map((w) => neufassung(w))) : ankreuzen(optionenVon(k)));
    // Zwischenüberschrift bleibt mit ihrem Inhalt auf einer Seite (nicht allein am Seitenende)
    const teil = (titel: string, inhalt: string) => `<div class="zusammen"><h3>${esc(titel)}</h3>${inhalt}</div>`;
    return dokument({
      titel: "Verfahrensdokumentation",
      betrieb: b,
      unter: "zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form (GoBD)",
      meta: `Stand: ${datumDe(text(d, "stand"))}\nVersion: ${text(d, "version")}\nVerantwortlich: ${text(d, "verantwortlich")}`,
      inhalt:
        abschnitte([
          { titel: "Allgemeine Beschreibung", rand: "GoBD Tz. 10.1", inhalt: angaben([["Betrieb", mitVertretung(b)], ["Tätigkeit und Organisation", text(d, "organisation")], ["Steuerberatung", text(d, "steuerberatung") || null], ["Verantwortlich", text(d, "verantwortlich")]]) },
          { titel: "Eingesetzte Programme und Geräte", rand: "GoBD Tz. 10.1", inhalt: tabelle(["Programm, Gerät", "Wofür", "Version, seit"], systeme.map((x) => [zelle(text(x, "name")), zelle(text(x, "zweck")), zelle(text(x, "version"))]), { breiten: ["38%", "38%", "24%"], ...(systeme.length ? {} : { mindestens: 4, hoch: true }) }) },
          {
            titel: "Anwenderdokumentation: Belegeingang, Erfassung und Ablage",
            rand: "GoBD Tz. 10.1",
            inhalt:
              teil("Eingang der Belege", l("belegeingang")) + teil("Art der Belegablage", l("belegart")) + teil("Ablage", l("ablage")) + teil("Erfassung, Prüfung und Verbuchung", zeilen(text(d, "erfassung"))) +
              (ja(d, "scannen") ? teil("Ersetzendes Scannen", `${text(d, "papier") ? `<p>${esc(text(d, "papier"))}.</p>` : ""}${zeilen(text(d, "scan_ablauf"))}`) : ""),
          },
          ...(text(d, "kasse_art")
            ? [{ titel: "Kasse", rand: "§ 146 Abs. 1, § 146a AO", inhalt: `<p>${esc(text(d, "kasse_art"))}.</p>${auswahl(d, "kasse_ablauf").length ? punkte(auswahl(d, "kasse_ablauf").map((w) => neufassung(w))) : ""}${zeilen(text(d, "kasse_zusatz"))}` }]
            : []),
          ...(ja(d, "amtlos") ? [{ titel: `Abläufe in ${MARKE.name}`, rand: "GoBD Tz. 3.2.4, 8, 9", inhalt: punkte(AMTLOS_ABLAEUFE) }] : []),
          {
            titel: "Technische Systemdokumentation und Betriebsdokumentation",
            rand: "GoBD Tz. 10.1",
            inhalt:
              // Blatt zum Ausfüllen (noch keine Ablage gewählt): auch das Intervall zum Ankreuzen statt des Startwerts
              teil("Datensicherung", leer || !text(d, "sicherung_intervall") ? `<p>Die Daten werden gesichert:</p>${ankreuzen(optionenVon("sicherung_intervall"), { nebeneinander: true })}<p>Wohin:</p>${l("sicherung_ort")}` : `<p>Die Daten werden ${esc(text(d, "sicherung_intervall"))} gesichert:</p>${l("sicherung_ort")}`) +
              (ja(d, "e_rechnung") ? teil("E-Rechnungen", `<p>${esc(GOBD.eRechnung)}</p>`) : "") +
              teil("Zugriffsrechte", zeilen(text(d, "zugriff"))) + teil("Internes Kontrollsystem", zeilen(text(d, "kontrollen"))),
          },
          {
            titel: "Aufbewahrung und Änderungen",
            rand: "GoBD Tz. 10.1, 10.2",
            inhalt: `<div${aenderungen.length <= 8 ? ' class="zusammen"' : ""}><p>Diese Verfahrensdokumentation wird als Organisationsunterlage 10 Jahre aufbewahrt (§ 147 Abs. 1 Nr. 1, Abs. 3 AO); Änderungen werden mit Datum festgehalten. Jede geteilte Fassung ist festgeschrieben, frühere Fassungen bleiben erhalten.</p>${text(d, "fassung_nr") ? `<p><strong>Fassung ${esc(text(d, "fassung_nr"))}</strong>${text(d, "fassung_ersetzt") ? ` – ersetzt die Fassung vom ${datumDe(text(d, "fassung_ersetzt"))}` : ""}${text(d, "fassung_grund") ? `. Grund: ${esc(text(d, "fassung_grund"))}` : ""}</p>` : ""}${aenderungen.length ? tabelle(["Datum", "Änderung"], aenderungen.map((x) => [datumDe(text(x, "datum")), zelle(text(x, "aenderung"))]), { breiten: ["18%", "82%"] }) : tabelle(["Datum", "Änderung"], [], { breiten: ["18%", "82%"], mindestens: 4, hoch: true })}</div>`,
          },
        ]) +
        // Kapitalgesellschaft: wer für den Betrieb unterschreibt (Geschäftsführung aus „Mein Betrieb“)
        unterschriften([mitVertretung(b) !== b.name.trim() ? `Unterschrift (${mitVertretung(b)})` : "Unterschrift"], { ortDatum: true }),
    });
  },
};
