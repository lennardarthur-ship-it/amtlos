# Inhalte aktualisieren (Katalog, Texte) – Runbook

Stand 29.10.2026 (E-240). Gilt für die Mobile-App (`apps/mobile`); Website und Web-App holen den Katalog beim eigenen
Build bzw. Deployment.

## Kurz

- Rechtsinhalte (Pflichten, Regelwerte, Rechtsstand) stecken im JS-Bündel der App (`src/pflichten/katalog.json`,
  `src/unterlagen/katalog.json`). Heute kommen sie **nur mit einem Store-Release** aufs Gerät.
- Die App sagt selbst, wenn ihr Stand alt ist: **„Rechtsstand vom TT.MM.JJJJ – bitte App aktualisieren“** auf „Heute“
  und in der Einleitung des Pflichten-Checks, mit Link zur Store-Seite. Sie sperrt nichts.
  - mehr als **120 Tage** nach `catalog/rechtsstand.yaml → datum`, oder
  - sofort, wenn ein **Änderungsstichtag** erreicht ist, den der Katalog selbst nennt: `gueltig_ab`/`radar.erwartet_ab`
    von Einträgen und Regelwerten mit `status_recht: entwurf | geplant`, oder das Ende (`gueltig_bis`) einer
    Regelwert-Version ohne Folgeversion. `beschlossen`/`in_kraft` mit späterem Beginn zählt nicht (der Inhalt steht
    schon im Katalog).
  - Logik: `apps/mobile/src/pflichten/aktualitaet.ts`; das Freigabe-Tor nennt den Tag, ab dem der Hinweis erscheint.
- **Inhalts-Updates** (expo-updates: neues JS-Bündel samt Katalog ohne Store-Release) sind vorbereitet, aber **aus**.
  Einschalten erst nach Gründerentscheidung und Ergänzung der Datenschutzhinweise (PRUEFLISTE T-366, T-367).

## Ablauf einer Katalogänderung

1. **Ändern** in `catalog/pflichten/*.yaml` bzw. `catalog/regelwerte/*.yaml` (nur mit Quelle; nichts erfinden).
   Neue Einträge nach dem Startstand mit `nicht_vor_freigabe: true` (erscheinen erst mit der Freigabe, E-233).
2. **Rechtsstand fortschreiben:** `catalog/rechtsstand.yaml → datum` auf den Tag, bis zu dem die veränderlichen
   Einträge gegen die Quellen geprüft sind – auch dann, wenn sich inhaltlich nichts geändert hat (sonst meldet die App
   nach 120 Tagen „veraltet“). Erwartete Daten von Entwürfen (`gueltig_ab`, `radar.erwartet_ab`) aktuell halten:
   Ein überholtes Datum lässt die App sofort „bitte aktualisieren“ sagen.
3. **Freigaben:** geänderte Inhalte verlieren ihre Freigabe (Prüfsumme) – Prüfpaket an die zuständige Rolle,
   Ergebnis in `docs/freigabe-katalog/freigaben.yaml` bzw. `freigaben-regelwerte.yaml` übernehmen
   (`python3 docs/freigabe-katalog/anwenden.py`, Kontrolle `--pruefen`). Nie eine Freigabe „auffrischen“.
4. **Bündeln:** `pnpm turbo run build`, dann `node apps/mobile/werkzeuge/katalog-buendel.mjs`; Tests
   (`pnpm --filter @amtlos/mobile test`, rules-engine), einchecken.
5. **Freigabe-Tor:** `node apps/mobile/werkzeuge/inhalte-gate.mjs --kanal production` (bzw. `pnpm --filter
   @amtlos/mobile inhalte-gate`). Muss grün sein. Prüft: dieselben Katalog- und Vorlagen-Freigaben wie der Store-Check
   (`werkzeuge/freigabe-pruefungen.mjs`), Datenschutzhinweise freigegeben, Bündel aktuell, Aktualität (das Update zeigt
   nicht sofort „veraltet“; unter 30 Tagen bis dahin ein Hinweis), Datenschutzhinweis nennt den Update-Server, Arbeitsstand
   eingecheckt. Kanal `preview` (interne Testgeräte): Freigabe-Befunde nur als Hinweis.
6. **Ausliefern**
   - **Store-Release** (immer möglich, heute der einzige Weg): `node apps/mobile/werkzeuge/store-check.mjs`, dann
     `eas build --profile production` und `eas submit`. Pflicht bei jeder nativen Änderung (neue Bibliothek, Berechtigung,
     `app.json`/`app.config.ts`-Änderung mit nativer Wirkung, Expo-SDK).
   - **Inhalts-Update** (erst nach T-366/T-367 und einem Store-Build mit eingeschalteten Updates):
     `npx eas-cli update --channel production --environment production --message "Katalog, Rechtsstand TT.MM.JJJJ"`.
     Nur nach grünem Tor. Für `betatest` zuerst den Kanal `betatest` bespielen und auf einem Gerät prüfen
     (App zweimal starten: das Update gilt erst beim zweiten Start).
