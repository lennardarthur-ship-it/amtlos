# Google Play – Formular „Datensicherheit“ (E-190)

Antworten für die Play Console (App-Inhalte → Datensicherheit) – **nur aus dem Code**, für den Build **ohne
Synchronisation** (`EXPO_PUBLIC_API_URL` leer, so wie die App zuerst erscheint). Kurzfassung maschinenlesbar in
`apps/mobile/store/de-android.json` → `datensicherheit`. Punkte mit **[prüfen]** vor dem Absenden bestätigen
(PRUEFLISTE T-179); danach `konsole.datensicherheitAbgesendet: true` setzen (`werkzeuge/store-check.mjs` meldet es sonst).

Stand des Codes: E-190 (25.10.2026). Bei jeder neuen Bibliothek, die Daten sendet, und vor jedem Release neu abgleichen.

## Was die App überhaupt sendet

| Empfänger | Wann | Was | Quelle im Code |
|---|---|---|---|
| RevenueCat, Inc. (USA, Auftragsverarbeiter) | nur in Builds mit `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; beim Start (Abo-Status), beim Öffnen des Bezahlschirms, beim Kauf und „Käufe wiederherstellen“ | zufällige App-Kennung (anonyme App-User-ID von RevenueCat), Kaufbelege/Kauf-Token von Google Play, Abo-Status | `src/pro/kauf.ts` (`Purchases.configure`, `getCustomerInfo`, `getOfferings`, `purchasePackage`, `restorePurchases`) |
| Google Play (eigener Verantwortlicher) | beim Kauf | Abwicklung des Kaufs durch Google Play Billing – nicht vom Entwickler zu erklären | über RevenueCat |
| Ordner, den der Nutzer wählt (Gerät, Google Drive, Nextcloud …) | nur mit eingeschalteter „Automatisch in einen Ordner sichern“ (Pro) | mit dem Passwort des Nutzers verschlüsselte `.amtlos`-Dateien | `src/unterlagen/cloud.android.ts` |
| an wen der Nutzer teilt | nur auf ausdrücklichen Tipp („PDF teilen“, „Daten sichern“ …) | PDFs, E-Rechnungen, Pakete, Sicherungsdateien – über das Teilen-Menü von Android | `src/unterlagen/teilen.ts`, `sicherungDatei.ts` |

Sonst nichts: keine eigenen Server (ohne Sync), keine Analyse- oder Absturz-Dienste, keine Werbung, keine Werbe-ID,
keine Push-Dienste (Erinnerungen sind lokale Benachrichtigungen, `src/pflichten/erinnerungen.ts`), kein Standort.

## Antworten

**Erhebt oder teilt deine App erforderliche Nutzerdatentypen?** Ja (wegen RevenueCat).

**Werden alle erhobenen Nutzerdaten bei der Übertragung verschlüsselt?** Ja (HTTPS zu RevenueCat).

**Wie können Nutzer die Löschung ihrer Daten beantragen?** Kein Konto im Build ohne Synchronisation. Die Daten zur
App-Kennung bei RevenueCat löschen wir auf Anfrage (Kontakt im Datenschutzhinweis; Löschung über die RevenueCat-API,
`docs/12-phase1-recht-store.md`). Daten auf dem Gerät löscht der Nutzer selbst („Alle Daten löschen“ bzw. App entfernen).
[prüfen] Ob Google ohne Konto trotzdem eine Lösch-URL verlangt; mit Synchronisation ja – dann „Konto löschen“ in der
App und eine Web-Seite zum Beantragen angeben.

### Erhobene Daten

| Kategorie → Datentyp | Erhoben | Geteilt | Verarbeitung | Erforderlich/optional | Zwecke |
|---|---|---|---|---|---|
| Finanzdaten → Kaufverlauf | ja (RevenueCat) | nein – RevenueCat ist Auftragsverarbeiter (Google zählt Dienstleister, die im Auftrag verarbeiten, nicht als „Teilen“) | nicht nur vorübergehend | erforderlich für Pro (ohne Pro wird nur der Abo-Status abgefragt) | App-Funktionen, Analysen (Kennzahlen im RevenueCat-Dashboard – wie im Privacy Manifest der iPhone-App) |
| Geräte- oder andere IDs | ja (RevenueCat: zufällige App-Kennung) **[prüfen]** | nein | nicht nur vorübergehend | erforderlich | App-Funktionen |

[prüfen] Geräte- oder andere IDs: RevenueCat legt eine zufällige, anonyme App-User-ID an (keine Werbe-ID, keine
Android-ID durch unseren Code). Ob sie als „Geräte- oder andere IDs“ anzugeben ist, mit der aktuellen
Datensicherheits-Anleitung von RevenueCat abgleichen; ebenso, ob das SDK Diagnosedaten sendet (dann „App-Informationen
und -Leistung“).

### Nicht erhoben (bleibt verschlüsselt auf dem Gerät oder wird gar nicht verarbeitet)

Standort · Personenbezogene Daten (Name, E-Mail, Adresse, Telefon, Steuer-ID … von Betrieb, Mitarbeitern, Kunden) ·
Finanzdaten außer Kaufverlauf (IBAN, Rechnungen, Belege, Kasse) · Gesundheit und Fitness · Nachrichten · Fotos und
Videos (Belegfotos) · Audio · Dateien und Dokumente · Kalender · Kontakte · App-Aktivitäten · Web-Browsing ·
App-Informationen und -Leistung · Geräte-IDs außer der RevenueCat-Kennung.

Begründung: Google zählt Daten, die nur auf dem Gerät verarbeitet werden, nicht als „erhoben“. Die automatische
Sicherung legt verschlüsselte Dateien dort ab, wohin der Nutzer sie selbst über die Ordnerauswahl von Android legt –
[prüfen] ob das als vom Nutzer veranlasste Übertragung gilt (nach unserem Verständnis kein Erheben durch uns; die Inhalte
sind mit dem Passwort des Nutzers verschlüsselt, wir haben keinen Zugriff).

### Sicherheit

- Verschlüsselung bei der Übertragung: ja.
- Daten auf dem Gerät: AES-256-GCM, Schlüssel im Android-Schlüsselspeicher; keine Gerätesicherung durch Android
  (`allowBackup: false`) – kein Formularfeld, aber für die Beschreibung.
- Unabhängige Sicherheitsprüfung (MASA): nein.

## Nur mit Synchronisation (späterer Build mit `EXPO_PUBLIC_API_URL`)

Zusätzlich anzugeben: Personenbezogene Daten → E-Mail-Adresse, Name (Anmeldedienst), Nutzer-IDs (Konto-Kennung) – App-
Funktionen, Kontoverwaltung; Dateien und Dokumente – Ende-zu-Ende-verschlüsselt auf dem Server [prüfen: ob Inhalte, die
wir nicht lesen können, anzugeben sind]. Löschung: „Konto löschen“ in der App plus Web-Seite. Datenschutzhinweis-Zusatz
(T-80) vorher freigeben.

## Übrige Angaben in der Play Console (Gründer)

- **Werbung:** enthält keine Werbung.
- **App-Zugriff:** Hinweise aus `store/de-android.json` → `app_zugriff`; Lizenztester (Play Console → Lizenztests)
  eintragen, damit die Prüfung das Abo ohne Kosten abschließen kann.
- **Inhaltseinstufung (IARC):** Kategorie „Dienstprogramm, Produktivität, Kommunikation oder Sonstiges“; keine Gewalt,
  Sexualität, Drogen, Glücksspiel, kein Austausch zwischen Nutzern, kein Standort; digitale Käufe ja. Erwartet USK 0 /
  PEGI 3 – vergibt der Fragebogen.
- **Zielgruppe:** 18 Jahre und älter; nicht für Kinder; keine Inhalte, die Kinder ansprechen.
- **Erklärung zu Finanzfunktionen:** [prüfen] Die App erstellt Rechnungen, führt ein Kassenbuch und bereitet Werte für
  die Steuer vor, bietet aber keine Bank-, Zahlungs-, Kredit- oder Anlagedienste. Welche Auswahl in der Play Console
  passt, vor dem Absenden klären.
- **Gesundheits-Apps-Erklärung:** nicht zutreffend.
- **Behörden-App:** nein (die App ist kein Angebot einer Behörde).
- **Nachrichten-App:** nein.
