# 11 · Vom Code in den App Store und zu Google Play (E-132, E-190)

Stand: 2026-10-25 (E-142 bis E-144, App-Review-Vorprüfung R9; Android E-190 → §10). Alles, was im Code geht, ist erledigt. Was hier steht, braucht dein Apple-Konto, dein Google-Play-Konto, deine Firma oder eine fachliche Freigabe. `node apps/mobile/werkzeuge/store-check.mjs` zeigt jederzeit, was noch offen ist (`--ios` bzw. `--android` für einen Store).

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
| `amtlos_pro_jahr` | 1 Jahr | 14 Tage kostenlos (Einführungsangebot „Kostenloser Testzeitraum“, 2 Wochen) |
| `amtlos_pro_monat` | 1 Monat | 14 Tage kostenlos (Einführungsangebot „Kostenloser Testzeitraum“, 2 Wochen) |

**Preise (E-156, Gründerentscheidung):** Monatsabo **9,99 €** als Einstieg; Jahresabo in der Spanne **79–99 €** – Apple bietet dafür u. a. die Preispunkte 79,99 €, 89,99 € und 99,99 €. Begründung: Der Nutzen sind vermiedene Bußgelder und Abmahnungen, nicht Bequemlichkeit. Zum Vergleich: 12 × 9,99 € = 119,88 €; das Jahresabo spart damit 17 % (99,99 €), 25 % (89,99 €) oder 33 % (79,99 €). Die App rechnet die Ersparnis selbst aus den Store-Preisen aus und zeigt nie einen Betrag aus dem Code. Preise wählst du in App Store Connect unter „Abopreise“ mit Basisland Deutschland; die übrigen Länder rechnet Apple um.

**Nach 60 Tagen prüfen:** Umwandlung Testzeitraum → zahlend, Anteil Jahr/Monat, Kündigungen in den ersten 30 Tagen und Rückerstattungen (RevenueCat). Faustregel für die Entscheidung: Wandeln deutlich weniger Testzeiträume um als erwartet, liegt es eher am Nutzen der Probezeit als am Preis; kündigen viele Monatsabos nach dem ersten Monat, das Jahresabo stärker hervorheben. Preisänderungen gelten für Bestandskunden nur nach Apples Regeln (Erhöhung mit Zustimmung bzw. Benachrichtigung) – neue Preise am besten zuerst nur für Neukunden.

