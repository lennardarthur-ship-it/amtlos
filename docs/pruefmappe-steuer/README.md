# Prüfmappe für die steuerliche Prüfung

Stand: Oktober 2026. Diese Mappe ist für eine Steuerberaterin oder einen Steuerberater mit Erfahrung in **Finanzbuchhaltung mit DATEV Kanzlei-Rechnungswesen**, **Umsatzsteuer** und **Kassenführung/GoBD** kleiner Betriebe. Sie soll den Prüfauftrag eingrenzen und damit die Kosten planbar machen. Die rechtliche Prüfung (Arbeitsrecht, Datenschutz, RDG, Nutzungsbedingungen) hat Dr. Weber übernommen; sie ist hier nicht Gegenstand.

Anbieter: Lang Ventures UG (haftungsbeschränkt) i. G., Reutlingen. App: **Betriebsklar** (iPhone).

## Was Betriebsklar ist

Eine iPhone-App für kleine Betriebe in Deutschland (Café, Salon, Handwerk, Praxis, Laden, Freiberufler). Sie zeigt aus einem festen Katalog, welche Pflichten nach den Angaben des Betriebs in Frage kommen, bietet Vorlagen zum Ausfüllen und – für diese Prüfung wichtig – führt die laufenden Unterlagen eines Kleinbetriebs:

1. **Rechnungen** mit Pflichtangaben, Storno (Rechnungskorrektur), Gutschrift, Abschlagsrechnung, Skonto, GiroCode und **E-Rechnung** (XRechnung 3.0 in UBL, von der App selbst erzeugt; empfangene XRechnungen und ZUGFeRD-Rechnungen werden beim Beleg eingelesen). Festschreibung beim ersten Teilen/Drucken, danach nur Storno.
2. **Belege** (Foto, PDF, E-Rechnung) mit Kategorie in Alltagssprache, Steuersatz, Vorsteuer-Schalter, Zahlungsweg und Zahltag; § 13b-Kennzeichen; feste Belegnummern, Festschreiben nach Paket/Voranmeldung, Änderungsprotokoll.
3. **Kasse** (seit E-155): Tagesabschluss aus dem Z-Bon (Umsatz je Steuersatz, Kartenanteil, Entnahmen/Einlagen), Festschreibung, Korrektur nur mit Grund, Kassenbuch nur lesbar mit Fassungen, Kassensturz mit Zählprotokoll, Kassendifferenzen, Kartentrinkgeld, Einzweck-/Mehrzweck-Gutscheine, bar kassierte Rechnungen, Sachentnahmen. Kassenbericht (retrograd) nur bei offener Ladenkasse.
4. **Übertragungshilfen**: Umsatzsteuer-Voranmeldung „aus Rechnungen übernehmen“ (Soll nach Leistungsdatum, Ist nach Zahlungseingang, dazu Kassenumsätze), EÜR „aus Rechnungen und Belegen übernehmen“, Unterlagen zur Steuererklärung, Bilanz/GuV als Vorlage. Die Zahlen überträgt der Nutzer selbst in ELSTER.
5. **Steuerberater-Paket** (Export für die Kanzlei, als ZIP über das Teilen-Menü): DATEV-Buchungsstapel (EXTF, SKR03 oder SKR04, mit Berater- und Mandantennummer), dieselben Buchungen als lesbare Liste, Rechnungs-, Beleg- und Kassenlisten (CSV), Belege im Original, XRechnungen, Änderungsprotokoll, `LIESMICH.txt` und `Fragen_*.txt` (nur Sachverhalte aus den Daten, keine Bewertung).

**Was die App nicht tut:** keine Übermittlung an ELSTER (kein ERiC in der App; die direkte Übermittlung ist nur ein Konzept, PRUEFLISTE T-05/T-71/J-1), keine Zahlungsbuchungen vom Bankkonto, keine AfA, keine Lohnabrechnung, keine OSS-Erklärung, keine Zusammenfassende Meldung.

**Daten:** Alles bleibt auf dem Gerät (verschlüsselte Ablage). Betriebsklar sieht keine Nutzerdaten. Das Paket verlässt das Gerät nur, wenn der Nutzer es selbst an die Kanzlei schickt.

## Inhalt der Mappe

