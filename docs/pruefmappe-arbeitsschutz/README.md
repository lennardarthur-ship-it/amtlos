# Prüfmappe für die fachliche Prüfung Arbeitsschutz

Stand: Oktober 2026. Diese Mappe ist für eine **Fachkraft für Arbeitssicherheit** (Sifa) und – für die Fragen zur arbeitsmedizinischen Vorsorge – eine **Betriebsärztin oder einen Betriebsarzt**, idealerweise mit Erfahrung in der Betreuung kleiner Betriebe (Gastronomie, Friseur/Kosmetik, Handwerk, Werkstatt, Reinigung, Büro). Sie soll den Prüfauftrag eingrenzen und damit die Kosten planbar machen. Die rechtliche Prüfung (Arbeitsrecht, Datenschutz, RDG, Nutzungsbedingungen) hat Rechtsanwalt Dr. Weber übernommen; sie ist hier nicht Gegenstand.

Anbieter: Lang Ventures UG (haftungsbeschränkt) i. G., Reutlingen. App: **Betriebsklar** (iPhone).

## Was Betriebsklar im Arbeitsschutz tut

Betriebsklar ist eine iPhone-App für kleine Betriebe in Deutschland. Für den Arbeitsschutz heißt das:

1. **Pflichten-Check:** Aus 10–15 Angaben zum Betrieb (Branche, Beschäftigte, davon unter 18 Jahren …) zeigt die App aus einem festen Katalog, welche Pflichten in Frage kommen – z. B. Gefährdungsbeurteilung, Unterweisung (jährlich, bei Jugendlichen halbjährlich), Betreuung durch Fachkraft für Arbeitssicherheit und Betriebsarzt, Erste Hilfe und Brandschutz, Prüfung elektrischer Geräte, arbeitsmedizinische Vorsorge. Regelbasiert, keine KI, keine Einzelfallprüfung.
2. **Vorlagen, die der Betrieb selbst ausfüllt** und als PDF ausgibt: Gefährdungsbeurteilung, Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung (Gefahrstoff, TRGS 555), Prüfprotokoll elektrische Geräte (DGUV V3) und Hautschutzplan.
3. **Bausteine als Vorschläge:** In den Vorlagen bietet die App vorformulierte Gefährdungen mit Maßnahmen, Unterweisungsthemen, Textbausteine für Betriebsanweisungen, Hautschutz-Zeilen und Prüffristen zum Antippen an – je Branchengruppe sortiert, jeweils mit Kurzbeleg (z. B. „BGW“, „DGUV Regel 110-003“, „TRGS 530“). Der Betrieb übernimmt sie und passt sie an. Kein Baustein ist bisher fachlich freigegeben; die App zeigt bei den Vorlagen den Hinweis „Die Vorlagen sind noch nicht von Fachleuten geprüft. Prüfe die Inhalte, bevor du sie verwendest.“
4. **Kontrollmappe:** Die aktuellen Arbeitsschutz-, Hygiene- und Personalnachweise in einem PDF für eine Besichtigung (BG, Gewerbeaufsicht). Nachweise ohne Vorlage (Betreuung durch Sifa und Betriebsarzt, Ersthelfer, Verbandbuch, Prüfnachweise für Arbeitsmittel, Vorsorge, bei Werkstätten Hebebühne, Druckbehälter, Hochvolt) kann der Betrieb nur als „vorhanden“ abhaken.

**Was die App nicht ist:** kein Ersatz für die sicherheitstechnische und betriebsärztliche Betreuung nach ASiG und DGUV Vorschrift 2. Der Katalog führt diese Betreuung als eigene Pflicht (`arbeitsschutz.fasi_betriebsarzt`, mit Hinweis auf das Unternehmermodell der Berufsgenossenschaft), die Gefährdungsbeurteilung hat das Feld „Mitgewirkt haben“ (Fachkraft für Arbeitssicherheit, Betriebsärztin/Betriebsarzt, Unternehmermodell). Die App beurteilt nichts selbst: Sie schlägt Formulierungen vor, die Verantwortung bleibt beim Arbeitgeber.

**Daten:** Alles bleibt auf dem Gerät. Betriebsklar sieht keine Nutzerdaten. Die Beispiele in den PDFs („voll“, „Auswahl“) sind erfunden.

