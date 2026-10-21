# 14 · Marke: sichtbarer Name an einer Stelle

Der Name, den Nutzer, App Store und Website sehen, steht **nur** in [`packages/marke/marke.json`](../packages/marke/marke.json).
Vorläufig heißt die App **Betriebsklar** (amtlos.de gehört einem anderen Dienst); der Name soll sich später mit wenig
Aufwand ändern lassen.

```json
{ "name": "Betriebsklar", "proName": "Betriebsklar Pro", "domain": "betriebsklar.de", "email": "hallo@betriebsklar.de", "technisch": { … } }
```

`@amtlos/marke` (`packages/marke/index.js`) liefert daraus `MARKE` (name, proName, domain, email, website, datenschutz,
hilfe) und `markeEinsetzen()` für Textdateien mit Platzhaltern `{{MARKE}}`, `{{MARKE_PRO}}`, `{{DOMAIN}}`, `{{EMAIL}}`,
`{{WEBSITE}}`. Das Paket hat keine Abhängigkeiten und keine Node-APIs – `@amtlos/fachlogik` darf es deshalb nutzen.

## Wer liest die Marke

| Stelle | Wie |
|---|---|
| App-Name auf dem Home-Bildschirm (`CFBundleDisplayName`), Berechtigungstexte | `apps/mobile/app.config.ts` (`mitMarke`) setzt `name` und ersetzt `{{MARKE}}` in `app.json` |
| App-Texte, Rechtstexte, Datenschutzhinweis, Links (Website, Datenschutz, Hilfe), Kontakt-E-Mail | `MARKE.*` in `src/texte.ts`, `src/rechtliches.ts` und allen anderen Quellen |
| PDFs, ZIP-Pakete, LIESMICH, DATEV-Kopf, Kontrollmappe, Verfahrensdoku („Abläufe in …“) | `MARKE.name` in `apps/mobile/src/unterlagen/*` und `packages/fachlogik` |
| Dateinamen von Sicherung, Archiv, Steuerpaket | `MARKE.name`-Präfix (Endung `.amtlos` bleibt) |
| Pflichten-Katalog in der App | `werkzeuge/katalog-buendel.mjs` ersetzt „Amtlos“ der redaktionellen Katalogtexte durch `MARKE.name` |
| Check-Fragen und Web-Texte | `packages/i18n` (`MARKE.name`) |
| Store-Texte | `apps/mobile/store/de.json` nur mit Platzhaltern; `store-check.mjs`, `store-bilder.mjs` und `test/store.test.ts` setzen ein |
| Website | `apps/website/seite.html` mit Platzhaltern, `bauen.mjs` setzt in jede Seite ein (Titel, OG, JSON-LD) und bricht bei Resten ab |
| Testpaket | `werkzeuge/testpaket.sh` (LIESMICH, app.json) |
| Web, Studio, API, Worker, Server | Seitentitel, Manifest, E-Mails, Push-Texte, PDF-Producer, Absender |

`apps/mobile/test/marke.test.ts` sucht in allen Zeichenketten der App, von Fachlogik und i18n, in Store-Texten,
`app.json`, Website und allen Vorlagen nach einem fest geschriebenen Namen (alt oder aktuell) und rendert Texte,
Rechtstexte, Sicherungsname, Verfahrensdoku und Store-Texte probeweise mit einem anderen Namen.

## Name ändern – Checkliste

1. `packages/marke/marke.json`: `name`, `proName`, `domain`, `email` anpassen (nicht `technisch`, siehe unten).
2. Store-Name prüfen: `{{MARKE}}: Pflichten-Check` muss ≤ 30 Zeichen bleiben (`store/de.json` → `name` ggf. kürzen).
3. Bauen und prüfen:
   ```sh
   pnpm build                                        # fachlogik/dist mit neuem Namen
   cd apps/mobile
   node werkzeuge/katalog-buendel.mjs                # Katalog fürs Gerät
   npx vitest run test/marke.test.ts test/store.test.ts
   node werkzeuge/store-check.mjs                    # Längen; --texte gibt die fertigen Store-Texte aus
   CI=1 npx expo export --platform web --output-dir /tmp/expo-web --clear
   node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder   # Store- und Website-Bilder (og.jpg)
   cd ../.. && node apps/website/bauen.mjs --entwurf # Website
   ```
4. Dokumente von Hand nachziehen (Markdown, keine Platzhalter): `docs/12`, `docs/13`, `docs/pruefmappe-anwalt/`,
   `docs/nutzungsbedingungen-entwurf.md` – `grep -rn "<alter Name>" docs apps packages`.
5. Außerhalb des Repos: App Store Connect (Name, Untertitel, Texte aus `store-check.mjs --texte`, Bilder), Domain und
   E-Mail-Postfach, RevenueCat-Anzeigename des Abos, Website-Hosting.

## Was **nicht** mit der Marke geändert wird

Diese Kennungen bleiben „amtlos“ – eine Änderung nach dem ersten Store-Release kostet Testern und Kunden Daten, Käufe
oder Links:

- Bundle-ID `de.amtlos.app`, Android-Paket, URL-Schema `amtlos://` (Anmeldung, Partner-Links), iCloud-Container
  `iCloud.de.amtlos.app` – stehen zur Übersicht unter `technisch` in `marke.json`, maßgeblich bleibt `app.json`; der
  Test prüft, dass beide übereinstimmen. **Nur vor dem ersten Store-Release ändern.**
- Speicherschlüssel (`amtlos.unterlagen.v1`, `amtlos.sync.*`, `amtlos.datei.*`), Schlüsselbund-Namen
  (`amtlos.schluessel.v1`), Dateiformate und Kennungen (`amtlos-sicherung`, `amtlos-tresor`, `amtlos-schluessel`),
  Dateiendung `.amtlos`, iCloud-Ordner `/Amtlos` (die App findet vorhandene Sicherungen dort; Aufräumen und Lesen
  akzeptieren Dateinamen mit jedem Präfix, also auch „Amtlos-Sicherung-…“).
- Paketnamen `@amtlos/*`, Sync-API-Pfade, Datenbank- und Rollennamen, Umgebungsvariablen, RevenueCat-IDs
  (`amtlos_pro_jahr` …), Schema-IDs (`https://amtlos.de/schemas/…`), ICS-`PRODID`, User-Agent des Online-Checks,
  Schriftfamilien „Amtlos Sans/Serif“ in den PDFs.
- Redaktioneller Katalog (`catalog/`): Texte sind versioniert und geprüft und nennen weiter „Amtlos“; die App bekommt
  sie über `katalog-buendel.mjs` mit dem sichtbaren Namen. Server und Web zeigen Katalogtexte noch unverändert – vor
  einem Web-Start dort ebenfalls einsetzen (Änderung der YAML-Texte bräuchte neue Versionen und Freigaben).
- Historie (`ENTSCHEIDUNGEN.md`, `docs/testberichte`, `docs/review`) bleibt, wie sie war.
