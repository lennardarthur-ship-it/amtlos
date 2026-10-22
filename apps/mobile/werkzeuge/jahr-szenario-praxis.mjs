/**
 * Jahres-Szenario „Physiotherapie am Markt – Tom Reiter“ 2026 (Leipzig, Einzelpraxis, freier Beruf ohne Gewerbe,
 * Heilbehandlungen steuerfrei nach § 4 Nr. 14 UStG, daneben 19 % für Wellness, Verkauf und Firmenkurse, teilweiser
 * Vorsteuerabzug, Ist-Versteuerung mit vierteljährlicher Voranmeldung, Kassenpatienten über ein Abrechnungszentrum, zwei
 * Beschäftigte, Website mit Online-Terminbuchung): erzeugt mit den echten Funktionen der App alle Unterlagen eines Jahres –
 * Rechnungen (PDF + XRechnung, soweit die App sie erzeugt) inkl. Storno, Belege (inkl. empfangener E-Rechnung), die
 * Dokumentvorlagen (Impressum, Datenschutz, AVV, VVT, Verfahrensdokumentation, Aufbewahrung, Personal, Arbeitsschutz,
 * Hygiene), vier Voranmeldungen, EÜR, Steuererklärung, Kontrollmappe, Steuerberater-Pakete (Q2 und Jahr, entpackt) und den
 * Pflichten-Check – und schreibt SZENARIO.md mit allen Eingaben, den unabhängig gerechneten Erwartungswerten
 * (werkzeuge/jahr-szenario-praxis-daten.ts) und jeder Abweichung.
 *
 *   cd apps/mobile && node werkzeuge/jahr-szenario-praxis.mjs [ausgabe]     # Standard: /tmp/claude-0/praxis
 *   CHROMIUM_PFAD=…   anderer Chromium (Standard /opt/pw-browsers/chromium)
 *   KOSIT=<ordner>    optional: KoSIT-Validator (<ordner>/v/validator-*.jar, <ordner>/cfg/scenarios.xml)
 *
 * Voraussetzungen wie beim Café-Szenario (jahr-szenario.mjs): pnpm install, gebaute Pakete (@amtlos/fachlogik dist:
 * cd packages/fachlogik && npx tsc -p tsconfig.build.json), Chromium, pdftotext/pdftoppm (poppler).
 *
 * Ändert keinen Produktcode und schreibt nichts ins Repository.
 */
