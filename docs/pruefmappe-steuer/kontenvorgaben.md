# Kontenvorgaben der Kanzlei

Kanzleien haben feste Hausregeln für einzelne Konten – Verrechnungskonto Gesellschafter, Gutscheine, Kassendifferenz,
Bank statt Verbindlichkeiten, Anlagenkonten nach Art, Homeoffice (Prüfbericht Steuerberatungskanzlei vom
21.10.2026, Befunde B-4, B-6, B-9, B-10, B-11). Der Kontenrahmen (SKR03/SKR04) allein reicht dafür nicht. Die App
verwendet deshalb **Kontenvorgaben**: Ohne Vorgabe gilt das Standardkonto des Kontenrahmens, mit Vorgabe das Konto der
Kanzlei – im DATEV-Buchungsstapel, in Buchungsliste und Belegliste und in den Texten von `LIESMICH.txt`.

- **In der App:** Steuerberatung → „Kontenvorgaben der Kanzlei“. Felder leer lassen = Standardkonto. Dort lässt sich die
  Datei der Kanzlei laden und die eigene Einstellung als Datei teilen.
- **Gespeichert:** im Stand unter `steuerberatung.kontenvorgaben` (Datensicherung, Synchronisation; Migration 6 → 7); Personenkonten am Kunden bzw. im Lieferanten-Verzeichnis (Migration 7 → 8).
- **Im Paket:** `LIESMICH.txt` nennt unter „Mandant“ die verwendeten Vorgaben (oder „keine – Standardkonten des
  Kontenrahmens“) und die Gewinnermittlung.
- Code: `packages/fachlogik/src/kontenvorgaben.ts` (Format, Prüfung), `buchungen.ts` (`kontenFuer`, Standardkonten).

## Dateiformat (Version 1)

Eine JSON-Datei (UTF-8, mit oder ohne BOM), z. B. `kontenvorgaben.json`:

```json
{
  "format": "kontenvorgaben",
  "version": 1,
  "kanzlei": "Kanzlei Muster Steuerberatung",
  "stand": "2026-10-21",
  "kontenrahmen": "SKR03",
  "konten": {
    "verrechnungGesellschafter": "0731",
    "gutscheinVerbindlichkeit": "1701",
    "kassendifferenzErtrag": "2700",
    "erloesNullsatz": "8290"
  },
  "optionen": {
    "belegeGegenBank": false,
    "zahlungenBuchen": false,
    "personenkonten": false,
    "gewinnermittlung": "bilanz"
  }
}
```

- `format` und `version` sind freiwillig; wenn angegeben, müssen sie `"kontenvorgaben"` bzw. `1` sein.
- `kanzlei` (höchstens 80 Zeichen) und `stand` (JJJJ-MM-TT) erscheinen in der App und in `LIESMICH.txt`.
- `kontenrahmen` (`"SKR03"` oder `"SKR04"`, freiwillig) stellt beim Laden auch den Kontenrahmen des Pakets um.
- `konten`: nur die abweichenden Konten, je **vierstellige Sachkontonummer** als Text (Sachkontenlänge 4 im DATEV-Kopf).
  Unbekannte Schlüssel und ungültige Nummern übernimmt die App nicht und nennt sie nach dem Laden.
- Mindestens ein gültiges Konto oder eine Option muss enthalten sein. Beim Laden ersetzt die Datei alle bisherigen Vorgaben.

### Konten

