# Amtlos – mobile App (Expo)

React Native mit Expo SDK 54, geteilte Texte aus `@amtlos/i18n` (Deutsch/Englisch), dieselbe API wie die Web-App (E-108).

**Funktionen:** Heute und offene Pflichten, Stempeln (auch offline, mit Übertragung über `client_id`), Belege fotografieren,
Push-Erinnerungen, Unternehmen und Sprache wählen. Alles Weitere (Erledigen mit Nachweis, Formulare) läuft am Computer.

```bash
pnpm --filter @amtlos/mobile start          # Expo Dev Server (Expo Go oder Development Build)
pnpm --filter @amtlos/mobile test           # Kernlogik: API-Client, Offline-Warteschlange, Zeit
pnpm --filter @amtlos/mobile typecheck
cd apps/mobile && npx expo export --platform android   # Bündel prüfen (läuft in CI)
```

**Konfiguration** (`app.json` → `expo.extra`): `apiUrl`, `authModus` (`dev` = Anmeldung mit Kennung über
`POST /v1/dev/token`, nur wenn die API mit `AUTH_MODUS=dev` läuft; `oidc` = Identity-Provider mit PKCE),
`oidcIssuer`, `oidcClientId`, `eas.projectId` (für Push-Tokens).

**Offen vor Store-Veröffentlichung:** Identity-Provider (Zitadel, E-061), EAS-Projekt und Signierschlüssel,
Push-Anbieter und AVV (T-41), Store-Texte und Datenschutzangaben, Tests auf echten Geräten (VoiceOver/TalkBack).