/* global URL, process, document, TextEncoder, TextDecoder, Buffer, console -- Node-Skript (document: im Browser per page.evaluate) */
/* eslint-disable no-console -- Ausgabe auf der Konsole ist der Zweck des Werkzeugs */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Beobachtungen beim Erstellen des Szenarios (Oktober 2026), die sich nicht als Zahlvergleich automatisieren lassen –
 * Quelle jeweils mit Datei:Zeile. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**Pflichten-Check: „Doppelte Buchführung“ für einen Freiberufler** (catalog/pflichten/steuern.buchfuehrungspflicht.yaml:33–52, gespiegelt in steuern.euer.yaml:33–50 und apps/mobile/src/pflichten/katalog.json): Auslöser ist Umsatz > 800.000 € bzw. Gewinn > 80.000 € im Vorjahr (§ 141 AO) – ohne Prüfung der Einordnung. § 141 AO gilt nur für gewerbliche Unternehmer sowie Land- und Forstwirte, nicht für freie Berufe. Folge: Tom (Gewinn 2025: 98.000 €) bekommt „Doppelte Buchführung“ mit Vorlage Bilanz/GuV, und „EÜR“ fällt weg. Vorschlag: in beiden Zweigen zusätzlich `profil.taetigkeit.einordnung != freiberuf` (und `profil.rechtsform != freiberuf`); Fixture „freiberufler-gewinn-ueber-80000“ ergänzen.",
  "**Pflichten-Check, offene Fragen „ausländische Investoren“** (catalog/pflichten/gesellschaft.awv_meldung.yaml, gesellschaft.investitionspruefung_hinweis.yaml): Auslöser fragen nur `gesellschafter.auslaendische_investoren`; für eine natürliche Person ohne Gesellschafter erscheinen sie als „Noch offen“. Vorschlag: nur bei Gesellschaften fragen.",
  "**Impressum druckt „Kammer:“ mit Ausfüll-Linie**, wenn „Reglementierter Beruf“ an und keine Kammer eingetragen ist (packages/fachlogik/src/dokumente/website.ts:183 `Kammer: ${text(d, \"kammer\") || FEHLT}`). Physiotherapeuten (wie viele Gesundheitsfachberufe) gehören keiner Kammer an; § 5 Abs. 1 Nr. 5 DDG verlangt die Kammer nur, wenn es eine gibt. Ein Impressum mit Leerstelle geht so auf die Website. Vorschlag: Zeile weglassen, wenn leer, und Hilfetext „nur wenn Pflichtmitglied einer Kammer“; Vorschlagsliste um Heilberufe ohne Kammer ergänzen.",
  "**Mehrzahl der Einheiten:** „6 Behandlung“, „8 Besuch“, „3 Behandlung“ auf allen Praxisrechnungen (packages/fachlogik/src/rechnung.ts:26–46 EINHEIT_MEHRZAHL kennt „behandlung“, „besuch“, „termin“, „bericht“, „rolle“, „sitzung“ nicht). Vorschlag: ergänzen (behandlung → behandlungen, besuch → besuche, termin → termine, bericht → berichte, rolle → rollen, sitzung → sitzungen, einheit ist schon da).",
  "**Lohnkonto für Minijob mit Pauschsteuer:** „Steuerklasse“ ist Pflichtfeld (packages/fachlogik/src/dokumente/lohn.ts:142) – bei pauschal versteuerten Minijobs (2 %, § 40a Abs. 2 EStG) gibt es keine; die App meldet „Fehlt noch: Steuerklasse“. Felder für Pauschsteuer und Pauschalbeiträge (KV 13 %, RV 15 %) fehlen; „SV-Beiträge Arbeitgeber“ muss sie mit aufnehmen. Vorschlag: Steuerklasse optional bzw. Option „pauschal (§ 40a)“.",
  "**Kontrollmappe:** Deckblatt kürzt den Namenszusatz auf 40 Zeichen mitten im Wort („AbrechnungsZentrum Mitteldeutschland Gmb“, „Flächendesinfektion alkoholfrei, Konzent“; packages/fachlogik/src/dokumente/index.ts:187 `.slice(0, 40)`) und zeigt beim Prüfprotokoll das ISO-Datum als Zusatz („· 2026-09-18“). Vorschlag: an Wortgrenze kürzen mit „…“, Datumsfelder als TT.MM.JJJJ. Inhaltlich passend: 14 Nachweise (Arbeitsschutz, Hygiene, Datenschutz, Personal), keine Rechnungen/Steuern/Lohn.",
  "**Teilweiser Vorsteuerabzug (umgesetzt, E-165):** Belege kennen jetzt „Vorsteuer voll / anteilig (Prozent oder Betrag) / aus“ (packages/fachlogik/src/belege.ts `vorsteuer_anteil`, `vorsteuer_betrag_cent`, `vorsteuerAufteilung`). Im Szenario: gemischt genutzte Belege mit 13 % (vorläufiger Schlüssel aus „Mein Betrieb“), Voranmeldung (Kz 66 und Kz 67 aus § 13b) und EÜR (abziehbarer Teil in „Gezahlte Vorsteuer“, Rest in der Kategorie) kommen ohne Nachtrag von Hand aus der Übernahme; der DATEV-Stapel bucht je gemischtem Beleg zwei Zeilen (mit BU 9 und ohne). Offen: der endgültige Schlüssel der Jahreserklärung bleibt Handarbeit (Kanzlei).",
  "**Startwert „Vorsteuer abziehbar“** (apps/mobile/src/seiten/Belege.tsx, packages/fachlogik/src/erechnungLesen.ts): E-165 – eine eingelesene E-Rechnung startet bei gemischten Umsätzen anteilig mit der Vorsteuerquote aus „Mein Betrieb“ (ohne Quote: aus), bei nur steuerfreien Umsätzen aus; am Beleg warnt die App bei gemischten Umsätzen, solange „voll“ gewählt ist. Ein von Hand erfasster Beleg startet weiter mit „voll“ (Spalte „Vorsteuer mit Startwerten“: so viel wäre es, wenn alle Belege voll blieben).",
  "**Kassenpatienten (Abrechnungszentrum) haben keinen Platz in der App:** Der größte Umsatz (150.555 € von 187.976 €) kommt als Sammelauszahlung des Abrechnungszentrums, abzüglich verrechneter Gebühren. Rechnungen schreibt das Abrechnungszentrum, nicht die App; einen Einnahmebeleg gibt es nicht (Belege sind nur Ausgaben, packages/fachlogik/src/belege.ts). Voranmeldung, EÜR und Steuerberater-Paket enthalten diese Umsätze daher nicht; der Hinweis „Kassenumsätze fehlen“ (apps/mobile/src/unterlagen/steuerpaket.ts:77 kassenSatzPaket) erscheint nur mit elektronischer Kasse und meint Z-Bons. Im Szenario von Hand in Voranmeldung (Umsätze ohne USt) und EÜR ergänzt. Wichtig: Einnahme ist der Bruttobetrag vor Gebühr – wer nur die Gutschrift auf dem Konto erfasst, unterschlägt die Gebühr als Ausgabe und mindert den Umsatz. Vorschlag: „Sonstige Einnahme“ (Datum, Betrag, Steuerart, Text) bzw. Import von Auszahlungsavisen; mindestens ein Hinweis bei Branche „Gesundheit und Pflege“ – E-165: die LIESMICH nennt diese Umsätze jetzt unter „Nicht enthalten“ (Abrechnungszentrum, Zuzahlungen, Empfang; Einnahme vor Gebühr).",
  "**Zuzahlungen und Verkauf am Empfang** (EC-Terminal, Quittung) ebenso: keine Erfassung ohne Rechnung, kein Hinweis, weil `kasse.elektronisch = false` (kassenLage „keine“ unterdrückt jeden Kassenhinweis, steuerpaket.ts:71). Der LIESMICH-Punkt „Nicht enthalten: Kassenumsätze“ bleibt allgemein.",
  "**Umsätze ohne USt → falsche Kennzahl-Empfehlung:** Die Voranmeldung nennt für „Steuerfreie oder nicht steuerbare Umsätze“ nur Kz 41, 43 und 21 (packages/fachlogik/src/dokumente/buchhaltung.ts:693). Heilbehandlungen nach § 4 Nr. 14 UStG gehören in Kz 48 („steuerfreie Umsätze ohne Vorsteuerabzug“, § 4 Nr. 8 bis 29); Kz 43 ist für steuerfreie Umsätze MIT Vorsteuerabzug. Wer dem Hinweis folgt, meldet falsch. Vorschlag: Kz 48 in den Hinweis aufnehmen und – wenn alle 0-%-Rechnungen Steuerart „befreit“ mit „§ 4 Nr. 8–29“ im Hinweis haben – Kz 48 vorschlagen.",
  "**§ 13b fehlt weiterhin** (wie im Freiberuf-Szenario): CloudOffice aus Irland – Kz 46/47 und Vorsteuer daraus (Kz 67) haben kein Feld; hier ist die Vorsteuer aus § 13b zusätzlich nur anteilig abziehbar (77,52 € Steuer, 10,08 € Vorsteuer). Die Zahllast Q1 der App ist um 77,52 € zu niedrig.",
  "**Bruttopreise der Preisliste:** Für Selbstzahler stehen Wellness-Preise brutto in der Preisliste (69,00 €). Die Rechnung nimmt nur Nettopreise (buchhaltung.ts:243 „Einzelpreis netto (€)“); 2 × 57,98 € ergibt 115,96 € + 22,03 € = 137,99 € statt 138,00 € (Rechnung 2026-004). Vorschlag: Eingabe „Preis brutto“ je Position oder Rechnung (rechnet netto aus und rundet so, dass der Bruttobetrag stimmt).",
  "**Abrechnungsgebühren und Verrechnung:** Die App kann die mit der Auszahlung verrechnete Gebühr nur als Beleg mit Zahlungsweg „Überweisung“ erfassen; ein Zahlungsweg „verrechnet“ fehlt (ebenso für Kartengebühren des EC-Terminals).",
  "**EÜR-Zeile für steuerfreie Einnahmen** heißt in der Übernahme „Steuerfreie Umsätze aus Rechnungen (z. B. innergemeinschaftliche Lieferung)“ (apps/mobile/src/unterlagen/steuerpaket.ts:155) – für eine Praxis irreführend. Vorschlag: Text aus der Steuerart ableiten („steuerfreie Umsätze aus Rechnungen“ bzw. Befreiungshinweis).",
  "**Steuerart „befreit“ in DATEV:** steuerfreie Positionen gehen auf SKR03 8100 (packages/fachlogik/src/buchungen.ts:99) – das ist für § 4 Nr. 8 ff. passend; die Buchung unterscheidet aber nicht nach Steuerart (Prüfpunkt buchungen.ts:431). Für die Vorsteueraufteilung braucht die Steuerberatung die steuerfreien Umsätze ohne Vorsteuerabzug getrennt – mit 8100 gegeben.",
  "**Rechnungen an Privatpatienten:** Befreiungshinweis (Feld „Hinweis auf die Steuerbefreiung“) muss bei jeder Rechnung von Hand eingetragen werden; der Vorschlag lautet „Steuerfreie Leistung nach § 4 Nr. … UStG“ (buchhaltung.ts:255). Kein Vorbelegen aus „Mein Betrieb“/Branche. Die Summenzeile heißt „Umsatzsteuer 0 % (steuerfrei, siehe Hinweis) auf …“ mit 0,00 € – korrekt, aber für Patienten sperrig; Spalte „USt 0 %“ je Position. Bei Rechnungen nur mit 0 % ist „Summe netto“ ebenfalls missverständlich.",
  "**Verordnungsangaben auf Privatrechnungen** (Arzt, Datum; üblich für die Erstattung durch PKV/Beihilfe) sind Gesundheitsdaten. Sie landen im Steuerberater-Paket nur über Kundenname und Hinweistext der XRechnung (Privatpatienten haben keine), aber Patientennamen stehen in Rechnungsliste und DATEV-Buchungstext („RE 2026-001 Dr. Johanna Krüger“). Dass jemand Patient einer Physiotherapiepraxis ist, ist selbst ein Gesundheitsdatum und unterliegt § 203 StGB – ob die Weitergabe an die Steuerberatung so zulässig ist bzw. pseudonymisiert werden sollte, fachlich klären (siehe Rechtsfragen).",
  "**Hygieneplan:** Die einzige Vorlage gehört zum Bereich „Beauty“ (packages/fachlogik/src/dokumente/branchen.ts:358 `bereich: \"beauty\"`, Pflicht branche.beauty_hygieneplan) mit Vorschlägen „Alle Beauty-Betriebe“; Begriffe wie „Kunde“, Haarwaschbecken, Kämme. Für Heilberufe gibt es keine Vorschlagsgruppe; Rechtsgrundlage auf dem Aushang „Hygieneverordnung des Landes“. Im Szenario 11 Vorschläge + 4 eigene Zeilen.",
  "**Gefährdungsbeurteilung:** keine Vorschlagsgruppe „Gesundheitsdienst/Physiotherapie“ (Gruppen: Friseur, Kosmetik, Gastronomie, Handwerk, Büro/Laden). Kosmetik passt teilweise; Patiententransfer, Medizinprodukte, Hausbesuche, Infektionsgefährdung ohne Blutkontakt (TRBA 250) mussten frei formuliert werden.",
  "**Medizinprodukte (MPBetreibV):** Für das Reizstrom-/Ultraschallgerät gibt es weder eine Vorlage für Bestandsverzeichnis/Medizinproduktebuch noch eine Pflicht im Katalog; die STK (Beleg b31) lässt sich nicht dokumentieren. Das DGUV-V3-Protokoll ist für Medizinprodukte nicht gedacht.",
  "**Datenschutz-Vorschläge für Patienten:** „Kundenverwaltung / Kundenkartei“ nennt als Grundlage für Gesundheitsdaten die Einwilligung (Art. 9 Abs. 2 lit. a DSGVO, packages/fachlogik/src/dokumente/bausteine.ts, Vorschlag Kundenverwaltung) – für die Behandlungsdokumentation einer Heilberufspraxis ist das in der Regel Art. 9 Abs. 2 lit. h, Abs. 3 DSGVO i. V. m. § 22 BDSG und die Löschfrist 10 Jahre (§ 630f Abs. 3 BGB) statt „Buchungsbelege 8 Jahre“. Die Datenschutzinformation (Bausteine aus derselben Liste) druckt den Einwilligungs-Satz, obwohl die Ergänzung Art. 9 Abs. 2 lit. h nennt – Widerspruch im selben Dokument (siehe Durchsicht). Vorschlag: Vorschlag „Patientenverwaltung und Behandlungsdokumentation“ für Branche Gesundheit; Baustein „Abrechnung mit Krankenkassen (§ 302 SGB V)“.",
  "**Schweigepflicht:** Keine Vorlage für die Verpflichtung der Beschäftigten und Dienstleister auf die Schweigepflicht (§ 203 StGB) bzw. Vertraulichkeit; der TOM-Vorschlag „Verpflichtung aller Beschäftigten auf Vertraulichkeit/Datenschutz“ erwähnt § 203 nicht.",
  "**Impressum für Heilberufe ohne Kammer:** Die Vorlage hat Felder „Kammer“, „Berufsbezeichnung“, „Staat der Verleihung“, „Berufsrechtliche Regelungen“ und „Aufsichtsbehörde“; ohne Kammer bleibt das Feld leer (siehe Durchsicht, ob eine leere Zeile gedruckt wird). Die Rechtsform-Auswahl kennt „Freiberuflich“ nicht (nur Einzelunternehmen, e. K., GbR, …), anders als der Pflichten-Check (`rechtsform: freiberuf`).",
  "**Leistungszeitraum als Text bei Privatrechnungen** (Behandlungsserie „05.01.2026 – 15.01.2026“): unschädlich, weil Privatpatienten ohne E-Mail ohnehin keine XRechnung bekommen und die Ist-Versteuerung nach Zahlungseingang zuordnet; bei Soll-Versteuerung würde nach Rechnungsdatum zugeordnet (ustAusRechnungen.ts:61).",
];

