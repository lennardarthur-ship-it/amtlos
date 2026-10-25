# 03 · Regel-Schema und Engine-Semantik

Stand: 2026-10-11 · Entscheidungen: E-030 bis E-040

Dateien:

| Datei | Inhalt |
|---|---|
| `packages/rules-schema/pflicht.schema.json` | JSON-Schema (Draft 2020-12) für eine Pflichtversion |
| `packages/rules-schema/regelwert.schema.json` | JSON-Schema für eine Regelwertversion |
| `packages/rules-schema/fakten.json` | Fakten-Katalog: alle Felder, die Regeln abfragen dürfen |
| `packages/rules-schema/ereignisse.json` | Ereignis-Katalog |
| `packages/rules-schema/scripts/validate-katalog.mjs` | Validator: Schema + Querverweise + prod-Gate |
| `catalog/pflichten/*.yaml` | Beispiele: Gefährdungsbeurteilung, USt-Voranmeldung, Berufsgenossenschaft |
| `catalog/regelwerte/*.yaml` | Beispiele: USt-VA-Grenzen, Kleinunternehmergrenzen, Mindestlohn, Minijob |
| `catalog/fixtures/*.yaml` | Profil-Fixtures mit erwarteten Ergebnissen |

## Abweichungen vom Beispiel in Spezifikation 3.2

| Spezifikation | Schema v1 | Grund |
|---|---|---|
| `titel: Gefährdungsbeurteilung erstellen` | `titel: { de: …, en: … }` | Zweisprachigkeit (E-040) |
| `frist.wert: vor_arbeitsbeginn` | `versatz: P0D`, `zeitpunkt: vor_beginn` | maschinell auswertbar |
| `wiederholung: bei_aenderung` | `wiederholung: { art: bei_aenderung, neu_ausloesen_bei: [...] }` | Was genau ist „Änderung“? Muss explizit sein. |
| `sanktion: Text` | `sanktion: { text, schwere }` | Priorisierung „Als Nächstes tun“ |
| `geprueft_von`, `geprueft_am` | `pruefung` (nur lesend) | wird aus Vier-Augen-Freigaben abgeleitet (E-039) |
| — | `verschiebung`, `erinnerung`, `voraussetzungen`, `aktion`, `erneut_erledigen`, `radar`, `fachlich_zu_pruefen` | neu, siehe unten |

## Bausteine einer Bedingung

```yaml
ausloeser:
  all:                                   # alle müssen gelten
    - feld: profil.ust.kleinunternehmer  # Fakt aus fakten.json
      op: "=="
      wert: false
      label: { de: Du nutzt die Kleinunternehmerregelung nicht. }
    - any:                               # mindestens eine muss gelten
        - feld: profil.ust.zahllast_vorjahr
          op: ">"
          wert: { regelwert: steuern.ust_va.grenze_befreiung }   # Regelwert zum Stichtag
        - ereignis: gruendung            # Ereignistest
          op: eingetreten
          innerhalb: P1Y
    - not: { feld: profil.erwerb, op: "==", wert: neben }
```

Weitere: `{ immer: true }`, Operatoren `in`, `nicht_in` (Liste), `enthaelt`, `enthaelt_eines` (für Listen-Fakten), `vorhanden`, `nicht_vorhanden`, Faktor bei Regelwerten (`{ regelwert: …, faktor: 0.8 }` für die 80-%-Warnung).

### Dreiwertige Auswertung (E-033)

Jeder Knoten liefert `gilt`, `gilt_nicht` oder `unbekannt`:

| Knoten | Ergebnis |
|---|---|
| Vergleich | `unbekannt`, wenn der Fakt fehlt oder der Regelwert zum Stichtag keine freigegebene Version hat; sonst Vergleich |
| `vorhanden` / `nicht_vorhanden` | nie `unbekannt` |
| `all` | `gilt_nicht`, sobald ein Kind `gilt_nicht`; sonst `unbekannt`, wenn ein Kind `unbekannt`; sonst `gilt` |
| `any` | `gilt`, sobald ein Kind `gilt`; sonst `unbekannt`, wenn ein Kind `unbekannt`; sonst `gilt_nicht` |
| `not` | tauscht `gilt` ↔ `gilt_nicht`, `unbekannt` bleibt |

