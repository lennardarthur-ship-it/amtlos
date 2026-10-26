# 06 · Designsystem

Stand: 2026-10-22 · Quelle: `packages/web-kern/src/designsystem.css`, `apps/mobile/src/ui/thema.ts`, `apps/website/seite.html`

## Haltung

Ruhig, behördennah ohne Behördenhärte (Spezifikation 11). Papier und Tinte statt Software-Bunt. Ein einziges prägendes Element, das **Fristblatt**; alles andere bleibt zurückhaltend: Listen mit Trennlinien statt Kartenraster, keine Schatten, keine Verläufe.

## Farben

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
Web-App (`designsystem.css`, Tailwind-Tokens `--color-*`):

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `papier` | `#f3f3f8` | `#0f0e1c` | Seitenfläche |
| `blatt` | `#ffffff` | `#1a1930` | Lese- und Eingabeflächen |
| `tinte` | `#120e3a` | `#ecebf5` | Text |
| `tinte-leise` | `#4b4966` | `#b3b1cc` | Nebentext (≥ 7:1) |
| `linie` | `#d6d5e3` | `#33314d` | Trennlinien |
| `amt` | `#3b30c4` | `#a79dff` | Handeln: Knöpfe, Links, Auswahl (White-Label-Marken ersetzen nur diesen Ton) |
| `erfolg` | `#08785a` | `#7cf5c8` | Erledigt: Stempel, Fristblatt, Bestätigungen |
| `frist` | `#b42318` | `#ff8a7a` | überfällig |
| `bald` | `#a84a06` | `#f5b453` | bald fällig |

Statusfarben erscheinen nie allein, immer mit Form und Wort (E-074). Die Flächen, gegen die das Studio Markenfarben prüft, stehen in `MARKEN_FLAECHEN` (`packages/server/src/studio.ts`) und müssen zu `papier`/`blatt` passen.

## Schrift

Atkinson Hyperlegible, entwickelt für Lesbarkeit bei Sehschwäche, selbst gehostet (keine Anfrage an Google, DSGVO). Die durchgestrichene Null ist gewollt: Ziffern sind in Fristen und Beträgen eindeutig. Skala ≈ 1,25: 13 / 16 / 20 / 25 / 39 px.

## Fristblatt

Datum wie auf einem Abreißkalender: Wochentag, großer Tag, Monat. Der Bindestreifen oben trägt den Status (rot überfällig, bernstein bald, Minze erledigt, keiner bei „Angabe fehlt“ und „ohne Termin“ mit gestrichelter Kante). Für Screenreader ist es ausgeblendet; das Datum steht zusätzlich als Text.

## Erledigt-Stempel

Einmalige, leicht gedrehte Umrandung wie ein Amtsstempel. Die einzige Bewegung im System; bei „Bewegung reduzieren“ entfällt sie.

## Qualitätsboden

WCAG 2.2 AA, geprüft mit axe im E2E-Rundgang (hell/dunkel, Desktop/mobil). Ziele mindestens 44 px, sichtbarer Fokus, „Zum Inhalt springen“, Zeilenlänge ≤ 68 Zeichen, Dunkelmodus über `prefers-color-scheme`.

## iPhone-App (E-142 „Bühne und Papier“)

Quelle: `apps/mobile/src/ui/thema.ts`, `bausteine.tsx` und `seiten/gemeinsam.tsx` (`BuehnenSeite`).