/**
 * Durchsicht aller PDF-Seiten von Hand (Oktober 2026, PNGs mit 60 dpi; Ausschnitte mit 110 dpi). Nach Änderungen an
 * Vorlagen erneut ansehen und hier pflegen. [schwer/mittel/gering] = Einstufung.
 */
const DURCHSICHT = [
  "**Rechnungen 2026-001 … 2026-021 (22 Seiten):** Beträge, Mengen, Steuerzeilen und GiroCode stimmen mit der unabhängigen Rechnung; steuerfreie Positionen mit Spalte „0 %“, Summenzeile „Umsatzsteuer 0 % (steuerfrei, siehe Hinweis) auf …“ (bricht in zwei Zeilen um) und darunter der Befreiungshinweis; reine 19-%-Rechnungen ohne Befreiungshinweis (richtig). Stornorechnung 2026-011 mit Verweis „storniert die Rechnung Nr. 2026-010 vom 22.05.2026“ und negativen Beträgen.",
  "[mittel] **Rechnung 2026-005 (gemischt, 2 Seiten):** 3 Positionen, zwei Steuerzeilen und der Verordnungshinweis passen nicht auf eine Seite; Seite 2 trägt den Pflichthinweis „Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG“ allein mit dem Gruß, während Seite 1 mit „siehe Hinweis“ endet. Quelle: buchhaltung.ts:35 (Text „steuerfrei, siehe Hinweis“) und :394 (Hinweise im Schlussblock). Vorschlag: Befreiungsgrund direkt in die Summenzeile („Umsatzsteuer 0 % – steuerfrei nach § 4 Nr. 14 UStG“) oder Hinweisblock mit den Summen zusammenhalten.",
  "[gering] **Alle Rechnungen:** „6 Behandlung“, „8 Besuch“ (Mehrzahl fehlt, siehe Beobachtungen). E-Mail im Infoblock bricht in „praxis@ / physio-am-markt.example“ um.",
  "[gering] **Rechnung 2026-004:** 2 × Wellness-Massage ergibt 137,99 € statt der Preisliste 2 × 69,00 € (Nettoeingabe, siehe Beobachtungen).",
  "[mittel] **Impressum (1 Seite):** Abschnitt „Berufsrechtliche Angaben“ beginnt mit „Kammer: ________“ (Ausfüll-Linie) – so nicht veröffentlichbar; sonst vollständig (§ 5 DDG, USt-IdNr., Berufsbezeichnung, Regelungen, § 18 Abs. 2 MStV, VSBG). Keine Aufsichtsbehörde (bewusst leer, siehe Rechtsfragen).",
  "**Datenschutzerklärung (4 Seiten):** Online-Terminbuchung über TheraPlan mit Art. 6 Abs. 1 lit. b und AVV; technisch notwendige Cookies nach § 25 Abs. 2 Nr. 2 TDDDG. [mittel] Gesundheitsangaben im Buchungsformular kommen nur über die eigene „Weitere Verarbeitungen“-Ergänzung vor; der Baustein „online_terminbuchung“ nennt „Leistung“, aber nie Art. 9 DSGVO.",
  "**AVV TheraPlan und Abrechnungszentrum (je 3 Seiten):** Gegenstand, Datenarten (Gesundheitsdaten) und Unterauftragnehmer wie eingegeben; [gering] keine Klausel zur Verschwiegenheit nach § 203 StGB (Verpflichtung der mitwirkenden Personen), nur die allgemeine Vertraulichkeit nach Art. 28 Abs. 3 lit. b DSGVO.",
  "[mittel] **Datenschutzinformation Patienten (4 Seiten):** Baustein „Kundenverwaltung / Kundenkartei“ mit „postalische Werbung an Bestandskunden“, „Allergien/Unverträglichkeiten … Einwilligung nach Art. 9 Abs. 2 lit. a“ und „Buchungsbelege 8 Jahre“ – im selben Dokument sagt die Ergänzung „Art. 9 Abs. 2 lit. h“ und „zehn Jahre“ (§ 630f BGB). Abschnitt „Widerruf Ihrer Einwilligung“ wegen SMS-Erinnerung. Widersprüchlich für Patienten.",
  "**VVT (8 Seiten):** eigene Tätigkeit „Abrechnung mit gesetzlichen Krankenkassen“ und umgeschriebene „Patientenverwaltung“ korrekt übernommen; Dienstleistertabelle mit Drittland-Bezug CloudOffice. [gering] Die übrigen Vorschläge sprechen weiter von „Kunden“ (Terminvereinbarung: „Kundentermine“).",
  "**Verfahrensdokumentation (3 Seiten), Aufbewahrungsplan (1 Seite):** stimmig; Patientendokumentation „10 Jahre, bis 31.12.2036“ – die App rechnet ab Jahresende, § 630f Abs. 3 BGB ab Abschluss der Behandlung (konservativ, unschädlich).",
  "**Personal (Nachweise 2 × 2 Seiten, Fragebögen 2 × 2, Lohnkonten 1 + 2, Arbeitszeitnachweis 1):** Inhalte wie eingegeben; Minijob-Nachweis mit Stundenlohn 14,50 € und RV-Befreiung im Freitext. [gering] Lohnkonto Minijob: Steuerklasse leer mit Linie, Monate November/Dezember auf Seite 2; Arbeitszeitnachweis 40 Std. korrekt summiert.",
  "[mittel] **Gefährdungsbeurteilungen (4 + 3 Seiten):** Kosmetik-Vorschläge passen nur teilweise („Instrumente mit Sicherheitssystem“, „EU-Kosmetikverordnung“, „Nagellack“); eigene Zeilen für Transfer, Medizinprodukte, Fango, Hausbesuche, Infektionen sauber dargestellt. [gering] Seite 1 der Behandlungsräume-GB endet nach einer Zeile mit viel Weißraum (Abschnitt 3 beginnt auf neuer Seite).",
  "**Unterweisung (2 Seiten), Gefahrstoffverzeichnis (1), Betriebsanweisung (1), Prüfprotokoll DGUV V3 (2):** stimmig; das Medizinprodukt (Reizstrom/Ultraschall) steht absichtlich nicht im DGUV-Protokoll – für die STK gibt es keine Vorlage.",
  "[mittel] **Hygieneplan (3 Seiten, Querformat):** Beauty-Texte („Nagelhautbearbeitung, Fußpflege, invasive Kosmetik“, „nach jeder Kundin / jedem Kunden“, „Haarwaschbecken“); Rechtsgrundlage „Hygieneverordnung des Landes (auf Grundlage des IfSG)“. [gering] Seite 3 enthält nur die Unterschriftszeilen.",
  "**USt-Voranmeldungen Q1–Q4 (je 2 Seiten):** Kz 81 und Vorsteuer (Kz 66) wie von Hand ergänzt; [schwer] Abschnitt „Umsätze ohne Umsatzsteuer“ empfiehlt Kz 41/43/21 statt 48 (siehe Beobachtungen); Q1-Zahllast 615,83 € statt 693,35 € (§ 13b ohne Feld). [gering] Seite 2 trägt nur „Übermittelt am / Transferticket / Gezahlt am“ (durch die lange Notiz).",
  "**EÜR (3 Seiten):** Zeilen und Summen wie die unabhängige Rechnung (Gewinn 104.885,81 €); Kassenpatienten, Zuzahlungen und Empfang von Hand ergänzt. [gering] Übernommene Zeile „Steuerfreie Umsätze aus Rechnungen (z. B. innergemeinschaftliche Lieferung)“.",
  "[gering] **Unterlagen zur Steuererklärung (2 Seiten):** Rechtsgrundlage fest „§ 25 EStG; § 31 KStG; § 14a GewStG; § 18 Abs. 3 UStG“ obwohl nur ESt und USt gewählt (buchhaltung.ts:732); „Summe aller Vorauszahlungen (verschiedene Steuern)“ addiert ESt und USt zu 16.999,39 € – als Zahl ohne Aussage.",
  "**Kontrollmappe (Deckblatt + 14 Unterlagen):** Deckblatt mit Seitenangaben; Kürzungen „…Mitteldeutschland Gmb“, „…alkoholfrei, Konzent“ und ISO-Datum beim Prüfprotokoll [gering].",
  "**Belege b01–b35 (34 PDF + 1 XML):** Eingaben des Szenarios (nicht von der App), alle lesbar; Beträge und Steuerausweis passen zur Tabelle „Eingaben: Belege“.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/praxis");