| Schlüssel | Bedeutung | Standard SKR03 | Standard SKR04 | Quelle des Standards |
|---|---|---|---|---|
| `verrechnungGesellschafter` | Kapitalgesellschaft: privat ausgelegte Belege, Barbelege vor dem ersten Kassenabschluss, Einlagen/Entnahmen der Kasse | 0731 | 3560 (**unsicher**) | Bericht B-6, korrigiert am 22.10.2026: SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“ (0755 ist das Konto für offene Ausschüttungen und hier falsch). **SKR04: Gegenstück zu 0731 laut Kanzlei folgt** (nach dem Testimport) – bis dahin bleibt 3560 |
| `bank` | Zahlungseingänge bilanzierender Betriebe; mit `belegeGegenBank` auch Belege per Überweisung/Karte | 1200 | 1800 | bisheriger Prüfpunkt |
| `forderungen` | Forderungen aus L+L (ohne Kontokorrent) | 1410 | 1210 | bisher |
| `verbindlichkeiten` | Verbindlichkeiten aus L+L (ohne Kontokorrent) | 1610 | 3310 | bisher |
| `kasse` | Kasse | 1000 | 1600 | bisher |
| `geldtransit` | Geldtransit (Karte, Bargeld zur Bank) | 1360 | 1460 | bisher |
| `privateinlagen` | Privateinlagen | 1890 | 2180 | bisher |
| `privatentnahmen` | Privatentnahmen | 1800 | 2100 | bisher |
| `gutscheinVerbindlichkeit` | verkaufte Mehrzweck-Gutscheine | 1700 | 3500 | bisher; Bericht B-4 empfiehlt ein Unterkonto (z. B. 1701) |
| `kassendifferenzAufwand` | Kassenfehlbetrag laut Zählung | 4900 | 6300 | bisher |
| `kassendifferenzErtrag` | Kassenüberschuss laut Zählung – leer: Erlöse 19 %; ein anderes Konto wird **ohne Umsatzsteuer** gebucht (dann zählt der Überschuss auch in Voranmeldung und EÜR-Übernahme nicht als Umsatz 19 %) | (Erlöse 19 %) | (Erlöse 19 %) | Bericht A-9/B-9: alternativ 2700 / 4830 „Sonstige Erträge“ |
| `erloesNullsatz` | Erlöse zum Nullsteuersatz (§ 12 Abs. 3 UStG, PV), Kz 87 | 8290 | 4290 | Bericht B-2 nennt keine Nummer („in Rewe nach Nullsteuersatz bzw. § 12 Abs. 3 suchen“); 8290/4290 „Erlöse 0 % USt“ laut Herstellerangaben (microdat, Lexware) – **unsicher** |
| `erloesOss` | Erlöse mit der Umsatzsteuer des Bestimmungslands (OSS, § 18j UStG); Land in Feld 40 (bei Privatpersonen nur das Länderkennzeichen), Steuersatz in Feld 41 | 8320 | 4320 | „Erlöse aus im anderen EU-Land steuerpflichtigen Lieferungen“; Kontenbereich 8320 ff./4320 ff. von der Kanzlei bestätigt (Nachtrag 22.10.2026) – Steuerschlüssel offen |
| `erloesAusfuhr` | steuerfreie Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a UStG), Kz 43 – vorher auf 8100/4100 (§ 4 Nr. 8 ff., Kz 48) gebucht (E-208) | 8120 | 4120 | „Steuerfreie Umsätze § 4 Nr. 1a UStG“ im DATEV-Standardkontenrahmen – vom Steuerberater bestätigt (26.10.2026, E-214), Prüfung im DATEV-Testimport offen (PRUEFLISTE T-221) |
| `erloesKz43` | übrige steuerfreie Umsätze mit Vorsteuerabzug (§ 4 Nr. 2–7 UStG), Kz 43 – vorher auf 8100/4100 (§ 4 Nr. 8 ff., Kz 48) gebucht (E-214) | 8150 | 4150 | „Sonstige steuerfreie Umsätze § 4 Nr. 2–7 UStG“ – vom Steuerberater genannt (26.10.2026, E-214), Prüfung im DATEV-Testimport offen (PRUEFLISTE T-221) |
| `homeoffice` | Homeoffice-Pauschale / häusliches Arbeitszimmer | 4288 | 6348 | Bericht B-11 („Nummer in Rewe prüfen“) |
| `anlageMaschinen` | Anlagegut „Maschinen“ | 0400 | 0440 | Bericht B-10 |
| `anlageBga` | Anlagegut „Betriebs- und Geschäftsausstattung“ (Standard der Kategorie „Anschaffung über 800 €“) | 0420 | 0650 | Bericht B-10 |
| `anlageKfz` | Anlagegut „Fahrzeug“ | 0320 | 0520 | Bericht B-10 |
| `anlageSoftware` | Anlagegut „Software“ | 0027 | 0135 | Bericht B-10 |

Die Art des Anlageguts wählt der Betrieb beim Beleg der Kategorie „Anschaffung über 800 €“.

### Optionen

| Schlüssel | Werte | Wirkung |
|---|---|---|
| `belegeGegenBank` | `true` / `false` (Standard) | Belege mit Zahlungsweg „Überweisung oder Karte“ direkt gegen `bank` statt gegen `verbindlichkeiten` |
| `zahlungenBuchen` | `true` / `false` (Standard) | Nur bilanzierende Betriebe: Zahlungseingänge auf Rechnungen als Bank an Forderungen (Soll-Stapel, Befund A-4). **Standard aus** (Nachtrag der Kanzlei vom 22.10.2026): Kanzleien buchen die Bank aus dem Kontoauszug; im Stapel stehen dann alle Rechnungen des Zeitraums als Forderung, `LIESMICH.txt` nennt den Saldo und die laut Rechnungsliste offenen Forderungen. Ein nur, wenn die Kanzlei die Zahlungseingänge aus der App übernimmt – dann nicht noch einmal aus dem Kontoauszug buchen |
| `personenkonten` | `true` / `false` (Standard) | E-165 (Befund A-3): **Personenkonten für Kunden und Lieferanten (OPOS)** statt der Sammelkonten `forderungen`/`verbindlichkeiten` – siehe Abschnitt „Personenkonten“. **Standard aus** |
| `gewinnermittlung` | `"bilanz"` / `"euer"` / fehlt | Fehlt: nach Rechtsform (GmbH, UG, AG, GmbH & Co. KG, e. K.) bzw. Mitteilung des Finanzamts (§ 141 AO) – Bilanz; sonst EÜR. Bei Bilanz sperrt die App die EÜR-Übernahme (E-4) und gibt einen Soll-Stapel aus (Zahlungseingänge nur mit `zahlungenBuchen`) |

