# Amtlos – mobile App (Expo)

React Native mit Expo SDK 54, geteilte Texte aus `@amtlos/i18n` (Deutsch/Englisch), dieselbe API wie die Web-App (E-108).

Zuerst für iPhone gebaut (E-117): Fristblatt, SF Symbols, Tableiste mit Unschärfe, Erledigt-Stempel mit Haptik.

**Funktionen:** Schnellstart und Nachfragen, Heute mit einer klaren nächsten Handlung, Pflichten nach Fälligkeit gruppiert,
Pflicht-Karte mit Erledigen, Stempeln (auch offline, mit Übertragung über `client_id`), Belege fotografieren,
Push-Erinnerungen, Unternehmen und Sprache wählen. Angaben ändern, Nachweise, Formulare und Abo laufen am Computer.

```bash
pnpm --filter @amtlos/mobile start          # Expo Dev Server (Expo Go oder Development Build)
pnpm --filter @amtlos/mobile test           # Kernlogik: API-Client, Offline-Warteschlange, Zeit
pnpm --filter @amtlos/mobile typecheck
cd apps/mobile && npx expo export --platform ios       # Bündel prüfen (CI: android)
cd apps/web && node ../mobile/e2e/schau.mjs <web-export> <bilder> <kennung>   # Bildschirmfotos über den Web-Export, siehe Kopf der Datei
```

**Konfiguration** (`app.json` → `expo.extra`): `apiUrl`, `authModus` (`dev` = Anmeldung mit Kennung über
`POST /v1/dev/token`, nur wenn die API mit `AUTH_MODUS=dev` läuft; `oidc` = Identity-Provider mit PKCE),
`oidcIssuer`, `oidcClientId`, `eas.projectId` (für Push-Tokens).

**Offen vor Store-Veröffentlichung:** Identity-Provider (Zitadel, E-061), EAS-Projekt und Signierschlüssel,
Push-Anbieter und AVV (T-41), Store-Regeln zum Abo-Hinweis (T-49), Store-Texte und Datenschutzangaben, Tests auf echten Geräten (VoiceOver/TalkBack).