for (const d of ["pdf", "rechnungen", "png", "belege", "mappe", "steuerpaket-2026-Q2", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario-praxis.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario-praxis.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const S = await import(gebaut);
fs.rmSync(gebaut);
const D = S.D;

const bau = S.standBauen();
const { s } = bau;
const auffaellig = [...bau.auffaellig];
const vergleiche = [...bau.vergleiche];
const vergleich = (bereich, was, app, erwartet) => {
  const ok = app === erwartet;
  vergleiche.push({ bereich, was, app: typeof app === "number" ? D.eur(app) : String(app), erwartet: typeof erwartet === "number" ? D.eur(erwartet) : String(erwartet), ok });
  if (!ok) auffaellig.push(`${bereich} – ${was}: App ${typeof app === "number" ? D.eur(app) : app}, erwartet ${typeof erwartet === "number" ? D.eur(erwartet) : erwartet}.`);
};

// ---------------------------------------------------------------- PDF wie die App
const MM = 72 / 25.4;
const pt = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
async function appPdf(roh, quer) {
  const html = S.mitSchriften(roh);
  const ang = S.fussAngaben(html);
  const [o, r, u, l] = S.RAENDER[ang.gestalt] ?? S.RAENDER.nachweis;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: "A4", landscape: quer, margin: { top: pt(o), right: pt(r), bottom: pt(u), left: pt(l) }, printBackground: true });
  return S.fusszeileStempeln(new Uint8Array(pdf), ang);
}
async function einfachPdf(html) {
  await page.setContent(html, { waitUntil: "load" });
  return new Uint8Array(await page.pdf({ format: "A4", printBackground: true }));
}

const dateien = [];
const merke = (rel, inhalt) => dateien.push({ rel, inhalt });
const pdfJeUid = {};
for (const d of bau.docs) {
  const rel = `${d.ordner}/${d.datei}`;
  const bytes = await appPdf(S.dokHtml(s, d.uid), d.quer);
  pdfJeUid[d.uid] = bytes;
  fs.writeFileSync(path.join(OUT, rel), bytes);
  merke(rel, `${d.titel}: ${d.worum}`);
}
for (const x of bau.xmls) {
  fs.writeFileSync(path.join(OUT, "rechnungen", x.datei), x.xml);
  merke(`rechnungen/${x.datei}`, `XRechnung 3.0 (UBL) zu ${x.nummer}, erzeugt mit eRechnungAus + xrechnungUbl wie „Als E-Rechnung teilen“.`);
}
const belegBytes = {};
for (const b of bau.belegDateien) {
  const bytes = b.xml ? new TextEncoder().encode(b.xml) : await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id));
  merke(`belege/${b.datei}`, `Eingabe: ${roh.lieferant} ${roh.nummer ?? ""} vom ${D.de(roh.datum)} – ${roh.worum}`);
}

// ---------------------------------------------------------------- Kontrollmappe wie in der App (Kontrollmappe.tsx: Deckblatt zweimal, dann zusammenfügen)
let mappeInfo = "";
{
  const heute = "2026-12-31";
  const teile = bau.mappe.eintraege.map((e) => pdfJeUid[e.id]);
  const seitenN = await Promise.all(teile.map((t) => S.seitenzahl(t)));
  let deckSeiten = 1;
  let deck = null;
  for (let i = 0; i < 2; i++) {
    const start = S.startSeiten(deckSeiten, seitenN);
    deck = await appPdf(S.deckblattHtml(s.betrieb.name, heute, bau.mappe.eintraege.map((e, j) => ({ ...e, geteilt: true, seite: start[j] }))), false);
    const n = await S.seitenzahl(deck);
    if (n === deckSeiten) break;
    deckSeiten = n;
  }
  const mappe = await S.mappeZusammenfuegen([deck, ...teile]);
  const name = S.mappeDateiname(s.betrieb.name, heute);
  fs.writeFileSync(path.join(OUT, "mappe", name), mappe);
  const gesamt = await S.seitenzahl(mappe);
  merke(`mappe/${name}`, `Kontrollmappe (mappenAuswahl → Deckblatt → mappeZusammenfuegen wie in der App): ${bau.mappe.eintraege.length} Unterlagen, ${gesamt} Seiten.`);
  vergleich("Kontrollmappe", "Seiten = Deckblatt + Summe der Unterlagen", gesamt, deckSeiten + seitenN.reduce((a, b) => a + b, 0));
  mappeInfo = `${bau.mappe.eintraege.length} Unterlagen (${bau.mappe.eintraege.map((e) => e.titel).join("; ")}), ${gesamt} Seiten, unvollständig: ${bau.mappe.unvollstaendig}.`;
}
await browser.close();

