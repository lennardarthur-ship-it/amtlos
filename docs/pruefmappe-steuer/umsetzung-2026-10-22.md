# Umsetzung des Prüfberichts Heckler und Busch vom 21.10.2026

Stand: 22.10.2026. Die Szenario-Pakete dieser Mappe sind mit dem neuen Stand erzeugt (bitte für den Testimport nach Abschnitt 3.3 diese verwenden).

| Prio | Maßnahme (Abschnitt 10) | Befund | Status |
|---|---|---|---|
| 1 | Belegbuchungen drehen: Zahlungskonto in Feld 7 (Haben), Sachkonto mit BU in Feld 8 | A-1 | umgesetzt (auch Gutschriften, Kassenfehlbeträge) |
| 1 | Feld 103 leer, GUID in Beleginfo 1 (Felder 21/22, „Buchungs-GUID“; Belegfeld 2 hat nur 12 Zeichen), Feld 114 = 0, Stornos mit Generalumkehr (118 = 1) | 3.1 | umgesetzt |
| 1 | Kapitalgesellschaften: Soll-Stapel nach Leistung, offene Forderungen zum 31.12., EÜR gesperrt, Verrechnungskonto Gesellschafter statt 1890/1360 | A-4, B-6, E-4 | umgesetzt. Nachtrag 22.10.2026: Verrechnungskonto SKR03 0731 (statt 0755), SKR04 vorläufig 3560; Zahlungseingänge standardmäßig aus (siehe unten) |
| 1 | Nullsteuersatz: eigene Steuerart, eigenes Erlöskonto (Kz 87), XRechnung Kategorie Z | B-2, C-12 | umgesetzt; Konto 8290/4290 aus Herstellerangaben – bitte bestätigen |
| 1 | Testimport Café, Salon, Elektro nach Protokoll 3.3 | 3.3 | bei Ihnen |
| 2 | Kleinunternehmer: Wareneingang 3200/5200 ohne BU 40 | A-2 | umgesetzt |
| 2 | Konten konfigurierbar (Gutscheine, Kassendifferenz, Verrechnungskonto, Bank statt 1610, Anlagen nach Art, Homeoffice 4288/6348) | B-4, B-9–B-11 | umgesetzt: Seite „Kontenvorgaben der Kanzlei“ + JSON-Import (Format: `kontenvorgaben.md`) |
| 2 | Schlussrechnung mit Abschlagsabzug, Ersatzrechnung im Storno-Zeitraum | C-4, C-6 | umgesetzt |
| 2 | Privatkunden-Schalter mit § 14b-Hinweis, Leitweg-ID (BT-10), Skonto BT-20 eigene Zeile, KoSIT für Salon/Shop/Elektro | C-3, C-13, C-15 | umgesetzt; BT-20 war bereits in eigener Zeile (Test belegt), KoSIT jetzt in allen sechs Szenarien grün |
| 2 | Voranmeldung in vollen Euro, Liste der nach Rechnungsdatum zugeordneten Rechnungen | 5.2 | umgesetzt |
| 2 | OSS als Pflicht mit Frist und Übertragungshilfe; ZM als Pflicht mit Frist | 5.2, C-9 | umgesetzt (OSS-Erlöskonto 8320/4320 mit Land/Satz in Feld 40/41 – Kontenbereich im Nachtrag bestätigt) |
| 2 | Verfahrensdoku: Kasse (TSE, DSFinV-K, Ausfall), ersetzendes Scannen, IKS; Kassenbuch umbenannt | D-9, D-10 | umgesetzt |
| 2 | Vollsicherung außerhalb des Geräts mit Erinnerung und Nachweis | D-11 | umgesetzt (Erinnerung nach 30 Tagen) |
| 2 | Hinweis „Übertragungshilfe, keine Steuerberatung“ auf den PDFs; KU-Warnung als Rechenergebnis | 8 | umgesetzt auf USt-VA, EÜR, Steuererklärung-Unterlagen, Lohnkonto-Übersicht, ZM, OSS – bewusst nicht auf der Bilanz (vom Geschäftsführer unterschrieben, offengelegt) |
| 3 | Personenkonten | A-3 | umgesetzt (Nachtrag 2, E-165): optionale Kontenvorgabe, Standard aus |
| 3 | USt-Zahlungen in der EÜR | E-1 | als Hinweis (Zehn-Tage-Regel) |
| 3 | Bewirtung 30 % nicht abziehbar | E-3 | umgesetzt |
| 3 | Vorsteuer-Teilabzug je Beleg; Schalter nach E-Rechnungs-Import bei steuerfreien Betrieben | 5.2 | umgesetzt (Nachtrag 2, E-165) |
| 3 | Bilanzvorlage: Ertragsteuern, Angaben unter der Bilanz, Unterschriften aller Geschäftsführer; Lohnkonto-Übersicht | E-5, E-7 | umgesetzt |
| 3 | Gutschrift-Nummernkreis, Einheitencodes, AllowanceCharge, BT-30 | B-12, C-14, C-16, C-17 | umgesetzt (Gutschrift-Nummernkreis als Hinweis + getrennte Zählung „GS-“) |
| 3 | Partnermodell: Kammeranfrage, Vertrag ohne Provision und Exklusivität | 8 | vorbereitet (Funktion verborgen), Kammeranfrage folgt |

