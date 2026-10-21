# Umsetzung des Prüfberichts Heckler und Busch vom 21.10.2026

Stand: 22.10.2026. Die Szenario-Pakete dieser Mappe sind mit dem neuen Stand erzeugt (bitte für den Testimport nach Abschnitt 3.3 diese verwenden).

| Prio | Maßnahme (Abschnitt 10) | Befund | Status |
|---|---|---|---|
| 1 | Belegbuchungen drehen: Zahlungskonto in Feld 7 (Haben), Sachkonto mit BU in Feld 8 | A-1 | umgesetzt (auch Gutschriften, Kassenfehlbeträge) |
| 1 | Feld 103 leer, GUID in Beleginfo 1 (Felder 21/22, „Buchungs-GUID“; Belegfeld 2 hat nur 12 Zeichen), Feld 114 = 0, Stornos mit Generalumkehr (118 = 1) | 3.1 | umgesetzt |
| 1 | Kapitalgesellschaften: Soll-Stapel nach Leistung, offene Forderungen zum 31.12., EÜR gesperrt, Verrechnungskonto Gesellschafter statt 1890/1360 | A-4, B-6, E-4 | umgesetzt; Salon: Saldo 1410 = 1.785,00 €. Konto 0755/3560 wie im Bericht – in SKR03-Listen heißt 0755 „Verbindlichkeiten gegenüber Gesellschaftern für offene Ausschüttungen“: bitte bestätigen |
| 1 | Nullsteuersatz: eigene Steuerart, eigenes Erlöskonto (Kz 87), XRechnung Kategorie Z | B-2, C-12 | umgesetzt; Konto 8290/4290 aus Herstellerangaben – bitte bestätigen |
| 1 | Testimport Café, Salon, Elektro nach Protokoll 3.3 | 3.3 | bei Ihnen |
| 2 | Kleinunternehmer: Wareneingang 3200/5200 ohne BU 40 | A-2 | umgesetzt |
| 2 | Konten konfigurierbar (Gutscheine, Kassendifferenz, Verrechnungskonto, Bank statt 1610, Anlagen nach Art, Homeoffice 4288/6348) | B-4, B-9–B-11 | umgesetzt: Seite „Kontenvorgaben der Kanzlei“ + JSON-Import (Format: `kontenvorgaben.md`) |
| 2 | Schlussrechnung mit Abschlagsabzug, Ersatzrechnung im Storno-Zeitraum | C-4, C-6 | umgesetzt |
| 2 | Privatkunden-Schalter mit § 14b-Hinweis, Leitweg-ID (BT-10), Skonto BT-20 eigene Zeile, KoSIT für Salon/Shop/Elektro | C-3, C-13, C-15 | umgesetzt; BT-20 war bereits in eigener Zeile (Test belegt), KoSIT jetzt in allen sechs Szenarien grün |
| 2 | Voranmeldung in vollen Euro, Liste der nach Rechnungsdatum zugeordneten Rechnungen | 5.2 | umgesetzt |
| 2 | OSS als Pflicht mit Frist und Übertragungshilfe; ZM als Pflicht mit Frist | 5.2, C-9 | umgesetzt (OSS-Erlöskonto 8320/4320 mit Land/Satz in Feld 40/41 – bitte bestätigen) |
| 2 | Verfahrensdoku: Kasse (TSE, DSFinV-K, Ausfall), ersetzendes Scannen, IKS; Kassenbuch umbenannt | D-9, D-10 | umgesetzt |
| 2 | Vollsicherung außerhalb des Geräts mit Erinnerung und Nachweis | D-11 | umgesetzt (Erinnerung nach 30 Tagen) |
| 2 | Hinweis „Übertragungshilfe, keine Steuerberatung“ auf den PDFs; KU-Warnung als Rechenergebnis | 8 | umgesetzt auf USt-VA, EÜR, Steuererklärung-Unterlagen, Lohnkonto-Übersicht, ZM, OSS – bewusst nicht auf der Bilanz (vom Geschäftsführer unterschrieben, offengelegt) |
| 3 | Personenkonten | A-3 | offen |
| 3 | USt-Zahlungen in der EÜR | E-1 | als Hinweis (Zehn-Tage-Regel) |
| 3 | Bewirtung 30 % nicht abziehbar | E-3 | umgesetzt |
| 3 | Vorsteuer-Teilabzug je Beleg; Schalter nach E-Rechnungs-Import bei steuerfreien Betrieben | 5.2 | offen (Praxis hat auch 19-%-Umsätze; Teilabzug je Beleg nötig) |
| 3 | Bilanzvorlage: Ertragsteuern, Angaben unter der Bilanz, Unterschriften aller Geschäftsführer; Lohnkonto-Übersicht | E-5, E-7 | umgesetzt |
| 3 | Gutschrift-Nummernkreis, Einheitencodes, AllowanceCharge, BT-30 | B-12, C-14, C-16, C-17 | umgesetzt (Gutschrift-Nummernkreis als Hinweis + getrennte Zählung „GS-“) |
| 3 | Partnermodell: Kammeranfrage, Vertrag ohne Provision und Exklusivität | 8 | vorbereitet (Funktion verborgen), Kammeranfrage folgt |

Offene Fragen an Sie: Bestätigung der Konten 0755/3560, 8290/4290, 8320/4320; Datumsfeld der GmbH-Erlösbuchungen (Belegdatum = Rechnungsdatum, Leistungsdatum in Feld 115); Feld 116 bei GmbH mit Ist-Versteuerung (Zahltag) oder Mandantenstamm „Ist“ mit OPOS.