## Personenkonten (Option `personenkonten`, E-165)

Für Kanzleien, die offene Posten führen wollen (Prüfbericht A-3: „Optional je Kunde/Lieferant Personenkonto (10000 ff./70000 ff.) aus der Kunden-/Lieferantenliste, damit die Kanzlei OPOS führen kann; Bankzahlungen weiterhin aus dem Kontoauszug“).

- **Nummern:** DATEV-Standardnummerierung bei Sachkontenlänge 4 – Debitoren **10000–69999**, Kreditoren **70000–99999** (Quellen: Lexware-Hilfe „Warum sind die Bereiche für Kunden- und Lieferantennummern fest definiert?“ – „Kundennummern 10000 bis 69999 … Lieferantennummern 70000 bis 99999“, wie in DATEV; Pickware-Hilfe „Kundennummern bei Einzel-Debitorenkonten“; abgerufen am 22.10.2026). Fortlaufend ab 10000 bzw. 70000 in der Reihenfolge des ersten Auftretens (Rechnungs- bzw. Belegdatum). Die Sachkontenlänge im DATEV-Kopf bleibt 4.
- **Dauerhaft:** Einmal vergeben, bleibt die Nummer am Kunden (`kunden[].personenkonto`, angelegt, wenn der Kunde fehlt) bzw. im Lieferanten-Verzeichnis (`lieferanten`, Schlüssel USt-IdNr. bzw. Name ohne Groß-/Kleinschreibung und Satzzeichen) – auch wenn später frühere Rechnungen dazukommen. Vergeben wird beim Einschalten und vor jedem Steuerberater-Paket. Ein anders geschriebener Empfängername (z. B. falsch adressierte Rechnung) ist ein eigener Partner; Rechnung und Storno gleichen sich auf demselben Personenkonto aus.
- **Buchungen:** Rechnungen Debitor an Erlös (Soll-Stapel: Rechnungsdatum; Ist-EÜR: Zahltag), gewährtes Skonto Skontokonto an Debitor, Zahlungseingänge Bank an Debitor nur mit `zahlungenBuchen`; Gutschriften Kreditor des Leistenden an Aufwand; Belege per Überweisung/Karte Sachkonto mit BU an Kreditor (mit `belegeGegenBank` weiter gegen Bank). Bar und privat bezahlte Belege, Kasse und Sachentnahmen unverändert. **Belegfeld 1** ist die Rechnungs- bzw. Belegnummer – so lassen sich die Zahlungen aus dem Kontoauszug gegen den offenen Posten ausziffern.
- **Stammdaten:** `EXTF_Debitoren_Kreditoren_<Zeitraum>.csv` im Paket – DATEV-Format „Debitoren/Kreditoren“ (EXTF, Version 700, Datenkategorie 16, Formatversion 5 laut Formatübersichten von Drittanbietern), Spalten 1–40: Konto, Name (Unternehmen bzw. „keine Angabe“ bei Privatpersonen), Adressattyp, Kurzbezeichnung, EU-Land und USt-IdNr., Adressart, Straße, PLZ, Ort, Land. Vor dem Buchungsstapel importieren. **Im Testimport prüfen** (PRUEFLISTE T-129).
- **Ist-Versteuerung bilanzierender Betriebe:** Feld 116 „Datum Zuord. Steuerperiode“ trägt weiter den Zahltag. Laut Kanzlei braucht Ist-Versteuerung mit Bilanzierung vermutlich Personenkonten (Mandantenstamm „Ist“ mit OPOS) – `LIESMICH.txt` nennt Personenkonten + OPOS als empfohlene Einrichtung; im Testimport bestätigen.

## Vorsteuer-Teilabzug je Beleg (E-165)

Keine Kontenvorgabe, aber für die Buchung wichtig: Ein Beleg kann „Vorsteuer anteilig“ tragen (Prozent oder Betrag, § 15 Abs. 4 UStG). Im Stapel steht er je Steuersatz in **zwei Zeilen** – der abziehbare Teil brutto mit BU 9/8 (so gerundet, dass DATEV genau die abziehbare Vorsteuer rechnet), der nicht abziehbare Teil brutto ohne Steuer auf demselben Aufwandskonto (Automatikkonto BU 40, Text „ohne VSt“); § 13b-Belege anteilig auf 3123/3143 bzw. 5923/5943. Die Belegliste nennt den Anteil (Spalte „Vorsteuerabzug“). DATEV kennt dafür auch die Buchungsschlüssel 90/9000 bzw. 9xxx „aufzuteilende Vorsteuer“ (ganze Vorsteuer auf das Konto „Aufzuteilende Vorsteuer“, die Kanzlei teilt auf – DATEV-Hilfe-Dokument 0904313); welche Variante die Kanzlei möchte: PRUEFLISTE T-130.

## Grenze

Die App übernimmt die Nummern nur in Stapel und Listen; welche Konten richtig sind, entscheidet die Kanzlei. Die App
prüft nicht, ob ein Konto im Kontenrahmen der Kanzlei existiert oder die erwartete Steuerautomatik hat.
