# Datenschutzhinweis der Android-App – Entwurf zur Freigabe (E-190)

> **ENTWURF – NICHT FREIGEGEBEN.** Vorzulegen bei RA Dr. Weber (PRUEFLISTE T-177). Der freigegebene Datenschutzhinweis
> der iPhone-App (`DATENSCHUTZ` in `apps/mobile/src/rechtliches.ts`, Freigabe 23.10.2026, Prüfsumme 892aa8818e0e) bleibt
> **unverändert** und gilt weiter nur für das iPhone. Die Android-Fassung steht im Code als `DATENSCHUTZ_ANDROID`
> (`freigegeben: false`): Die Android-App zeigt sie mit dem Vermerk „Entwurf – dieser Hinweis ist fachlich noch nicht
> freigegeben“, `werkzeuge/store-check.mjs` meldet sie als offen, und die Website zeigt sie erst nach der Freigabe.

## Vorgehen

Der Entwurf übernimmt Aufbau und Wortlaut des freigegebenen iPhone-Textes Abschnitt für Abschnitt und ändert nur, was
die Android-App **technisch anders macht** (Stand des Codes, Commit dieses Entwurfs). Neue rechtliche Aussagen sind
nicht erfunden; wo eine Einordnung aus dem iPhone-Text übertragen wurde, steht unten eine Frage.

## Was die Android-App technisch anders macht

| Thema | iPhone (freigegeben) | Android (Code) |
|---|---|---|
| Schlüssel der lokalen Verschlüsselung | Schlüsselbund (expo-secure-store, nur dieses Gerät) | Android-Schlüsselspeicher (expo-secure-store auf Android Keystore) |
| Gerätesicherung durch das Betriebssystem | iCloud-Backup des iPhones nimmt den Schlüssel nicht mit | `allowBackup: false` in `app.json` – die Gerätesicherung von Android (Google) nimmt die Daten der App gar nicht mit |
| Automatische Sicherung | iCloud Drive (Apple), Ordner „Amtlos“ im App-Container | ein Ordner, den der Nutzer einmal über die Ordnerauswahl von Android wählt (Speicherzugriffs-Framework): auf dem Gerät, Google Drive, Nextcloud o. a.; die App erhält nur Zugriff auf diesen Ordner; keine Anmeldung bei Google in der App; Dateien wie auf dem iPhone mit dem Passwort verschlüsselt (`.amtlos`) |
| Kauf von Pro | App Store, Apple-Account | Google Play, Google-Konto (Google Play Billing über RevenueCat) |
| RevenueCat erhält | zufällige App-Kennung, Kaufbelege von Apple | zufällige App-Kennung, Kaufbelege von Google Play (Kauf-Token) |
| Erinnerungen | lokale Mitteilungen | lokale Benachrichtigungen (Kanal „Fristen“), kein Push-Dienst, kein Server |
| Bildschirmfotos | möglich | bei eingeschalteter App-Sperre gesperrt (FLAG_SECURE) – keine Daten, nur Hinweis zur Vollständigkeit |

## Abschnitt für Abschnitt (geänderte Stellen)