| Datei / Ordner | Inhalt |
|---|---|
| `vorlagen/*.pdf` | Steuerliche Vorlagen in drei Fassungen (leer, Beispiel mit Auswahl, voll ausgefüllt): Rechnung, EÜR, Bilanz/GuV, USt-Voranmeldung, Unterlagen zur Steuererklärung, Verfahrensdokumentation, Kassenbuch, Kassenmeldung (§ 146a Abs. 4 AO), Aufbewahrungsplan, Lohnkonto, Personalfragebogen (SV-Meldedaten). Dazu je ein Beispiel Stornorechnung, Gutschrift und Abschlagsrechnung aus den Szenarien |
| `szenarien/UEBERSICHT.md` | Ergebnis des Laufs: Prüfungen je Szenario, alle Abweichungen im Wortlaut, KoSIT-Ergebnis |
| `szenarien/<n>-<name>/SZENARIO.md` | Betrieb, alle Eingaben, **unabhängig gerechnete Erwartungswerte**, Vergleich App ↔ Erwartung, Auffälligkeiten |
| `szenarien/<n>-<name>/steuerberater-pakete/*.zip` | Die Pakete, wie die Kanzlei sie bekäme (Jahr und ein Monat/Quartal): `EXTF_Buchungsstapel_*.csv`, `Buchungsliste_*.csv`, `Rechnungen_*.csv`, `Belege_*.csv`, ggf. `Kassenabschluesse_*.csv`, `Gutschriften_*.csv`, `Aenderungsprotokoll_*.csv`, `Belege/`, `E-Rechnungen/`, `LIESMICH.txt`, `Fragen_*.txt` |
| `szenarien/<n>-<name>/pdf/` | USt-Voranmeldungen, EÜR bzw. Bilanz/GuV, Unterlagen zur Steuererklärung, Kassenbuch, Kassenmeldung, Lohnkonten, Personalfragebögen, Verfahrensdokumentation, Aufbewahrungsplan des Szenarios |
| `szenarien/<n>-<name>/rechnungen/` | Alle Ausgangsrechnungen des Jahres als PDF und XRechnung |
| `katalog-steuer.csv` | Pflichten der Kategorie `steuern` sowie Lohn/Sozialversicherung (`personal.*`) und die steuerlichen Gründungs- und Abschlusspflichten – gleiche Spalten wie die Anwalts-Mappe |
| `regelwerte-steuer.csv` | Regelwerte (Grenzen, Sätze, Fristen) der Bereiche Steuern und Personal mit offenen Punkten |
| `PRUEFLISTE-steuer.md` | Alle Punkte der Prüfliste mit „StB“ in der Spalte „Wer“, nach Thema; Anhang: offene Katalogpunkte |
| `konten.md` | Alle DATEV-Konten und BU-Schlüssel der App (SKR03/SKR04) mit Zweck und Markierung „UNSICHER“ aus dem Code |
| `kontenvorgaben.md` | Kontenvorgaben der Kanzlei: welche Konten die Kanzlei abweichend vorgeben kann, Standardkonten, Dateiformat der JSON-Datei für den Import in die App |

`node docs/pruefmappe-steuer/erzeugen.mjs <ziel>` erzeugt die Mappe neu aus dem aktuellen Code (mit `KOSIT=<ordner>` zusätzlich die KoSIT-Prüfung der XRechnungen). Nicht enthalten sind die übrigen Szenario-Unterlagen (Arbeitsschutz, Datenschutz, Seitenbilder) – sie liegen in der Anwalts-Mappe bzw. im Szenario-Lauf.

## Die sechs Szenarien

Jedes Szenario ist ein vollständiges Geschäftsjahr 2026, erzeugt mit denselben Funktionen wie die App. Alle Namen, Steuer- und Kontonummern sind erfunden.