// ---------------------------------------------------------------- Steuerberater-Pakete
const csvLesen = (bytes, kodierung = "utf8") => {
  const txt = kodierung === "latin1" ? Buffer.from(bytes).toString("latin1") : new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  return txt.split(/\r\n/).filter(Boolean).map((z) => {
    const f = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < z.length; i++) {
      const c = z[i];
      if (q) {
        if (c === '"' && z[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ";") { f.push(cur); cur = ""; }
      else cur += c;
    }
    f.push(cur);
    return f;
  });
};
const centAus = (t) => {
  const m = /^(-?)([\d.]*),(\d{2})$/.exec(String(t).trim());
  return m ? (m[1] ? -1 : 1) * (Number(m[2].replace(/\./g, "")) * 100 + Number(m[3])) : NaN;
};
const summe = (l) => l.reduce((a, b) => a + b, 0);
const liste = (bytes) => {
  const [kopf, ...alle] = csvLesen(bytes);
  const sp = (name) => {
    const genau = kopf.indexOf(name);
    const i = genau >= 0 ? genau : kopf.findIndex((k) => k.startsWith(name));
    if (i < 0) throw new Error(`Spalte „${name}“ fehlt: ${kopf.join(";")}`);
    return i;
  };
  return { kopf, zeilen: alle.filter((z) => !/^Summe\b/.test(z[0])), summen: alle.filter((z) => /^Summe\b/.test(z[0])), sp, w: (z, name) => z[sp(name)] };
};

const paketInfo = {};
function paketPruefen(name, zr, ordner) {
  const bereich = `Paket ${name}`;
  const pk = S.paket(s, zr, belegBytes);
  fs.writeFileSync(path.join(OUT, pk.dateiname), pk.zip);
  merke(pk.dateiname, `Steuerberater-Paket ${name} (steuerpaket(), ZIP wie in der App).`);
  const inhalt = S.unzipSync(pk.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, ordner, p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, ordner, p), bytes);
  }
  merke(`${ordner}/`, `entpacktes Paket ${name}: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}${Object.keys(inhalt).some((p) => p.startsWith("E-Rechnungen/")) ? ", E-Rechnungen/" : ""}, Belege/).`);
  const inZr = (iso) => iso >= zr.von && iso <= zr.bis;
  const vg = D.vorgaenge().filter((x) => inZr(x.datum));
  const reL = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  const re = reL.zeilen;
  vergleich(bereich, "Anzahl Zeilen in der Rechnungsliste (nach Rechnungsdatum, inkl. Storno)", re.length, vg.length);
  vergleich(bereich, "Rechnungsliste: Summe Netto", summe(re.map((z) => centAus(reL.w(z, "Netto")))), summe(vg.map((x) => x.vz * x.s.netto)));
  vergleich(bereich, "Rechnungsliste: Summe USt", summe(re.map((z) => centAus(reL.w(z, "USt")))), summe(vg.map((x) => x.vz * x.s.ust)));
  const arten = (art) => re.filter((z) => reL.w(z, "Steuerart") === art).map((z) => reL.w(z, "Nummer")).sort().join(",");
  vergleich(bereich, "Rechnungsliste: Steuerart „befreit“ genau bei Rechnungen mit steuerfreien Positionen", arten("befreit"), vg.filter((x) => x.s.frei).map((x) => x.nummer).sort().join(","));
  const gesamt = reL.summen.find((z) => z[0] === "Summe gesamt");
  if (re.length) {
    vergleich(bereich, "Rechnungsliste: „Summe gesamt“ Brutto = Summe der Zeilen", gesamt ? centAus(reL.w(gesamt, "Brutto")) : NaN, summe(re.map((z) => centAus(reL.w(z, "Brutto")))));
    const s0 = reL.summen.find((z) => /^Summe 0 %/.test(z[0]));
    vergleich(bereich, "Rechnungsliste: Summenzeile „0 % (befreit)“ = steuerfreie Netto-Beträge", s0 ? centAus(reL.w(s0, "Netto")) : 0, summe(vg.map((x) => x.vz * x.s.frei)));
    paketInfo[name] = { ...(paketInfo[name] ?? {}), summenzeilen: reL.summen.map((z) => z[0]).join(" | ") };
  }
  const beL = liste(inhalt[`Belege_${zr.name}.csv`]);
  const be = beL.zeilen;
  const belege = D.BELEGE.filter((b) => inZr(b.datum));
  vergleich(bereich, "Anzahl Belege (nach Belegdatum)", be.length, belege.length);
  vergleich(bereich, "Belegliste: Summe Brutto", summe(be.map((z) => centAus(beL.w(z, "Brutto")))), summe(belege.map((b) => D.belegSumme(b).brutto)));
  // E-165: abziehbare Vorsteuer je Beleg (pflichtig voll, gemischt 13 %), Spalte „Vorsteuerabzug“ nennt den Anteil
  vergleich(bereich, "Belegliste: Summe Vorsteuer (abziehbarer Teil, E-165)", summe(be.map((z) => centAus(beL.w(z, "Vorsteuer")))), summe(belege.map((b) => D.vstAbziehbarBeleg(b))));
  vergleich(bereich, "Belegliste: Spalte „Vorsteuerabzug“ = „anteilig: 13 %“ genau bei den gemischt genutzten Belegen mit USt", String(be.filter((z) => /^anteilig: 13 %/.test(beL.w(z, "Vorsteuerabzug"))).length), String(belege.filter((b) => b.zuordnung === "gemischt" && (b.p13b || D.belegSumme(b).ust)).length));
  vergleich(bereich, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, belege.length);
  vergleich(bereich, "E-Rechnungen im Paket = erzeugte XRechnungen des Zeitraums", Object.keys(inhalt).filter((p) => p.startsWith("E-Rechnungen/")).length, bau.xmls.filter((x) => inZr(D.vorgaenge().find((v) => v.nummer === x.nummer).datum)).length);
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const zeilen = extf.slice(2);
  vergleich(bereich, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  vergleich(bereich, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "52114/30871");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
  // R11: Ist-Versteuerung (EÜR) – im Stapel stehen die Rechnungen mit Zahlungseingang im Zeitraum, zum Zahltag
  const vgIst = D.vorgaenge().filter((x) => x.bezahlt && inZr(x.bezahlt));
  vergleich(bereich, "DATEV: Brutto auf 8400 (19 %) = 19-%-Anteil der im Zeitraum bezahlten Rechnungen inkl. USt (Ist)", kontoSumme("8400"), summe(vgIst.map((x) => x.vz * (x.s.pflichtig + x.s.ust))));
  vergleich(bereich, "DATEV: Brutto auf 8100 (steuerfreie Umsätze § 4 Nr. 8 ff.) = steuerfreie Positionen der im Zeitraum bezahlten Rechnungen (Ist)", kontoSumme("8100"), summe(vgIst.map((x) => x.vz * x.s.frei)));
  // R10: BU 40 nur auf Automatikkonten (Wareneingang 3400/3300); auf Konten ohne Automatik ohne Vorsteuer kein BU, mit Vorsteuer BU 9/8
  const AUTOMATIK = ["3400", "3300", "3120", "3123"];
  // StB-Prüfung (A-1): der BU-Schlüssel gehört zum Gegenkonto (Feld 8)
  vergleich(bereich, "DATEV: kein BU 40 auf Konten ohne Automatik", zeilen.filter((z) => z[8] === "40" && !AUTOMATIK.includes(z[7])).length, 0);
  // E-165 (5.2): Teilabzug als zwei Zeilen – aus den Zeilen mit BU 9 rechnet DATEV (je Zeile gerundet) die abziehbare Vorsteuer
  // Zeilen mit Vorsteuer: BU 9 auf Konten ohne Automatik bzw. Wareneingang 3400 ohne Schlüssel (Automatikkonto, ohne Abzug BU 40)
  vergleich(bereich, "DATEV: Vorsteuer aus den Belegzeilen mit Vorsteuer (BU 9 bzw. Automatikkonto 3400 ohne BU; Brutto × 19/119 je Zeile) = abziehbare Vorsteuer der Belege (E-165)", summe(zeilen.filter((z) => z[8] === "9" || (z[7] === "3400" && z[8] === "")).map((z) => Math.round((centAus(z[0]) * 19) / 119))), summe(belege.map((b) => D.vstAbziehbarBeleg(b))));
  vergleich(bereich, "DATEV: je gemischt genutztem Beleg mit USt zwei Zeilen (mit und ohne Vorsteuer), Summe = Brutto", belege.filter((b) => b.zuordnung === "gemischt" && !b.p13b && D.belegSumme(b).ust).every((b) => { const zb = zeilen.filter((z) => z[10] === String(b.nummer).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36)); return zb.length === 2 && summe(zb.map((z) => centAus(z[0]))) === D.belegSumme(b).brutto; }) ? "ja" : "nein", "ja");
  const gi = extf[1].indexOf("Beleginfo - Inhalt 1"); // StB-Prüfung 3.1: GUID in Beleginfo 1, Feld 103 „Buchungs GUID“ leer
  const guids = zeilen.map((z) => z[gi]);
  vergleich(bereich, "DATEV: Buchungs-GUID in jeder Zeile (Beleginfo 1) und eindeutig, Feld 103 leer", gi >= 0 && zeilen.every((z) => z[102] === "" && z[20] === "Buchungs-GUID") && guids.every((g, i) => /^[0-9a-f-]{36}$/.test(g) && guids.indexOf(g) === i) ? "ja" : "nein", "ja");
  const texte = zeilen.map((z) => z[13]);
  vergleich(bereich, "DATEV: Buchungstext höchstens 60 Zeichen", texte.filter((t) => t.length > 60 || t !== t.trimEnd()).join(" | ") || "alle", "alle");
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  const fragen = inhalt[`Fragen_${zr.name}.txt`] ? Buffer.from(inhalt[`Fragen_${zr.name}.txt`]).toString("utf8") : "";
  vergleich(bereich, "LIESMICH: Kleinunternehmer „nein“", (/Kleinunternehmer \(§ 19 UStG\): (ja|nein)/.exec(liesmich) ?? [])[1] ?? "fehlt", "nein");
  vergleich(bereich, "LIESMICH/Fragen erwähnen Umsätze außerhalb der App (Abrechnungszentrum/Kassenpatienten/Zuzahlungen)", /Abrechnungszentrum|Krankenkasse|Kassenpatient|Zuzahlung|sonstige Einnahmen/i.test(liesmich + fragen) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH/Fragen erwähnen Vorsteueraufteilung bzw. steuerfreie Umsätze", /Vorsteuer.{0,40}(aufteil|anteil)|§ 15 Abs\. 4|steuerfreie Umsätze ohne Vorsteuer/i.test(liesmich + fragen) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: „Nicht enthalten – bitte zusätzlich liefern“", /Nicht enthalten – bitte zusätzlich liefern/.test(liesmich) ? "ja" : "nein", "ja");
  const patient = D.RECHNUNGEN.filter((r) => D.KUNDE_ART[r.kunde] === "privat" && inZr(r.datum)).map((r) => D.KUNDEN[r.kunde].name);
  paketInfo[name] = { ...(paketInfo[name] ?? {}), anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, ohneXml: pk.ohneXml, fragen: pk.fragen, patienten: [...new Set(patient)].filter((n) => texte.some((t) => t.includes(n.split(" ").at(-1)))).length, liesmichAnfang: liesmich.split("\r\n").slice(0, 3).join(" / ") };
}
paketPruefen("2026-Q2", { von: "2026-04-01", bis: "2026-06-30", name: "2026-Q2" }, "steuerpaket-2026-Q2");
paketPruefen("Jahr 2026", { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, "steuerpaket-jahr");

// ---------------------------------------------------------------- Dateinamen
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
  const doppelt = bau.docs.map((d) => d.datei.replace(/^\d+-/, "")).filter((n, i, l) => l.indexOf(n) !== i);
  vergleich("Dateinamen", "PDF-Namen (ohne laufende Nummer) eindeutig", doppelt.length ? doppelt.join(", ") : "ja", "ja");
}

