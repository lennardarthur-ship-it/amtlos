# 10 · Gestaltung der Dokumente (E-130)

Stand: 2026-10-20 · Quelle: `packages/fachlogik/src/dokumente/html.ts`, Schriften in `apps/mobile/assets/schriften`

## Wofür die Dokumente da sind

Ein Dokument aus Amtlos geht an eine Kundin, ans Finanzamt, an eine Prüferin der Berufsgenossenschaft, an eine neue Mitarbeiterin – oder hängt an der Wand im Salon. Es muss in jedem dieser Fälle **ernst genommen** werden und **ohne Erklärung** lesbar sein. Es wirbt für nichts. Das Vorbild ist nicht die Software-Oberfläche, sondern das gut gemachte deutsche Amts- und Kanzleidokument: Vordrucke mit Feldnummern, Gesetzestexte mit Randnummern, Betriebsanweisungen mit Farbleiste, der Geschäftsbrief nach DIN 5008.

Fünf Leser, sechs Gestalten:

| Gestalt | Leser | Vorlagen | Was sie besonders macht |
|---|---|---|---|
| **Brief** | Kundschaft | Rechnung, Stornorechnung | DIN 5008 Form B: Fensteranschrift, Informationsblock, Betreff; Zahlungsblock mit GiroCode (EPC-QR); Geschäftsangaben in der Fußzeile jeder Seite |
| **Vertrag** | Vertragspartner, Beschäftigte | Nachweis der Arbeitsbedingungen, AVV, Belehrung § 43 IfSG | Parteien in zwei Spalten (beide Anschriften mehrzeilig), Paragrafen bzw. Randnummern, Serifenschrift im Flattersatz, Unterschriftenraster mit Ort und Datum; im Nachweis stehen aufeinanderfolgende kurze Punkte (Beginn, Befristung, Arbeitsort …) als Angabenzeilen unter einer Randnummer („2.–6.“) |
| **Aushang** | alle im Betrieb, aus 1–2 m Entfernung | Hygieneplan, Hautschutzplan, Allergenliste, Betriebsanweisung | Großer Titel, Farbleiste, Tabellen mindestens 10,5 pt (erste Spalte 12 pt halbfett), keine Kleinangaben außer Stand und Verantwortlich, kein Bereich der App im Kopf; Betriebsanweisung im Aufbau der DGUV Information 211-010 |
| **Nachweis** | Prüfer, Behörde, man selbst | Gefährdungsbeurteilung, Unterweisung, KI-Schulung, Gefahrstoffverzeichnis, Prüfprotokoll, Arbeitszeit, Lohnkonto, Kassenbuch, Eigenkontrollen, Datenpanne, Personalfragebogen | Kennungsleiste (Rechtsgrundlage, Stand, Verantwortlich, Nummer); **Randspalte** mit Abschnittsnummer und Rechtsgrundlage; Listentabellen über die ganze Breite (auch über die Randspalte), Zeilenlinien, Summen abgesetzt |
| **Formular** | man selbst beim Übertragen ins amtliche Formular | Gewerbeanmeldung, Handelsregister, Transparenzregister, Kassenmeldung, USt-Voranmeldung, Steuererklärung, EÜR, Bilanz | Feldraster mit Feldnummern, Werte in Kästen, Kennzahlen (USt-VA: Kz 81, 86, 66, 83) und Übertragungsvermerk |
| **Handbuch** | Prüfer, Aufsicht, Betroffene | Verfahrensdokumentation, Verzeichnis der Verarbeitungen, Datenschutzinformation, Datenschutzerklärung, Impressum, Aufbewahrungsplan | Lesetext in Serifenschrift, Randspalte mit Gliederungsnummern, Inhaltsübersicht ab fünf Abschnitten, mehrseitig gedacht |

## Das eine prägende Element: die Randspalte