| Szenario | Betrieb | Was es abdeckt |
|---|---|---|
| `1-cafe` | Café Morgenrot, Einzelunternehmen, Leipzig, Soll, vierteljährlich, EÜR, 2 Beschäftigte | **Kasse mit TSE**: 313 Tagesabschlüsse, 7 %/19 %, Kartenanteil über Geldtransit, **Kartentrinkgeld**, **Einzweck-/Mehrzweck-Gutscheine**, **Kassendifferenz** laut Zählung, Korrektur mit Grund, bar kassierte Rechnung, Skonto auf einen Beleg; Storno über den Quartalswechsel; igL nach Österreich |
| `2-salon-gmbh` | Salon Sonne GmbH, Ist-Versteuerung, monatlich, Bilanz (Kleinstkapitalgesellschaft) | **Kapitalgesellschaft**: Bilanz/GuV statt EÜR, Ist-Stapel ohne OPOS, privat ausgelegter Beleg einer Geschäftsführerin (nicht im Stapel), monatliche Voranmeldungen, Kassenmeldung |
| `3-freiberuf` | Mira Lindqvist Grafikdesign, **freier Beruf, Kleinunternehmerin** (§ 19 UStG), EÜR nach Zufluss | Kleinunternehmer-Hinweis, § 13b auf Leistungen aus dem EU-Ausland (Adobe, Irland) trotz KU, Rechnungen an B2B-EU und Drittland, **Gutschrift**, Storno, AfA von Hand |
| `4-shop` | Kerzenwerk Lina Hoff, Onlineshop, Soll, monatlich | **OSS** (Fernverkäufe AT/NL/FR/BE), **igL**, § 13b für Shop-System und Stripe aus Irland, Kassenbuch (offene Ladenkasse am Weihnachtsmarkt), Shop-Umsätze außerhalb der App |
| `5-praxis` | Physiotherapie am Markt, Ist, vierteljährlich, EÜR | **Steuerfreie Heilbehandlungen** (§ 4 Nr. 14 UStG) neben 19 %-Umsätzen, **Vorsteueraufteilung** (vorläufiger Schlüssel 13 %), Umsätze über das Abrechnungszentrum außerhalb der App, § 13b aus Irland |
| `6-elektro` | Elektro Brandt, Handwerk, Soll, vierteljährlich, Bauleistender (§ 13b Abs. 5) | **Skonto** gewährt und erhalten (§ 17 UStG), **§ 13b** ein- und ausgehend (Subunternehmer-Bauleistung), Abschlagsrechnung, Privatkunde mit Grundstücksbezug, Anlage über 800 € |

### Bekannte Abweichungen (Stand dieses Laufs)

Café, Salon und Freiberuf stimmen in allen Prüfungen. Drei Szenarien haben bekannte Abweichungen; der genaue Wortlaut steht in `szenarien/UEBERSICHT.md`:

- **Shop 358 von 360:** Die OSS-Erklärungen beim BZSt für Q3 und Q4 (AT, NL, FR, BE) haben in der App weder eine Vorlage noch eine Pflicht im Pflichten-Check. Produktlücke, kein Rechenfehler – die Erwartungswerte stehen in SZENARIO.md.
- **Praxis 351 von 354:** (1) Nach dem Einlesen einer E-Rechnung für ein Gerät, das nur für steuerfreie Heilbehandlungen genutzt wird, steht der Vorsteuer-Schalter auf „an“ (erwartet: aus, § 15 Abs. 2 Nr. 1 UStG) – der Nutzer muss ihn selbst umstellen. (2, 3) `LIESMICH.txt`/`Fragen` der Pakete Q2 und Jahr erwähnen nicht, dass die Umsätze über das Abrechnungszentrum (Kassenpatienten, Zuzahlungen) außerhalb der App liegen und fehlen.
- **Elektro 433 von 434:** Bei der Rechnung an einen Privatkunden für eine Leistung im Zusammenhang mit einem Grundstück (Gartenbeleuchtung) weist die App nicht auf den fehlenden Aufbewahrungshinweis nach § 14 Abs. 4 Satz 1 Nr. 9, § 14b Abs. 1 Satz 5 UStG hin.

Außerdem bekannt und in SZENARIO.md beschrieben (kein ✗, weil bewusst so gebaut oder Prüfpunkt): Storno über den Quartalswechsel verschiebt die Zahllast zwischen Q2 und Q3 (T-97); USt-Vorauszahlungen und AfA trägt der Nutzer in der EÜR von Hand nach; das Paket ordnet Rechnungen nach Rechnungsdatum, die Voranmeldung nach Leistungsdatum.

## Prüfumfang – Vorschlag

### A. DATEV-Testimport (höchster Nutzen)