Eine Pflicht mit Ergebnis `unbekannt` wird als Karte „Angabe fehlt“ angezeigt, mit den fehlenden Fakten als konkrete Fragen. Sie zählt in der Ampel als gelb, nie als grün.

### Fakten (E-032)

Regeln sehen nur Fakten, nie das rohe Profil. Präfixe:

- `profil.*` direkt aus der aktuellen Profilversion
- `abgeleitet.*` berechnet (z. B. `ist_gruendungsjahr`, Beschäftigtenzählung je Gesetz)
- `finanzen.*`, `personal.*` aus den Fachmodulen (ab Abschnitt 4 bzw. 5)

Jeder Fakt hat einen Typ. Der Validator lehnt unbekannte Fakten, unpassende Operatoren (z. B. `>` auf eine Liste) und ungültige Enum-Werte ab.

**Wichtig:** Schwellen wie „ab 20 Beschäftigten“ zählen je Gesetz unterschiedlich. Deshalb gibt es eigene abgeleitete Fakten je Zählweise (`abgeleitet.beschaeftigte.zaehlung_bdsg38` usw.). Die Zählregeln sind `[FACHLICH ZU PRÜFEN]`.

### Regelwerte (E-034)

`{ regelwert: id }` wird zum **Stichtag der Auswertung** aufgelöst: die freigegebene Version mit `gueltig_ab ≤ Stichtag ≤ gueltig_bis`. Die Begründung nennt Wert, Version und Quelle. Termine in einem späteren Kalenderjahr als der Stichtag werden mit `vorlaeufig: true` markiert: Sie beruhen auf heutigen Fakten (etwa der Vorjahres-Zahllast), die sich bis dahin ändern. Zum Jahreswechsel löst der Tageswechsel-Job eine Neuberechnung aus; dann gelten die neuen Regelwerte und Fakten.

## Fristen

| `typ` | Beispiel | Termine |
|---|---|---|
| `dauerhaft` | Impressum vorhalten | keiner; Status bleibt „erfüllt“ bis Änderung |
| `absolut` | Registrierung bis 31.7.2026 | ein Datum |
| `relativ` | BG-Anmeldung 7 Tage nach Gründung | Bezug (Ereignis, Datums-Fakt oder andere erledigte Pflicht) + Versatz |
| `wiederkehrend` | USt-VA | Rhythmus (ggf. abhängig von Fakten) + Fälligkeitsregel + optionale Verlängerung |

Fälligkeitsregeln bei `wiederkehrend`: `tag_nach_periodenende` (USt-VA, Lohnsteuer), `feste_termine` (Vorauszahlungen `03-10`, `06-10`, …), `n_letzter_bankarbeitstag` (SV-Beiträge, mit `arbeitstage_vorher` für den Beitragsnachweis).

**Relative Fristen:** Fehlt das Bezugsereignis, gilt die Pflicht trotzdem, aber ohne Termin; die Karte zeigt „Termin hängt von … ab“. Bei `zeitpunkt: vor_beginn` ist der Termin der Tag vor dem Bezugstag. Mehrere Ereignisse gleichen Typs: Bezug ist das früheste nicht stornierte. Mit `je_ereignis: true` entsteht stattdessen je Ereignis eine eigene Instanz mit der Periode `aenderung-JJJJMMTT` (z. B. SV-Anmeldung je Einstellung, E-091).

**Berechnungsreihenfolge:** Rohtermin → Verlängerung (`verlaengerung.versatz`, falls Bedingung gilt) → Verschiebung (`verschiebung.regel` mit `kalender`). Monatsende-Regel: Ein Versatz von einem Monat ab dem 31. landet auf dem letzten Tag des Folgemonats. Jeder Termin hat eine `periode` (`2026-10`, `2026-Q3`, `2026`, `einmalig`); zusammen mit Pflicht-ID und Unternehmen ist sie eindeutig.