## Inhalt der Mappe

| Datei | Inhalt |
|---|---|
| `vorlagen/*.pdf` | Jede Arbeitsschutz-Vorlage in drei Fassungen: `-leer` (Startwerte, zum Ausfüllen von Hand), `-voll` (realistisch ausgefüllt), `-auswahl` (jede Auswahl umgestellt, alle Schalter an – so erscheinen auch die Abschnitte, die erst durch eine Auswahl entstehen). Vorlagen: `gefaehrdungsbeurteilung`, `unterweisung`, `gefahrstoffverzeichnis`, `betriebsanweisung`, `pruefprotokoll_elektro`, `hautschutzplan` |
| `bausteine.md` | Alle Bausteine dieser Vorlagen nach Branchengruppe und Vorlage: Baustein, Inhalt (Maßnahmen), automatisch herausgezogene Kennzahlen, Quelle, Markierung („fachlich zu prüfen“, „unsicher“, „Nutzertest“, „ohne Quelle“). Am Ende die kurzen Auswahllisten und die festen Texte (Risikoskala, Gefährdungsfaktoren, Pflichtangaben Gefahrstoffverzeichnis, Gliederung Betriebsanweisung, Prüffristen) |
| `bausteine.csv` | Dieselben Bausteine als Tabelle (Semikolon, UTF-8, für Excel), eine Zeile je Baustein mit Nummer B-…, zum Kommentieren |
| `katalog-arbeitsschutz.csv` | Katalogeinträge der Kategorie `arbeitsschutz` und die Arbeitsschutz-Einträge aus Personal und Branchen (JArbSchG, MuSchG, ArbZG/Nachtarbeit, Arbeitszeit, Aushänge, Führerscheinkontrolle, Hautschutzplan, Gefährdungsbeurteilung je Gewerk, Baustellenverordnung, Lenk- und Ruhezeiten) – gleiche Spalten wie die Anwalts-Mappe |
| `regelwerte-arbeitsschutz.csv` | Regelwerte des Arbeitsschutzes (Schwelle für Ersthelfer) mit offenen Punkten |
| `PRUEFLISTE-arbeitsschutz.md` | Punkte der Prüfliste, deren Spalte „Wer“ die Sifa (auch BG, Elektrofachkraft) nennt, Punkte für „Fach“ mit Arbeitsschutz-Bezug, zur Kenntnis die übrigen Punkte mit Arbeitsschutz-Bezug; Anhang: offene Katalogpunkte dieser Einträge |

`node docs/pruefmappe-arbeitsschutz/erzeugen.mjs <ziel>` erzeugt die Mappe neu aus dem aktuellen Code.

## Woher die Bausteine kommen

- **Recherche vom 12.10.2026** (`docs/recherche/2026-10-12/arbeitsschutz.json`): Gefährdungen und Maßnahmen für Friseur, Kosmetik, Gastronomie/Café, Handwerk und Büro/Laden, Unterweisungsthemen, Betriebsanweisungs-Bausteine, Muster-Hautschutzplan Friseur, Prüffristen DGUV V3, Mutterschutz-Ergebnisse – mit Quellen (BGW, BGN, DGUV-Regeln, TRGS 401/530/555, ASR, DGUV Vorschrift 1 und 3). Das Skript `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs` übernimmt sie ohne Umformulierung nach `bausteine.ts`; „unsicher“ heißt dort „nicht wörtlich an der Primärquelle geprüft“.
- **Ergänzungen im Code** (`arbeitsschutz.ts`): Elektrische Anlagen und Jugendliche (§ 28a JArbSchG), Gebäudereinigung und Holz/Tischlerei, Kfz-Werkstatt, Bäckerei und Transport/Kurier. Diese Gruppen stammen aus simulierten Nutzertests; die Maßnahmen sind allgemeine Grundsätze, die Quelle sagt „fachlich zu prüfen“, wo die Fundstelle nicht sicher ist, oder „Nutzertest“, wo es keine Fachquelle gibt.
- **Branchengruppen:** Gastronomie/Café, Bäckerei, Friseur, Kosmetik, Handwerk/Bau (inkl. Holz/Tischlerei), Kfz-Werkstatt, Transport/Kurier, Gebäudereinigung, Büro/Laden. Eine eigene Gruppe für **Praxen (Gesundheit)** gibt es nicht – dort zeigt die App alle Bausteine ungefiltert.