- **Aufbau:** Jede Tab-Seite beginnt auf der Bühne in Navy (`#120e3a`, dunkel `#17124a`) mit weißer Schrift und Minze (`#7cf5c8`). Darunter liegt ein helles Blatt (`#f4f4f9`, dunkel `#0b0a16`, Ecken 32) mit weißen Karten (Ecken 24). Auf der Bühne steht nur, was zählt: ein Betrag, das Jahr, ein bis zwei Knöpfe.
- **Schrift:** Onest in fünf Schnitten. Titel extrafett und eng gesetzt (34 / 28), Überschrift 20, Fließtext 17, klein 15, Fußnote 13.
- **Knöpfe:** Abgerundete Rechtecke (18), 54 pt hoch. Der Hauptknopf ist Navy (dunkel: Minze mit Navy-Schrift). Auf der Bühne gibt es den Minze-Knopf und den Glasknopf (Weiß 12 %).
- **Symbole:** Getönte Quadrate (Hauch-Farbe, Zeichen in der Tonfarbe). Das Fristblatt ist ein getöntes Quadrat mit Tag und Monat, der Ton trägt den Status.
- **Navigation:** Eine dunkle, schwebende Kapsel. Der aktive Tab ist eine Minze-Pille mit Wort, rechts sitzt der Minze-Knopf „+“. Unterseiten und Blätter nutzen die nativen Leisten.
- **Unterseiten und Blätter:** `BuehnenBlatt` (Titel, Satz, Kennzahl auf der Bühne) bzw. `Unterseite` (Titelband in Bühnenfarbe); alle Leisten in Bühnenfarbe mit Glasknöpfen. Abläufe: Fortschritt und Schritt-Titel auf der Bühne, Felder auf dem Blatt.
- **Rechnung:** Der Abschluss zeigt das Dokument als Blatt Papier auf der Bühne; jeder Abschnitt ist antippbar und führt zu seinen Feldern (E-144).
- **Marke:** Das Bildzeichen des Logos (drei Ebenen, oben mit Haken; `BildZeichen` in `bausteine.tsx`) groß, leise und angeschnitten oben rechts auf der Bühne – es ersetzt das frühere §-Motiv (E-139). Wo § inhaltlich steht (Rechtsgrundlagen), bleibt es. App-Symbol, Startbild und Favicon: Logo-Dateien aus `packages/marke/logo`.
- **Stempel:** Form unverändert (doppelter Ring, Haken, gedreht); Farbe ist die Erfolgsfarbe (`erfolg`), auf der Bühne Minze. Auf dem Rechnungsblatt „Bezahlt“ in dunkler Minze `#08785a`, „Geteilt“ in Indigo `#3b30c4`.

## Farbwelt des Logos (Stand 2026-10-22)

Gründerentscheidung „alles anpassen“: App, Website, Web-App, Dokument-Standardfarbe und Store-Bilder folgen den Logo-Farben **Navy `#120e3a`**, **Indigo `#3b30c4`**, **Violett `#6e5bff`** und **Minze `#7cf5c8`** statt Dunkelgrün/Minze. Rollen:

- **Navy = Bühne:** dunkle Flächen (Bühne, Hauptknopf, Tab-Kapsel, Store-Hintergrund) und – auf Hell – die Tinte.
- **Indigo = Handeln:** Links, Auswahl, Fokusrahmen der Felder, Fortschritt, Symbole (`amt`). Dunkel als helles Violett `#a79dff`.
- **Minze = Signal und Erfolg:** auf der Bühne (Knöpfe, aktiver Tab, Kennzahlen) und für Erledigtes (`erfolg`). Auf hellem Grund nie als Schrift, sondern als dunkle Minze `#08785a`.
- **Violett** nur im Bildzeichen (mittlere Ebene).
- **Neutrale Töne** leicht zum Navy getönt (Farbton ≈ 245°) statt grünstichig. Rot (`frist`) und Bernstein (`bald`) bleiben unverändert.

### App-Tokens (`thema.ts`)