// ---------------------------------------------------------------- Texte in den Rechnungs-PDFs (pdftotext)
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/\u2212/g, "-");
for (const d of bau.docs.filter((y) => y.ordner === "rechnungen")) {
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei));
  const flach = txt.replace(/\s+/g, " ");
  const x = D.vorgaenge().find((v) => d.datei.includes(v.nummer));
  if (!x) continue;
  if (!flach.includes(`${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`)) auffaellig.push(`PDF ${d.datei}: Betrag ${D.eur(x.s.brutto)} € nicht im Text gefunden.`);
  if (x.s.frei && !flach.includes("§ 4 Nr. 14")) auffaellig.push(`PDF ${d.datei}: Befreiungshinweis (§ 4 Nr. 14 UStG) fehlt trotz steuerfreier Positionen.`);
  if (!x.s.frei && /§ 4 Nr\. 14/.test(flach)) auffaellig.push(`PDF ${d.datei}: Befreiungshinweis auf einer Rechnung ohne steuerfreie Position.`);
  if (x.s.pflichtig && !/Umsatzsteuer 19 %/.test(flach)) auffaellig.push(`PDF ${d.datei}: Zeile „Umsatzsteuer 19 %“ fehlt.`);
  if (x.s.frei && !/Umsatzsteuer 0 %/.test(flach)) auffaellig.push(`PDF ${d.datei}: Zeile „Umsatzsteuer 0 %“ fehlt.`);
  const seitenZahl = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [path.join(OUT, "rechnungen", d.datei)], { encoding: "utf8" }))?.[1] ?? 1);
  if (seitenZahl > 1) auffaellig.push(`PDF ${d.datei}: ${seitenZahl} Seiten.`);
}

// ---------------------------------------------------------------- KoSIT (optional)
let kosit = "nicht geprüft (Umgebungsvariable KOSIT nicht gesetzt)";
const KOSIT = process.env.KOSIT;
if (KOSIT && fs.existsSync(KOSIT)) {
  const jar = fs.readdirSync(path.join(KOSIT, "v")).find((f) => /^validator-.*\.jar$/.test(f));
  const sz = path.join(KOSIT, "cfg", "scenarios.xml");
  const berichte = path.join(OUT, ".kosit");
  fs.mkdirSync(berichte, { recursive: true });
  const xmlDateien = [...bau.xmls.map((x) => path.join(OUT, "rechnungen", x.datei)), ...bau.belegDateien.filter((b) => b.xml).map((b) => path.join(OUT, "belege", b.datei))];
  try {
    execFileSync("java", ["-cp", `${path.join(KOSIT, "v", jar)}:${path.join(KOSIT, "v", "libs")}/*`, "de.kosit.validationtool.cmd.CommandLineApplication", "-s", sz, "-r", path.dirname(sz), "-o", berichte, ...xmlDateien], { stdio: "pipe" });
  } catch {
    /* Ergebnis steht in den Berichten */
  }
  const erg = xmlDateien.map((f) => {
    const b = fs.readdirSync(berichte).find((r) => r.startsWith(path.basename(f, ".xml")) && r.includes("report") && r.endsWith(".xml"));
    const txt = b ? fs.readFileSync(path.join(berichte, b), "utf8") : "";
    const ok = /<rep:accept/.test(txt);
    const warnungen = (txt.match(/<rep:message[^>]*level="warning"[^>]*>[^<]*/g) ?? []).map((m) => m.replace(/<[^>]*>/g, "").replace(/^.*?>/, ""));
    if (!ok) auffaellig.push(`KoSIT: ${path.basename(f)} nicht akzeptiert: ${(txt.match(/<rep:message[^>]*level="error"[^>]*>[^<]*/g) ?? []).slice(0, 3).map((m) => m.replace(/<[^>]*>/g, "")).join(" | ") || "kein Bericht"}`);
    return `${path.basename(f)}: ${ok ? "akzeptiert" : "ABGELEHNT"}${warnungen.length ? ` (${warnungen.length} Warnungen: ${[...new Set(warnungen)].slice(0, 2).join(" | ").slice(0, 300)})` : ""}`;
  });
  fs.rmSync(berichte, { recursive: true, force: true });
  kosit = `KoSIT-Validator (${jar}, ${path.basename(KOSIT)}): ${erg.join("; ")}`;
}