## Prüfumfang – Vorschlag

### A. Bausteine je Branche fachlich freigeben (höchster Nutzen)

`bausteine.md` bzw. `bausteine.csv` je Branchengruppe durchsehen:

- **Gefährdungen vollständig?** Fehlen typische Gefährdungen der Branche, die eine BG-Handlungshilfe nennt?
- **Maßnahmen nach STOP** (Substitution, technisch, organisatorisch, persönlich): richtig, in sinnvoller Reihenfolge, nichts Überholtes? Der Hilfetext der Vorlage sagt heute nur „technisch vor organisatorisch vor persönlich“.
- **Kennzahlen und Grenzwerte mit Quelle:** z. B. Rutschhemmung R 9, 100 m³ Frischluft pro Stunde und Beschäftigtem, 750 lx, 300/500 lx, 20/26 °C, 6 Löschmitteleinheiten bis 50 m², Feuchtarbeit unter 4 bzw. 2 Stunden, Lärm 80/85 dB(A), Fehlerstrom-Schutzschalter höchstens 30 mA, Prüffristen 3/6 Monate bis 2 Jahre. Bitte je Wert die Fundstelle bestätigen oder korrigieren – ASR, TRGS, DGUV-Regeln/-Informationen und die Branchenhilfen von BGW, BGN, BG BAU, BGHM, BG ETEM, BGHW und BG Verkehr.
- **Bausteine mit „fachlich zu prüfen“ und „Nutzertest“** zuerst: dort fehlt eine belastbare Fachquelle.

Zur Abrechnung genügt eine Rückmeldung je Nummer (B-…): „frei“, „ändern in …“ oder „streichen“.

### B. Vorlagenstruktur

Je eine Fassung „leer“ und „voll“ aus `vorlagen/`:

- **Gefährdungsbeurteilung:** Abschnitte nach § 5 Abs. 3 Nr. 1–6 ArbSchG plus „Sonstige“, Spalten Gefährdung / Risiko / Schutzmaßnahmen / Wer – bis wann / Erledigt am, Mutterschutz (§ 10 MuSchG, Information nach § 14 Abs. 2), Jugendliche (§ 28a JArbSchG), Wirksamkeit und Fortschreibung. Auf dem leeren Blatt je Faktor eine Tabelle.
- **Unterweisungsnachweis:** Anlass (Erst-, Wiederholungs-, Anlassunterweisung), Dauer, Sprache, Themen zum Ankreuzen, betriebliche Ergänzungen, Teilnahmeliste mit Unterschrift auf Papier, nächster Termin (bei Jugendlichen halbjährlich).
- **Betriebsanweisung:** Gliederung nach TRGS 555, heute ohne GHS-Piktogramme.
- **Gefahrstoffverzeichnis:** Bezeichnung, Hersteller, Einstufung, Mengenbereich, Arbeitsbereiche, Verwendung, Sicherheitsdatenblatt und dessen Stand (§ 6 Abs. 12 GefStoffV).
- **Hautschutzplan:** Tätigkeit, Hautschutz, Handschuhe, Reinigung, Pflege, Produkte des Betriebs; Musterzeilen nur für Friseure (TRGS 530/BGW).
- **Prüfprotokoll elektrische Geräte:** Prüfende Elektrofachkraft, Prüfgerät, Art und Umfang der Prüfung, Normen DIN EN 50678 / 50699, je Gerät Schutzklasse, R<sub>PE</sub>, R<sub>ISO</sub>, I<sub>PE</sub>/I<sub>B</sub>, Ergebnis, Mängel, nächster Termin aus dem Richtwert der Einsatzbedingungen.

### C. Katalog-Stichprobe Arbeitsschutz

`katalog-arbeitsschutz.csv`: Auslöser, Fristen und Wiederholung der Einträge, bevorzugt Unterweisung (Erst-, Wiederholungs-, Jugendliche), Erste Hilfe und Brandschutz, Feuerlöscher, DGUV V3, Arbeitsmittel (BetrSichV), Fahrzeuge (DGUV V70), arbeitsmedizinische Vorsorge (ArbMedVV), Unfallanzeige, Nachtarbeit und Jugendarbeitsschutz. Alle Einträge stehen auf Prüfstatus `entwurf`.

