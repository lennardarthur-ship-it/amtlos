# Lasttest Neuberechnung

Stand: 2026-10-11 · Skript: `scripts/lasttest-neuberechnung.mjs` · Ziel (docs/01): Neuberechnung für 100.000 Unternehmen in unter 30 Minuten.

## Aufbau

- Eigene Datenbank, aktueller Katalog (37 Pflichten), Unternehmen mit den 21 Persona- und Grenzfall-Profilen aus `catalog/fixtures` (reihum).
- Gemessen wird genau das, was der Worker je Unternehmen tut: Neuberechnung + Erinnerungsplanung in einer Transaktion, als Rolle `worker_user` (mit RLS), 8 parallel.
- **Erstberechnung:** alle Pflichtinstanzen neu (wie nach einem Release mit vielen Änderungen).
- **Tageswechsel:** nichts ändert sich (der tägliche Normalfall).
- Maschine: 2 CPU-Kerne, PostgreSQL 16 auf derselben Maschine. In Produktion (eigener DB-Server, mehr Kerne, mehrere Worker) ist mehr zu erwarten; die Zahlen sind eine Untergrenze.

## Ergebnisse

| Lauf | Unternehmen | Dauer | je Sekunde | p50 | p95 | p99 | hochgerechnet 100.000 |
|---|---:|---:|---:|---:|---:|---:|---:|
| vorher, Erstberechnung | 2.000 | 51,3 s | 39 | 199 ms | 276 ms | 326 ms | 42,7 min ✗ |
| vorher, Tageswechsel | 2.000 | 50,9 s | 39 | 200 ms | 265 ms | 295 ms | 42,4 min ✗ |
| **nachher, Erstberechnung** | 10.000 | 116 s | 86 | 88 ms | 131 ms | 190 ms | **19,3 min ✓** |
| **nachher, Tageswechsel** | 10.000 | 67 s | 149 | 48 ms | 101 ms | 144 ms | **11,2 min ✓** |

Keine Fehler in allen Läufen.

## Was der Test gefunden hat (E-085)

1. **Eine Anweisung je Pflichtinstanz** (≈ 39 Hin- und Rückwege je Unternehmen). Jetzt ein einziger Upsert für alle Instanzen.
2. **Unveränderte Zeilen wurden trotzdem neu geschrieben** – jedes Mal ein neues Tupel und ein Audit-Eintrag. Der Audit-Trigger serialisiert über eine globale Sperre (Hash-Kette), dadurch liefen die 8 Worker praktisch nacheinander. Jetzt werden nur geänderte Zeilen geschrieben; der Tageswechsel schreibt fast nichts.
3. **Audit-Volumen:** Der Begründungsbaum stand vollständig im Audit. Er ist aus Profilversion und Release reproduzierbar und wird nicht mehr protokolliert (Migration 0006); Status, Fälligkeit, Erledigung, wer und wann bleiben vollständig.

## Speicherbedarf (10.000 Unternehmen)

709 MB gesamt ≈ 71 KB je Unternehmen (≈ 7 GB für 100.000), davon der größte Teil Pflichtinstanzen mit Begründung und das Audit der Erstberechnung. Je Lauf kommt ein Berechnungslauf mit Fakten hinzu (≈ 0,8 KB). Bei täglicher Neuberechnung sind das ≈ 80 MB pro Tag für 100.000 Unternehmen – **Aufbewahrungsfrist für Berechnungsläufe festlegen** (Prüfpunkt G-09), danach ein Aufräum-Job.

## Nachmessung Abschnitt 10 (146 Pflichten, Übersetzungen, Push)

Der Katalog ist seit der ersten Messung von 37 auf 146 Pflichten gewachsen (≈ 150 Pflichtinstanzen je Unternehmen statt ≈ 40). Gleiche Maschine (2 Kerne), Parallelität 8.

| Lauf | Unternehmen | Dauer | je Sekunde | p50 | p95 | p99 | hochgerechnet 100.000 |
|---|---:|---:|---:|---:|---:|---:|---:|
| vor 0017, Tageswechsel | 2.000 | 29,1 s | 69 | 87 ms | 235 ms | 294 ms | 24,3 min |
| vor 0017, Erstberechnung | 2.000 | 54,9 s | 36 | 216 ms | 324 ms | 384 ms | 45,8 min |
| **nach 0017, Tageswechsel** | 10.000 | 89 s | 112 | 70 ms | 104 ms | 126 ms | **14,8 min ✓** |
| **nach 0017, Erstberechnung** | 10.000 | 211 s | 47 | 166 ms | 216 ms | 273 ms | 35,2 min |

Gefunden und behoben (E-109):

1. **Fehlende Indizes für den RLS-Filter.** 24 Mandantentabellen hatten keinen Index mit `unternehmen_id` vorne, darunter `app.erinnerung`. Jede Abfrage las alle Mandanten (3 ms je Abfrage bei 2.000 Unternehmen, wachsend). Migration 0017 legt die Indizes an. Ein Schematest verhindert, dass neue Tabellen ohne Index entstehen. Der Durchsatz bleibt jetzt von 2.000 bis 10.000 Unternehmen gleich.
2. **Erinnerungen wurden täglich komplett neu geschrieben.** Jetzt werden nur Unterschiede geschrieben. Sofort-Erinnerungen behalten ihren Zeitpunkt.
3. Zwei Abfragen je Katalog-Zugriff sind zu einer zusammengefasst.

Die **Erstberechnung** nach einem großen Release liegt hochgerechnet bei 35 Minuten. Grund ist das Audit jeder neuen Pflichtinstanz über die globale Hash-Kette. Das ist vertretbar, weil sie nur nach Releases mit vielen Änderungen anfällt und der Rollout über die Warteschlange verteilt läuft. Ein eigener Datenbankserver bringt deutlich mehr. Abhilfe, falls nötig: Audit der Erstanlage gebündelt je Berechnungslauf statt je Zeile (Prüfpunkt G-16).

Speicher bei 10.000 Unternehmen: 2,7 GB ≈ 267 KB je Unternehmen (≈ 27 GB für 100.000). Den größten Teil machen Pflichtinstanzen mit Begründungsbaum und deren Audit aus. Die Aufbewahrung der Berechnungsläufe (G-09) bleibt offen.

## In der CI

Der Datenbank-Job führt den Test mit 1.000 Unternehmen aus und schlägt fehl, wenn die Hochrechnung für den Tageswechsel über 30 Minuten liegt.