// ---------------------------------------------------------------- PNG-Ansichten (60 dpi)
const pdfs = [];
const sammeln = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) sammeln(p);
    else if (f.name.endsWith(".pdf")) pdfs.push(p);
  }
};
for (const d of ["pdf", "rechnungen", "belege", "mappe"]) sammeln(path.join(OUT, d));
const seiten = {};
for (const p of pdfs) {
  const rel = path.relative(OUT, p);
  const ziel = path.join(OUT, "png", rel.replace(/\//g, "__").replace(/\.pdf$/, ""));
  // die Kontrollmappe wiederholt nur die Einzel-PDFs – Seitenzahl ja, PNGs nur vom Deckblatt
  execFileSync("pdftoppm", ["-r", "60", "-png", ...(rel.startsWith("mappe/") ? ["-f", "1", "-l", "1"] : []), p, ziel]);
  seiten[rel] = rel.startsWith("mappe/") ? Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [p], { encoding: "utf8" }))?.[1] ?? 0) : fs.readdirSync(path.join(OUT, "png")).filter((f) => f.startsWith(path.basename(ziel) + "-")).length;
}

fs.writeFileSync(path.join(OUT, "stand.json"), JSON.stringify(s, null, 1));

// ---------------------------------------------------------------- SZENARIO.md
const e = D.eur;
const md = [];
const tab = (kopf, zeilen) => [`| ${kopf.join(" | ")} |`, `|${kopf.map(() => "---").join("|")}|`, ...zeilen.map((z) => `| ${z.map((x) => String(x ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | ")} |`)].join("\n");
const B = D.BETRIEB;
const eu = D.euerUnabhaengig();
const qs = D.ustQuartale();
const uj = D.ustJahr();
const jq = D.jahresQuote();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario-praxis.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, eRechnungLesen/belegAusERechnung, umsaetzeFuer, euerUebernahme, steuerpaket, mappenAuswahl/mappeZusammenfuegen, auswertung, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-praxis-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd packages/fachlogik && npx tsc -p tsconfig.build.json && cd ../../apps/mobile && KOSIT=<ordner mit v/ und cfg/> node werkzeuge/jahr-szenario-praxis.mjs /tmp/claude-0/praxis`. Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Name", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland})`], ["Tätigkeit", `Einzelpraxis für Physiotherapie seit ${D.de(D.GRUENDUNG)}, Inhaber ${D.INHABER.name} (${D.INHABER.erlaubnis}); freier Beruf, kein Gewerbe; Kassenzulassung (Heilmittelerbringer)`],
    ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr}; Heilbehandlungen steuerfrei (§ 4 Nr. 14 Buchst. a UStG), Wellness/Verkauf/Firmenkurse 19 %; **keine Kleinunternehmerregelung** (steuerpflichtiger Umsatz 2025: ${D.UMSATZ_VORJAHR_STEUERPFLICHTIG.toLocaleString("de-DE")} €); Ist-Versteuerung, Voranmeldung vierteljährlich (Zahllast 2025: ${D.ZAHLLAST_VORJAHR.toLocaleString("de-DE")} €); Vorsteueraufteilung, vorläufiger Umsatzschlüssel ${D.QUOTE_VORLAEUFIG} %; EÜR`],
    ["Beschäftigte", `${D.MITARBEITER.m1.name} (Physiotherapeutin, 25 Std., ${e(D.LOHN_M1)} €), ${D.MITARBEITER.m2.name} (Empfang, Minijob ${e(D.LOHN_M2)} € = 40 Std. × ${e(D.STUNDENLOHN_M2)} €)`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website}`],
    ["Website", "Praxis-Website mit Kontaktformular und Online-Terminbuchung (TheraPlan, AVV), Hosting Saxonia Webhosting (AVV)"],
    ["Abrechnung", `Kassenpatienten über ${D.AZ.name} (monatliche Sammelauszahlung, Gebühr 2,4 % zzgl. USt verrechnet); Privatpatienten, Selbstzahler, Firmen und Unfallversicherungsträger per Rechnung aus Amtlos; Zuzahlungen und Verkauf am Empfang per EC-Terminal`],
    ["Steuerberatung", "Steuerkanzlei Sommer & Partner; DATEV SKR03, Berater 52114 / Mandant 30871"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\` (Name = Pfad mit \`__\`, Suffix -Seitenzahl; von der Kontrollmappe nur das Deckblatt). \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen", "", `Zeile = Menge × Einzelpreis (netto), auf Cent gerundet; USt 19 % auf die Summe der 19-%-Positionen. Steuerfreie Positionen mit 0 % und dem Hinweis „${D.BEFREIUNG}“.`, "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde", "steuerfrei", "19 % netto", "USt", "Brutto", "Bezahlt", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : (x.r.leistungText ?? D.de(x.r.leistung ?? x.datum)), `${D.KUNDEN[x.kunde].name} (${D.KUNDE_ART[x.kunde]})`, e(x.vz * x.s.frei), e(x.vz * x.s.pflichtig), e(x.vz * x.s.ust), e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}** an ${D.KUNDEN[r.kunde].name}, Ziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} € (${p.satz} %)`).join("; ")}`);
md.push("");

md.push("## Eingaben: Einnahmen ohne Rechnung in der App", "");
md.push(tab(["Quelle", "Q1", "Q2", "Q3", "Q4", "2026"], [
  ["Abrechnungszentrum (Kassenanteil brutto, steuerfrei)", ...qs.map((q) => e(q.gkv)), e(eu.gkv)],
  ["Zuzahlungen (steuerfrei)", ...qs.map((q) => e(q.zuzahlungen)), e(eu.zuzahlungen)],
  ["Empfang 19 % netto (brutto)", ...qs.map((q) => `${e(q.empfang.netto)} (${e(q.empfang.brutto)})`), `${e(eu.empfangNetto)} (${e(eu.empfangNetto + eu.empfangUst)})`],
]), "", `Auszahlungen des Abrechnungszentrums: ${D.GKV.map((g) => `${g.monat} → ${D.de(g.zufluss)} ${e(g.betrag)} €`).join("; ")}. Gebühren 2026: ${e(eu.gkvGebuehren)} € netto (Belege b14–b17).`, "");

md.push("## Eingaben: Belege", "", "In die App wird der Bruttobetrag je Satz eingegeben. Vorsteuer bei Zuordnung **pflichtig** voll, bei **gemischt** anteilig 13 % (Vorsteuer-Teilabzug je Beleg, E-165, § 15 Abs. 4 UStG), bei **frei** aus. „USt“ = so steht es auf dem Beleg.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "Zuordnung", "je Satz: netto + USt", "Brutto", "Zahlung", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, `${b.zuordnung}${b.p13b ? " (§ 13b)" : ""}`, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, b.worum];
})), "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "", "### Umsatzsteuer je Quartal (Ist-Versteuerung, vorläufiger Schlüssel 13 %)", "");
md.push(tab(["", ...qs.map((q) => q.q)], [
  ["Kz 81: Umsätze 19 % (Rechnungen nach Zahlungseingang + Empfang)", ...qs.map((q) => `${e(q.u19)} (${e(q.rePflichtig)} + ${e(q.empfang.netto)})`)],
  ["Umsatzsteuer 19 %", ...qs.map((q) => e(q.ust19))],
  ["Kz 48: steuerfreie Umsätze ohne Vorsteuerabzug (Rechnungen + Abrechnungszentrum + Zuzahlungen)", ...qs.map((q) => `${e(q.kz48)} (${e(q.reFrei)} + ${e(q.gkv)} + ${e(q.zuzahlungen)})`)],
  ["Kz 46/47: § 13b Bemessungsgrundlage / Steuer", ...qs.map((q) => `${e(q.bmg13b)} / ${e(q.st13b)}`)],
  ["Vorsteuer voll (nur steuerpflichtig genutzt)", ...qs.map((q) => e(q.vstVoll))],
  ["Vorsteuer gemischt gesamt → 13 % (je Beleg gerundet)", ...qs.map((q) => `${e(q.gemischtGesamt)} → ${e(q.vstAnteil)}`)],
  ["Vorsteuer aus § 13b (13 %)", ...qs.map((q) => e(q.vst13b))],
  ["**Vorsteuer gesamt (Kz 66 + 67)**", ...qs.map((q) => `**${e(q.vorsteuer)}**`)],
  ["**Zahllast**", ...qs.map((q) => `**${e(q.zahllast)}**`)],
  ["zum Vergleich: Vorsteuer, wenn alle Belege mit Startwert „an“", ...qs.map((q) => e(q.vstStandard))],
  ["zum Vergleich: Vorsteuer ohne Aufteilung (gemischte „an“)", ...qs.map((q) => e(q.vstOhneAufteilung))],
  ["App „Aus Rechnungen übernehmen“: 19 % / ohne USt / Vorsteuer", ...qs.map((q) => { const a = bau.ust.find((u) => u.q === q.q); return a ? `${a.app.umsatz_19} / ${a.app.umsatz_frei} / ${a.app.vorsteuer ?? "–"} (${a.anzahl} Rechnungen, ${a.offen} offen)` : "–"; })],
  ["App fertiges Formular", ...qs.map((q) => { const a = bau.ust.find((u) => u.q === q.q); return a ? a.formular.map(([x, y]) => `${x} ${y}`).join(", ") : "–"; })],
]), "");
md.push(`Endgültiger Schlüssel 2026: steuerpflichtig ${e(jq.pflichtig)} € / gesamt ${e(jq.gesamt)} € = ${jq.exakt.toFixed(2).replace(".", ",")} % → gerundet ${jq.quote} % (Annahme: kaufmännisch auf volle Prozent). USt-Jahreserklärung: USt ${e(uj.ust)} € + § 13b ${e(uj.st13b)} € − Vorsteuer ${e(uj.vorsteuer)} € = ${e(uj.jahr)} €; Vorauszahlungen ${e(uj.vorauszahlungen)} € → Abschlusszahlung ${e(uj.abschluss)} €. Kleinunternehmergrenze: steuerpflichtiger Umsatz 2026 ${e(jq.pflichtig)} € (steuerfreie Heilbehandlungen zählen nicht zum Gesamtumsatz – fachlich bestätigen).`, "");

md.push("### EÜR 2026", "");
md.push(tab(["Posten", "Betrag €"], [
  [`Steuerpflichtige Einnahmen aus Rechnungen (netto, ${eu.reAnzahl} bezahlte Rechnungen; offen zum Jahresende ${e(eu.offen)} € brutto)`, e(eu.rePflichtig)],
  ["Steuerfreie Einnahmen aus Rechnungen (Privatpatienten, Unfallversicherung)", e(eu.reFrei)],
  ["Vereinnahmte USt aus Rechnungen", e(eu.reUst)],
  ["Kassenpatienten (Abrechnungszentrum, brutto vor Gebühr)", e(eu.gkv)],
  ["Zuzahlungen", e(eu.zuzahlungen)],
  ["Empfang 19 % netto + USt", `${e(eu.empfangNetto)} + ${e(eu.empfangUst)}`],
  ["**Summe Betriebseinnahmen**", `**${e(eu.einnahmen)}**`],
  ...Object.entries(eu.nachKategorie).map(([k, w]) => [`Ausgaben ${k} (${w.anzahl} Belege, brutto; in der App-Sicht ${e(w.appSicht)})`, e(w.brutto)]),
  [`USt an das Finanzamt gezahlt (Q4/2025 ${e(D.VA_Q4_2025.betrag)} am ${D.de(D.VA_Q4_2025.zahltag)}, Q1–Q3/2026)`, e(eu.vaGezahlt)],
  ["**Summe Betriebsausgaben (ohne AfA)**", `**${e(eu.ausgaben)}**`],
  [`AfA Kombigerät: ${e(eu.afaBasis)} € brutto / 5 Jahre × 11/12`, e(eu.afa)],
  ["**Gewinn**", `**${e(eu.ergebnis)}**`],
  ["nicht in 2026: Wäsche Jul–Dez (b24, 08.01.2027), Telefon Jul–Dez (b26, 05.01.2027), USt Q4/2026 (11.01.2027), Rechnungen 2026-020/021 (offen)", ""],
]), "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((v) => v.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((v) => [v.ok ? "✓" : "✗", v.bereich, v.was, v.app, v.erwartet])), "");
md.push("EÜR-Übernahme der App (Rohzeilen):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.uebernahme.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.uebernahme.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Hinweis der App: ${bau.euer.uebernahme.hinweis}`, "", `Ergebnis der fertigen EÜR (nach Ergänzungen): ${bau.euer.ergebnis.map(([a, b]) => `${a} ${b}`).join(", ")}.`, "");
md.push("### Steuerberater-Pakete", "", ...Object.entries(paketInfo).map(([n, p]) => `- **${n}:** ${p.anzahl} Dateien, ${p.buchungen} DATEV-Buchungen, ${p.ohneXml} Rechnungen ohne E-Rechnung, ${p.fragen} Punkte in den Fragen; Summenzeilen der Rechnungsliste: ${p.summenzeilen ?? "–"}; Patientennamen in DATEV-Buchungstexten: ${p.patienten}. LIESMICH beginnt: „${p.liesmichAnfang}“.`), "");
md.push("### Kontrollmappe", "", `- ${mappeInfo}`, "");

