# Testbericht Bauabschnitt 8 · Branchenmodule

Stand: 2026-10-11 · Spezifikation 12 (Abschnitt 8), Katalog H

## Ergebnis in einem Satz

Neun Branchenpakete aus dem Katalog: 18 neue Pflichten, dazu 26 vorhandene Pflichten den Paketen zugeordnet (in neuer Version). Die Gastronomie ist voll ausgebaut mit HACCP-Eigenkontrollen, Allergenliste mit Aushang und IfSG-Belehrung. Handwerk und Onlinehandel nutzen die vorhandenen Werkzeuge. **584 automatisierte Tests und 59 Datenbanktests sind grün**, die E2E-Rundgänge in Web und Studio ebenfalls (axe ohne Befunde).

## Was neu ist

| Bereich | Umfang |
|---|---|
| Katalog H | Gastronomie: Lebensmittelregistrierung, IfSG-Belehrung je Einstellung, HACCP, Allergene. Handwerk: Gefährdungsbeurteilung je Gewerk, Gewährleistung. Beauty: Hygieneplan, Hautschutzplan, Kosmetikverordnung. Bau: SOKA-BAU, Baustellenverordnung. Transport: Erlaubnis, Lenk- und Ruhezeiten. IT: Scheinselbstständigkeit, Haftung. Gesundheit: Berufserlaubnis. Immobilien/Finanzen: Weiterbildung (§ 34c/d), GwG. Alles ungeprüft und markiert |
| Zuordnung | `branchen` an 26 vorhandenen Pflichten, darunter das ganze Paket G für Onlinehandel; jeweils neue Version (E-019) |
| Fixtures | 3 neue (Gastro-Start mit Einstellung, Friseur/Kosmetik, Mischbetrieb Bau/Transport/IT/Immobilien) |
| Datenmodell (0012) | Messpunkte, Messungen (nur anhängen, Abweichung nur mit Maßnahme, Grenzwerte je Messung gespeichert), Gerichte mit Allergenen (nur die 14 Hauptallergene), Unterweisungsart `ifsg` |
| API | 10 neue Routen (Messpunkte, Messungen, Monatsübersicht und PDF, Allergene, Gerichte, Aushang-PDF). Pflichtkarten tragen `branchen`. IfSG-Abschluss erledigt die Pflicht je Einstellung |
| Web | Bereich „Branche“ (Desktop-Seitenleiste, mobil unter „Mehr“, Hinweis auf „Heute“) mit Paketen je Branche. Seiten für Eigenkontrollen und Allergene. IfSG-Belehrungen über das Unterweisungsmodul. Neue Anleitung in der Hilfe |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 8) |
|---|---:|
| Regel-Engine inkl. 46 Fixture-Dateien | 394 |
| Server | 36 |
| API (neu: Branchen an Pflichtkarten, Eigenkontrollen mit Abweichung und DB-Schutz, Allergene, IfSG-Belehrung, Grenzwert-Einheitentest) | 57 |
| Übersetzungen | 51 |
| Fristen | 21 |
| Validator | 7 |
| Web (neu: Branchen aus dem Profil, Werkzeug-Seiten) | 10 |
| Studio | 5 |
| Worker | 3 |
| **Summe** | **584** |
| Datenbank (`db/tests`) | 59 |
| E2E Web | Branchenseite, Eigenkontrolle mit abgewiesener und dokumentierter Abweichung, Monatsprotokoll-PDF, Gericht mit Allergenen, Aushang-PDF. axe ohne Befunde, hell/dunkel |

## Von Tests gefundene und behobene Fehler

1. Der Katalog-Import lehnte geänderte Pflichten ab, weil eine veröffentlichte Version nicht geändert werden darf. Zugeordnete Pflichten erscheinen jetzt als neue Version. Der Generator führt dafür eine Versionsliste.
2. Im E2E-Test wurde die zweite Messung abgeschickt, während die erste noch lief. Der Test wartet jetzt auf die Antwort (die Anwendung selbst war in Ordnung).
3. Messwerte erschienen mit Punkt statt Komma („9.5 °C“). Web und PDF formatieren jetzt nach Sprache. „1 Abweichungen“ heißt jetzt „Abweichungen: 1“.
4. Ein Fixture mit Einstellung in der Zukunft löste die IfSG-Pflicht nicht aus. Fachlich richtig, weil das Ereignis noch nicht eingetreten ist; das Fixture ist korrigiert.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe Katalog H (18 Pflichten) und der neuen Versionen | keine Prüfer (R-01) | Studio ist bereit |
| Vorlagen (Hygieneplan, Hautschutzplan, Gefährdungsbeurteilung je Gewerk) | Inhalte (T-20, T-36) | Dokumentengenerator nach Freigabe |
| Vorschläge für HACCP-Kontrollpunkte und Grenzwerte | fachlich (T-34) | aus Leitlinien nach Prüfung |
| Werkzeuge für Bau (SOKA-Meldungen), Transport (Fahrtenschreiber-Auslese) | Schnittstellen und Inhalte fehlen | nach Partnerwahl |
| Dokumentvorlagen als DOCX | 6.4 | eigener Schritt |