7. **Rückgängig:** die vorige Update-Gruppe auf dem Kanal erneut veröffentlichen (`eas update:republish`, siehe
   EAS-Dokumentation) – oder, solange kein Update aktiv ist, nichts tun: Geräte nutzen das eingebaute Bündel.

## Inhalts-Updates einschalten (später)

Voraussetzungen, in dieser Reihenfolge:

1. Gründerentscheidung zum Server (T-366): EAS Update (Expo, USA) oder eigener Server nach dem expo-updates-Protokoll
   beim eigenen Hoster (EU).
2. Datenschutzhinweise iPhone und Android ergänzen und vom Rechtsanwalt freigeben lassen (T-367; Formulierungsvorschlag
   dort). Danach Prüfsumme/Freigabe in `src/rechtliches.ts` wie bei E-201 nachtragen, Website-Datenschutzseite,
   App-Store-Datenschutzangaben und Play-Formular „Datensicherheit“ angleichen.
3. EAS-Projekt verknüpfen (`eas init` → `app.json extra.eas.projectId`; ohnehin offener Punkt im Store-Check) bzw.
   `INHALTS_UPDATES_URL` für den eigenen Server. Für einen eigenen Server Code-Signierung einrichten
   (`updates.codeSigningCertificate`, Schlüssel nicht im Repository).
4. In `eas.json` beim Profil `INHALTS_UPDATES: "1"` in `env` setzen, Store-Build erstellen. Erst Builds ab dann fragen
   nach Updates. Der Store-Check verlangt dann den Datenschutzhinweis zum Update-Server.

Technik (`app.config.ts → mitInhaltsUpdates`): `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0` – die App
wartet beim Start nie auf das Netz; ein Update wird im Hintergrund geladen und gilt erst beim nächsten Start, nie mitten
in der Sitzung. `runtimeVersion: { policy: "fingerprint" }` – ein Update erreicht nur Builds mit genau denselben nativen
Teilen (kein Absturz durch ein Update, das ein fehlendes natives Modul braucht; `eas update` mit derselben Umgebung wie
der Build ausführen, sonst passt der Fingerabdruck nicht und das Update erreicht niemanden). Ohne Flag:
`updates.enabled: false` – keine Verbindung zu einem Update-Server.

## Store-Regeln (Stand der Recherche 29.10.2026)

- **Apple:** Guideline 2.5.2 (sinngemäß: Apps dürfen keinen Code laden, der ihre Funktion ändert) und Developer Program
  License Agreement 3.3.1(B) (früher 3.3.2): heruntergeladener interpretierter Code ist erlaubt, solange er den
  Hauptzweck der App nicht ändert (keine Funktionen, die dem eingereichten und beworbenen Zweck widersprechen), keinen
  Store für anderen Code schafft und keine Sicherheitsfunktionen umgeht. Wortlaut der aktuellen Fassungen hier **nicht
  geprüft** (nur Sekundärquellen) – vor dem Einschalten im aktuellen Text nachlesen. Katalog- und Textkorrekturen
  ändern den Zweck nicht; neue Funktionen gehören in ein Store-Release mit Review.
- **Google Play** (Richtlinie „Device and Network Abuse“): Eine App darf sich nicht anders als über Google Play
  verändern, ersetzen oder aktualisieren; das gilt nicht für Code, der in einer virtuellen Maschine oder einem
  Interpreter mit nur mittelbarem Zugriff auf Android-APIs läuft (Beispiel JavaScript in einer WebView). React-Native-
  Bündel werden in der Praxis so behandelt; Regel wie bei Apple: nur Inhalte und Korrekturen.

## Alternative: signierte Katalog-Datei vom eigenen Server (bewertet, nicht umgesetzt)

Die App lädt `katalog.json` plus Signatur (Ed25519, öffentlicher Schlüssel in der App) vom eigenen Server, prüft
Signatur, Schema und Rechtsstand (nur neuer als eingebaut) und fällt sonst auf das eingebaute Bündel zurück.

- Vorteile: unabhängig von Expo, reine Daten (Store-rechtlich unkritisch), kleine Datei.
- Nachteile: erreicht nur den Katalog – Vorlagen, Texte, Freigabe-Vermerke (`geprueft.ts`, `pruefer.ts`) und Fehler im
  Code bleiben beim Store-Release; der Katalog wird heute an vielen Stellen synchron importiert (Check, Erinnerungen,
  Vermerke, Website) – Umbau auf einen austauschbaren Katalog wäre groß; eigene Kryptografie und Schlüsselverwaltung;
  Datenschutz wie beim eigenen Update-Server (Abruf mit IP-Adresse) – der Hinweis muss ebenfalls ergänzt werden.
- **Empfehlung:** expo-updates (vorbereitet) statt eigener Katalog-Datei. Server: kurzfristig EAS Update, wenn der
  Rechtsanwalt die Übermittlung an Expo (USA) mit tragfähiger Grundlage freigibt; sonst eigener Server nach dem
  expo-updates-Protokoll beim eigenen Hoster (keine Drittlandübermittlung, aber Betrieb und Code-Signierung selbst).
