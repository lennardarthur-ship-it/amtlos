# 05 · Risiken

Stand: 2026-10-11 · Bewertung: Eintritt (E) und Auswirkung (A) jeweils niedrig/mittel/hoch.

| Nr. | Risiko | E | A | Gegenmaßnahme | Verantwortlich |
|---|---|---|---|---|---|
| R-01 | **Keine fachlichen Prüfer** oder zu wenig Prüfkapazität. Ohne Freigabe kein Livegang (E-002). Der Startkatalog hat 75 Pflichten plus Branchenmodule, jede braucht zwei Prüfungen. | hoch | hoch | Prüfer-Partner vor Abschnitt 2 vertraglich binden; Katalog nach Personas priorisieren (Livegang mit Teilkatalog, klar gekennzeichnet); Studio so bauen, dass eine Prüfung < 15 min dauert (Diff, Fixtures, Quellen nebeneinander). | Product Owner |
| R-02 | **Falsch-negative Aussage** („gilt nicht“), Nutzer versäumt Pflicht, Haftungsanspruch. | mittel | hoch | Dreiwertige Logik (E-033); „nicht zutreffend“ immer mit Begründung und „trotzdem prüfen lassen“; Haftungsbegrenzung (J-3); Vermögensschadenhaftpflicht (Spez. 8.6). | PO + Recht |
| R-03 | **StBerG/RDG**: einzelne Funktionen (ELSTER-Übermittlung, Postfach-Erklärungen, Assistent) werden als unzulässige Hilfe in Steuer- oder Rechtssachen gewertet. | mittel | hoch | Juristische Klärung J-1, J-2 vor Abschnitt 3 bzw. 9; Architektur hält Alternativen offen (ERiC lokal oder serverseitig); Assistent nur katalogbasiert. | Recht |
| R-04 | **ELSTER-Herstellerregistrierung und ERiC** dauern länger als geplant; ERiC ist eine native Bibliothek mit eigenen Plattformvorgaben. | mittel | mittel | Registrierung sofort beantragen; ERiC im eigenen Container kapseln (E-011); Abschnitt 3 so schneiden, dass der Gründungsassistent zunächst mit vorausgefülltem Ausdruck/Deeplink funktioniert. | Tech |
| R-05 | **Katalog veraltet**: Gesetzesänderungen werden zu spät eingepflegt. | hoch | hoch | Radar mit Fälligkeiten; Quellen mit Abrufdatum, automatische Prüfung toter Links; Redaktionsrhythmus (monatlich + anlassbezogen); „Prüfdatum“ für Nutzer sichtbar. | Redaktion |
| R-06 | **Regel-Komplexität** wächst schneller als das DSL (Sonderfälle, Ermessen, Übergangsregeln). | mittel | mittel | DSL bewusst klein; Sonderfälle als abgeleitete Fakten im Code (getestet) statt als DSL-Erweiterung; Ermessensfälle als `hinweis` statt als harte Pflicht. | Tech |
| R-07 | **Zählweisen und Schwellen** unterscheiden sich je Gesetz (Beschäftigte, Umsatzbegriff). Ein einheitlicher Wert würde systematisch falsche Ergebnisse liefern. | hoch | mittel | Eigene Fakten je Zählweise (E-032), jede `[FACHLICH ZU PRÜFEN]`; Fixtures für Grenzfälle. | Tech + Prüfer |
| R-08 | **Feiertags- und Bankarbeitstagsdaten** fehlerhaft, besonders kommunale Feiertage. | mittel | mittel | Feiertage als Daten mit Quelle; jährliche Prüfung; Tests für jeden Feiertag der nächsten 3 Jahre gegen eine zweite Quelle. | Tech |
| R-09 | **Sicherheitsvorfall**: Steuer-, Lohn- und Gesundheitsdaten von Unternehmen sind ein attraktives Ziel. | mittel | hoch | RLS mit Tests in CI, App-Rolle ohne Eigentum, Feldverschlüsselung, Isolation fremder Inhalte, Pentest vor Livegang, Bug-Bounty später, Ziel ISO 27001. Der Schema-Test hat bereits eine Lücke gefunden (Selbst-Eintragung in fremde Unternehmen) – Beleg, dass diese Tests Pflicht bleiben. | Tech |
| R-10 | **Push-Benachrichtigungen** laufen technisch über Dienste der Plattformbetreiber außerhalb der EU. | hoch | niedrig | Push-Inhalte ohne personenbezogene oder steuerliche Details („Du hast eine neue Frist“); Details erst nach Öffnen der App. | Tech |
| R-11 | **Audit-Log vs. Löschpflicht**: Hash-Kette verträgt keine Löschung, DSGVO verlangt sie. | mittel | mittel | Personendaten im Audit nur als Pseudonym/maskiert; Zuordnungstabelle löschbar; Ansatz von Datenschutzberatung bestätigen lassen. | Tech + DSB |
| R-12 | **Audit-Kette als Engpass**: globale Sperre pro Schreibvorgang. | mittel | niedrig | Lasttest in Abschnitt 1; bei Bedarf Kette je Unternehmen statt global. | Tech |
| R-13 | **LLM-Antworten** erfinden Fristen oder Paragraphen. | mittel | hoch | Kein LLM in Entscheidungslogik; Assistent nur mit Quellenbindung, Antworten gegen Katalog validiert, sonst „weiß ich nicht sicher“; Belegerkennung immer mit Nutzerbestätigung. | Tech |
| R-14 | **Umfang**: zehn produktionsreife Abschnitte sind sehr viel für ein kleines Team; Gefahr, dass „produktionsreif“ verwässert. | hoch | mittel | Definition of Done strikt; jeder Abschnitt mit Testbericht; Livegang nach Abschnitt 2 mit Teilkatalog statt Warten auf alles. | PO |
| R-15 | **Abhängigkeit von Partnern** (Lohn, Banking, Signatur): Preisänderung, Einstellung, Ausfall. | mittel | mittel | Adapter-Schicht je Partnerart; Vergleich in Abschnitt 5 (E-052); Exportfähigkeit aller Daten. | Tech |
| R-16 | **Vertrauensverlust durch Fehlalarme** (zu viele oder irrelevante Pflichten). | mittel | mittel | Max. drei Aufgaben in „Als Nächstes tun“; Priorität nach Sanktionsschwere und Frist; Nutzer-Feedback „passt nicht“ je Karte → Redaktion. | Produkt |
| R-17 | **Barrierefreiheit der eigenen App** (BFSG) wird spät geprüft. | mittel | mittel | axe-Tests in CI ab Abschnitt 1, manuelle Prüfung je Abschnitt, Barrierefreiheitserklärung. | Tech |

## Annahmen, die das Risiko beeinflussen

- Die in der Spezifikation genannten Werte (Stand Oktober 2026) sind der Ausgangspunkt; sie wurden **nicht** unabhängig nachrecherchiert (E-054). Die Quell-URLs in den Beispielen sind noch nicht abgerufen (`abgerufen: null`); gesetze-im-internet.de war aus der Arbeitsumgebung nicht erreichbar.
- STACKIT stellt die benötigten Dienste (Kubernetes, Postgres ≥ 16 mit `btree_gist`, Object Lock) bereit – vor Abschnitt 1 technisch zu bestätigen (E-013).