**Kalender:** `bundeseinheitlich`, `bundesland`, `gemeinde` (Feiertage aus `katalog.feiertag`) und `bankarbeitstage`. Welche Pflicht welchen Kalender und welche Verschiebung nutzt, ist pro Pflicht `[FACHLICH ZU PRÜFEN]` (E-037).

## Ausgabe der Engine

```jsonc
{
  "pflicht_id": "steuern.ust_voranmeldung",
  "pflicht_version": 1,
  "ergebnis": "gilt",                         // gilt | gilt_nicht | unbekannt
  "begruendung": {                            // Lebensmittelfachbeauftragter, Knoten mit label und Ist-Wert
    "op": "all", "ergebnis": "gilt",
    "kinder": [
      { "feld": "profil.ust.kleinunternehmer", "ist": false, "soll": false, "ergebnis": "gilt",
        "label": "Du nutzt die Kleinunternehmerregelung nicht." },
      { "op": "any", "ergebnis": "gilt", "kinder": [
        { "feld": "profil.ust.zahllast_vorjahr", "ist": 12400, "op": ">",
          "soll": { "regelwert": "steuern.ust_va.grenze_befreiung", "version": 1, "wert": 2000 },
          "ergebnis": "gilt" } ] } ]
  },
  "fehlende_fakten": [],
  "termine": [
    { "periode": "2026-10", "roh": "2026-11-10", "faellig_am": "2026-11-10",
      "rhythmus": "monatlich", "verschoben": null }
  ],
  "regelwerte_genutzt": [{ "id": "steuern.ust_va.grenze_befreiung", "version": 1 }]
}
```

Daraus entstehen der Satz „Diese Pflicht gilt für dich, weil …“ (Labels der Knoten mit Ergebnis `gilt` auf dem entscheidenden Pfad) und bei `gilt_nicht` die Begründung für „nicht zutreffend“.

Die Engine ist eine **reine Funktion** `auswerten(katalog, fakten, ereignisse, stichtag, kalender) → Ergebnis[]` ohne Datenbank- oder Netzzugriff. Dadurch läuft sie identisch auf Server, Web, App und im Studio-Testlauf.

## Fixtures

```yaml
# catalog/fixtures/solo-freiberufler-kleinunternehmer.yaml
persona: solo_freiberufler
stichtag: "2026-10-11"
fakten:
  profil.rechtsform: freiberuf
  profil.ust.kleinunternehmer: true
  profil.beschaeftigte.gesamt: 0
erwartet:
  steuern.ust_voranmeldung: gilt_nicht
  arbeitsschutz.gefaehrdungsbeurteilung: gilt_nicht
  gruendung.berufsgenossenschaft: gilt
```

Pflicht in CI: mindestens eine Fixture je Persona und eine je Schwellenwert-Grenzfall (genau an der Grenze, 1 Cent darüber, Fakt fehlt). Der Studio-Testlauf zeigt vor jeder Freigabe, welche Fixtures ihr Ergebnis ändern.

## Validator

```bash
cd packages/rules-schema
npm run validate        # Entwurf: Schema + Querverweise
npm run validate:prod   # zusätzlich: freigegeben, Englisch vorhanden, Quellen abgerufen, keine offenen Prüfpunkte
```

Er prüft auch, dass sich Versionen eines Regelwerts zeitlich nicht überlappen und dass Dateiname und ID übereinstimmen.

## Startbestand und Lücken (E-075)

Der Startbestand wird aus der Spezifikation erzeugt (`scripts/katalog_startbestand.py`), danach im Studio gepflegt. Lücken werden nicht gefüllt, sondern sichtbar gemacht:

| Spezifikation nennt nicht … | Im Katalog | Prüfpunkt |
|---|---|---|
| eine Frist | `frist: { typ: dauerhaft }` | „Frist nicht in der Spezifikation genannt …“ |
| Folgen | „Die Folgen sind noch nicht fachlich erfasst.“ | „Folgen … nicht in der Spezifikation genannt …“ |
| die Rechtsgrundlage | ergänzt | „Rechtsgrundlage ergänzt, steht nicht in der Spezifikation“ |

Mit offenen Prüfpunkten kann eine Version in kein prod-Release (Validator `--prod`).