Zwei bis drei Jahrespakete in einen **echten Mandanten in DATEV Kanzlei-Rechnungswesen** importieren – Vorschlag: `1-cafe` (SKR03, Kasse, Soll), `2-salon-gmbh` (Ist ohne OPOS, GmbH) und `6-elektro` (Skonto, § 13b). Danach abgleichen:

- Läuft der Stapel ohne Fehler durch? Welche Warnungen? (Format: EXTF, Formatversion 13, Kategorie 21; die 125 Spalten sind aus dem Gedächtnis nachgebaut, gefüllt sind die ersten 14 Felder, Feld 40, 103 „Buchungs GUID“, 115/116.)
- USt-Verprobung bzw. Voranmeldung aus DATEV gegen die Voranmeldungen in `pdf/` und die Erwartungswerte in `SZENARIO.md` (Kz 81, 86, 41, 21, 46/47, 84/85, 66, 67, 83).
- EÜR bzw. GuV aus DATEV gegen die EÜR/Bilanz der App und `SZENARIO.md`.
- Kasse: Saldo Konto 1000 gegen den Endbestand im Kassenbuch (`Kassenabschluesse_*.csv`).

Aufwand nach unserer Schätzung: ein halber bis ein Tag. Ein fehlerfreier Import mit stimmenden Summen ist für uns die wichtigste Aussage.

### B. Kontenzuordnung und BU-Schlüssel

`konten.md` durchsehen: jedes Konto (SKR03 und SKR04), Automatik ja/nein, BU 9/8/40. Vorrangig die als **UNSICHER** markierten Konten (Mehrzweck-Gutscheine 1700/3500, Sachentnahmen 8910/8915 bzw. 4620/4610, Skonto auf igL 8743/4743 und auf § 13b/EU-Leistung 8741/4741) sowie Erlöskonten nach Steuerart (8125, 8336 vs. 8338, 8337), § 13b-Eingangskonten (3120/3123/3140/3143) und das Konto für Kz 87.

### C. Umsatzsteuer (Stichprobe an den Szenario-Rechnungen)

- Rechnungspflichtangaben (§ 14 Abs. 4 UStG), Angaben von Gesellschaften (§ 35a GmbHG), Kleinbetragsrechnung (§ 33 UStDV, bis 250 €)
- Kleinunternehmer nach § 19 UStG n. F. (Grenzen 25.000 € / 100.000 €, Hinweistext, § 13b bei KU)
- Skonto (§ 14 Abs. 4 Satz 1 Nr. 7, § 17 UStG): Angabe auf der Rechnung, Minderung im Zahlungszeitraum, Aufteilung auf Steuersätze
- § 13b ein- und ausgehend; igL, Drittland, OSS
- Gutschrift (§ 14 Abs. 2 Satz 2 UStG), Storno, Abschlagsrechnung
- E-Rechnung: XRechnung 3.0 (UBL) – Steuerkategorien S/Z/E/AE/K/G/O, Storno als Rechnungskorrektur Typ 384, Gutschrift Typ 389, Abschlag Typ 326, Skonto in BT-20. Die XRechnungen der Szenarien Café, Freiberuf und Praxis prüft der KoSIT-Validator (XRechnung 3.0.2), wenn `KOSIT` gesetzt ist; im Lauf für diese Mappe wurden alle akzeptiert (16 + 15 + 11, siehe `UEBERSICHT.md`). Die übrigen drei Szenarien prüfen KoSIT nicht. Fachlich hat die E-Rechnungen noch niemand geprüft.

### D. Kasse und GoBD

Tagesabschluss, Kassenbuch (nur lesbar), Kassenbericht bei offener Ladenkasse, Zählprotokoll, Kassendifferenzen, Trinkgeld, Gutscheine; Verfahrensdokumentation (Vorlage, versioniert, mit Kassenkapitel); Unveränderbarkeit auf dem Gerät ohne Server (Festschreibung, Änderungsprotokoll, Löschen nur 24 Stunden und vor dem Export). Eine simulierte Betriebsprüfung (E-155) kam zu „mit Feststellungen“; die Verwerfung wegen eines bearbeitbaren Kassenbuchs bei offener Ladenkasse und die übrigen Hauptfeststellungen sind behoben. Bitte prüfen Sie, ob das aus Ihrer Sicht trägt – die simulierte Prüfung ersetzt keine echte.

### E. EÜR, Bilanz, Lohnkonto (Stichprobe)

