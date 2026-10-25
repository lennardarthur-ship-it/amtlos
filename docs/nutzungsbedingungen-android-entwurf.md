# Nutzungsbedingungen – was für die Android-App fehlt (E-190)

> **ENTWURF – NICHT FREIGEGEBEN, keine neuen Rechtstexte.** Vorzulegen bei RA Dr. Weber (PRUEFLISTE T-178). Die
> Fassung zur Freigabe (`docs/nutzungsbedingungen-entwurf.md`, Fassung vom 23.10.2026) ist für den Vertrieb über Apples
> App Store geschrieben und bleibt unverändert. Diese Liste nennt nur die Stellen, die für den Vertrieb über Google Play
> nicht passen, und was die App technisch tut – den Wortlaut für Android formuliert der Anwalt.

## Was die App bis zur Freigabe tut

- iPhone: wie bisher – Link „Nutzungsbedingungen“ auf Apples Standard-Lizenzvertrag (`LINKS.nutzung`).
- Android: **kein** Link auf Nutzungsbedingungen (Apples Standard-Lizenzvertrag gilt bei Google Play nicht, und Google
  Play hat keinen eigenen Standard-Lizenzvertrag für Apps). `nutzungsLink()` liefert dort eine leere Adresse; Bezahlschirm
  und „Über Betriebsklar“ blenden die Zeile aus. Sobald die eigenen Bedingungen (mit Android-Teil) freigegeben sind
  (`NUTZUNGSBEDINGUNGEN.freigegeben: true`), verlinken beide Apps dieselbe Seite auf der Website.
- Ob Google Play für ein Abo einen Link auf Nutzungsbedingungen verlangt (wie Apple in Richtlinie 3.1.2): nicht
  geprüft – bitte vor dem Einreichen klären (T-178).

## Stellen in der Fassung zur Freigabe, die Apple voraussetzen

| Ziffer | Inhalt (gekürzt) | Was für Android fehlt bzw. nicht passt |
|---|---|---|
| 1.3 | Bedingungen mit uns, nicht mit Apple; Apple nicht verantwortlich | Entsprechung für Google nötig? (Apples Vorgaben für Lizenzverträge verlangen diese Sätze; ob Google Vergleichbares verlangt, ist offen) |
| 3.1 | Nutzungsrecht „auf Apple-Geräten … im Rahmen der Nutzungsregeln des App Store … Familienfreigabe“ | Android-Geräte, Google-Play-Regeln, Mediathek-Freigabe von Google Play (ob für Abos aktiviert – Produktentscheidung) |
| 3.4 | Wartung und Support leisten wir, nicht Apple | ggf. ohne Apple-Bezug allgemein fassen |
| 4.2 | Abo über den Apple-Account; Kündigung in den Einstellungen des Apple-Accounts | Abo über das Google-Konto bei Google Play; Kündigung in Google Play unter „Zahlungen und Abos“ › „Abos“ (so steht es in der App) |
| 4.3 | Kauf mit Apple; Widerrufsbelehrung durch Apple | Wer bei Google Play Vertragspartner ist und belehrt – nicht von uns geprüft |
| 4.4 | Partner-Codes im App Store einlösen | Google Play: Codes im Play Store einlösen (die App hat dort kein Einlöseblatt) |
| 5.4 | RevenueCat verarbeitet Kaufbelege von Apple | … bzw. von Google Play |
| 6.1 | Für Käufe und Updates den App Store | bzw. Google Play |
| 6.2 | Anpassung „an neue Versionen von iOS oder an Vorgaben von Apple“ | Android, Vorgaben von Google |
| 6.3 | Erstattung nach § 327r BGB „über Apple (reportaproblem.apple.com)“ | Erstattungsweg bei Google Play – nicht von uns geprüft |
| 11 | Apple als Drittbegünstigter, Gewährleistung über Apple | gilt nur für den App Store – für Google Play entfällt der Abschnitt oder bekommt eine eigene Fassung |
| 12.2 | Sicherungen in iCloud Drive: Bedingungen von Apple | Android: automatische Sicherung in einen selbst gewählten Ordner (Gerät, Google Drive, Nextcloud …) – es gelten die Bedingungen des jeweiligen Anbieters |

## Technische Fakten für den Android-Teil (aus dem Code)

- Kauf: Google Play Billing über RevenueCat (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`), Berechtigung „pro“, dieselben
  Produkt-IDs wie auf iOS vorgesehen (`amtlos_pro_jahr`, `amtlos_pro_monat`), kostenlose Testphase als Angebot in der
  Play Console.
- Käufe gelten je Plattform (Apple-Account bzw. Google-Konto); plattformübergreifend nur mit Konto und Synchronisation.
- „Käufe wiederherstellen“ gibt es auf beiden Plattformen; „Code einlösen“ in der App nur auf dem iPhone.
- Automatische Sicherung auf Android: Speicherzugriffs-Framework, dauerhafte Berechtigung nur für den gewählten Ordner,
  keine Anmeldung in der App.
