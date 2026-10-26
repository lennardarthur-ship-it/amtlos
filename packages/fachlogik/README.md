# @amtlos/fachlogik

Fachlogik für kleine Betriebe – dieselben Rechenregeln für App und Server (E-120): Rechnungen und Summen,
E-Rechnung (XRechnung, lesen und schreiben), GiroCode, Belege und Vorsteuer, Kasse und Kassenbuch, EÜR-Zuordnung,
Vorlagen (Unterweisungen, Hygieneplan, Arbeitszeit …) als druckfertiges HTML. Teil der Amtlos-Fachbibliothek
(Phase 2.3, E-156). Ohne Datenbank und ohne Node-APIs.

## Zweck

- **Rechnung**: Summen je Steuersatz in ganzen Cent (kaufmännisch gerundet, Brutto- oder Nettopreise),
  Kleinunternehmer-Hinweis, Pflichtangaben für die E-Rechnung (`fehlendFuerERechnung`), USt-Zeiträume.
- **E-Rechnung**: XRechnung (UBL) erzeugen (`xrechnungUbl`), eingehende XRechnung/ZUGFeRD lesen (`eRechnungLesen`,
  `eRechnungAusPdf`) und als Beleg übernehmen.
- **Zahlung**: GiroCode nach EPC069-12 (`giroCodeDaten`, `giroCodeSvg`), Skonto, IBAN-/PLZ-/E-Mail-Prüfung.
- **Belege, Kasse, Buchungen**: Belegnummern, Vorsteuer, Steuerschuld (§ 13b), EÜR-Zeilen, Kassenabschlüsse und
  -stürze, Sachentnahmen, Konten SKR03/SKR04 für das Steuerberater-Paket.
- **Vorlagen**: `VORLAGEN`, `vorlageFuer`, `leereDaten`, `dokumentHtml` (A4, druckfertig), Branchen-Bausteine.

Keine Rechts- oder Steuerberatung; die Vorlagen sind fachlich zu prüfen (PRUEFLISTE T-52 ff.).

## Installation

Nicht öffentlich (`UNLICENSED`), Lieferung als Tarball – zusammen mit `@amtlos/fristen`:

```sh
pnpm add ./amtlos-fristen-0.1.0.tgz ./amtlos-fachlogik-0.1.0.tgz
```

Fremdabhängigkeit: `qrcode-generator` (MIT, fest auf 2.0.4). Nur ESM, getestet mit Node 22; läuft auch im Browser
und in React Native. Typen liegen bei.

## Schnittstelle

| Bereich | Wichtigste Exporte |
| --- | --- |
| Rechnung | `Position`, `Summen`, `summen`, `rundeCent`, `KU_HINWEIS`, `fehlendFuerERechnung`, `ustZeitraum`, `umsaetzeNachSatz` |
| E-Rechnung | `xrechnungUbl`, `eRechnungsDokument`, `eRechnungLesen`, `eRechnungAusPdf`, `belegAusERechnung` |
| Zahlung, Prüfen | `giroCodeDaten`, `giroCodeSvg`, `ibanGueltig`, `plzGueltig`, `emailGueltig`, Skonto-Funktionen |
| Belege | `Beleg`, `belegAus`, `belegSummen`, `belegNummern`, `naechsteBelegnummer`, `vorsteuerFuer`, `steuerschuldFuer`, `euerFuer`, `KATEGORIEN` |
| Kasse | `KassenInhalt`, `Kassenabschluss`, `kassenSummen`, `kassenUmsatzJeSatz`, `kassenFehler`, `kassenVerlauf`, `kassenWarnungen`, `zbonLuecken` |
| Vorlagen | `VORLAGEN`, `vorlageFuer`, `leereDaten`, `dokumentHtml`, `Betrieb`, `LEERER_BETRIEB`, `HAUSFARBEN`, `BUNDESLAENDER` |
| Gründung, Fragebogen | Gründungs-Checkliste und Fragebogen zur steuerlichen Erfassung (Ausfüllhilfe) |

## Beispiel

Lauffähig unter `beispiel/beispiel.mjs` (`pnpm beispiel` nach `pnpm build`):

```js
import { LEERER_BETRIEB, dokumentHtml, giroCodeDaten, leereDaten, summen, vorlageFuer } from "@amtlos/fachlogik";

const s = summen([{ bezeichnung: "Haarschnitt", menge: 1, einheit: "stueck", preis_cent: 2500, ust_satz: 19 }], false);
s.brutto_cent; // 2975
giroCodeDaten({ name: "Salon Sonne", iban: "DE89370400440532013000", betragCent: s.brutto_cent, verwendungszweck: "Rechnung 2026-001" });

const betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne" };
const v = vorlageFuer("hygieneplan");
const html = dokumentHtml(v, leereDaten(v, betrieb, "2026-10-21"), betrieb); // druckfertiges HTML
```

## Entwicklung

`pnpm build`, `pnpm test` (vitest; einige Tests lesen den Katalog aus `catalog/` als Testdaten), `pnpm beispiel`.
Prüfung als Bibliothek: `node werkzeuge/bibliothek-pruefen.mjs` im Wurzelordner.

## Lizenz

`UNLICENSED` – Eigentum des Anbieters von Amtlos; Nutzung nur nach schriftlicher Vereinbarung (siehe
amtlos-intern: docs/13-b2b-lizenz.md). Mitgelieferte Fremdsoftware: `qrcode-generator` (MIT).
