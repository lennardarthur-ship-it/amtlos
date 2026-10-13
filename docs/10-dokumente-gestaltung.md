# 10 · Gestaltung der Dokumente (E-130)

Stand: 2026-10-13 · Quelle: `packages/fachlogik/src/dokumente/html.ts`, Schriften in `apps/mobile/assets/schriften`

## Wofür die Dokumente da sind

Ein Dokument aus Amtlos geht an eine Kundin, ans Finanzamt, an eine Prüferin der Berufsgenossenschaft, an eine neue Mitarbeiterin – oder hängt an der Wand im Salon. Es muss in jedem dieser Fälle **ernst genommen** werden und **ohne Erklärung** lesbar sein. Es wirbt für nichts. Das Vorbild ist nicht die Software-Oberfläche, sondern das gut gemachte deutsche Amts- und Kanzleidokument: Vordrucke mit Feldnummern, Gesetzestexte mit Randnummern, Betriebsanweisungen mit Farbleiste, der Geschäftsbrief nach DIN 5008.

Fünf Leser, sechs Gestalten:

| Gestalt | Leser | Vorlagen | Was sie besonders macht |
|---|---|---|---|
| **Brief** | Kundschaft | Rechnung, Stornorechnung | DIN 5008 Form B: Fensteranschrift, Informationsblock, Betreff; Zahlungsblock mit GiroCode (EPC-QR); Geschäftsangaben in der Fußzeile jeder Seite |
| **Vertrag** | Vertragspartner, Beschäftigte | Nachweis der Arbeitsbedingungen, AVV, Belehrung § 43 IfSG | Parteien in zwei Spalten, Paragrafen bzw. Randnummern, Serifenschrift im Blocksatz, Unterschriftenraster mit Ort und Datum |
| **Aushang** | alle im Betrieb, aus 1–2 m Entfernung | Hygieneplan, Hautschutzplan, Allergenliste, Betriebsanweisung | Großer Titel, Farbleiste, 11-pt-Tabellen, keine Kleinangaben außer Stand und Verantwortlich; Betriebsanweisung im Aufbau der DGUV Information 211-010 |
| **Nachweis** | Prüfer, Behörde, man selbst | Gefährdungsbeurteilung, Unterweisung, KI-Schulung, Gefahrstoffverzeichnis, Prüfprotokoll, Arbeitszeit, Lohnkonto, Kassenbuch, Eigenkontrollen, Datenpanne, Personalfragebogen | Kennungsleiste (Rechtsgrundlage, Stand, Verantwortlich, Nummer); **Randspalte** mit Abschnittsnummer und Rechtsgrundlage; Tabellen mit Zeilenlinien, Summen abgesetzt |
| **Formular** | man selbst beim Übertragen ins amtliche Formular | Gewerbeanmeldung, Handelsregister, Transparenzregister, Kassenmeldung, USt-Voranmeldung, Steuererklärung, EÜR, Bilanz | Feldraster mit Feldnummern, Werte in Kästen, Kennzahlen (USt-VA: Kz 81, 86, 66, 83) und Übertragungsvermerk |
| **Handbuch** | Prüfer, Aufsicht, Betroffene | Verfahrensdokumentation, Verzeichnis der Verarbeitungen, Datenschutzinformation, Datenschutzerklärung, Impressum, Aufbewahrungsplan | Lesetext in Serifenschrift, Randspalte mit Gliederungsnummern, Inhaltsübersicht ab fünf Abschnitten, mehrseitig gedacht |

## Das eine prägende Element: die Randspalte

Bei Nachweis, Vertrag und Handbuch stehen Abschnittsnummer und Rechtsgrundlage **links neben** dem Text in einer 24 mm breiten Randspalte – wie Randnummern in einem Gesetzeskommentar. Der Text beginnt rechts davon. So sieht man beim Blättern sofort die Gliederung, und jeder Abschnitt trägt seine Grundlage bei sich. Nichts anderes im Dokument ist auffällig: keine Karten, keine Schatten, keine Symbole, keine Verläufe.

## Farbe

| Token | Wert | Verwendung |
|---|---|---|
| Tinte | `#1a1f24` | Text |
| Tinte 2 | `#4a535c` | Beschriftungen, Nebentext (≥ 7:1 auf Weiß) |
| Tinte 3 | `#7a838c` | Feldnummern, Randnummern, Fußzeile |
| Linie | `#c9d0d6` | Tabellenlinien, Trennstriche |
| Linie leise | `#e4e8eb` | Zeilen in Angabenlisten |
| Hausfarbe | aus „Mein Betrieb“, Standard Graphit `#2f3a45` | Kopfzeile, Randnummern, Summenlinie, Farbleiste im Aushang |
| Hausfarbe Hauch | 8 % der Hausfarbe auf Weiß | Kennungsleiste, Zahlungsblock, Formular-Abschnittsköpfe |
| Papier | `#ffffff` | Blatt |

Acht Hausfarben stehen zur Wahl (Graphit, Marineblau, Petrol, Tannengrün, Bordeaux, Rostbraun, Aubergine, Oliv). Alle sind dunkel genug für weiße Schrift (Kontrast ≥ 7:1) und bleiben im Schwarz-Weiß-Druck unterscheidbar grau. Die Betriebsanweisung für Gefahrstoffe nutzt zusätzlich die übliche orange Kennfarbe der DGUV-Muster.

## Schrift

- **Amtlos Sans** (Source Sans 3, OFL) für alles Strukturelle: Kopfzeilen, Beschriftungen, Tabellen, Formulare, Aushänge.
- **Amtlos Serif** (Source Serif 4, OFL) für Lesetext in Vertrag und Handbuch.
- Beide sind eingebettet; das PDF sieht auf jedem Gerät gleich aus. Source Sans und Source Serif sind dieselbe Familie, aus der die Hausschrift des Bundes abgeleitet ist – die Dokumente wirken dadurch wie bessere Amtsdokumente, nicht wie Software.
- Skala in pt: 6,8 (Feldnummern, Fußzeile) · 7,6 (Beschriftungen) · 8,6 (Tabellen) · 9,6 (Text) · 10,4 (Aushang-Text) · 11 (h3) · 12,5 (h2) · 15 (Unterzeile) · 20 (Titel) · 26 (Aushang-Titel).
- Zeilenabstand 1,45 (Sans), 1,55 (Serif). Ziffern in Tabellen als Tabellenziffern, rechtsbündig.
- Zeilenlänge bei Lesetext höchstens 80 Zeichen (Randspalte macht die Spalte schmaler).

## Seite

- A4, Ränder je Gestalt (siehe `RAENDER`), Brief nach DIN 5008 Form B mit Falz- und Lochmarken.
- Fußzeile setzt die App nach dem Drucken auf jede Seite: beim Brief die Geschäftsangaben in Spalten, sonst „Betrieb · Dokument“ links und „Stand · Seite x von y“ rechts; ab Seite 2 zusätzlich eine kleine Kopfzeile mit dem Dokumentnamen.
- Tabellenköpfe wiederholen sich auf Folgeseiten; Unterschriften, Summen und einzelne Einträge werden nicht getrennt.
- Leere Angaben zeigen eine Linie zum Ausfüllen – ein Dokument aus Amtlos ist auch halb ausgefüllt ein brauchbares Formular.

## Was absichtlich fehlt

Symbole und Piktogramme (keine Lizenz- und Deutungsfragen), Rahmen um jeden Block, Farbverläufe, Schatten, mehr als eine Hausfarbe, Großbuchstaben-Beschriftungen, Icons vor Überschriften, Aufzählungen mit Punkten in Tabellen, Werbetexte.
