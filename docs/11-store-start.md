# 11 · Vom Code in den App Store (E-132)

Stand: 2026-10-13. Alles, was im Code geht, ist erledigt. Was hier steht, braucht dein Apple-Konto, deine Firma oder eine fachliche Freigabe. `node apps/mobile/werkzeuge/store-check.mjs` zeigt jederzeit, was noch offen ist.

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

Ohne den Schlüssel läuft jede Version im **Testmodus**. Dort lässt sich Pro testweise einschalten, und es gibt keine Käufe. So bleibt das Testpaket für Expo Go nutzbar.

## 4. Bauen und einreichen

```bash
cd apps/mobile
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production
```

Für Tests auf echten Geräten: `--profile preview` (interne Verteilung) oder TestFlight über `submit`. Dabei auch die Punkte prüfen, die nur auf dem Gerät sichtbar sind: PDF-Druck, Kalender, Face ID, iCloud, Kauf in der Sandbox und „Käufe wiederherstellen“.

## 5. Store-Eintrag

- **Texte:** `apps/mobile/store/de.json` (Name, Untertitel, Werbetext, Schlüsselwörter, Beschreibung, „Neu“, Hinweise für die App-Prüfung). Die Grenzen prüft ein Test.
- **Bilder:** echte Bildschirme mit Demo-Stand, 1290 × 2796:
  ```bash
  cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
  node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder
  ```
- **Kategorie:** Business (zweite: Finanzen). **Altersfreigabe:** 4+ (keine Inhalte, die eine höhere Einstufung brauchen; im Fragebogen bestätigen).
- **App Privacy („Datenschutz-Etiketten“):** Der Code erhebt keine Daten auf eigenen Servern und nutzt kein Tracking. Über RevenueCat wird die **Kaufhistorie** verarbeitet: nicht mit der Identität verknüpft, kein Tracking, Zweck „App-Funktionalität“. So steht es auch im Privacy Manifest (`app.json` → `ios.privacyManifests`). Vor dem Absenden mit dem Datenschutzhinweis abgleichen (T-77).
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