**RevenueCat:** App anlegen (Bundle-ID `de.amtlos.app`), App-Store-Verbindung herstellen (In-App-Purchase-Schlüssel), Berechtigung **`pro`**, Offering **`default`** mit beiden Produkten (Jahr als erstes Paket). Den öffentlichen iOS-Schlüssel als EAS-Secret setzen:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                       # schreibt extra.eas.projectId in app.json
npx eas-cli env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --visibility sensitive
npx eas-cli env:exec production "node werkzeuge/store-check.mjs"   # Store-Check mit den Variablen der Umgebung „production“
```

Hinweis für ältere EAS-CLI-Versionen (vor den Umgebungsvariablen): `npx eas-cli secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --scope project`.

`store-check.mjs` prüft standardmäßig das Profil `production` und meldet einen fehlenden Schlüssel als offen (`--profile preview` prüft ein anderes Profil). Ohne Schlüssel zeigt ein Store-Build **keinen** Kaufknopf und keinen Einstieg in den Bezahlschirm unter „Mein Betrieb“ – nie „Pro testweise einschalten“ (App-Review B2).

Ohne den Schlüssel lässt sich Pro in einer Store-Version **nicht kaufen** – Apple würde die App dann ablehnen, weil sich das Abo nicht prüfen lässt. Pro testweise einschalten geht nur in Entwicklung, im Testpaket (Expo Go) und in Builds mit `EXPO_PUBLIC_PRO_TESTMODUS=1` (EAS-Profil `preview`, für TestFlight-Tester). Das Profil `production` setzt das nie (E-143).

**Mit dieser Version einreichen:** Beide Abos (`amtlos_pro_jahr`, `amtlos_pro_monat`) mit Review-Screenshot und Beschreibung an die App-Version hängen (das erste Abo muss zusammen mit einer Version geprüft werden). Paid Applications Agreement, Bank- und Steuerdaten müssen aktiv sein – sonst lädt die App keine Angebote („Die Angebote ließen sich nicht laden“) und Apple lehnt nach 2.1(b) ab.

**Testzeitraum und Preis (App-Review R2/R3):** Die App zeigt den kostenlosen Testzeitraum nur, wenn RevenueCat das Apple-Konto als berechtigt meldet (`checkTrialOrIntroductoryPriceEligibility`); unbekannt oder nicht berechtigt → nur der Preis. Direkt über dem Kaufknopf steht gleich groß „14 Tage kostenlos, danach 89,99 € pro Jahr“ – Zeitraum und Betrag kommen aus dem Store (`priceString`), nie aus dem Code.

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
  Die fachliche Freigabe (T-52) ist erledigt (25.10.2026) – die endgültigen Bilder jetzt neu erzeugen, damit Bild 1 den Prüfvermerk statt des alten Hinweises zeigt.
  Die Bestätigungen der Prüfer kamen per Mail; die Mails liegen beim Gründer, nicht im Repository (E-198). Für Rückfragen von Apple oder Google zum Prüfvermerk: Register `docs/freigabe-katalog/freigaben.yaml` und `packages/fachlogik/src/dokumente/geprueft.ts` (je Freigabe Art, Datum, Rolle und Umfang der Bestätigung) – die Mails selbst zeigt nur der Gründer.
- **Pro kennzeichnen:** Seit E-188 („Modell Check-Teaser“) ist ohne Abo nur der Pflichten-Check kostenlos – alle Fragen, die Zahl der Pflichten und die ersten 3 mit Termin und Abhaken; alles Weitere (Rechnungen, E-Rechnung, Belege, Kasse, alle Pflichten mit Erinnerungen, Paket für die Steuerberatung, Vorlagen ausfüllen und als PDF, Kontrollmappe, Pflicht-Details, Briefkopf, iCloud, Synchronisation) steht in Beschreibung, Bildtexten und Website mit „Pro“ (Richtlinie 2.3.2), die kostenlose Testphase wird genannt. Eigene Daten bleiben ohne Abo zugänglich (ansehen, erneut teilen, stornieren, Belege und Kassenbuch exportieren, Sicherung, Datenexport, Löschen). Kein Text verspricht „kostenlos ohne Limit“ (`store-check.mjs` prüft das). Preise und Testzeitraum nennt kein Text – sie kommen aus dem Store.
- **Bezahlschirm nach dem ersten Pflichten-Check (E-188):** öffnet sich einmal von selbst über dem Ergebnis (Überschrift „N Pflichten kommen für dich in Frage“ (E-189), mit Testzeitraum, falls berechtigt) und schließt mit „Später“; danach bei jeder gesperrten Handlung. Die Prüfhinweise sagen Apple ausdrücklich, dass die meisten Funktionen nur mit Testphase bzw. Sandbox-Kauf zu prüfen sind, und was ohne Abo sichtbar ist. Die Store-Bilder folgen seit E-189 dem Pflichten-Kompass: 1 Pflichten, 2 „Heute“ (Hast du alles erledigt?), 3 Pflicht mit Quelle, 4 Vorlagen, 5 Kontrollmappe, 6 Rechnung (als Zugabe).
- **„Neu in dieser Version“:** Für 1.0.0 der Text in `neu`; ab dem ersten Update die Änderungen.
- **Synchronisation:** Wird ein Build mit `EXPO_PUBLIC_API_URL` eingereicht, stimmen „ohne Konto, ohne Server“ in Store-Texten, Bild 6 und Website nicht mehr – vorher anpassen.
- **Kategorie:** Business (zweite: Finanzen). **Altersfreigabe:** 4+ (keine Inhalte, die eine höhere Einstufung brauchen; im Fragebogen bestätigen).
- **App Privacy („Datenschutz-Etiketten“):** Kein Tracking. Im Privacy Manifest (`app.json` → `ios.privacyManifests`) steht die Kaufhistorie (RevenueCat) – mit der Identität verknüpft, Zwecke **App-Funktionalität und Analysen** (RevenueCat-Dashboard, wie von RevenueCat verlangt). E-Mail-Adresse, Name und Benutzer-ID fallen nur mit Synchronisation an: `app.config.ts` ergänzt sie im Manifest nur, wenn `EXPO_PUBLIC_API_URL` gesetzt ist. In App Store Connect für einen Build ohne Sync also nur „Käufe → Kaufhistorie“ (App-Funktionalität + Analysen, verknüpft, kein Tracking) angeben. Vor dem Absenden mit dem Datenschutzhinweis abgleichen (T-77, T-85).
- **Export-Compliance:** Die App verschlüsselt selbst mit Standardverfahren, die nicht aus iOS stammen (AES-256-GCM, PBKDF2-SHA256 über `@noble/ciphers`/`@noble/hashes`). Deshalb steht in `app.json` `ios.config.usesNonExemptEncryption: true` (Apples Ausnahme gilt nur für Verschlüsselung des Betriebssystems). In App Store Connect angeben: „Standard encryption algorithms instead of, or in addition to, using or accessing the encryption within Apple's operating system“. **Frankreich:** Dafür verlangt Apple die französische Verschlüsselungserklärung (ANSSI). Entweder sie hochladen oder Frankreich bis dahin aus der Verfügbarkeit nehmen – **Entscheidung des Gründers bzw. rechtlich zu klären (T-77), nicht im Code entschieden.** Nach Apples Freigabe den erhaltenen Code als `ITSEncryptionExportComplianceCode` in `ios.infoPlist` eintragen. Die Gegenposition „keine meldepflichtige Verschlüsselung“ (EAR Kat. 5 Teil 2, Note 4) ginge nur mit anwaltlicher Einstufung. Ohne Frankreich in den Hinweisen für die Prüfung den Satz zur hochgeladenen Export-Dokumentation streichen.

## 6. Nach dem Start messen

- **RevenueCat-Dashboard:** Testzeiträume, Umwandlung in zahlende Kunden, MRR, Kündigungen, Rückerstattungen. Das sind die Zahlen für Investoren.
- **App Store Connect → Analysen:** Impressionen, Produktseitenaufrufe, Conversion, Downloads, Bindung (Tag 1/7/28).
- Die App sendet selbst **keine** Nutzungsdaten. Eigene Messung nur mit Einwilligung und eigenem Server, das ist ein eigenes Projekt (siehe Go-to-Market-Plan).

## 7. Synchronisation einschalten (E-134, optional)

Die App kann ohne Synchronisation veröffentlicht werden – dann zeigt sie nichts davon. Zum Einschalten:

1. **Server betreiben:** API (`apps/api`) mit Postgres, Migrationen bis 0019, `AUTH_MODUS=oidc`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `REVENUECAT_SECRET_KEY` (damit nur Pro synchronisiert). Hosting in der EU, AV-Vertrag (T-80).
2. **Anmeldedienst (Identity-Provider)** mit einer „Native App“ anlegen: PKCE, Weiterleitung `amtlos://anmeldung`, Scopes `openid profile email offline_access`; das Zugriffstoken muss die Zielgruppe `OIDC_AUDIENCE` tragen.
3. **Build-Variablen** (EAS-Secrets bzw. `eas.json` → `env`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID`, bei Bedarf `EXPO_PUBLIC_OIDC_AUDIENCE`.
4. **App Privacy ergänzen:** E-Mail-Adresse, Name (falls Server oder Anmeldedienst ihn speichert) und Benutzer-ID (mit Identität verknüpft, App-Funktionalität), Kaufhistorie dann an die Konto-ID gebunden. Das Privacy Manifest ergänzt `app.config.ts` automatisch, sobald `EXPO_PUBLIC_API_URL` gesetzt ist. Datenschutzhinweis: Abschnitt „Konto und Synchronisation“ erscheint automatisch – fachlich freigeben (T-80).
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

## 10. Google Play (Android, E-190)

Die Android-App ist dieselbe App in gleicher Qualität: gleiche Funktionen, gleiche Daten- und Sicherungsformate,
Texte je Plattform („Smartphone“, „Google-Konto“, „Fingerabdruck oder Gesichtserkennung“ statt „iPhone“, „Apple-Account“,
„Face ID“). Unterschiede: automatische Sicherung in einen selbst gewählten Ordner statt iCloud, Kauf über Google Play,
kein „Code einlösen“ in der App, Kalender als Android-Dialog. **Käufe gelten je Plattform** – ein Abo aus dem App Store
gilt nicht bei Google Play und umgekehrt (kein Konto; plattformübergreifend erst mit Konto und Synchronisation, §7).

### 10.1 Konto (du)

1. **Google-Play-Entwicklerkonto als Organisation** der UG anlegen – nach der Eintragung ins Handelsregister, mit
   **D-U-N-S-Nummer** (dieselbe wie für Apple, §1). Als Organisationskonto gilt die Pflicht privater Konten zu einem
   geschlossenen Test mit 12 Testern über 14 Tage nicht (Gründerentscheidung E-190, PRUEFLISTE T-176). Einmalige
   Gebühr und Identitätsprüfung laut Play Console.
2. **App anlegen:** Paketname `de.amtlos.app` (steht fest, nach dem ersten Upload nicht mehr änderbar), Standardsprache
   Deutsch, App (nicht Spiel), kostenlos mit In-App-Käufen.
3. **Play-App-Signatur** annehmen (Google verwaltet den App-Signaturschlüssel; EAS erzeugt und verwaltet den
   Upload-Schlüssel beim ersten `eas build -p android`).
4. **Dienstkonto für `eas submit`:** Google Cloud → Dienstkonto mit JSON-Schlüssel, in der Play Console unter
   „Nutzer und Berechtigungen“ einladen (Rechte: Releases verwalten). Schlüssel nach
   `apps/mobile/geheim/google-play-dienstkonto.json` legen – der Ordner ist in `.gitignore`, nie einchecken. Pfad steht in
   `eas.json` → `submit.production.android.serviceAccountKeyPath`. Hinweis: Den **allerersten** Upload verlangt Google von
   Hand in der Play Console (AAB hochladen) – danach geht `eas submit`.

### 10.2 Abo bei Google Play und RevenueCat

- **Play Console → Monetarisieren → Abos:** Produkte `amtlos_pro_jahr` und `amtlos_pro_monat` (gleiche IDs wie bei
  Apple), je ein Basis-Abo (jährlich bzw. monatlich, automatisch verlängernd) und ein **Angebot „kostenlose Testphase“**
  (14 Tage, Berechtigung „Neukunden“). Preise mit Basisland Deutschland wie in §3 (E-156) – die App zeigt nur, was der
  Store liefert.
- **RevenueCat:** in demselben Projekt eine **Google-Play-App** (`de.amtlos.app`) anlegen, das Dienstkonto aus 10.1 mit
  den Rechten für Finanzdaten und Abos verbinden (Anleitung von RevenueCat; Echtzeit-Benachrichtigungen über Google
  Cloud Pub/Sub einschalten), beide Produkte der Berechtigung **`pro`** zuordnen und in das Offering **`default`**
  legen (Jahr zuerst). Den öffentlichen Android-Schlüssel (beginnt mit `goog_`) als EAS-Variable setzen:

  ```bash
  cd apps/mobile
  npx eas-cli env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_xxx --visibility sensitive
  npx eas-cli env:exec production "node werkzeuge/store-check.mjs --android"
  ```

  Ohne diesen Schlüssel zeigt der Android-Build keinen Kaufknopf und keinen Einstieg in den Bezahlschirm (wie auf iOS).
- **Lizenztests:** Play Console → Einstellungen → Lizenztests: deine Google-Konten und das der Prüfung eintragen – Käufe
  laufen dann ohne Belastung, Abos verlängern sich im Minutentakt.
- **Testphase in der App:** Android zeigt die kostenlose Phase, wenn Google sie im Standardangebot liefert (Google bietet
  sie nur berechtigten Konten an); eine Berechtigungsabfrage wie bei Apple gibt es dort nicht (`src/pro/storeRegeln.ts`).

### 10.3 Bauen, testen, einreichen

```bash
cd apps/mobile
npx eas-cli build -p android --profile preview      # APK zum direkten Installieren (Testmodus für Pro an)
npx eas-cli build -p android --profile production   # AAB für Google Play
npx eas-cli submit -p android --profile production  # in den internen Test („internal“, als Entwurf)
```

Danach in der Play Console: **interner Test** an die eigenen Tester verteilen und auf echten Geräten prüfen (PRUEFLISTE
T-180): Kauf und „Käufe wiederherstellen“ mit Lizenztester, Zurück-Taste/-Geste in Blättern und Abläufen, Tastatur
über Feldern, Kalender, Kamera, PDF teilen und drucken, Benachrichtigungen (Android 13+ fragt), App-Sperre mit
Fingerabdruck, automatische Sicherung in einen Google-Drive- und einen lokalen Ordner samt Wiederherstellen auf einem
zweiten Gerät, Symbol (auch „Designfarben“/Monochrom ab Android 13), Startbild, randlose Darstellung mit Gesten- und
Drei-Tasten-Navigation. Dann Release in „Produktion“ (gestaffelt, z. B. 20 %).

### 10.4 Store-Eintrag

- **Texte:** `apps/mobile/store/de-android.json` – Titel (≤ 30), Kurzbeschreibung (≤ 80), Beschreibung (≤ 4.000),
  „Neu in dieser Version“ (≤ 500), Kategorie „Business“. Grenzen prüft `test/store-android.test.ts`;
  `node werkzeuge/store-check.mjs --android` zeigt sie mit eingesetzter Marke. Positionierung wie im App Store (E-189:
  Pflichten-Kompass vorn, Rechnungen/Belege/Kasse als Zugabe; E-188: Pflichten-Check kostenlos ausprobieren, alles
  Weitere mit Pro und kostenloser Testphase, Pro-Funktionen gekennzeichnet).
- **Bilder:** Smartphone-Screenshots 1080 × 1920 (Statusleiste im Android-Stil), Vorstellungsgrafik 1024 × 500,
  Symbol 512 × 512 (32 Bit):
  ```bash
  cd apps/mobile && EXPO_PUBLIC_VORSCHAU_PLATTFORM=android CI=1 npx expo export --platform web --output-dir /tmp/expo-web-android
  PLAY=1 node werkzeuge/store-bilder.mjs /tmp/expo-web-android /tmp/play-bilder
  ```
- **Datensicherheit:** Antworten in `docs/play-datensicherheit.md` (nur aus dem Code; Punkte mit „[prüfen]“ vorher
  bestätigen, T-179). Danach in `store/de-android.json` → `konsole.datensicherheitAbgesendet: true`.
- **Datenschutzerklärung:** Google verlangt eine öffentliche URL, die die Android-App beschreibt. Der Android-Teil ist
  ein Entwurf (`DATENSCHUTZ_ANDROID`, `docs/datenschutz-android-entwurf.md`) – erst nach der Freigabe durch Rechtsanwalt
  (T-177) erscheint er auf `datenschutz.html`. Nutzungsbedingungen mit Android-Teil: T-178.
- **Inhaltseinstufung (IARC), Zielgruppe (18+), Werbung (keine), App-Zugriff (Hinweise für die Prüfung, Lizenztester),
  Erklärung zu Finanzfunktionen:** Vorschläge in `store/de-android.json` und `docs/play-datensicherheit.md`; nach dem
  Absenden die Häkchen in `store/de-android.json` → `konsole` setzen.
- **Kontakt:** E-Mail und Website aus der Marke; die Adresse des Entwicklers zeigt Google bei Organisationskonten mit
  Käufen öffentlich an (Angabe in der Play Console).

### 10.5 Technik der Android-Fassung (zum Nachschlagen)

- `app.json` → `android`: Paket `de.amtlos.app`, `versionCode` (EAS zählt im Profil `production` hoch), adaptives Symbol
  mit Monochrom-Fassung (`assets/adaptive-icon-monochrome.png` für Designfarben), `allowBackup: false` (der Schlüssel im
  Android-Schlüsselspeicher wandert nicht mit – eine zurückgespielte Gerätesicherung wäre unlesbar), nur nötige
  Berechtigungen (Internet, Kamera, Biometrie, Benachrichtigungen, Neustart für Erinnerungen, Vibration); gesperrt:
  Medien-/Speicherzugriff, Mikrofon, exakte Wecker, Überlagern, Bildschirmfoto-Erkennung – damit braucht es keine
  Erklärungen zu Foto-/Video-Berechtigungen oder exakten Weckern. Randlos (edge-to-edge) ist ab SDK 54 immer an.
- `expo-system-ui` setzt `userInterfaceStyle: light` auch auf Android durch (E-172: kein Dunkelmodus) – Rückfragen und Kalender bleiben hell.
- Bei eingeschalteter App-Sperre setzt die App auf Android `FLAG_SECURE` (expo-screen-capture): keine Vorschau in der
  App-Übersicht, keine Bildschirmfotos.
- Teilen: Android meldet nicht, ob geteilt oder abgebrochen wurde. Eine Sicherungsdatei bzw. das offene Archiv zählt
  deshalb erst nach „Ja, gespeichert“ als Sicherung. Rechnungen werden nach dem Teilen festgeschrieben (wie bisher –
  lieber einmal zu früh festgeschrieben als eine geteilte Rechnung, die sich noch ändern ließe).