EÜR-Vorlage und Übernahme (Zeilenwortlaut gegen die Anlage EÜR 2026), Bilanz/GuV-Gliederung für Kleinstkapitalgesellschaften, Unterlagen zur Steuererklärung, Lohnkonto (§ 4 LStDV) und Personalfragebogen (DEÜV) – je eine Vorlage in `vorlagen/` und ein ausgefülltes Exemplar aus einem Szenario.

## Fragen an die Prüfung

Verdichtet aus `PRUEFLISTE-steuer.md` (Nummern in Klammern).

### DATEV und Konten

1. Ist der Buchungsstapel importierbar (Kopf, Spaltenzahl, Feld 103 GUID, Felder 115/116, Datum im Kopf als JJJJMMTT)? (T-102, T-117)
2. Sind Automatikkonten und BU-Schlüssel richtig: BU 9/8 auf Aufwandskonten ohne Automatik, BU 40 nur auf Automatikkonten – weist DATEV BU 40 auf anderen Konten ab oder warnt es? (T-102, T-113)
3. Erlöskonten nach Steuerart: igL 8125/4125, EU-Leistung (Kz 21) 8336/4336 oder 8338/4338, § 13b im Inland 8337/4337, Nullsatz (Kz 87)? (T-115)
4. § 13b-Eingangsleistungen auf 3120/3123 bzw. ohne Vorsteuerabzug 3140/3143 (SKR04 5920/5923/5940/5943) – richtig, auch für Kleinunternehmer? (T-115, T-117)
5. Die als UNSICHER markierten Konten (Mehrzweck-Gutscheine, Sachentnahmen, Skonto auf igL/§ 13b) und die Kassendifferenzen (Fehlbetrag 4900/6300, Überschuss als Erlös 19 %) – „mit der Kanzlei abstimmen“ laut Code. (T-118)
6. Ist-Versteuerung: Rechnungen erst mit dem Zahlungseingang im Stapel (Forderungen an Erlöse zum Zahltag), ohne OPOS – löst DATEV das richtig auf? Stornos als einfache Umkehrbuchung statt Generalumkehr – Folgen? (T-117)
7. GmbH: privat ausgelegte Belege eines Gesellschafters stehen nur in der Belegliste, nicht im Stapel (früher Privateinlagen 1890, T-100) – welches Verrechnungskonto soll die App buchen (z. B. SKR03 0755)? Barbelege einer GmbH vor dem ersten Kassenabschluss gehen an Geldtransit – richtig? *(Beantwortet im korrigierten Bericht vom 22.10.2026: SKR03 0731, auch für Barbelege; SKR04-Unterkonto folgt – siehe UMSETZUNG.md.)*

### Umsatzsteuer

8. Rechnung: Pflichtangaben vollständig, auch bei Gesellschaften und Kleinbetragsrechnungen? Verspricht die Kurzbeschreibung („mit allen Angaben, die das Finanzamt verlangt“) zu viel? (T-09, T-58, T-66, T-68)
9. Kleinunternehmer: Wortlaut des Hinweises, Umsatzbegriff für die Grenzüberwachung in der App, Grenze inklusive/exklusive? (T-06, G-06, `regelwerte-steuer.csv`)
10. Skonto: Minderung im Zeitraum der Zahlung, Aufteilung nach dem Verhältnis der Bruttobeträge je Steuersatz, Anpassung der ZM – richtig? (T-118)
11. Storno über den Quartalswechsel: App mindert im Storno-Quartal und zählt die neue Rechnung im Leistungsquartal – nach § 17/§ 14c UStG richtig? (T-97, T-70)
12. Voranmeldung: Kennzahlen gegen den Vordruck 2026, Soll nach Leistungsdatum / Ist nach Zahlungseingang, Steuer aus Cent-Beträgen statt aus vollen Euro, Anzahlungen? (T-08, T-70, T-76, T-88)
13. Gutschrift: Angaben des Leistenden statt des eigenen Betriebs, Kleinunternehmer als Leistender, XRechnung Typ 389? (T-95, T-117)
14. Ausland: E-Rechnung-Kategorien AE/K/E/G/O, Hinweistexte nach § 14a UStG, OSS ohne Vorlage – was muss vor dem Start an Onlinehändler noch rein? (T-72, T-109, Shop-Szenario)
15. E-Rechnung: Rechnungsnummer als Käuferreferenz (BT-10), Steuernummer als Verkäuferkennung (BT-29), Rabattzeilen mit negativer Menge, Storno-Leistungsdatum? (T-07, T-11, T-69, T-81, T-87)
16. Steuerfreie Umsätze mit Vorsteueraufteilung (Praxis): Die App kennt keinen Aufteilungsschlüssel – reicht der Vorsteuer-Schalter je Beleg plus Hinweis? (T-110)