md.push("## Pflichten-Check der App", "", `Profil (Antworten wie in der App): ${Object.entries(bau.profil).map(([k, w]) => `${k} = ${Array.isArray(w) ? w.join("/") : w}`).join("; ")}. Stichtag 15.01.2026.`, "");
md.push("### Gilt", "", tab(["Pflicht", "ID", "Schwere", "Nächster Termin", "Grund laut App", "Vorlage (erzeugt?)"], bau.pflichten.gilt.map((p) => [p.titel, p.id, p.schwere, p.termin ? D.de(p.termin) : "–", p.grund, p.vorlage ? `${p.vorlage} (${p.erzeugt ? "ja" : "**nein**"})` : "–"])), "");
if (bau.pflichten.gruendung.length) md.push("### Gründungsschritte (Praxis läuft seit 2021 – vermutlich erledigt)", "", tab(["Pflicht", "ID", "Grund laut App", "Vorlage"], bau.pflichten.gruendung.map((p) => [p.titel, p.id, p.grund, p.vorlage ?? "–"])), "");
if (bau.pflichten.unbekannt.length) md.push("### Noch offen (App braucht weitere Antworten)", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel} (${p.id})${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");
if (bau.pflichten.jahresende.length) md.push("### Zusätzlich am 31.12.2026", "", ...bau.pflichten.jahresende.map((p) => `- ${p.titel} (${p.id}) – ${p.grund}`), "");
md.push("### Varianten des Profils (Unterschied zu oben)", "", tab(["Variante", "kommt hinzu", "fällt weg"], bau.pflichten.varianten.map((v) => [v.name, v.nurHier.join(", ") || "–", v.fehltHier.join(", ") || "–"])), "");

md.push("## Auffälligkeiten beim Erzeugen", "");
md.push("### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Beim Erzeugen festgestellt (fachlich, nicht automatisch prüfbar)", "", ...BEOBACHTUNGEN.map((b) => `- ${b}`), "");
md.push("## Hinweise der App und weitere Informationen", "", ...bau.infos.map((i) => `- ${i}`), `- ${kosit}`, "");
md.push("## Durchsicht aller PDF-Seiten (von Hand, anhand der PNGs)", "", `${pdfs.length} PDFs mit ${Object.entries(seiten).filter(([k]) => !k.startsWith("mappe/")).reduce((a, [, b]) => a + b, 0)} Seiten (ohne Kontrollmappe). Einstufung: [schwer] falsche Steuer-/Zahlenangabe mit Außenwirkung, [mittel] fachlich falsch oder widersprüchlich, [gering] Layout/Wortwahl.`, "", ...(DURCHSICHT.length ? DURCHSICHT.map((x) => `- ${x}`) : ["- (noch nicht durchgesehen)"]), "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((v) => v.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
for (const a of auffaellig) console.log(`  - ${a}`);
console.log(kosit);