Bei Nachweis, Vertrag und Handbuch stehen Abschnittsnummer und Rechtsgrundlage **links neben** dem Text in einer 24 mm breiten Randspalte – wie Randnummern in einem Gesetzeskommentar. Der Text beginnt rechts davon. So sieht man beim Blättern sofort die Gliederung, und jeder Abschnitt trägt seine Grundlage bei sich. Nichts anderes im Dokument ist auffällig: keine Karten, keine Schatten, keine Symbole, keine Verläufe.

## Farbe

| Token | Wert | Verwendung |
|---|---|---|
| Tinte | `#1a1f24` | Text |
| Tinte 2 | `#4a535c` | Beschriftungen, Nebentext, Feldnummern im Formular (≥ 7:1 auf Weiß) |
| Tinte 3 | `#5c666f` | Rechtsgrundlagen in der Randspalte (5,9:1 auf Weiß; früher `#7a838c` mit 3,85:1 zu hell) |
| Linie | `#c9d0d6` | Tabellenlinien, Trennstriche |
| Linie leise | `#e4e8eb` | Zeilen in Angabenlisten |
| Hausfarbe | aus „Mein Betrieb“, Standard Graphit `#2f3a45`; zu helle Farben werden auf ≥ 4,5:1 zu Weiß abgedunkelt (`akzent()`, z. B. `#c27c0e` → `#a3680c`) | Kopfzeile, Randnummern, Linien unter Tabellenköpfen und Zwischensummen, Farbleiste im Aushang – nicht die Linie über dem Rechnungsbetrag (Tinte) |
| Hausfarbe Hauch | 8 % der Hausfarbe auf Weiß | Kennungsleiste, Zahlungsblock, Formular-Abschnittsköpfe |
| Papier | `#ffffff` | Blatt |