Offene Fragen an Sie (Stand Nachtrag): SKR04-Gegenstück zu 0731 (Verrechnungskonto Gesellschafter); Bestätigung der Konten 8290/4290 und des Steuerschlüssels auf 8320/4320; Datumsfeld der GmbH-Erlösbuchungen (Belegdatum = Rechnungsdatum, Leistungsdatum in Feld 115); Feld 116 bei GmbH mit Ist-Versteuerung (Zahltag) oder Mandantenstamm „Ist“ mit OPOS.

## Nachtrag 22.10.2026

Umsetzung Ihrer Hinweise zum korrigierten Bericht (`2026-10-22-steuer-heckler-busch.pdf`). Die Szenarien und Pakete dieser Mappe (v3) sind mit diesem Stand erzeugt.

| Punkt | Ihr Hinweis | Umsetzung |
|---|---|---|
| Verrechnungskonto Gesellschafter (B-6, Frage 7) | 0755 war falsch (offene Ausschüttungen); Standard SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“; SKR04-Unterkonto nennen Sie nach dem Import | SKR03-Standard jetzt **0731** in Stapel, Buchungs- und Belegliste, LIESMICH/Fragen, `konten.md`, `kontenvorgaben.md`. **SKR04 bleibt vorläufig 3560** und ist im Code und in `konten.md` als UNSICHER markiert („SKR04-Gegenstück zu 0731 laut Kanzlei folgt“). Abweichend über die Kontenvorgaben. Salon: 3 Buchungen auf 0731, keine auf 0755/1890 |
| OSS 8320/4320, Feld 40 (B-7, 5.2) | Kontenbereich bestätigt; bei Fernverkäufen an Privatpersonen in Feld 40 nur das Länderkennzeichen | Feld 40 enthält bei OSS-Buchungen nur das Kennzeichen des Bestimmungslands (Griechenland „EL“), nie eine USt-IdNr. – auch wenn am Kunden eine erfasst ist; Feld 41 der Steuersatz. Gilt auch für Stornos (Generalumkehr) und neu für Skonto auf OSS-Rechnungen (Minderung auf 8320 mit Land/Satz statt „Gewährte Skonti 19 %“). igL behält die USt-IdNr. |
| OSS-Testdaten (Shop) | Der Shop enthielt keine OSS-Buchung | Vier Fernverkäufe an Privatpersonen per E-Mail-Bestellung im Dezember (nach Überschreiten der Schwelle am 17.07.): 2026-020 Wien (AT 20 %), 2026-021 Utrecht (NL 21 %), 2026-022 Lyon (FR 20 %), 2026-023 Gent (BE 21 %, zum 31.12. offen). Regelsätze geprüft (VATupdate, 25.07.2026). Unabhängig gerechnet und geprüft: Rechnungsbeträge, keine Übernahme in die Voranmeldung, „Aus OSS-Rechnungen übernehmen“ je Land, OSS-Erklärung Q4 (Rechnungen + Shop-Bericht), Stapel 1410 an 8320 mit Land/Satz in Feld 40/41, EÜR (Netto in „nicht umsatzsteuerbare Betriebseinnahmen“, ausländische USt in „Vereinnahmte Umsatzsteuer“) |
| Zahlungseingänge (A-4) | Salon-Stapel bucht Bank 1200 an Forderungen – Kanzleien buchen die Bank aus dem Kontoauszug | Kontenvorgabe „Zahlungseingänge buchen“ ist jetzt **standardmäßig aus**. Im Soll-Stapel bilanzierender Betriebe stehen dann alle Rechnungen als Forderung; die LIESMICH nennt den Saldo des Forderungskontos und die laut Rechnungsliste offenen Forderungen und erklärt, wie man die Option einschaltet. Salon: Saldo 1410 im Jahresstapel = 14.497,54 € (alle Rechnungen 2026), offen laut Rechnungsliste 1.785,00 €; mit eingeschalteter Option Saldo 1410 = 1.785,00 € (Gegenprobe im Szenario) |
| C-2 | Zeile „Umsatzsteuer 0 % … 0,00 €“ bei § 13b/igL missverständlich | Summenzeile ohne Satz und Betrag: „Umsatzsteuer: entfällt (§ 13b UStG)“ bzw. „Umsatzsteuer: entfällt (steuerfreie innergemeinschaftliche Lieferung, § 4 Nr. 1b UStG)“. Andere 0-%-Fälle (Befreiung, Nullsteuersatz) behalten Satz und Bemessungsgrundlage. Geprüft an den PDFs Café 2026-012, Shop 2026-003/-012, Elektro 2026-003/-011/-018 |

