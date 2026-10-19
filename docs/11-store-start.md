# 11 · Vom Code in den App Store (E-132)

Stand: 2026-10-19 (E-142 bis E-144). Alles, was im Code geht, ist erledigt. Was hier steht, braucht dein Apple-Konto, deine Firma oder eine fachliche Freigabe. `node apps/mobile/werkzeuge/store-check.mjs` zeigt jederzeit, was noch offen ist.

## 1. Firma und Konten (du)

1. **Rechtsform und Anschrift** festlegen. Ohne ladungsfähige Anschrift gibt es kein Impressum (§ 5 DDG) und keinen kostenpflichtigen App-Store-Eintrag.
2. **Apple Developer Program** als Organisation (D-U-N-S-Nummer nötig, beantragen dauert einige Tage). Im Anschluss das **Small Business Program** beantragen (15 % statt 30 % Provision; laut Recherche ab dem 2. Abojahr 10 %).
3. **Domain** sichern und Website (Landingpage unter `apps/website`) veröffentlichen. Darauf liegen Datenschutzerklärung und Support-Seite.
4. **RevenueCat**-Konto (kostenlos bis zu einem Monatsumsatz, danach umsatzabhängig – aktuelle Konditionen prüfen).
5. **Markenrecherche** „Amtlos“ (DPMA/EUIPO) – Status-Punkt 31.

## 2. Angaben eintragen (du, 15 Minuten)

- `apps/mobile/src/rechtliches.ts`: `ANBIETER` (Firma, Anschrift, Vertretung, E-Mail, optional Telefon, Register, USt-IdNr.) und `LINKS` (Website, Datenschutz-URL, Support-URL, später App-Store-Link).
- `apps/mobile/eas.json`: `ascAppId` und `appleTeamId` aus App Store Connect.

## 3. Abo einrichten

**App Store Connect → Abos**, Gruppe „Amtlos Pro“:

| Produkt-ID (Vorschlag) | Zeitraum | Einführungsangebot |
|---|---|---|
| `amtlos_pro_jahr` | 1 Jahr | 14 Tage kostenlos |
| `amtlos_pro_monat` | 1 Monat | 14 Tage kostenlos |

Die Preise wählst du in App Store Connect. Die App zeigt den Preis aus dem Store. Einen Vorschlag mit Begründung enthält der Go-to-Market-Plan.