### D. Risikoskala

Die Gefährdungsbeurteilung kennt drei Stufen (gering / mittel / hoch) mit kurzer Definition (Wortlaut in `bausteine.md`, „Feste Texte“). Für jede Gefährdung ist „mittel“ vorbelegt; einige Bausteine setzen „hoch“.

## Fragen an die Prüfung

Verdichtet aus `PRUEFLISTE-arbeitsschutz.md` (Nummern in Klammern).

### Bausteine (A)

1. Sind die Gefährdungen je Branchengruppe vollständig – was fehlt aus Ihrer Sicht in Gastronomie, Bäckerei, Friseur, Kosmetik, Handwerk/Bau, Kfz-Werkstatt, Transport/Kurier, Gebäudereinigung und Büro/Laden? (T-20, T-62)
2. Stimmen die Maßnahmen und ihre Rangfolge nach dem STOP-Prinzip? Soll der Hilfetext die Substitution ausdrücklich nennen?
3. Stimmen die Kennzahlen und Grenzwerte in den Bausteinen mit den genannten Quellen überein (R 9, 100 m³/h, Beleuchtungsstärken, Raumtemperaturen, Löschmitteleinheiten, Feuchtarbeit, Lärm, 30 mA, Prüffristen)? Wo soll die Quelle genauer werden (Abschnitt, Tabelle)? (T-62)
4. Welche Fachquelle gehört zu den Bausteinen mit „Nutzertest“ bzw. „fachlich zu prüfen“ (Gebäudereinigung, Holz/Tischlerei, Kfz mit TRGS 554 und DGUV Information 209-093, Bäckerei mit Mehlstaub und Nachtarbeit, Transport/Kurier mit DGUV V70 und Ladungssicherung)? (T-121)
5. Welche Branchenhilfen sollten wir für Gruppen ohne eigene Bausteine nutzen, vor allem Praxen (BGW) und Einzelhandel (BGHW)? Reicht der eine Baustein „Elektrische Anlagen“ für das Elektrohandwerk?
6. Hautschutz: Der Musterplan deckt nur Friseure ab. Brauchen Kosmetik, Nagelstudio, Gastronomie und Gebäudereinigung eigene Zeilen? DIN EN ISO 374-6 als Friseurhandschuh und „Sticharbeiten“ belegen. (T-90)

### Vorlagen (B)

7. Gefährdungsbeurteilung: Genügt die Gliederung nach § 5 Abs. 3 ArbSchG mit „Sonstige“, oder fehlen Faktoren wie Brand- und Explosionsgefährdung als eigener Abschnitt? Reichen die Spalten für eine BG-Besichtigung? (T-18)
8. Mutterschutz und Jugendliche: Reichen die drei Ergebnisse nach § 10 Abs. 1 MuSchG, der Hinweis bei Gefahrstoffen, Stäuben oder Lärm trotz „keine Schutzmaßnahmen“ und die Formulierungen zu §§ 22–29 JArbSchG? (T-100)
9. Unterweisung: Sind die Themen sinnvoll, fehlt ein Nachweis des Verständnisses? Genügt die Unterschrift auf dem ausgedruckten Nachweis, und wäre eine Bestätigung in der App (eingetippter Name) zulässig? (T-13)
10. Betriebsanweisung und Gefahrstoffverzeichnis: Passt die Gliederung zur TRGS 555, auch ohne Piktogramme? Reichen die Spalten für § 6 Abs. 12 GefStoffV, sind die Mengenbereiche (eigene Formulierung) brauchbar? Brauchen kleine Betriebe auch Betriebsanweisungen für Maschinen (§ 12 BetrSichV), für die es heute keine Vorlage gibt? (T-56, T-64, T-90, T-104)
11. Prüfprotokoll elektrische Geräte: Reichen die Spalten für DGUV V3? Stimmen die Richtwerte (Tabelle 1A/1B der Durchführungsanweisung) – besonders der als „unsicher“ markierte Wert für Fehlerstrom-Schutzschalter? Darf die App den nächsten Termin aus dem Richtwert ausrechnen? (T-61)

### Katalog (C) und Risikoskala (D)