OSS-Werte Shop (DATEV-Stapel, je Rechnung Forderungen 1410 an 8320):

| Rechnung | Land / Satz (Feld 40 / 41) | Netto | USt | Brutto |
|---|---|---|---|---|
| 2026-020 | AT / 20,00 | 282,90 € | 56,58 € | 339,48 € |
| 2026-021 | NL / 21,00 | 283,70 € | 59,58 € | 343,28 € |
| 2026-022 | FR / 20,00 | 191,40 € | 38,28 € | 229,68 € |
| 2026-023 | BE / 21,00 | 211,10 € | 44,33 € | 255,43 € |
| Summe | | 969,10 € | 198,77 € | 1.167,87 € |

OSS-Erklärung Q4/2026 (Rechnungen + Shop-Bericht, Steuer je Land): AT 6.900,74 € → 1.380,15 €, NL 4.351,38 € → 913,79 €, FR 2.869,15 € → 573,83 €, BE 2.179,61 € → 457,72 €; Summe 3.325,49 €. Q3 unverändert 1.221,32 € (nur Shop-Bericht).

Szenarien nach dem Nachtrag: Café 314/314, Salon 380/380, Freiberuf 267/267, Shop 391/391, Praxis 351/354 (bekannt: Vorsteuer-Teilabzug je Beleg, Umsätze außerhalb der App), Elektro 437/437; KoSIT in allen Szenarien akzeptiert.

Offene Fragen an Sie: SKR04-Gegenstück zu 0731; Steuerschlüssel auf 8320/4320 (Land/Satz in Feld 40/41 reichen?); Konto 8290/4290 für den Nullsteuersatz; Ergebnis des Testimports nach Abschnitt 3.3.

## Nachtrag 2 – 22.10.2026: Personenkonten und Vorsteuer-Teilabzug (E-165)

Die beiden noch offenen Maßnahmen aus Abschnitt 10, Prio 3.