Acht Hausfarben stehen zur Wahl (Graphit, Marineblau, Petrol, Tannengrün, Bordeaux, Rostbraun, Aubergine, Oliv). Alle sind dunkel genug für weiße Schrift (Kontrast ≥ 7:1) und bleiben im Schwarz-Weiß-Druck unterscheidbar grau. Eine eigene Farbe (#rrggbb) wird bei gleichem Farbton und gleicher Sättigung so weit abgedunkelt, bis sie 4,5:1 zu Weiß erreicht. Die Betriebsanweisung für Gefahrstoffe nutzt zusätzlich die orange Kennfarbe der DGUV-Muster, abgedunkelt auf `#c2540a` (weiße Schrift 4,6:1); auch die Aufzählungspunkte in den Kästen stehen in dieser Kennfarbe.

## Schrift

- **Amtlos Sans** (Source Sans 3, OFL) für alles Strukturelle: Kopfzeilen, Beschriftungen, Tabellen, Formulare, Aushänge.
- **Amtlos Serif** (Source Serif 4, OFL) für Lesetext in Vertrag und Handbuch.
- Beide sind eingebettet; das PDF sieht auf jedem Gerät gleich aus. Source Sans und Source Serif sind dieselbe Familie, aus der die Hausschrift des Bundes abgeleitet ist – die Dokumente wirken dadurch wie bessere Amtsdokumente, nicht wie Software.
- Skala in pt: 7,2 (Rechtsgrundlage in der Randspalte, Fußzeile) · 7,4 (Feldnummern, halbfett) · 7,6 (Beschriftungen) · 8,6 (Tabellen) · 9,6 (Text) · 10,4 (Aushang-Text, h3) · 10,5 (Aushang-Tabellen) · 11 (Unterzeile) · 12,5 (h2) · 20 (Titel) · 26 (Aushang-Titel).
- Brief (Rechnung): Text 10 pt, Positionstabelle 9,2 pt (Kopf 7,8 pt), Informationsblock 8,5 pt, Betreff 13 pt halbfett, Rechnungsbetrag 12 pt; Fußzeile 7,2 pt (bei mehr als fünf Zeilen 6,8 bzw. 6,4 pt).
- Formularwerte in Regular 9,8 pt (ein Medium-Schnitt ist nicht eingebettet; Halbfett wirkte wie lauter Überschriften).
- Zeilenabstand 1,45 (Sans), 1,55 (Serif). Ziffern in Tabellen als Tabellenziffern, rechtsbündig. Negative Beträge mit typografischem Minus (−, U+2212); maschinenlesbare Ausgaben (DATEV, CSV, Steuerberater-Paket) formatieren selbst mit Bindestrich.
- Flattersatz in Vertrag und Handbuch (Chromium trennt ohne Wörterbuch nicht deutsch; Blocksatz risse Lücken).
- Feste Leerzeichen (`festeLeerzeichen()`): Zahl und Einheit, „§ 622 Abs. 2“, „Art. 6 Abs. 1 lit. b DSGVO“, „je/pro/à“ und das folgende Wort; in der schmalen Randspalte nur die kurzen Verbindungen, sonst entstünden zu lange untrennbare Ketten.
- Zeilenlänge bei Lesetext höchstens 80 Zeichen (Randspalte macht die Spalte schmaler).

## Seite

- A4, Ränder je Gestalt (siehe `RAENDER`), Brief nach DIN 5008 Form B mit Falz- und Lochmarken. Beim Brief ist der rechte Druckrand 10 mm; Text und Informationsblock (125–190 mm) enden über einen Innenabstand bündig bei 190 mm, ebenso das Logo.
- Kennungsleiste erst ab zwei Angaben als Band; mit nur einer (meist der Rechtsgrundlage) eine kleine Zeile unter dem Titel. Die Unterzeile entfällt, wenn derselbe Wert schon in der Leiste steht. Kein Element darf über den Satzspiegel ragen – Chromium verkleinert sonst das ganze Blatt, iOS schneidet ab.
- Rechnung: Informationsblock in der Reihenfolge Rechnungsnummer, Leistungsdatum, Steuernummer, USt-IdNr., Ansprechperson, Telefon, E-Mail, Leerzeile, Rechnungsdatum (halbfett). Spalten 5/47/13/13/7/15 % (Kleinunternehmer 5/54/13/13/15 %), der Summenblock beginnt an der Mengenspalte. Der Zahlungsblock (GiroCode 25 mm samt Ruhezone von 4 Modulen, „Empfänger: Betrieb (Inhaber/in)“ vor der IBAN) bleibt bei den Summen und bricht nicht; nur Hinweise und Gruß dürfen als Block auf eine Folgeseite rücken. Die Anrede ist wählbar (Standard „Sehr geehrte Damen und Herren“).
- Brief: Die Anschriftzone fasst bis 6 Zeilen in 10 pt; längere Anschriften werden in 9 bzw. 8 pt gesetzt, nie gekürzt. Was dann noch nicht passt, schiebt den Betreff nach unten (statt ihn zu überdecken). Informationsblock und Anschrift stehen im Fluss nebeneinander.
- Fußzeile setzt die App nach dem Drucken auf jede Seite: beim Brief die Geschäftsangaben in Spalten, sonst „Betrieb · Dokument“ links und „Stand · Seite x von y“ rechts, bündig mit dem Satzspiegel der Gestalt (die Ränder stehen in der Meta-Angabe `amtlos-raender`; Aushang 14 mm, Nachweis/Formular 18 mm, die Aushang-Fußzeile 7 mm über der Blattkante); ab Seite 2 bei allen Gestalten eine kleine Kopfzeile mit dem Dokumentnamen.
- Die Geschäftsangaben im Brief werden **nie gekürzt** (Pflichtangaben nach § 35a GmbHG, § 37a HGB): Spaltenbreiten richten sich nach dem Inhalt, lange Zeilen brechen um, ab sechs Zeilen wird die Schrift kleiner (6,8 bzw. 6,4 pt) und der Block rückt nach oben; passt die Seitenzahl dann nicht mehr darüber, steht sie oben rechts.
- Tabellenköpfe wiederholen sich auf Folgeseiten; Überschriften, Tabellenzeilen, Summen und die Bilanz werden nicht getrennt. Lange Einträge (z. B. eine Verarbeitungstätigkeit) dürfen umbrechen, nur ihre Überschrift bleibt beim Text.
- Unterschriften stehen nie allein auf einer Seite: `dokument()` fasst den Unterschriftsblock mit dem kurzen Text davor (Erklärung, Hinweis, Notruf, kurzer letzter Abschnitt) bzw. mit der letzten Zeile einer Listentabelle zu einem Schlussblock zusammen.
- Bilanz: eine Tabelle Aktiva | Passiva – gleiche Zeilenhöhen, die Summen auf einer Linie mit 3-pt-Doppellinie. Kennzahlentabellen ohne Kennzahl (GuV-Ergebnis) haben keine leere Kennzahlspalte.
- Aushänge mit viel Text (Hygiene-, Hautschutzplan, ab ca. 1.800 Zeichen) werden kompakter gesetzt, nie unter 9,6 pt. Die Betriebsanweisung wird ab ca. 15 Textzeilen kompakt (gemessen an den Szenario-Dokumenten). Die Allergenliste ist eine Matrix: eine Zeile je Speise, eine Spalte je Allergen mit Kennbuchstaben A–N (Reihenfolge Anhang II LMIV), ● = enthalten; die Zuordnung der Buchstaben steht unter der Matrix und als erste Spalte der Erläuterung.
- Lohnkonto: ein Querformatblatt für Stammdaten (drei Spalten) und zwölf Monate; leere Zellen und ganz leere Spalten (auch in der Summe) zeigen „–“.
- Leere Angaben zeigen eine Linie zum Ausfüllen – ein Dokument aus Amtlos ist auch halb ausgefüllt ein brauchbares Formular.
- Prüfung: `node apps/mobile/werkzeuge/dokumente-pruefen.mjs` druckt alle Vorlagen (Startwerte und volle Listen) mit Chromium und meldet Überlauf über den Satzspiegel, Seiten nur mit Unterschrift und mehrseitige Aushänge.

## Offene Entscheidungen

- **GHS-Piktogramme in der Betriebsanweisung:** Die TRGS 555 sieht Gefahrenpiktogramme in der Betriebsanweisung vor; die Regel „keine Symbole“ (unten) schließt sie bisher aus. Bewusst offen – zu entscheiden mit Lizenz der Piktogramme und fachlicher Abnahme (PRUEFLISTE).
- **Übertrag bei mehrseitigen Rechnungen:** Zwischensumme am Seitenende und „Übertrag“ oben auf der Folgeseite setzen voraus, dass bekannt ist, welche Position auf welcher Seite landet. Das HTML kennt keine Seiten, und expo-print liefert keine Rückmeldung zum Umbruch; ohne zweiten Durchlauf mit Messung nicht sauber machbar. Bis dahin: Tabellenkopf und Dokumentname wiederholen sich auf Folgeseiten.
- **EÜR-Zeilennummern:** Die Kennzahlenkästen der EÜR bleiben ohne Nummer, solange die Zeilen der Anlage EÜR nicht im Katalog belegt sind.

## Was absichtlich fehlt

Symbole und Piktogramme (keine Lizenz- und Deutungsfragen), Rahmen um jeden Block, Farbverläufe, Schatten, mehr als eine Hausfarbe, Großbuchstaben-Beschriftungen, Icons vor Überschriften, Werbetexte. Aufzählungen in Tabellenzellen gibt es nur, wo eine Zelle mehrere Maßnahmen nennt (Gefährdungsbeurteilung, `zellePunkte()`) – eine einzelne Zeile steht ohne Punkt.
