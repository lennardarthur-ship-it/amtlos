# 06 · Designsystem

Stand: 2026-10-11 · Quelle: `packages/web-kern/src/designsystem.css`

## Haltung

Ruhig, behördennah ohne Behördenhärte (Spezifikation 11). Papier und Tinte statt Software-Bunt. Ein einziges prägendes Element, das **Fristblatt**; alles andere bleibt zurückhaltend: Listen mit Trennlinien statt Kartenraster, keine Schatten, keine Verläufe.

## Farben

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `papier` | `#f2f3ef` | `#11171d` | Seitenfläche |
| `blatt` | `#ffffff` | `#19212a` | Lese- und Eingabeflächen |
| `tinte` | `#1b2a3a` | `#e6eae3` | Text |
| `tinte-leise` | `#4a5868` | `#aeb8c2` | Nebentext (≥ 7:1) |
| `linie` | `#d3d8d0` | `#2f3a45` | Trennlinien |
| `amt` | `#136f5b` | `#5cc2a6` | Handeln: Knöpfe, Links, Erledigt-Stempel |
| `frist` | `#b42318` | `#ff8a7a` | überfällig |
| `bald` | `#a84a06` | `#f5b453` | bald fällig |

Statusfarben erscheinen nie allein, immer mit Form und Wort (E-074).

## Schrift

Atkinson Hyperlegible, entwickelt für Lesbarkeit bei Sehschwäche, selbst gehostet (keine Anfrage an Google, DSGVO). Die durchgestrichene Null ist gewollt: Ziffern sind in Fristen und Beträgen eindeutig. Skala ≈ 1,25: 13 / 16 / 20 / 25 / 39 px.

## Fristblatt

Datum wie auf einem Abreißkalender: Wochentag, großer Tag, Monat. Der Bindestreifen oben trägt den Status (rot überfällig, bernstein bald, grün erledigt, keiner bei „Angabe fehlt“ und „ohne Termin“ mit gestrichelter Kante). Für Screenreader ist es ausgeblendet; das Datum steht zusätzlich als Text.

## Erledigt-Stempel

Einmalige, leicht gedrehte Umrandung wie ein Amtsstempel. Die einzige Bewegung im System; bei „Bewegung reduzieren“ entfällt sie.

## Qualitätsboden

WCAG 2.2 AA, geprüft mit axe im E2E-Rundgang (hell/dunkel, Desktop/mobil). Ziele mindestens 44 px, sichtbarer Fokus, „Zum Inhalt springen“, Zeilenlänge ≤ 68 Zeichen, Dunkelmodus über `prefers-color-scheme`.

## iPhone-App (E-137)

Quelle: `apps/mobile/src/ui/thema.ts` und `bausteine.tsx`.

- **Schrift:** Amtlos Serif (Halbfett) für Seitentitel und Abschnittsüberschriften, Amtlos Sans für alles andere. Es sind dieselben Dateien wie in den Dokumenten und auf der Website. Skala: 13,5 / 15,5 / 17,5 / 21 / 27 / 34 pt. Auszeichnung in Halbfett, Beträge fett mit gleich breiten Ziffern (`Betrag`).
- **Farben:** wie oben, dazu `flaeche` (ruhige Füllung), `zeiger` (Listenpfeile), `amtText` (Schrift auf Grün) und `buehne`, die eine dunkelgrüne Fläche je Seite.
- **Flächen:** Karten hell mit weichem Schatten, dunkel mit Rahmen. Ecken 12 / 14 / 18 / 24, Chips rund. Haarlinien in Listen sind ab dem Text eingerückt.
- **Stempel:** das Bildzeichen aus dem App-Symbol. Er erscheint auf der Bühne, bei leeren Listen und bei geschafften Schritten, sonst nicht.
- **Kacheln:** getönte Symbol-Kacheln vor Listenzeilen. Grün steht für Handeln, Bernstein für fehlende Angaben, Grau für Neutrales. Personen erscheinen mit Initialen.
- **Knöpfe:** ein gefüllter Hauptknopf je Bildschirm; `ton` für Zweitrangiges, `buehne` auf der Bühne, Textknöpfe für Nebenwege. 52 pt hoch, geben beim Drücken leicht nach.