### Kasse, GoBD, Aufbewahrung

17. Reicht die Kassenführung (Tagesabschluss aus Z-Bon mit Festschreibung, Korrektur mit Grund, Kassenbuch nur lesbar, Zählprotokoll; unbare Zahlungen im Verhältnis der Umsätze je Steuersatz aufgeteilt) für GoBD und Kassen-Nachschau? (T-68, T-118)
18. Verfahrensdokumentation: Gliederung ausreichend oder Vierteilung nach GoBD nötig? (T-54, T-95)
19. Aufbewahrung: Fristbeginn, 8 bzw. 10 Jahre, Löschschutz „erst nach Sicherung“ auf dem Gerät – genügt das, oder braucht es eine Sicherung außerhalb des Geräts? (G-21, T-74)

### EÜR, Bilanz, Lohn

20. EÜR: Zeilenwortlaut der Kategorien gegen die Anlage EÜR 2026, EÜR auch für Kapitalgesellschaften erzeugbar (Hinweis nötig?), Bilanz/GuV-Gliederung und Unterschriften (§ 245 HGB)? (T-79, T-93, T-117)
21. Lohnkonto nach § 4 LStDV und Personalfragebogen für die DEÜV-Meldung vollständig? Welche Felder braucht ein Lohnbüro im CSV-Export? (T-61, T-96, T-12)

### Grenze zur Steuerberatung (§ 2 StBerG)

22. Der Prüfbericht von Dr. Weber (21.10.2026) hält fest: Die Berechnung der USt-Voranmeldung aus den Rechnungen braucht den Hinweis „Übertragungshilfe, keine Steuerberatung“; die Kleinunternehmer-Warnung aus den Rechnungsdaten ist „vertretbar, weil rein rechnerisch, aber an der Grenze zur Steuerberatung (§ 2 StBerG)“ und muss als Rechenergebnis erkennbar bleiben. **Heute** heißt die Vorlage im Untertitel „Übertragungshilfe für ELSTER“; der allgemeine Hinweis „keine Rechts- oder Steuerberatung“ steht in der App bei jeder Vorlage, nicht auf dem PDF. Bitte bestätigen oder korrigieren Sie den Wortlaut – für die Voranmeldung, die EÜR-Übernahme, die Kleinunternehmer-Warnung und die `Fragen_*.txt` im Paket („nur Sachverhalte, keine steuerliche Bewertung“). Die direkte ELSTER-Übermittlung (J-1, T-71) ist nicht gebaut.

## Nicht Gegenstand dieser Prüfung

- Alles, was Dr. Weber geprüft hat oder prüft: RDG-Einordnung des Pflichten-Checks, Nutzungsbedingungen und Haftung, Datenschutz der App und der Website, Impressum, NachwG-Nachweis, AVV, Datenschutzinformation, Gefährdungsbeurteilung und die übrigen arbeits- und datenschutzrechtlichen Vorlagen.
- Arbeitsschutz, Lebensmittelhygiene (HACCP, Allergene, Hygieneplan), Gefahrstoffe, Elektroprüfung.
- Katalogpflichten außerhalb von `katalog-steuer.csv` und die Website.
- Technik der App (Verschlüsselung, Synchronisation, Abo).

Wenn Ihnen dabei trotzdem etwas auffällt, nehmen wir jeden Hinweis gern.

## Was wir nach der Prüfung ändern

Jede Anmerkung wird umgesetzt, in `ENTSCHEIDUNGEN.md` dokumentiert und in `PRUEFLISTE.md` mit Datum und Prüfer als erledigt markiert. Geprüfte Pflichten bekommen im Katalog `pruefung.status: geprueft`, `geprueft_von`, `geprueft_am` – die App zeigt dann nicht mehr „noch nicht von Fachleuten geprüft“.