**RevenueCat:** App anlegen (Bundle-ID `de.amtlos.app`), App-Store-Verbindung herstellen (In-App-Purchase-Schlüssel), Berechtigung **`pro`**, Offering **`default`** mit beiden Produkten (Jahr als erstes Paket). Den öffentlichen iOS-Schlüssel als EAS-Secret setzen:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                       # schreibt extra.eas.projectId in app.json
npx eas-cli secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --scope project
```

Ohne den Schlüssel lässt sich Pro in einer Store-Version **nicht kaufen** („noch nicht verfügbar“) – Apple würde die App dann ablehnen, weil sich das Abo nicht prüfen lässt. Pro testweise einschalten geht nur in Entwicklung, im Testpaket (Expo Go) und in Builds mit `EXPO_PUBLIC_PRO_TESTMODUS=1` (EAS-Profil `preview`, für TestFlight-Tester). Das Profil `production` setzt das nie (E-143).

## 4. Bauen und einreichen

```bash
cd apps/mobile
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production
```

Für Tests auf echten Geräten: `--profile preview` (interne Verteilung) oder TestFlight über `submit`. Dabei auch die Punkte prüfen, die nur auf dem Gerät sichtbar sind: PDF-Druck, Kalender, Face ID, iCloud, Kauf in der Sandbox und „Käufe wiederherstellen“.

## 5. Store-Eintrag

- **Texte:** `apps/mobile/store/de.json` (Name, Untertitel, Werbetext, Schlüsselwörter, Beschreibung, „Neu“, Hinweise für die App-Prüfung). Die Grenzen prüft ein Test.
- **Bilder:** echte Bildschirme mit Demo-Stand, 1290 × 2796, Reihenfolge und Überschriften aus `store/de.json` (`bilder`; optional `lupe` für einen vergrößerten Ausschnitt desselben Bildschirms, z. B. Summe und GiroCode der Rechnung):
  ```bash
  cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
  node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder            # schreibt auch apps/website/bilder (WEBSITE=0: nicht)
  DUNKEL=1 node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder   # dunkle Fassung
  ```
  Die endgültigen Bilder erst nach der fachlichen Freigabe (T-52) erzeugen: Bis dahin zeigt Bild 1 den echten Hinweis „fachlich noch nicht geprüft“.
- **Pro kennzeichnen:** Was nur mit Pro geht (E-Rechnung, Paket für die Steuerberatung, Übernahme per Tipp, iCloud-Sicherung, Briefkopf, Synchronisation), steht in Beschreibung, Bildtexten und Website mit „Pro“ (Richtlinie 2.3.2). Preise und Testzeitraum nennt kein Text – sie kommen aus dem Store.
- **„Neu in dieser Version“:** Für 1.0.0 der Text in `neu`; ab dem ersten Update die Änderungen.
- **Synchronisation:** Wird ein Build mit `EXPO_PUBLIC_API_URL` eingereicht, stimmen „ohne Konto, ohne Server“ in Store-Texten, Bild 6 und Website nicht mehr – vorher anpassen.
- **Kategorie:** Business (zweite: Finanzen). **Altersfreigabe:** 4+ (keine Inhalte, die eine höhere Einstufung brauchen; im Fragebogen bestätigen).
- **App Privacy („Datenschutz-Etiketten“):** Kein Tracking. Im Privacy Manifest (`app.json` → `ios.privacyManifests`) stehen seit E-143 Kaufhistorie, E-Mail-Adresse, Name und Benutzer-ID – mit der Identität verknüpft, Zweck „App-Funktionalität“. E-Mail, Name und Benutzer-ID fallen nur mit Synchronisation an; ohne sie genügt in App Store Connect die Kaufhistorie (verknüpft, weil RevenueCat Käufe einer Kennung zuordnet). Vor dem Absenden mit dem Datenschutzhinweis abgleichen (T-77, T-85).
- **Export-Compliance:** Die App verschlüsselt lokale Daten (AES-256-GCM). Ob die Ausnahme greift, ist **nicht** entschieden (T-77). Erst danach `ios.config.usesNonExemptEncryption` setzen.

## 6. Nach dem Start messen

- **RevenueCat-Dashboard:** Testzeiträume, Umwandlung in zahlende Kunden, MRR, Kündigungen, Rückerstattungen. Das sind die Zahlen für Investoren.
- **App Store Connect → Analysen:** Impressionen, Produktseitenaufrufe, Conversion, Downloads, Bindung (Tag 1/7/28).
- Die App sendet selbst **keine** Nutzungsdaten. Eigene Messung nur mit Einwilligung und eigenem Server, das ist ein eigenes Projekt (siehe Go-to-Market-Plan).

## 7. Synchronisation einschalten (E-134, optional)

Die App kann ohne Synchronisation veröffentlicht werden – dann zeigt sie nichts davon. Zum Einschalten:

1. **Server betreiben:** API (`apps/api`) mit Postgres, Migrationen bis 0019, `AUTH_MODUS=oidc`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `REVENUECAT_SECRET_KEY` (damit nur Pro synchronisiert). Hosting in der EU, AV-Vertrag (T-80).
2. **Anmeldedienst (Identity-Provider)** mit einer „Native App“ anlegen: PKCE, Weiterleitung `amtlos://anmeldung`, Scopes `openid profile email offline_access`; das Zugriffstoken muss die Zielgruppe `OIDC_AUDIENCE` tragen.
3. **Build-Variablen** (EAS-Secrets bzw. `eas.json` → `env`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID`, bei Bedarf `EXPO_PUBLIC_OIDC_AUDIENCE`.
4. **App Privacy und Privacy Manifest ergänzen:** E-Mail-Adresse und Benutzer-ID (mit Identität verknüpft, App-Funktionalität), Kaufhistorie dann ebenfalls verknüpft. Datenschutzhinweis: Abschnitt „Konto und Synchronisation“ erscheint automatisch – fachlich freigeben (T-80).
5. **App-Prüfung:** Apple verlangt bei Konten das Löschen in der App – vorhanden unter „Mein Betrieb → Auf mehreren Geräten → Konto löschen“. In den Hinweisen für die Prüfung ein Testkonto angeben.

## 8. Website (`apps/website`)

```bash
node apps/website/bauen.mjs            # → apps/website/dist (index, impressum, datenschutz, Bilder, Schriften, Favicon)
```

- **Kopf:** Alles in `seite.html` vor `<!-- /kopf -->` kommt in den `<head>`: Title, Description, Open Graph (Vorschaubild `bilder/og.jpg` aus `store-bilder.mjs`), Favicon (`favicon.svg` = App-Symbol, `apple-touch-icon.png` 180 px), strukturierte Daten (`SoftwareApplication`, ohne Preis und Bewertung).
- **`seite.json`:** `url` (z. B. `https://amtlos.de`) schaltet `canonical`, `og:url` und ein absolutes `og:image` ein; `appStoreId` (Ziffern aus App Store Connect) das Smart-App-Banner. Leer bleiben sie auskommentiert.
- **Impressum und Datenschutz** entstehen beim Bauen aus `apps/mobile/src/rechtliches.ts`. Fehlende Anbieterangaben stehen als „folgt vor dem Start“ da, der Datenschutzhinweis als „Entwurf“, solange `freigegeben: false`. Für den Abschnitt „Diese Website“ fehlen noch die Angaben zum Hosting (Server-Protokolle) – nach Wahl des Hosters ergänzen. Nicht veröffentlichen, bevor `ANBIETER` vollständig ist.
- **Schriften** liegen selbst gehostet in `schriften/` (Onest, wie App und App-Symbol; SIL Open Font License) – kein Abruf bei Google Fonts.
- **Bis zum Start** kein nachgebautes App-Store-Badge; danach das offizielle Badge von Apple mit Link zur App-Seite.

## 9. Vor dem Einreichen prüfen

```bash
cd apps/mobile && node werkzeuge/store-check.mjs      # listet, was noch fehlt (Exit 1, solange etwas offen ist)
```

Zusätzlich auf einem echten iPhone (TestFlight): PRUEFLISTE T-82 bis T-85 – Schrift, Statusleiste, Tab-Leiste, Wischgesten, Kauf in der Sandbox, „Käufe wiederherstellen“, Face ID, iCloud, PDF teilen und drucken.