| Punkt | Ihr Hinweis | Umsetzung |
|---|---|---|
| Personenkonten (A-3, E-1) | Optional je Kunde/Lieferant ein Personenkonto (10000 ff./70000 ff.), damit die Kanzlei OPOS führen kann; Bankzahlungen weiter aus dem Kontoauszug | Neue Kontenvorgabe **„Personenkonten für Kunden und Lieferanten (OPOS)“, Standard aus** (JSON `optionen.personenkonten`). Debitoren 10000–69999, Kreditoren 70000–99999 (DATEV-Standard bei Sachkontenlänge 4 laut Lexware- und Pickware-Hilfe), fortlaufend nach erstem Auftreten, dauerhaft am Kunden bzw. im neuen Lieferanten-Verzeichnis gespeichert (Schlüssel USt-IdNr. bzw. Name). Stapel: Debitor an Erlös, Skonto an Debitor, Bank an Debitor nur mit „Zahlungseingänge buchen“; Sachkonto mit BU an Kreditor (Belege per Überweisung/Karte); bar/privat unverändert; Belegfeld 1 = Rechnungs- bzw. Belegnummer. Neue Datei `EXTF_Debitoren_Kreditoren_<Zeitraum>.csv` (EXTF 700, Kategorie 16, Formatversion 5; Konto, Name, Anschrift, USt-IdNr.). Soll- und Ist-Versteuerung; bei Ist + Bilanz bleibt Feld 116 (Zahltag), die LIESMICH nennt Personenkonten + OPOS als empfohlene Einrichtung – bitte im Testimport bestätigen. In der App: Schalter mit Erklärung in den Kontenvorgaben, vergebene Nummern dort und am Kunden nur zum Ansehen |
| Vorsteuer-Teilabzug je Beleg (5.2, Frage 16) | Für gemischt genutzte Eingänge Aufteilungsschlüssel (§ 15 Abs. 4 UStG); mindestens „teilweise abziehbar (x %)“ und Hinweis, dass die Kanzlei den Schlüssel festlegt; Schalter nach E-Rechnungs-Import bei reinen Heilbehandlungsbetrieben „aus“ | Beleg „Vorsteuer voll / anteilig (Prozent oder Betrag) / aus“ mit Hinweis auf den Schlüssel der Kanzlei. Voranmeldung nur der abziehbare Teil (auch Kz 67 bei § 13b), EÜR: abziehbarer Teil „Gezahlte Vorsteuer“, Rest als Ausgabe der Kategorie; DATEV je Satz zwei Zeilen (abziehbarer Teil mit BU 9/8, Rest ohne Steuer; Automatikkonto BU 40); Belegliste Spalte „Vorsteuerabzug“. Neu in „Mein Betrieb“: **Vorsteuerquote (%)** (nur bei steuerfreien und steuerpflichtigen Umsätzen). E-Rechnungs-Import: nur steuerfreie Umsätze → aus (wie bisher); gemischte Umsätze → anteilig mit der Vorsteuerquote bzw. ohne Quote aus, jeweils mit Hinweis; am Beleg Warnung, solange „voll“ gewählt ist |
| Umsätze außerhalb der App (Praxis) | – (Abweichung im Praxis-Szenario) | LIESMICH unter „Nicht enthalten“: Sammelauszahlungen eines Abrechnungszentrums für Kassenpatienten (§ 302 SGB V) samt verrechneter Gebühren, Zuzahlungen und Verkäufe am Empfang; Einnahme ist der Betrag vor Gebühr (bei Branche „Gesundheit und Pflege“ bzw. steuerfreien Rechnungen mit Kz 48) |

Praxis-Szenario mit der Funktion: gemischt genutzte Belege anteilig 13 % (Vorsteuerquote 13 % in „Mein Betrieb“), die Voranmeldungen übernehmen Kz 66 und Kz 67 ohne Nachtrag von Hand. Vorsteuer Q1–Q4: 148,80 € / 127,07 € / 4,67 € / 72,77 €, Zahllast 693,34 € / 1.435,83 € / 996,32 € / 1.073,88 € (Anteil je Beleg gerundet – Q1 1 Cent mehr als die bisherige Rundung auf die Quartalssumme). Erwartungswerte unabhängig je Beleg gerechnet; zusätzlich geprüft: Belegliste (Anteil, Summe abziehbare Vorsteuer), DATEV (zwei Zeilen je gemischtem Beleg, Vorsteuer aus den Zeilen mit BU 9 bzw. Automatikkonto = abziehbare Vorsteuer).

Salon: unabhängige Gegenprobe „mit Personenkonten“ als eigenes Paket (`…-mit-Personenkonten.zip`), das Standardpaket bleibt unverändert: keine Buchung auf 1410/1610, jede Rechnungsbuchung auf dem Debitor ihres Kunden, Saldo aller Debitoren = alle Rechnungen 2026, falsch adressierte Rechnung 2026-010 und Storno 2026-011 gleichen sich auf ihrem Debitor aus, Kreditoren je Lieferant, Stammdaten-Datei (Kopf und Konten), LIESMICH.

Szenarien nach Nachtrag 2: Café 314/314, Salon 391/391 (380 + 11 Prüfungen „mit Personenkonten“), Freiberuf 267/267, Shop 391/391, **Praxis 365/365** (vorher 351/354), Elektro 437/437; KoSIT in allen Szenarien akzeptiert.

Offene Fragen an Sie (zusätzlich): Nummernkreise und Stammdatenformat der Personenkonten im Testimport (T-129); Teilabzug als zwei Zeilen, mit DATEV-BU 90/9xxx „aufzuteilende Vorsteuer“ (DATEV-Hilfe-Dokument 0904313) oder Umbuchung auf „Nicht abziehbare Vorsteuer“ (T-130); Ist + Bilanzierung mit Personenkonten (Mandantenstamm „Ist“ mit OPOS).
