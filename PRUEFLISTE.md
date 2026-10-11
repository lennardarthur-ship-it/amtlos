# PRÜFLISTE

Zentrale Liste aller Punkte mit `[FACHLICH ZU PRÜFEN]` (Spezifikation 14.4). Wer prüft: **StB** Steuerberater, **RA** Rechtsanwalt, **Sifa** Fachkraft für Arbeitssicherheit, **DSB** Datenschutz, **Tech** technisch.

Stand: 2026-10-11

## Grundsätzliche Punkte

| Nr. | Punkt | Wer | Quelle |
|---|---|---|---|
| G-01 | Alle 75 Pflichten und alle Werte aus Spezifikation Abschnitt 4 sind ungeprüft übernommen (E-054). Jede braucht Vier-Augen-Freigabe. | StB/RA/Sifa | E-002 |
| G-02 | Zuordnung Kategorie → erforderliche Prüferqualifikation | RA | E-039 |
| G-03 | Fristverschiebung (Wochenende/Feiertag) und maßgeblicher Kalender je Pflicht | StB/RA | E-037 |
| G-04 | Kommunale Feiertage: vollständige Liste und Quelle | Tech | E-037, R-08 |
| G-05 | Zählweise der Beschäftigten je Gesetz (BDSG § 38, SGB IX, HinSchG, VSBG § 36, BFSG) | RA | fakten.json, R-07 |
| G-06 | Umsatzbegriff für die Kleinunternehmergrenze bei Echtzeit-Überwachung | StB | fakten.json |
| G-07 | Wortlaut und Darstellung von „nicht zutreffend“ und „Angabe fehlt“ | RA | J-3, E-033 |
| G-08 | Wo erscheint „ersetzt keine Steuer- oder Rechtsberatung“ (Vorschlag in 04-seitenstruktur) | RA | Spez. 8.4 |
| G-09 | Aufbewahrungs- und Löschfristen je Datenart in Amtlos selbst | StB/DSB | 02-datenmodell |
| G-10 | Audit-Log und DSGVO-Löschpflicht | DSB | R-11 |
| G-11 | Quellen-URLs abrufen und Fundstellen eintragen (aus der Arbeitsumgebung nicht erreichbar) | Redaktion | 05-risiken |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

| Nr. | Objekt | Katalog-Nr. | Punkt |
|---|---|---|---|
| K-01 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Frist: 'vor Arbeitsbeginn' als Auslegung bestätigen |
| K-02 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Auslöser neu_ausloesen_bei: Liste der Anlässe vollständig? |
| K-03 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | gueltig_ab 1996-08-21 aus Spezifikation übernommen |
| K-04 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-05 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-06 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-07 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-08 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-09 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-10 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-11 | `personal.mindestlohn.stunde@1` | D.39 | Fundstelle der geltenden Anpassungsverordnung ergänzen |
| K-12 | `personal.mindestlohn.stunde@2` | D.39 | status_recht 'beschlossen' vs. 'in_kraft' (Verordnung bereits erlassen?) |
| K-13 | `personal.minijob.grenze_monat@1` | D.39 | Dynamische Kopplung an Mindestlohn: als Berechnung oder als gepflegter Wert führen? |
| K-14 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-15 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-16 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-17 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-18 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-19 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-20 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
