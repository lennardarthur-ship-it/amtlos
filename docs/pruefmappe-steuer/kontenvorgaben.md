# Kontenvorgaben der Kanzlei

Kanzleien haben feste Hausregeln für einzelne Konten – Verrechnungskonto Gesellschafter, Gutscheine, Kassendifferenz,
Bank statt Verbindlichkeiten, Anlagenkonten nach Art, Homeoffice (Prüfbericht Kanzlei Heckler und Busch vom
21.10.2026, Befunde B-4, B-6, B-9, B-10, B-11). Der Kontenrahmen (SKR03/SKR04) allein reicht dafür nicht. Die App
verwendet deshalb **Kontenvorgaben**: Ohne Vorgabe gilt das Standardkonto des Kontenrahmens, mit Vorgabe das Konto der
Kanzlei – im DATEV-Buchungsstapel, in Buchungsliste und Belegliste und in den Texten von `LIESMICH.txt`.

- **In der App:** Steuerberatung → „Kontenvorgaben der Kanzlei“. Felder leer lassen = Standardkonto. Dort lässt sich die
  Datei der Kanzlei laden und die eigene Einstellung als Datei teilen.
- **Gespeichert:** im Stand unter `steuerberatung.kontenvorgaben` (Datensicherung, Synchronisation; Migration 6 → 7).
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
    "zahlungenBuchen": true,
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
| `verrechnungGesellschafter` | Kapitalgesellschaft: privat ausgelegte Belege, Barbelege vor dem ersten Kassenabschluss, Einlagen/Entnahmen der Kasse | 0755 | 3560 | Bericht B-6 („Verbindlichkeiten gegenüber Gesellschaftern, Restlaufzeit bis 1 Jahr“) – im DATEV-SKR03 heißt 0755 nach unserem Stand „… für offene Ausschüttungen“, 0731 „Restlaufzeit bis 1 Jahr“: bitte festlegen |
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
| `erloesOss` | Erlöse mit der Umsatzsteuer des Bestimmungslands (OSS, § 18j UStG); Land in Feld 40, Steuersatz in Feld 41 | 8320 | 4320 | „Erlöse aus im anderen EU-Land steuerpflichtigen Lieferungen“ laut Herstellerangabe (Lexware) – **unsicher**, Konto für sonstige Leistungen und Steuerschlüssel mit der Kanzlei klären |
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
| `zahlungenBuchen` | `true` (Standard) / `false` | Nur bilanzierende Betriebe: Zahlungseingänge auf Rechnungen als Bank an Forderungen (Soll-Stapel, Befund A-4). Aus, wenn die Kanzlei die Zahlungen aus dem Kontoauszug bucht – sonst doppelt |
| `gewinnermittlung` | `"bilanz"` / `"euer"` / fehlt | Fehlt: nach Rechtsform (GmbH, UG, AG, GmbH & Co. KG, e. K.) bzw. Mitteilung des Finanzamts (§ 141 AO) – Bilanz; sonst EÜR. Bei Bilanz sperrt die App die EÜR-Übernahme (E-4) und gibt einen Soll-Stapel mit Zahlungseingängen aus |

## Grenze

Die App übernimmt die Nummern nur in Stapel und Listen; welche Konten richtig sind, entscheidet die Kanzlei. Die App
prüft nicht, ob ein Konto im Kontenrahmen der Kanzlei existiert oder die erwartete Steuerautomatik hat.
