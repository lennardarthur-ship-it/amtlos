# Testhinweis für den Betatest

Stand 27.10.2026 (E-234). Wortlaut vom Rechtsanwalt vorgeschlagen (Antwort auf Frage R5, 27.10.2026; Mail beim Gründer).
Eine ausführliche Testvereinbarung ist nicht nötig – der Hinweis muss aber **vor dem Test in Textform angenommen** werden:
in der Testversion mit „Ich nehme teil“ oder per Antwort auf die E-Mail. Ohne Annahme ist z. B. die Vertraulichkeit
nicht vereinbart.

In der App steht derselbe Text (`apps/mobile/src/betatest.ts`, Seite `BetatestTor`): nur in Betatest-Builds (EAS-Profil
`betatest`), beim ersten Start vor jeder Nutzung; der Zeitpunkt von „Ich nehme teil“ bleibt im Schlüsselbund des Geräts.
Den Testzeitraum vor dem Bauen in `apps/mobile/eas.json` → `build.betatest.env` eintragen
(`EXPO_PUBLIC_BETATEST_VON`, `EXPO_PUBLIC_BETATEST_BIS`, JJJJ-MM-TT). Ohne gültigen Zeitraum sperrt die Testversion, und
`node werkzeuge/store-check.mjs --profile betatest` meldet ihn als offen. Neuer Zeitraum ⇒ neue Annahme.

## Fassung in der App

> **Testhinweis Betriebsklar (Betatest)**
>
> 1. Lang Ventures UG (haftungsbeschränkt) i. G., Gomaringer Str. 33, 72770 Reutlingen, stellt dir eine Testversion der App Betriebsklar vom [Datum] bis zum [Datum] kostenlos zur Verfügung.
> 2. Die Testversion kann Fehler enthalten. Betriebsklar gibt allgemeine Informationen und ist keine Rechts- oder Steuerberatung. Richte die Einhaltung deiner Pflichten und Fristen nicht allein nach der Testversion, und lege Sicherungen deiner Daten an.
> 3. Wir haften nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.
> 4. Bitte gib die Testversion nicht weiter und veröffentliche keine Inhalte oder Bildschirmfotos daraus ohne unsere Zustimmung.
> 5. Deine Rückmeldungen helfen uns. Wir dürfen sie frei verwenden, um Betriebsklar zu verbessern.
> 6. Deine Angaben in der App bleiben verschlüsselt auf deinem Gerät; wir sehen sie nicht. Für den Test verarbeiten wir nur deinen Namen, deine E-Mail-Adresse und deine Rückmeldungen (Art. 6 Abs. 1 lit. b DSGVO) und löschen sie spätestens drei Monate nach Ende des Tests. *[nur bei TestFlight:]* Apple erhebt über TestFlight eigene Daten; dafür gelten die Bedingungen von Apple. Kontakt und deine Rechte: hallo@betriebsklar.de.
>
> Mit „Ich nehme teil“ bestätigst du diesen Hinweis.

Die App setzt die Daten des Testzeitraums ein und nimmt den TestFlight-Satz nur auf dem iPhone auf (TestFlight); Anbieter,
Anschrift und E-Mail kommen aus `ANBIETER` (`apps/mobile/src/rechtliches.ts`), der Name aus der Marke.

## Fassung per E-Mail (APK bzw. TestFlight-Einladung)

Betreff: Betatest Betriebsklar – bitte vor dem Start bestätigen

> Hallo [Vorname],
>
> danke, dass du Betriebsklar testest. Bevor es losgeht, bitte diesen kurzen Testhinweis lesen und mit einer Antwort auf diese E-Mail bestätigen (z. B. „Ich nehme teil“).
>
> **Testhinweis Betriebsklar (Betatest)**
>
> 1. Lang Ventures UG (haftungsbeschränkt) i. G., Gomaringer Str. 33, 72770 Reutlingen, stellt dir eine Testversion der App Betriebsklar vom [Datum] bis zum [Datum] kostenlos zur Verfügung.
> 2. Die Testversion kann Fehler enthalten. Betriebsklar gibt allgemeine Informationen und ist keine Rechts- oder Steuerberatung. Richte die Einhaltung deiner Pflichten und Fristen nicht allein nach der Testversion, und lege Sicherungen deiner Daten an.
> 3. Wir haften nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.
> 4. Bitte gib die Testversion nicht weiter und veröffentliche keine Inhalte oder Bildschirmfotos daraus ohne unsere Zustimmung.
> 5. Deine Rückmeldungen helfen uns. Wir dürfen sie frei verwenden, um Betriebsklar zu verbessern.
> 6. Deine Angaben in der App bleiben verschlüsselt auf deinem Gerät; wir sehen sie nicht. Für den Test verarbeiten wir nur deinen Namen, deine E-Mail-Adresse und deine Rückmeldungen (Art. 6 Abs. 1 lit. b DSGVO) und löschen sie spätestens drei Monate nach Ende des Tests. *[nur bei TestFlight:]* Apple erhebt über TestFlight eigene Daten; dafür gelten die Bedingungen von Apple. Kontakt und deine Rechte: hallo@betriebsklar.de.
>
> Mit deiner Antwort auf diese E-Mail bestätigst du diesen Hinweis.
>
> Viele Grüße
> [Name]

Erst nach der bestätigenden Antwort die APK bzw. die TestFlight-Einladung schicken. Die Antworten aufbewahren (sie sind der
Nachweis der Annahme) und mit den übrigen Testdaten spätestens drei Monate nach Testende löschen.

## Hinweise für den Gründer (Rechtsanwalt, 27.10.2026)

- **Persönliche Haftung vor der Eintragung:** Bis zur Eintragung handelt die UG i. G.; wer in ihrem Namen handelt, haftet
  persönlich (§ 11 Abs. 2 GmbHG). Bei einem kostenlosen Test ist das Risiko gering.
- **Daten Dritter in Rückmeldungen:** Schicken Testpersonen Bildschirmfotos oder Texte mit Daten Dritter (Kunden,
  Beschäftigte), diese Daten löschen – sie gehören nicht zum Test.
- **Datenschutz:** nur Name, E-Mail-Adresse und Rückmeldungen; spätestens drei Monate nach Testende löschen (Ziffer 6).
