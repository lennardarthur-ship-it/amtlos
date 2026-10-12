# Testbericht Launch-Fokus 4 · Die iPhone-App als Unterlagen-Werkzeug

Stand: 2026-10-12 · Auftrag: „Die App soll an nichts erinnern, sondern bürokratische Aufgaben übernehmen – ohne Fragebogen, der Nutzer wählt selbst, welche Unterlage er braucht“ (E-121)

## Ergebnis in einem Satz

Die App ist jetzt ein Werkzeug für Pflichtunterlagen: Vorlage wählen, ausfüllen, PDF teilen – 15 Vorlagen für alle 18 Katalogpflichten mit Dokument-Generator, alles nur auf dem iPhone, ohne Konto. **Vorlagen-Tests, App-Tests, alle 42 Monorepo-Aufgaben, die Datenbanktests und der Rundgang (hell und dunkel) sind grün.**

## Was die App kann

| Tab | Funktionen |
|---|---|
| Unterlagen | alle Vorlagen nach Bereich (Arbeitsschutz, Datenschutz, Personal, Steuern, Gastronomie, Beauty); je Vorlage: was drinsteht, wozu (Katalogpflichten), Rechtsgrundlage, Quellen, „Jetzt ausfüllen“; Hinweis „Betrieb eintragen“, solange der Betrieb fehlt |
| Formular | speichert bei jeder Eingabe; Listen (Gefährdungen, Stoffe, Teilnehmende …) aufklappbar mit Hinzufügen/Entfernen; Felder erscheinen nur, wenn sie zutreffen (z. B. Begründung bei „kein Risiko“); „Fehlt noch“ nennt fehlende Pflichtangaben, ohne das PDF zu sperren; PDF teilen (Dateien, Mail, AirDrop), Drucken, Kopie anlegen, Löschen |
| Meine | alle angelegten Unterlagen, zuletzt bearbeitete zuerst, mit Stand „vollständig“ oder „n Angaben fehlen“ |
| Mein Betrieb | Name, Adresse, verantwortliche Person, Kontakt – steht im Kopf jeder Unterlage und füllt „Beurteilt von“, „Durchgeführt von“, Kontakt vor; Daten sichern; alles löschen |

Die PDFs: A4 (Tabellen und Aushänge quer), Betrieb im Kopf, Unterschriftsfelder, leere Zeilen zum Nachtragen von Hand (Teilnahmelisten, HACCP-Blatt), am Ende „Vorlage noch nicht fachlich geprüft“.

## Tests

| Prüfung | Ergebnis |
|---|---|
| Vorlagen (`@amtlos/fachlogik`): jede Katalogpflicht mit Dokument-Generator ist abgedeckt; IDs, Titel- und Namensfelder, Bedingungen stimmig; leere und volle Eingaben ergeben ein Dokument mit Prüfhinweis und maskierten Eingaben; Vorbelegung aus dem Betrieb; fehlende Angaben auch in Listen; 72-Stunden-Frist in Berliner Zeit über die Zeitumstellung; Dateinamen; Allergene, Unterschriftszeilen, HACCP-Leerzeilen; Quer-/Hochformat | 8 neu, alle grün |
| App: anlegen/ändern/kopieren/löschen, tolerantes Lesen gespeicherter Stände, Katalogauszug je Vorlage, Datum in deutscher Zeit | 5 |
| Monorepo (lint, typecheck, test) | 42/42 |
| Server und API gegen PostgreSQL (Bezeichnungen jetzt aus der Fachlogik) | 54 / 72 |
| Rundgang (Web-Export, iPhone-Format, hell und dunkel): Betrieb eintragen → Vorlage → ausfüllen → vollständig → PDF-Inhalt → Meine → Allergene (Mehrfachauswahl) → Neustart, Daten bleiben → Kopie und Löschen → alles löschen | ohne Befunde |
| Alle 15 Vorlagen als PDF in Chromium gesetzt und angesehen | lesbar, keine Überläufe |
| iOS-Bündel (Monorepo und Testpaket nach frischer Installation), Typprüfung Testpaket | grün |

## Beim Prüfen gefunden und behoben

1. Im Web lagen ausgeblendete Tabs unsichtbar über dem aktiven und schluckten Tipps – im Web jetzt ganz ausgeblendet (auf dem iPhone wirkte `pointerEvents` schon richtig).
2. Auswahl-Chips meldeten ihren Zustand im Web nicht an Screenreader (`aria-checked` fehlte) – ergänzt für Auswahl, Liste und Mehrfachauswahl.
3. Bei einer Gefährdung stand die lange Liste der Gefährdungsarten vor der eigentlichen Beschreibung – jetzt zuerst Gefährdung und Maßnahme, dann Risiko und Art.
4. Ungültige Daten (z. B. 13. Monat) wurden bei der Fristberechnung still verschoben – jetzt erkannt.

## Fachlich zu prüfen (Prüfliste)

T-52 alle Vorlagen · T-53 Nachweisgesetz (Liste, Form) · T-54 Verfahrensdokumentation (Gliederung) · T-55 Datenschutzinformation (Pflicht- und Kann-Abschnitte) · T-56 Betriebsanweisung, Gefahrstoffverzeichnis · T-57 Hautschutz-, Hygieneplan, HACCP, IfSG-Folgebelehrung.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Auf echtem iPhone gesehen | bisher Web-Export, iOS-Bündel und Chromium-PDFs | du testest im Testpaket; besonders PDF-Ränder und Querformat aus expo-print |
| Inhalte | die App gibt Gliederung und Beispiele, schreibt aber keine Rechtstexte – der Nutzer füllt aus | nach Freigabe (T-52 ff.) fachlich geprüfte Textbausteine je Branche anbieten |
| Datensicherung | „Daten sichern“ exportiert, Wiederherstellen fehlt | mit dem nächsten Schritt (Datei importieren) |
| Web-App und Server | unverändert – zeigen weiter Pflichtenplan und Erinnerungen | entscheiden, ob die Web-App denselben Weg geht |
