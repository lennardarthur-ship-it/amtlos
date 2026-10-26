# @amtlos/fristen

Fristen- und Feiertagsrechnung für deutsche Behördentermine – ohne Abhängigkeiten, ohne Node-APIs, rein funktional.
Teil der Amtlos-Fachbibliothek (Phase 2.3, E-156); die App, der Server und `@amtlos/rules-engine` rechnen damit.

## Zweck

- Datumsrechnung auf ISO-Daten (`"2026-10-21"`) ohne Zeitzonen-Fallen: Tage/Monate addieren, Wochentag, Vergleich.
- Gesetzliche Feiertage je Bundesland (inkl. Ostern-abhängiger Tage), Zusatzfeiertage (kommunal, einmalig) über
  `StandardKalender`; Bankarbeitstage im Sinne von § 23 Abs. 1 SGB IV (E-192): Montag bis Freitag ohne gesetzliche
  Feiertage (bundesweit oder in einem Land – der Sitz der Krankenkasse ist unbekannt, also der früheste Termin) und ohne
  24./31. Dezember (`keineBankarbeitstage`); der TARGET-Kalender (`bankSchliesstage`) dient nur noch zur Information.
- Perioden (monatlich, quartalsweise, halbjährlich, jährlich) und Fälligkeiten wie „10. des Folgemonats“ oder
  „n-letzter Bankarbeitstag“, Verschiebung auf den nächsten/vorherigen Werk- bzw. Bankarbeitstag (§ 108 Abs. 3 AO,
  § 193 BGB), Fristverlängerungen (z. B. Dauerfristverlängerung `P1M`).

Keine Rechtsberatung: Die Regeln bilden die üblichen Fälle ab; Sonderfälle (z. B. regionale Feiertage einzelner
Gemeinden) müssen als Zusatzfeiertage übergeben werden.

## Installation

Das Paket ist nicht öffentlich (`UNLICENSED`). Lieferung als Tarball:

```sh
pnpm add ./amtlos-fristen-0.1.0.tgz      # oder npm install ./amtlos-fristen-0.1.0.tgz
```

Nur ESM (`import`), getestet mit Node 22; läuft auch im Browser und in React Native. Typen liegen bei (`dist/*.d.ts`).

## Schnittstelle

| Bereich | Wichtigste Exporte |
| --- | --- |
| Datum (`datum.ts`) | `Datum` (ISO-Text), `datum`, `zerlege`, `istGueltig`, `plusTage`, `plusMonate`, `wochentag`, `vergleiche`, `differenzTage`, `letzterTagImMonat`, `jahrVon` |
| Dauer (`dauer.ts`) | `parseDauer("P1M")`, `plusDauer`, `minusDauer` (ISO-8601-Dauern) |
| Feiertage (`feiertage.ts`) | `BUNDESLAENDER`, `Ort` (`bundesland`, `ags`), `ostersonntag`, `gesetzlicheFeiertage(jahr)`, `keineBankarbeitstage(jahr)`, `bankSchliesstage(jahr)` (TARGET, nur Information) |
| Kalender (`kalender.ts`) | `Kalender` (Schnittstelle), `StandardKalender(zusatz?)`, `Verschiebung`, `pruefeWerktag`, `verschiebe` |
| Perioden (`perioden.ts`) | `Rhythmus`, `perioden`, `FaelligkeitsRegel`, `rohtermin`, `wiederkehrendeTermine`, `relativerTermin`, `Termin` |

Alle Funktionen sind rein (keine globalen Zustände; `StandardKalender` merkt sich Feiertage je Jahr nur intern).

## Beispiel

Lauffähig unter `beispiel/beispiel.mjs` (`pnpm beispiel` nach `pnpm build`):

```js
import { StandardKalender, wiederkehrendeTermine } from "@amtlos/fristen";

const termine = wiederkehrendeTermine(
  { rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", tag: 10 }, verschiebung: { regel: "naechster_werktag", kalender: "bundesland" } },
  "2026-10-01", "2026-12-31", { bundesland: "BY" }, new StandardKalender(),
);
// [{ periode: "2026-09", roh: "2026-10-10", faellig_am: "2026-10-12", … }, …]
```

## Entwicklung

`pnpm build` (nach `dist/`), `pnpm test` (vitest), `pnpm beispiel`. Bibliotheks-Prüfung über alle Pakete:
`node werkzeuge/bibliothek-pruefen.mjs` im Wurzelordner.

## Lizenz

`UNLICENSED` – Eigentum des Anbieters von Amtlos; Nutzung nur nach schriftlicher Vereinbarung (siehe
amtlos-intern: docs/13-b2b-lizenz.md).
