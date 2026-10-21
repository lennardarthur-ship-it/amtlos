# @amtlos/rules-engine

Regelwerk-Auswertung für betriebliche Pflichten: Welche Pflichten gelten für einen Betrieb, warum, was fehlt noch an
Angaben – und wann ist was fällig. Teil der Amtlos-Fachbibliothek (Phase 2.3, E-156). Ohne Datenbank, ohne Node-APIs;
einzige Abhängigkeit ist `@amtlos/fristen`.

## Zweck

- **Dreiwertige Logik** (Kleene): Jede Pflicht ergibt `gilt`, `gilt_nicht` oder `unbekannt`. Fehlt ein Fakt, ist das
  Ergebnis `unbekannt` – nie stillschweigend „gilt nicht“. `fehlende_fakten` sagt, welche Angabe die Frage klärt.
- **Regelwerte zum Stichtag** (`Regelwerte`): Grenzen wie die Kleinunternehmergrenze mit Gültigkeitszeiträumen und
  Versionen; das Ergebnis nennt, welche Version genutzt wurde.
- **Termine** über `@amtlos/fristen` (wiederkehrend, relativ zu Ereignissen oder erledigten Pflichten, je Ereignis).
- **Erklärungen**: die entscheidenden Sätze einer Auswertung, Bedingungen und Fristen als Klartext.
- **Radar**: Pflichten im Status `entwurf`/`beschlossen`/`geplant` erscheinen getrennt (`radar: true`).

Der Pflichten-**Katalog** (Inhalte, Rechtsgrundlagen, Quellen) ist **nicht** Teil dieses Pakets – er liegt im
Monorepo unter `catalog/` (YAML, Schema in `packages/rules-schema`) und wird gesondert geliefert bzw. lizenziert. Das
Paket rechnet mit jedem Katalog, der dem Schema `pflicht.schema.json` entspricht.

## Installation

Nicht öffentlich (`UNLICENSED`), Lieferung als Tarball – zusammen mit `@amtlos/fristen` (den Kalender übergibt der
Aufrufer):

```sh
pnpm add ./amtlos-fristen-0.1.0.tgz ./amtlos-rules-engine-0.1.0.tgz
```

Nur ESM, getestet mit Node 22; läuft auch im Browser und in React Native. Typen liegen bei.

## Schnittstelle

| Bereich | Wichtigste Exporte |
| --- | --- |
| Auswertung | `auswerten(eingabe): PflichtErgebnis[]`, `Eingabe` (`katalog`, `fakten`, `ereignisse`, `stichtag`, `kalender`, `erledigt?`, `fenster?`), `ENGINE_VERSION` |
| Typen | `Katalog`, `Pflicht`, `Bedingung`, `Frist`, `Fakten`, `Ereignis`, `Ergebnis`, `RegelwertVersion`, `Rechtsstand` |
| Logik | `und`, `oder`, `nicht`, `ausBool`, `werteAus(bedingung, kontext)`, `fehlendeFakten`, `genutzteRegelwerte` |
| Fakten | `mitAbgeleitetenFakten(profil, stichtag)` (`abgeleitet.*`), `zuErfragendeFakten`, `QUELLFAKTEN` |
| Regelwerte | `Regelwerte` (Wert zum Stichtag, mit Version) |
| Klartext | `entscheidendeSaetze`, `bedingungGliederung`, `gliederungAlsText`, `fristAlsText`, `dauerAlsText`, `wertAlsText` |
| Instanzen & Heute | `sollInstanzen`, `anzeigeStatus`, `nichtZutreffendGrund`, `dringlichkeit`, `heuteUebersicht`, `BEREICH_JE_KATEGORIE` |
| Rechtsstand | `rechtsstand`, `rechtsstandMonat`, `rechtsstandText` |

## Beispiel

Lauffähig unter `beispiel/beispiel.mjs` (`pnpm beispiel` nach `pnpm build`):

```js
import { StandardKalender } from "@amtlos/fristen";
import { auswerten } from "@amtlos/rules-engine";

const katalog = { regelwerte: [], pflichten: [{ /* … eine Pflicht nach pflicht.schema.json, siehe Beispiel */ }] };
const [ust] = auswerten({ katalog, fakten: { "profil.kleinunternehmer": false, "profil.bundesland": "BY" }, ereignisse: [], stichtag: "2026-10-21", kalender: new StandardKalender() });
ust.ergebnis;          // "gilt"
ust.termine[0];        // { periode: "2026-09", faellig_am: "2026-10-12", … }
```

## Entwicklung

`pnpm build`, `pnpm test` (vitest; einige Tests lesen den Katalog aus `catalog/` des Monorepos als Testdaten),
`pnpm beispiel`. Prüfung als Bibliothek: `node werkzeuge/bibliothek-pruefen.mjs` im Wurzelordner.

## Lizenz

`UNLICENSED` – Eigentum des Anbieters von Amtlos; Nutzung nur nach schriftlicher Vereinbarung (siehe
docs/13-b2b-lizenz.md).