12. Stimmen Auslöser und Fristen der Arbeitsschutz-Pflichten? Besonders: Unfallanzeige wird bei jedem gemeldeten Arbeitsunfall ausgelöst statt erst ab mehr als drei Tagen Arbeitsunfähigkeit; Ersthelfer ab zwei Versicherten („Versicherte oder Beschäftigte?“); Bezugstag „vor Arbeitsbeginn“ ist der Tag davor. (T-21, G-14, `regelwerte-arbeitsschutz.csv`)
13. Betreuung nach ASiG/DGUV V2: Ist der Katalogtext zur Regelbetreuung und zum Unternehmermodell für Kleinbetriebe richtig, und was soll die App Betrieben ohne jede Betreuung sagen?
14. Genügt die Skala gering/mittel/hoch mit Definition, oder braucht es eine anerkannte Methode (z. B. Risikomatrix nach Nohl)? Ist die Vorbelegung „mittel“ vertretbar oder soll das Feld leer starten? (T-19)

### Arbeitsmedizin (für die Betriebsärztin / den Betriebsarzt)

15. Sind die Vorsorgeanlässe in Bausteinen und Katalog richtig zugeordnet – Feuchtarbeit, Mehlstaub, Lärm, Nachtarbeit (§ 6 Abs. 3 ArbZG), Nachuntersuchung Jugendlicher (§ 33 JArbSchG) –, und fehlen für die Branchen typische Anlässe der ArbMedVV (z. B. Tätigkeiten mit Biostoffen in Praxen und Kosmetik, Hautkontakt mit Friseurchemikalien)? (Katalog E.56)

## Nicht Gegenstand dieser Prüfung

- **Rechtliches:** Das hat Rechtsanwalt Dr. Weber geprüft (Prüfbericht vom 21.10.2026): Gefährdungsbeurteilung im Abgleich mit ArbSchG, MuSchG und JArbSchG, RDG, Nutzungsbedingungen, Datenschutz. Sein Bericht hält ausdrücklich fest, dass die fachliche Freigabe der Bausteine (Risikobewertung, Grenzwerte) zur Fachkraft für Arbeitssicherheit gehört und nicht zur Anwältin; die Kennzahlen müssten je Baustein mit Quelle freigegeben werden (T-62). Gefahrstoff-Bausteine und Prüfprotokoll Elektro hat er an die Fachkraft für Arbeitssicherheit bzw. Elektrofachkraft verwiesen. Seine rechtlichen Ergänzungen (Spalte „bis wann“, Information nach § 14 Abs. 2 MuSchG, Abschnitt Jugendliche, leeres Blatt mit den sechs Faktoren) sind umgesetzt.
- Lebensmittelhygiene (HACCP, Hygieneplan für Lebensmittelbetriebe, Allergene, Belehrung nach § 43 IfSG) – eigene Prüfmappe. Der Hygieneplan für Beauty-Betriebe (Infektionshygiene nach den Hygieneverordnungen der Länder) ist ebenfalls nicht Teil dieser Mappe.
- Steuern, Buchhaltung, Lohn; Datenschutz; Technik der App.

Wenn Ihnen dabei trotzdem etwas auffällt, nehmen wir jeden Hinweis gern.

## Was wir nach der Prüfung ändern

- **Bausteine aus der Recherche:** Korrekturen gehen in die Druckfassung von `bausteine.ts` (Korrekturliste in `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs`, die Recherche selbst bleibt unverändert); die Bausteine aus den Nutzertests ändern wir in `arbeitsschutz.ts`. Freigegebene Bausteine bekommen die bestätigte Quelle, „fachlich zu prüfen“ und „Nutzertest“ entfallen; gestrichene Bausteine verschwinden aus der App.
- **Vorlagen:** Strukturänderungen setzen wir in den Vorlagen um und prüfen die PDFs erneut mit `werkzeuge/dokumente-pruefen.mjs`.
- **Katalog:** Geprüfte Pflichten bekommen `pruefung.status: geprueft`, `geprueft_von`, `geprueft_am` – die App zeigt dann nicht mehr „noch nicht von Fachleuten geprüft“.
- Jede Anmerkung wird in `ENTSCHEIDUNGEN.md` dokumentiert und in `PRUEFLISTE.md` mit Datum und Prüfer als erledigt markiert (vor allem T-18 bis T-21, T-56, T-61, T-62, T-90, T-121).