| Token | Hell | Dunkel | Kontrast hell / dunkel (WCAG 2.x) |
|---|---|---|---|
| `papier` | `#f4f4f9` | `#0b0a16` | – |
| `blatt` | `#ffffff` | `#18172b` | – |
| `flaeche` | `#e9e8f3` | `#25243d` | – |
| `tinte` | `#120e3a` | `#f3f3f8` | 16,7 auf Papier / 15,9 auf Blatt |
| `tinteLeise` | `#585672` | `#aaa9c2` | 7,0 Blatt · 6,4 Papier · 5,8 Fläche / 7,7 Blatt · 6,6 Fläche |
| `rahmen` | `#78768f` | `#7c7a98` | 4,4 Blatt · 4,0 Papier / 4,3 Blatt (≥ 3:1, 1.4.11) |
| `amt` | `#3b30c4` | `#a79dff` | 8,7 Blatt · 8,0 Papier · 7,4 auf `amtHauch` / 7,5 Blatt · 6,0 auf `amtHauch` |
| `amtTief` | `#2a2196` | `#cdc7ff` | 10,2 / 8,8 auf `amtHauch` (`#ecebff` / `#272263`) |
| `amtText` | `#ffffff` | `#120e3a` | 8,7 / 7,8 auf `amt` |
| `erfolg` | `#08785a` | `#7cf5c8` | 5,5 Blatt · 5,0 Papier · 4,9 auf `erfolgHauch` / 13,2 Blatt · 9,4 auf `erfolgHauch` |
| `erfolgTief` | `#055740` | `#b5fadf` | 7,6 / 10,5 auf `erfolgHauch` (`#dcf8ec` / `#123a35`) |
| `haupt` / `hauptText` | `#120e3a` / `#ffffff` | `#7cf5c8` / `#120e3a` | 18,3 / 13,7 |
| `buehne` | `#120e3a` | `#17124a` | Weiß 18,3 / 17,2 · Minze 13,7 / 12,9 · `buehneLeise` (Weiß 74 %) 10,2 / 9,3 |
| `buehneFlaeche` | `#2b2668` | `#2c2669` | Weiß 13,3 · Minze 10,0 |
| `buehneKnopf` / `…Text` | `#7cf5c8` / `#120e3a` | gleich | 13,7 |
| `kapsel` | `#0e0b2e` | `#2a2750` | Weiß 72 % 10,0 / 8,0 · Minze 14,2 / 10,5 |
| `frist` | `#d70015` | `#ff7a70` | 5,4 Blatt · 4,6 Hauch / 6,9 Blatt · 6,3 Hauch |
| `bald` | `#a05a00` | `#ffb340` | 4,8 auf Hauch / 9,8 Blatt |
| `lila` (veraltet) | `#8a3fbf` | `#d7a6f5` | 5,0 / 7,6 auf Hauch – vom Indigo abgerückt |

### Website (`seite.html`)

Hell: `papier #ffffff`, `blatt #f4f4f9`, `tinte #120e3a` (18,3), `tinte-2 #585672` (7,0 / 6,4 auf Blatt), `tinte-3 #5c5a76` (6,6 / 6,0), `chip-rand #7c7a94` (4,1), `amt #3b30c4` (8,7 / 8,0), `amt-tief #2a2196` auf `amt-hauch #ecebff` (10,2). Dunkel: `papier #0c0b19`, `blatt #17162b`, `tinte #f1f0f8` (17,2), `tinte-2 #aaa9c2` (8,5 / 7,7), `tinte-3 #9897b3` (6,9 / 6,3), `chip-rand #6d6b8a` (3,5), `amt #a79dff` (8,3 / 7,5), `amt-tief #cdc7ff` auf `amt-hauch #272263` (8,8).

### Web-App

Siehe Tabelle oben. Kontraste hell: Tinte 16,5, Tinte leise 8,6 (Blatt) / 7,8 (Papier), `amt` 8,7 / 7,9, Knopfschrift Weiß auf `amt` 8,7, `erfolg` 5,5 / 4,9, Fokus `#2457c5` 5,9. Dunkel: Tinte 16,2, Tinte leise 8,2 / 9,2, `amt` 7,3 / 8,1, Knopfschrift (Blattfarbe) auf `amt` 7,3, `erfolg` 12,9 / 14,3.

### Dokumente

Ohne eigene Hausfarbe drucken die Dokumente in **Indigo `#3b30c4`** (8,7:1 zu Weiß, Hauch 8 % = `#efeefa`); Indigo steht als erste der nun neun Hausfarben in „Mein Betrieb“. Gewählte Hausfarben (Graphit, Marineblau …) bleiben unverändert (amtlos-intern: docs/10-dokumente-gestaltung.md).

### Store-Bilder

Grund Navy `#120e3a`, Überschrift Weiß (18,3), Unterzeile Minze `#7cf5c8` (13,7); das Vorschaubild der Website trägt das Bildzeichen vor dem Namen.


## Kein Dunkelmodus (E-172, 23.10.2026)

App, Website und Web-App sind immer hell. Die Werte für „dunkel“ in den Abschnitten oben gelten nicht mehr; die Navy-Bühne bleibt als Fläche in der hellen Darstellung.