| Abschnitt | iPhone (freigegeben) | Android (Entwurf) |
|---|---|---|
| Kurz gesagt | „… nur auf deinem iPhone …“ | „… nur auf deinem Smartphone …“ – sonst gleich |
| Was auf dem iPhone/Smartphone liegt | „… der Schlüssel liegt im Schlüsselbund dieses iPhones.“ | „… der Schlüssel liegt im Android-Schlüsselspeicher dieses Smartphones. Die Gerätesicherung von Android nimmt diese Daten nicht mit.“ |
| Sicherungen | „… (z. B. Dateien, iCloud Drive). Die automatische iCloud-Sicherung legt dieselbe verschlüsselte Datei in deinem iCloud Drive ab. Für iCloud ist Apple eigener Verantwortlicher; es gelten die Datenschutzbestimmungen von Apple.“ | „… Du entscheidest, wo du sie ablegst. Die automatische Sicherung legt dieselbe verschlüsselte Datei in einem Ordner ab, den du einmal über die Ordnerauswahl von Android wählst (z. B. auf dem Smartphone, in Google Drive oder Nextcloud); Betriebsklar erhält dabei nur Zugriff auf diesen Ordner. Liegt der Ordner bei einem Cloud-Anbieter, ist dieser für die Speicherung eigener Verantwortlicher; es gelten seine Datenschutzbestimmungen.“ |
| Erinnerungen | „… plant das iPhone selbst als lokale Mitteilungen …“ | „… plant das Smartphone selbst als lokale Benachrichtigungen …“ |
| Betriebsklar Pro | „Käufe laufen über deinen Apple-Account; für App Store und Bezahlung ist Apple eigener Verantwortlicher. … Kaufbelege von Apple …“ | „Käufe laufen über dein Google-Konto bei Google Play; für Google Play und die Bezahlung ist Google eigener Verantwortlicher. … Kaufbelege von Google Play …“ |
| Rechtsgrundlagen | „… (Schlüsselbund, Einstellungen) … Sicherung in iCloud Drive nur, wenn du sie einschaltest.“ | „… (Schlüsselspeicher, Einstellungen) … Automatische Sicherung in einen Ordner nur, wenn du sie einschaltest.“ |
| Empfänger und Drittland | „Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher.“ | „Google ist für Google Play und Käufe eigener Verantwortlicher, für einen Cloud-Ordner der Anbieter, den du wählst.“ |
| Speicherdauer | „… Erstattungen und Rückbuchungen über Apple.“ | „… Erstattungen und Rückbuchungen über Google Play.“ |
| Keine automatisierte Entscheidung, Was du teilst | „iPhone“ | „Smartphone“ |
| Musst du Daten angeben?, Deine Rechte | – | unverändert |

Der vollständige Text steht in `apps/mobile/src/rechtliches.ts` → `DATENSCHUTZ_ANDROID` (die App zeigt ihn auf Android
unter „Mein Betrieb → Datenschutz“). Der Sync-Zusatz (nur Builds mit Server, auch auf dem iPhone nicht freigegeben)
wird auf Android nur in den Gerätewörtern und „Google statt Apple“ angepasst.

## Fragen an RA Dr. Weber

1. **Google als eigener Verantwortlicher** für Google Play und die Bezahlung – übertragbar wie bei Apple? Wer beim Kauf
   über Google Play Vertragspartner ist, ergibt sich aus den aktuellen Nutzungsbedingungen von Google Play – von uns
   nicht nachgelesen, bitte prüfen.
2. **Anbieter des Sicherungsordners** (Google Drive, Nextcloud, Dropbox …) als eigener Verantwortlicher – der Nutzer
   wählt den Anbieter selbst, die App übergibt nur die verschlüsselte Datei an die Ordnerauswahl des Systems. Reicht die
   allgemeine Formulierung, oder müssen Anbieter genannt werden? Ist es überhaupt eine Übermittlung durch uns?
3. **RevenueCat und Google-Kaufbelege**: Ändert sich am Auftragsverarbeitungsvertrag (DPA) und an den
   Standardvertragsklauseln etwas, wenn RevenueCat statt Apple-Belegen Kauf-Token von Google Play verarbeitet? (RevenueCat
   braucht dafür ein Dienstkonto in unserer Play Console.)
4. **§ 25 TDDDG**: unverändert (Android-Schlüsselspeicher, SharedPreferences/AsyncStorage) – bitte bestätigen.
5. **Website**: Soll `datenschutz.html` beide Apps in einem Dokument beschreiben (so vorbereitet: Abschnitt „Die
   Android-App“ erscheint nach der Freigabe) oder je Store eine eigene Seite?
6. **Nutzungsbedingungen**: siehe `docs/nutzungsbedingungen-android-entwurf.md` (T-178).

## Nach der Freigabe

`DATENSCHUTZ_ANDROID.freigegeben` auf `true`, Freigabevermerk mit Datum und Prüfsumme als Kommentar wie beim iPhone-Text,
PRUEFLISTE T-177 erledigen, Website neu bauen (`node apps/website/bauen.mjs`), Datenschutz-URL in der Play Console
eintragen.
